import { RpeDot } from "./ui";
import { formatDayShort, formatDuration } from "@/lib/dates";
import { sessionTypeLabel, type TrainingSession } from "@/lib/types";

/** Ligne d'historique d'une séance réalisée ou manquée. */
export function SessionRow({ session }: { session: TrainingSession }) {
  const duration = session.duration_actual_min ?? session.duration_planned_min;
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <p className="w-12 shrink-0 pt-0.5 font-display text-[17px] font-semibold tabular-nums">
        {formatDayShort(session.date)}
      </p>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{session.title}</p>
        <p className="text-[13px] text-ink-soft">
          {sessionTypeLabel(session.type)}
          {duration ? ` · ${formatDuration(duration)}` : ""}
          {session.coach_id === null ? " · libre" : ""}
        </p>
        {session.athlete_comment && (
          <p className="mt-1 text-[13px] text-ink-soft italic">
            « {session.athlete_comment} »
          </p>
        )}
      </div>
      {session.status === "missed" ? (
        <span className="shrink-0 rounded-full bg-rpe-max-soft text-rpe-max px-2 py-0.5 text-[12px] font-semibold">
          Manquée
        </span>
      ) : (
        session.rpe !== null && <RpeDot rpe={session.rpe} />
      )}
    </div>
  );
}
