import { addDays, toISODate } from "./dates";
import type { SessionStatus } from "./types";

/** Nombre maximal de séances créées en une seule fois (athlètes × dates). */
export const MAX_BATCH_SESSIONS = 120;

/**
 * Demi-largeur de la fenêtre chargée d'emblée par la vue planning, en jours.
 *
 * Douze semaines de part et d'autre, et non huit : depuis que la vue affiche
 * un **mois** entier (#143), deux coups de flèche suffisaient à sortir des
 * huit semaines, si bien que la navigation ordinaire attendait le serveur
 * presque à chaque pas — l'inverse de ce que la fenêtre existe pour éviter.
 * Douze semaines couvrent le mois affiché et les deux de part et d'autre.
 */
export const FENETRE_PLANNING_JOURS = 84;

/** Période couverte par les données déjà chargées. */
export type FenetreDates = { debut: string; fin: string };

export function fenetreAutour(
  now = new Date(),
  jours = FENETRE_PLANNING_JOURS
): FenetreDates {
  return {
    debut: toISODate(addDays(now, -jours)),
    fin: toISODate(addDays(now, jours)),
  };
}

/**
 * Ce qu'il manque pour afficher la période demandée, ou `null` si elle est
 * déjà couverte.
 *
 * Sans cela, la vue affirmait qu'un jour était vide alors qu'elle n'avait
 * simplement jamais demandé ses séances — indistinguable d'un jour libre
 * (#141). Le manque est rendu **par blocs d'une fenêtre entière** plutôt que
 * période par période : qui remonte de deux mois continue généralement, et
 * plusieurs requêtes valent moins qu'une seule un peu plus large.
 *
 * La période est donnée en dates et non en semaine : depuis #143 la vue
 * affiche un mois, dont la grille déborde des deux côtés.
 */
export function fenetreManquante(
  fenetre: FenetreDates,
  periode: FenetreDates,
  jours = FENETRE_PLANNING_JOURS
): FenetreDates | null {
  const { debut: debutSemaine, fin: finSemaine } = periode;

  if (debutSemaine < fenetre.debut) {
    return {
      debut: toISODate(addDays(new Date(`${fenetre.debut}T12:00:00`), -jours)),
      // Jusqu'à la veille de ce qu'on a déjà : les deux tranches se touchent
      // sans se recouvrir.
      fin: toISODate(addDays(new Date(`${fenetre.debut}T12:00:00`), -1)),
    };
  }
  if (finSemaine > fenetre.fin) {
    return {
      debut: toISODate(addDays(new Date(`${fenetre.fin}T12:00:00`), 1)),
      fin: toISODate(addDays(new Date(`${fenetre.fin}T12:00:00`), jours)),
    };
  }
  return null;
}

/** La fenêtre élargie à une tranche qu'on vient de charger. */
export function etendreFenetre(
  fenetre: FenetreDates,
  ajout: FenetreDates
): FenetreDates {
  return {
    debut: ajout.debut < fenetre.debut ? ajout.debut : fenetre.debut,
    fin: ajout.fin > fenetre.fin ? ajout.fin : fenetre.fin,
  };
}

export type CalendarDay = {
  iso: string;
  /** "L", "M", … — initiale du jour. */
  initial: string;
  dayOfMonth: number;
  isToday: boolean;
  /** Premier jour d'une semaine (lundi) : sert à découper la grille. */
  startsWeek: boolean;
};

/**
 * Grille de sélection des dates : à partir d'aujourd'hui, complétée jusqu'au
 * dimanche pour que les semaines soient entières et lisibles.
 */
export function planningCalendar(weeks = 3, now = new Date()): CalendarDay[] {
  const today = toISODate(now);
  // Recule jusqu'au lundi de la semaine en cours.
  const monday = addDays(now, -((now.getDay() + 6) % 7));
  const days: CalendarDay[] = [];

  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(monday, i);
    const iso = toISODate(date);
    if (iso < today) continue; // pas de planification dans le passé
    days.push({
      iso,
      initial: date.toLocaleDateString("fr-FR", { weekday: "narrow" }).toUpperCase(),
      dayOfMonth: date.getDate(),
      isToday: iso === today,
      startsWeek: date.getDay() === 1,
    });
  }
  return days;
}

/**
 * État d'une séance tel qu'il se lit dans un planning.
 *
 * `planned` en porte deux, que le statut SQL ne distingue pas : une séance
 * encore à faire et une séance dont le jour est passé sans compte rendu. La
 * seconde appelle une action de l'athlète, pas la première — d'où le même
 * vocabulaire que l'accueil (« À rattraper »), plutôt qu'un « À venir » qui
 * mentirait sur une séance d'hier.
 */
export type PlanningState = "fait" | "manquee" | "a-rattraper" | "a-venir";

export function planningState(
  session: { status: SessionStatus; date: string },
  now = new Date()
): PlanningState {
  if (session.status === "completed") return "fait";
  if (session.status === "missed") return "manquee";
  return session.date < toISODate(now) ? "a-rattraper" : "a-venir";
}

export const PLANNING_STATE_LABEL: Record<PlanningState, string> = {
  fait: "Fait",
  manquee: "Manquée",
  "a-rattraper": "À rattraper",
  "a-venir": "À venir",
};

/**
 * Une séance ne se déplace que tant qu'elle est encore une prescription.
 *
 * Déplacer une séance faite ou manquée réécrirait un compte rendu : l'athlète
 * a couru un jour donné, et ce jour-là ne se corrige pas d'un glissement de
 * doigt. C'est la même frontière que le trigger `enforce_session_ownership`
 * (migration 002), rappelée ici parce que le geste est trop facile pour
 * n'être retenu que par l'affichage.
 */
export function peutDeplacer(session: Pick<SessionRef, "status">): boolean {
  return session.status === "planned";
}

/**
 * Qui peut supprimer cette séance, et pourquoi.
 *
 * Miroir exact de la policy `sessions_delete` (migration 018). L'affichage ne
 * décide de rien — la base refuserait de toute façon — mais proposer un bouton
 * qui échoue est pire que ne pas le proposer.
 *
 * Deux cas, et un seul refus qui mérite d'être expliqué : un athlète devant la
 * prescription de son coach. Les autres n'ont pas de bouton du tout.
 */
export function peutSupprimer(
  session: { coach_id: string | null; athlete_id: string; status: SessionStatus },
  utilisateurId: string
): boolean {
  // L'athlète, sur sa séance libre : c'est son carnet.
  if (session.coach_id === null) return session.athlete_id === utilisateurId;
  // Le coach, sur sa prescription encore à venir. Une séance rapportée porte
  // le compte rendu de l'athlète, qu'il n'a pas à effacer.
  return session.coach_id === utilisateurId && session.status === "planned";
}

type SessionRef = { id: string; date: string; status: SessionStatus };

/**
 * Applique un déplacement à une liste de séances, sans la muter.
 *
 * Sert d'abord à l'affichage optimiste : la carte suit le doigt avant que le
 * serveur ait répondu. La règle ci-dessus est appliquée ici aussi, pour que
 * rien ne bouge à l'écran qui serait refusé à l'enregistrement — un retour en
 * arrière une seconde plus tard se lit comme un bug.
 */
export function appliquerDeplacement<T extends SessionRef>(
  sessions: T[],
  id: string,
  date: string
): T[] {
  return sessions.map((s) =>
    s.id === id && peutDeplacer(s) ? { ...s, date } : s
  );
}

/** "3 séances" / "1 séance" — accord automatique. */
export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count > 1 ? plural : singular}`;
}

/** Libellé du récapitulatif avant création. */
export function batchSummary(athletes: number, dates: number): string {
  const total = athletes * dates;
  if (total === 0) return "Choisis au moins un athlète et une date.";
  return `${pluralize(total, "séance")} — ${pluralize(athletes, "athlète")} × ${pluralize(dates, "date")}`;
}
