/**
 * Blocs d'une séance running structurée (échauffement, intervalle,
 * récupération, retour au calme). Le texte libre `sessions.description`
 * reste le repli pour une séance simple.
 */

export const BLOCK_TYPES = [
  { value: "echauffement", label: "Échauffement" },
  { value: "intervalle", label: "Intervalle" },
  { value: "recuperation", label: "Récupération" },
  { value: "retour_calme", label: "Retour au calme" },
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number]["value"];

export function blockTypeLabel(type: string): string {
  return BLOCK_TYPES.find((t) => t.value === type)?.label ?? type;
}

/** Un bloc tel que manipulé côté formulaire, avant enregistrement. */
export type BlockDraft = {
  block_type: BlockType;
  duration_sec: number | null;
  distance_m: number | null;
  target_pace_sec_per_km: number | null;
  repetitions: number | null;
};

/** "4:30" → 270. Format unique attendu : minutes, deux-points, secondes sur deux chiffres. */
export function parsePaceInput(texte: string): number | null {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(texte.trim());
  if (!m) return null;
  const total = Number(m[1]) * 60 + Number(m[2]);
  return total > 0 ? total : null;
}

/** 270 → "4:30". */
export function formatPaceInput(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 90 → "1 min 30", 30 → "30 s", 180 → "3 min" : `formatDuration` (dates.ts) ne descend pas sous la minute. */
export function formatBlockDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}`;
}

const nombreOuNull = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined) return null;
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max
    ? Math.round(v)
    : null;
};

const estBlockType = (v: unknown): v is BlockType =>
  typeof v === "string" && BLOCK_TYPES.some((t) => t.value === v);

/**
 * Revalide côté serveur la liste de blocs produite par le formulaire (JSON
 * dans un champ caché) : un formulaire se manipule. Un bloc invalide (type
 * inconnu, ni durée ni distance) est écarté plutôt que de faire échouer tout
 * l'enregistrement de la séance.
 */
export function validerBlocs(brut: string): BlockDraft[] {
  if (!brut) return [];
  let donnees: unknown;
  try {
    donnees = JSON.parse(brut);
  } catch {
    return [];
  }
  if (!Array.isArray(donnees)) return [];

  return donnees
    .slice(0, 30)
    .map((b): BlockDraft | null => {
      if (typeof b !== "object" || b === null) return null;
      const o = b as Record<string, unknown>;
      if (!estBlockType(o.block_type)) return null;

      const duration_sec = nombreOuNull(o.duration_sec, 1, 6 * 3600);
      const distance_m = nombreOuNull(o.distance_m, 1, 200_000);
      if (duration_sec === null && distance_m === null) return null;

      return {
        block_type: o.block_type,
        duration_sec,
        distance_m,
        target_pace_sec_per_km: nombreOuNull(o.target_pace_sec_per_km, 120, 1800),
        repetitions: nombreOuNull(o.repetitions, 1, 50),
      };
    })
    .filter((b): b is BlockDraft => b !== null);
}
