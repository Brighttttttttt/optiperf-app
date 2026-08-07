import { addDays, toISODate } from "./dates";
import type { SessionStatus } from "./types";

/** Nombre maximal de séances créées en une seule fois (athlètes × dates). */
export const MAX_BATCH_SESSIONS = 120;

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

/** Lundi de la semaine contenant `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7));
}

export type WeekDay = {
  iso: string;
  /** "lun.", "mar."… */
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
};

/** Les 7 jours de la semaine commençant au lundi donné. */
export function weekDays(monday: Date, now = new Date()): WeekDay[] {
  const today = toISODate(now);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const iso = toISODate(date);
    return {
      iso,
      label: date
        .toLocaleDateString("fr-FR", { weekday: "short" })
        .replace(".", ""),
      dayOfMonth: date.getDate(),
      isToday: iso === today,
      isPast: iso < today,
    };
  });
}

/** "Semaine du 3 au 9 août" — entête de la vue semaine. */
export function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const start = monday.toLocaleDateString("fr-FR", {
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
  });
  const end = sunday.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
  return `Semaine du ${start} au ${end}`;
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
