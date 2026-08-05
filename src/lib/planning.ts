import { addDays, toISODate } from "./dates";

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
