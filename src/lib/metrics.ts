import type { TrainingSession } from "./types";
import { addDays, toISODate } from "./dates";

/** Charge d'une séance réalisée : RPE × durée (méthode session-RPE de Foster). */
export function sessionLoad(s: TrainingSession): number {
  if (s.status !== "completed") return 0;
  const duration = s.duration_actual_min ?? s.duration_planned_min ?? 0;
  return (s.rpe ?? 0) * duration;
}

export type FitnessStatus = "frais" | "normal" | "fatigue" | "inconnu";

export type AthleteMetrics = {
  /** Volume réalisé sur les 7 derniers jours, en minutes. */
  weeklyVolumeMin: number;
  /** % de séances planifiées effectivement complétées sur 28 jours (null si rien de planifié). */
  adherencePct: number | null;
  /** RPE moyen des séances complétées sur 7 jours (null si aucune). */
  avgRpe: number | null;
  /** Charge des 7 derniers jours (Σ RPE × durée). */
  weeklyLoad: number;
  /** État de forme basé sur le ratio charge aiguë (7 j) / charge chronique (28 j). */
  status: FitnessStatus;
};

export function computeMetrics(
  sessions: TrainingSession[],
  now = new Date()
): AthleteMetrics {
  const today = toISODate(now);
  const d7 = toISODate(addDays(now, -6));
  const d28 = toISODate(addDays(now, -27));

  const last7 = sessions.filter((s) => s.date >= d7 && s.date <= today);
  const last28 = sessions.filter((s) => s.date >= d28 && s.date <= today);

  const completed7 = last7.filter((s) => s.status === "completed");
  const weeklyVolumeMin = completed7.reduce(
    (sum, s) => sum + (s.duration_actual_min ?? s.duration_planned_min ?? 0),
    0
  );

  // Adhérence : séances planifiées par le coach (28 j, hors futur) → complétées.
  const plannedPast28 = last28.filter((s) => s.coach_id !== null);
  const adherencePct =
    plannedPast28.length === 0
      ? null
      : Math.round(
          (plannedPast28.filter((s) => s.status === "completed").length /
            plannedPast28.length) *
            100
        );

  const rpes = completed7.filter((s) => s.rpe !== null);
  const avgRpe =
    rpes.length === 0
      ? null
      : Math.round(
          (rpes.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / rpes.length) * 10
        ) / 10;

  const weeklyLoad = last7.reduce((sum, s) => sum + sessionLoad(s), 0);
  const chronicLoad = last28.reduce((sum, s) => sum + sessionLoad(s), 0) / 4;

  let status: FitnessStatus = "inconnu";
  if (chronicLoad > 0) {
    const acwr = weeklyLoad / chronicLoad;
    if (acwr < 0.8) status = "frais";
    else if (acwr <= 1.3) status = "normal";
    else status = "fatigue";
  }

  return { weeklyVolumeMin, adherencePct, avgRpe, weeklyLoad, status };
}

export type WeekPoint = {
  /** Lundi de la semaine, au format YYYY-MM-DD. */
  weekStart: string;
  /** "4 août" — pour l'axe et le tableau. */
  label: string;
  /** Σ RPE × durée des séances réalisées. */
  load: number;
  /** Moyenne de charge des 4 dernières semaines : la référence du ratio. */
  chronicLoad: number;
  volumeActualMin: number;
  volumePlannedMin: number;
  avgRpe: number | null;
  completed: number;
  planned: number;
};

/**
 * Charge et volume agrégés par semaine, du plus ancien au plus récent.
 * La dernière entrée est la semaine en cours.
 */
/** Une semaine agrégée, sans sa charge chronique — celle-ci dépend des voisines. */
function pointSemaine(
  sessions: TrainingSession[],
  startIso: string
): WeekPoint {
  const debut = new Date(`${startIso}T12:00:00Z`);
  const endIso = toISODate(addDays(debut, 6));
  const inWeek = sessions.filter((s) => s.date >= startIso && s.date <= endIso);
  const done = inWeek.filter((s) => s.status === "completed");
  const rpes = done.filter((s) => s.rpe !== null);

  return {
    weekStart: startIso,
    label: debut.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      timeZone: "Europe/Paris",
    }),
    load: inWeek.reduce((sum, s) => sum + sessionLoad(s), 0),
    chronicLoad: 0, // rempli une fois toutes les semaines connues
    volumeActualMin: done.reduce(
      (sum, s) => sum + (s.duration_actual_min ?? s.duration_planned_min ?? 0),
      0
    ),
    volumePlannedMin: inWeek
      .filter((s) => s.coach_id !== null)
      .reduce((sum, s) => sum + (s.duration_planned_min ?? 0), 0),
    avgRpe:
      rpes.length === 0
        ? null
        : Math.round(
            (rpes.reduce((sum, s) => sum + (s.rpe ?? 0), 0) / rpes.length) * 10
          ) / 10,
    completed: done.length,
    planned: inWeek.filter((s) => s.coach_id !== null).length,
  };
}

/** Charge chronique : moyenne glissante sur 4 semaines, celle-ci comprise. */
function avecChronique(points: WeekPoint[]): WeekPoint[] {
  return points.map((p, i) => {
    const window = points.slice(Math.max(0, i - 3), i + 1);
    return {
      ...p,
      chronicLoad:
        Math.round(window.reduce((sum, w) => sum + w.load, 0) / window.length),
    };
  });
}

/**
 * Les semaines d'un mois donné, pour la lecture mois par mois (#143).
 *
 * Les agrégats portent sur les 4 à 6 semaines que couvre la grille du mois — l'unité reste la semaine, parce que c'est celle de la
 * charge session-RPE de Foster ; une charge quotidienne serait trop bruitée
 * pour qu'on y lise quoi que ce soit.
 *
 * Les **trois semaines qui précèdent** sont calculées puis retirées : sans
 * elles, la charge chronique de la première semaine du mois serait la moyenne
 * d'elle-même, et le repère afficherait une montée de charge là où il n'y en
 * a pas. C'est le genre d'erreur qui produit un chiffre plausible.
 */
export function monthlyWeeklySeries(
  sessions: TrainingSession[],
  lundisDuMois: string[]
): WeekPoint[] {
  if (lundisDuMois.length === 0) return [];

  const premier = new Date(`${lundisDuMois[0]}T12:00:00Z`);
  const contexte = [3, 2, 1].map((i) => toISODate(addDays(premier, -7 * i)));
  const tous = [...contexte, ...lundisDuMois];

  return avecChronique(tous.map((l) => pointSemaine(sessions, l))).slice(
    contexte.length
  );
}

export const STATUS_LABELS: Record<FitnessStatus, string> = {
  frais: "Frais",
  normal: "Normal",
  fatigue: "Fatigué",
  inconnu: "—",
};
