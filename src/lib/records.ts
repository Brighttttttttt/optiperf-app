/** Records personnels sur les distances standard, et VMA. */

export const RECORD_DISTANCES = [
  { value: "5km", label: "5 km", km: 5 },
  { value: "10km", label: "10 km", km: 10 },
  { value: "semi", label: "Semi-marathon", km: 21.0975 },
  { value: "marathon", label: "Marathon", km: 42.195 },
] as const;

export type RecordDistanceValue = (typeof RECORD_DISTANCES)[number]["value"];

export const RECORD_DISTANCE_VALUES: string[] = RECORD_DISTANCES.map((d) => d.value);

export function recordDistanceLabel(d: string): string {
  return RECORD_DISTANCES.find((r) => r.value === d)?.label ?? d;
}

function recordDistanceKm(d: string): number | null {
  return RECORD_DISTANCES.find((r) => r.value === d)?.km ?? null;
}

/** "22:30" ou "1:32:10" → secondes. Accepte mm:ss et h:mm:ss. */
export function parseDurationInput(texte: string): number | null {
  const brut = texte.trim();
  const court = /^(\d{1,3}):([0-5]\d)$/.exec(brut);
  if (court) {
    const total = Number(court[1]) * 60 + Number(court[2]);
    return total > 0 ? total : null;
  }
  const long = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(brut);
  if (long) {
    const total = Number(long[1]) * 3600 + Number(long[2]) * 60 + Number(long[3]);
    return total > 0 ? total : null;
  }
  return null;
}

/** 5530 → "1:32:10" ; 1350 → "22:30" (sous l'heure, pas d'heure affichée). */
export function formatDurationInput(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h === 0) return `${m}:${String(s).padStart(2, "0")}`;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Pourcentage de VMA usuellement tenu sur la distance, décroissant avec la
 * durée de l'épreuve — repère de coaching courant, pas une mesure de
 * laboratoire. Sert uniquement à *suggérer* une VMA à partir d'un chrono :
 * l'athlète garde la main, la valeur reste éditable indépendamment.
 */
const PCT_VMA: Record<RecordDistanceValue, number> = {
  "5km": 0.93,
  "10km": 0.9,
  semi: 0.85,
  marathon: 0.8,
};

export function estimerVma(distance: string, dureeSec: number): number | null {
  const km = recordDistanceKm(distance);
  const pct = PCT_VMA[distance as RecordDistanceValue];
  if (km === null || !pct || dureeSec <= 0) return null;
  const vitesseKmh = km / (dureeSec / 3600);
  return Math.round((vitesseKmh / pct) * 10) / 10;
}
