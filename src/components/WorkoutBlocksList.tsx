import { blockTypeLabel, formatBlockDuration, formatPaceInput } from "@/lib/blocks";
import { formatDistance } from "@/lib/activites";
import type { WorkoutBlock } from "@/lib/types";

/**
 * Lecture seule des blocs d'une séance : la structure doit se distinguer
 * d'un paragraphe, pas seulement s'y ajouter.
 */
export function WorkoutBlocksList({ blocks }: { blocks: WorkoutBlock[] }) {
  if (blocks.length === 0) return null;

  const tries = [...blocks].sort((a, b) => a.position - b.position);

  return (
    <ol className="mt-2.5 space-y-1.5">
      {tries.map((b) => {
        const details = [
          b.duration_sec !== null ? formatBlockDuration(b.duration_sec) : null,
          b.distance_m !== null ? formatDistance(b.distance_m) : null,
          b.target_pace_sec_per_km !== null
            ? `${formatPaceInput(b.target_pace_sec_per_km)} /km`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <li key={b.id} className="flex items-baseline gap-1.5 text-[14px]">
            <span className="font-semibold shrink-0">
              {b.repetitions !== null && b.repetitions > 1 ? `${b.repetitions} × ` : ""}
              {blockTypeLabel(b.block_type)}
            </span>
            {details && <span className="text-ink-soft">{details}</span>}
          </li>
        );
      })}
    </ol>
  );
}
