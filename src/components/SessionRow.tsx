import Link from "next/link";
import { RpeDot } from "./ui";
import { IconChevronRight } from "./Icons";
import { formatDayShort, formatDuration } from "@/lib/dates";
import { formatDistance } from "@/lib/activites";
import type { AnalyseSeance } from "@/lib/analyse-seance";
import {
  activitySourceLabel,
  sessionTypeLabel,
  type Activity,
  type TrainingSession,
} from "@/lib/types";

/**
 * Ligne d'historique d'une séance réalisée ou manquée.
 *
 * Quand une montre est à l'origine du compte rendu, son résumé s'affiche sur
 * sa propre ligne : en toutes lettres et non au survol, pour rester lisible
 * au doigt comme au lecteur d'écran. Ce qui est mesuré doit se distinguer de
 * ce qui est déclaré.
 */
export function SessionRow({
  session,
  activity,
  analyse,
}: {
  session: TrainingSession;
  activity?: Activity | null;
  /** Absente si le fichier n'avait pas de tours (GPX, saisie à la main). */
  analyse?: AnalyseSeance | null;
}) {
  const duration = session.duration_actual_min ?? session.duration_planned_min;
  const releve = activity && [
    activity.distance_m !== null ? formatDistance(activity.distance_m) : null,
    activity.avg_heart_rate !== null ? `${activity.avg_heart_rate} bpm` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Link
      href={`/seances/${session.id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-surface/60 transition-colors"
    >
      <p className="w-12 shrink-0 pt-0.5 font-display text-[17px] font-semibold tabular-nums">
        {formatDayShort(session.date)}
      </p>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{session.title}</p>
        <p className="text-[13px] text-ink-soft">
          {session.type === "renfo" ? (
            <span className="font-semibold text-pine">Muscu</span>
          ) : (
            sessionTypeLabel(session.type)
          )}
          {duration ? ` · ${formatDuration(duration)}` : ""}
          {session.coach_id === null ? " · libre" : ""}
        </p>
        {activity && (
          <p className="text-[13px] text-ink-soft">
            {activitySourceLabel(activity.source)}
            {releve ? ` · ${releve}` : ""}
          </p>
        )}
        {/* La structure lue dans les tours, avant même d'ouvrir la séance :
            c'est ce que le coach parcourt pour savoir qui a tenu la sienne. */}
        {analyse && analyse.structure && (
          <p className="mt-0.5 text-[13px] font-semibold text-pine">
            {analyse.structure}
          </p>
        )}
        {analyse && (
          <p className="text-[13px] text-ink-soft">{analyse.resume}</p>
        )}
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
      <IconChevronRight className="size-4 shrink-0 mt-1 text-ink-soft/50" />
    </Link>
  );
}
