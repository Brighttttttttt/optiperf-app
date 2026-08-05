import Link from "next/link";
import { Card, StatTile, StatusBadge } from "./ui";
import { IconCalendar, IconChevronRight } from "./Icons";
import { formatDayRelative, formatDuration } from "@/lib/dates";
import type { AthleteMetrics } from "@/lib/metrics";
import type { Objective, Profile, TrainingSession } from "@/lib/types";
import { btnGhost } from "@/lib/styles";

export function AthleteCard({
  athlete,
  metrics,
  nextSession,
  objective,
}: {
  athlete: Profile;
  metrics: AthleteMetrics;
  nextSession: TrainingSession | undefined;
  objective: Objective | undefined;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/athletes/${athlete.id}`}
          className="flex items-center gap-1 min-w-0 group"
        >
          <span className="font-display text-[20px] font-semibold uppercase tracking-wide truncate group-hover:text-pine">
            {athlete.full_name}
          </span>
          <IconChevronRight className="size-4 shrink-0 text-ink-soft" />
        </Link>
        <StatusBadge status={metrics.status} />
      </div>

      {objective && (
        <p className="mt-0.5 text-[13px] text-ink-soft truncate">
          Objectif : {objective.title}
          {objective.target_date &&
            ` · ${new Date(`${objective.target_date}T12:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}`}
        </p>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2">
        <StatTile
          value={metrics.weeklyVolumeMin > 0 ? formatDuration(metrics.weeklyVolumeMin) : "0"}
          label="Volume 7 j"
        />
        <StatTile
          value={metrics.adherencePct !== null ? `${metrics.adherencePct} %` : "—"}
          label="Adhérence"
        />
        <StatTile
          value={metrics.avgRpe !== null ? String(metrics.avgRpe) : "—"}
          label="RPE moyen"
        />
        <StatTile value={String(Math.round(metrics.weeklyLoad))} label="Charge 7 j" />
      </div>

      <div className="mt-3 pt-3 border-t border-line">
        {nextSession ? (
          <p className="flex items-center gap-1.5 text-[13px] text-ink-soft">
            <IconCalendar className="size-4 shrink-0" />
            <span className="truncate">
              {formatDayRelative(nextSession.date)} · {nextSession.title}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-rpe-high">
            <IconCalendar className="size-4 shrink-0" />
            Rien de planifié
          </p>
        )}
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Link href={`/planifier?athlete=${athlete.id}`} className={btnGhost}>
            Planifier
          </Link>
          <Link href={`/messages/${athlete.id}`} className={btnGhost}>
            Message
          </Link>
        </div>
      </div>
    </Card>
  );
}
