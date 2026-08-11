import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/supabase/session";
import { Card, PageHeader, RpeChip } from "@/components/ui";
import { EditSessionForm } from "@/components/EditSessionForm";
import { ActivityTraceChart } from "@/components/ActivityTraceChart";
import { WorkoutBlocksList } from "@/components/WorkoutBlocksList";
import { ZoneBar } from "@/components/ZoneBar";
import { ExercisesList } from "@/components/ExercisesList";
import { formatDayRelative, formatDayLong, formatDuration } from "@/lib/dates";
import { formatDistance } from "@/lib/activites";
import { repartitionZones } from "@/lib/zones";
import {
  activitySourceLabel,
  sessionTypeLabel,
  type Activity,
  type ActivityTrace,
  type Exercise,
  type ExerciseLog,
  type Profile,
  type TrainingSession,
  type WorkoutBlock,
} from "@/lib/types";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // La RLS ne laisse voir que les séances de ses propres athlètes, ou les
  // siennes si on est l'athlète concerné.
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle<TrainingSession>();
  if (!session) redirect("/");

  const profile = await getSessionProfile();
  // À qui appartient cette séance, plutôt qu'à quel rôle on appartient : un
  // coach qui s'entraîne ouvre les siennes depuis son historique, et celles
  // de ses athlètes depuis leur fiche. Le rôle ne le disait pas (#62).
  const backHref =
    profile?.id === session.athlete_id
      ? "/history"
      : `/athletes/${session.athlete_id}`;

  const { data: athlete } = await supabase
    .from("profiles")
    .select("full_name, fc_max")
    .eq("id", session.athlete_id)
    .maybeSingle<Pick<Profile, "full_name" | "fc_max">>();

  const { data: blocksData } = await supabase
    .from("workout_blocks")
    .select("*")
    .eq("session_id", session.id)
    .order("position");
  const blocks = (blocksData ?? []) as WorkoutBlock[];

  const { data: exercisesData } = await supabase
    .from("exercises")
    .select("*")
    .eq("session_id", session.id)
    .order("position");
  const exercises = (exercisesData ?? []) as Exercise[];

  // Une séance déjà rapportée appartient au compte rendu de l'athlète : le
  // coach n'en réécrit pas la prescription après coup, il en garde la trace.
  if (session.status !== "planned") {
    // Une séance peut agréger plusieurs activités : la plus récente la
    // représente, comme dans l'historique et la fiche athlète.
    const { data: activity } = await supabase
      .from("activities")
      .select("*")
      .eq("session_id", session.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<Activity>();

    const { data: trace } = activity
      ? await supabase
          .from("activity_traces")
          .select("*")
          .eq("activity_id", activity.id)
          .maybeSingle<ActivityTrace>()
      : { data: null };

    const { data: logsData } =
      exercises.length > 0
        ? await supabase
            .from("exercise_logs")
            .select("*")
            .in("exercise_id", exercises.map((e) => e.id))
        : { data: null };
    const logs = (logsData ?? []) as ExerciseLog[];

    return (
      <div>
        <PageHeader
          eyebrow={`${athlete?.full_name ?? "Athlète"} · ${formatDayRelative(session.date)}`}
          title={session.title}
          backHref={backHref}
        />
        <div className="px-5 space-y-4">
          {session.status === "missed" && (
            <span className="inline-flex rounded-full bg-rpe-max-soft text-rpe-max px-2.5 py-1 text-[13px] font-semibold">
              Manquée
            </span>
          )}

          {(session.description ||
            session.duration_planned_min ||
            blocks.length > 0 ||
            exercises.length > 0) && (
            <Card className="p-4">
              <p className="text-[13px] font-semibold text-ink-soft">Prévu</p>
              <p className="mt-1 text-[15px]">
                {sessionTypeLabel(session.type)}
                {session.duration_planned_min
                  ? ` · ${formatDuration(session.duration_planned_min)}`
                  : ""}
              </p>
              {session.description && (
                <p className="mt-2 text-[14px] text-ink-soft whitespace-pre-line">
                  {session.description}
                </p>
              )}
              <WorkoutBlocksList blocks={blocks} />
              <ExercisesList exercises={exercises} logs={logs} />
            </Card>
          )}

          {session.status === "completed" && (
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold text-ink-soft">Réalisé</p>
                {session.rpe !== null && <RpeChip rpe={session.rpe} />}
              </div>
              <p className="mt-1 text-[15px]">
                {session.duration_actual_min
                  ? formatDuration(session.duration_actual_min)
                  : "Durée non précisée"}
              </p>
              {session.athlete_comment && (
                <p className="mt-2 text-[14px] text-ink-soft whitespace-pre-line">
                  « {session.athlete_comment} »
                </p>
              )}
            </Card>
          )}

          {activity && (
            <Card className="p-4">
              <p className="text-[13px] font-semibold text-ink-soft">
                Relevé {activitySourceLabel(activity.source)}
              </p>
              <p className="mt-1 text-[15px]">
                {formatDuration(activity.duration_min)}
                {activity.distance_m !== null &&
                  ` · ${formatDistance(activity.distance_m)}`}
                {activity.avg_heart_rate !== null &&
                  ` · ${activity.avg_heart_rate} bpm`}
              </p>
              <p className="mt-0.5 text-[12px] text-ink-soft">
                {formatDayLong(activity.date)}
                {activity.file_name && ` · ${activity.file_name}`}
              </p>
            </Card>
          )}

          {trace && (
            <Card className="p-4 space-y-4">
              {athlete?.fc_max && (
                <ZoneBar
                  titre="Zones de fréquence cardiaque"
                  zones={repartitionZones(trace.t_s, trace.heart_rate ?? [], athlete.fc_max)}
                />
              )}
              <ActivityTraceChart trace={trace} />
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${athlete?.full_name ?? "Athlète"} · ${formatDayRelative(session.date)}`}
        title="Modifier"
        backHref={backHref}
      />
      <div className="px-5">
        <EditSessionForm session={session} blocks={blocks} exercises={exercises} />
      </div>
    </div>
  );
}
