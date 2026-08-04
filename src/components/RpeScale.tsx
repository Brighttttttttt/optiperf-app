"use client";

import { rpeBand, RPE_BG, RPE_CHIP, type RpeBand } from "@/lib/rpe";

const BAND_LABELS: Record<RpeBand, string> = {
  low: "Facile",
  mid: "Soutenu",
  high: "Difficile",
  max: "Maximal",
};

/** La rampe d'effort : sélecteur RPE 1–10, signature visuelle de l'app. */
export function RpeScale({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-10 gap-1" role="radiogroup" aria-label="RPE de 1 à 10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const band = rpeBand(n);
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(n)}
              className={`h-10 rounded-lg text-[13px] font-semibold transition-transform ${
                selected
                  ? `${RPE_BG[band]} text-card scale-y-110 shadow-sm`
                  : RPE_CHIP[band]
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between text-[11px] text-ink-soft">
        <span>Facile</span>
        <span className="text-[13px] font-semibold text-ink">
          {value ? `${value} — ${BAND_LABELS[rpeBand(value)]}` : "Touche pour choisir"}
        </span>
        <span>Max</span>
      </div>
    </div>
  );
}
