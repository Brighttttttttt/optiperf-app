import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, StatTile, StatusBadge } from "@/components/ui";
import { ObjectiveForm } from "@/components/ObjectiveForm";
import { RemoveAthleteButton } from "@/components/RemoveAthleteButton";
import { deleteObjective } from "@/app/(app)/actions";
import { computeMetrics } from "@/lib/metrics";
import { addDays, formatDuration, toISODate } from "@/lib/dates";
import type { Objective, Profile, TrainingSession } from "@/lib/types";

export default async function AthleteFichePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const now = new Date();

  const { data: athlete } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();
  if (!athlete) redirect("/");

  const [sessionsRes, objectivesRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", id)
      .gte("date", toISODate(addDays(now, -27)))
      .lte("date", toISODate(now))
      .order("date"),
    supabase
      .from("objectives")
      .select("*")
      .eq("athlete_id", id)
      .order("target_date", { ascending: true }),
  ]);

  const sessions = (sessionsRes.data ?? []) as TrainingSession[];
  const objectives = (objectivesRes.data ?? []) as Objective[];
  const metrics = computeMetrics(sessions, now);

  return (
    <div className="px-5 space-y-5">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink-soft">
            7 derniers jours
          </p>
          <StatusBadge status={metrics.status} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <StatTile
            value={metrics.weeklyVolumeMin > 0 ? formatDuration(metrics.weeklyVolumeMin) : "0"}
            label="Volume"
          />
          <StatTile
            value={metrics.adherencePct !== null ? `${metrics.adherencePct} %` : "—"}
            label="Adhérence"
          />
          <StatTile
            value={metrics.avgRpe !== null ? String(metrics.avgRpe) : "—"}
            label="RPE moyen"
          />
          <StatTile value={String(Math.round(metrics.weeklyLoad))} label="Charge" />
        </div>
      </Card>

      <section>
        <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft mb-2">
          Objectifs
        </h2>
        <div className="space-y-2">
          {objectives.map((o) => (
            <Card key={o.id} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{o.title}</p>
                {o.target_date && (
                  <p className="text-[13px] text-ink-soft">
                    {new Date(`${o.target_date}T12:00:00`).toLocaleDateString(
                      "fr-FR",
                      { day: "numeric", month: "long", year: "numeric" }
                    )}
                  </p>
                )}
              </div>
              <form action={deleteObjective}>
                <input type="hidden" name="objective_id" value={o.id} />
                <button
                  type="submit"
                  className="text-[13px] font-semibold text-ink-soft hover:text-rpe-max"
                >
                  Retirer
                </button>
              </form>
            </Card>
          ))}
          <ObjectiveForm athleteId={athlete.id} />
        </div>
      </section>

      <section className="pt-2">
        <RemoveAthleteButton
          athleteId={athlete.id}
          athleteName={athlete.full_name}
        />
      </section>
    </div>
  );
}
