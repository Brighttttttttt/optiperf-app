const DAY_MS = 24 * 60 * 60 * 1000;

/** Date locale au format YYYY-MM-DD (sans décalage UTC). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

/** "lundi 4 août" — pour les entêtes de planning. */
export function formatDayLong(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "04/08" — pour les listes compactes. */
export function formatDayShort(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });
}

/** "Aujourd'hui", "Demain", "Hier" ou la date longue. */
export function formatDayRelative(iso: string, now = new Date()): string {
  const diff = Math.round(
    (new Date(`${iso}T12:00:00`).setHours(0, 0, 0, 0) -
      new Date(now).setHours(0, 0, 0, 0)) /
      DAY_MS
  );
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  return formatDayLong(iso);
}

/** "14:32" pour aujourd'hui, sinon "04/08". */
export function formatTimestamp(isoDateTime: string, now = new Date()): string {
  const d = new Date(isoDateTime);
  if (toISODate(d) === toISODate(now)) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

/** 95 → "1 h 35", 45 → "45 min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}
