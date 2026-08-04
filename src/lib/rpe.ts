import type { FitnessStatus } from "./metrics";

export type RpeBand = "low" | "mid" | "high" | "max";

export function rpeBand(rpe: number): RpeBand {
  if (rpe <= 3) return "low";
  if (rpe <= 6) return "mid";
  if (rpe <= 8) return "high";
  return "max";
}

/** Couleur pleine de la rampe d'effort (pastilles, segments du sélecteur). */
export const RPE_BG: Record<RpeBand, string> = {
  low: "bg-rpe-low",
  mid: "bg-rpe-mid",
  high: "bg-rpe-high",
  max: "bg-rpe-max",
};

/** Fond doux + texte assorti (badges). */
export const RPE_CHIP: Record<RpeBand, string> = {
  low: "bg-rpe-low-soft text-rpe-low",
  mid: "bg-rpe-mid-soft text-rpe-mid",
  high: "bg-rpe-high-soft text-rpe-high",
  max: "bg-rpe-max-soft text-rpe-max",
};

/** L'état de forme réutilise la sémantique de la rampe. */
export const STATUS_CHIP: Record<FitnessStatus, string> = {
  frais: "bg-rpe-low-soft text-rpe-low",
  normal: "bg-pine-soft text-pine",
  fatigue: "bg-rpe-max-soft text-rpe-max",
  inconnu: "bg-line text-ink-soft",
};
