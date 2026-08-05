import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, StatTile, StatusBadge } from "@/components/ui";
import { SessionRow } from "@/components/SessionRow";
import { ObjectiveForm } from "@/components/ObjectiveForm";
import { RemoveAthleteButton } from "@/components/RemoveAthleteButton";
import { WeekPlanner } from "@/components/WeekPlanner";
import { IconChat, IconPlus } from "@/components/Icons";
import { deleteObjective } from "@/app/(app)/actions";
import { TrendCharts } from "@/components/TrendCharts";
import { computeMetrics, weeklySeries } from "@/lib/metrics";
import { addDays, formatDuration, toISODate } from "@/lib/dates";
import { btnGhost, btnPrimary } from "@/lib/styles";
import type { Objective, Profile, TrainingSession } from "@/lib/types";

export default async function AthletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const now = new Date();
  const today = toISODate(now);

  // La RLS ne laisse voir que ses propres athlètes : profil vide = accès refusé.
  const { data: athlete } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "athlete")
    .maybeSingle<Profile>();
  if (!athlete) redirect("/");

  const [sessionsRes, objectivesRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", id)
      // Fenêtre large : elle sert à la fois à la navigation entre semaines
      // sans aller-retour et aux courbes sur 12 semaines.
      .gte("date", toISODate(addDays(now, -84)))
      .lte("date", toISODate(addDays(now, 56)))
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
  const upcoming = sessions.filter((s) => s.status === "planned" && s.date >= today);
  const history = sessions
    .filter((s) => s.status !== "planned")
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div>
      <PageHeader
        eyebrow="Fiche athlète"
        title={athlete.full_name}
        backHref="/"
        action={
          <Link
            href={`/messages/${athlete.id}`}
            aria-label={`Écrire à ${athlete.full_name}`}
            className={`${btnGhost} p-2.5`}
          >
            <IconChat className="size-5" />
          </Link>
        }
      />

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
            Évolution
          </h2>
          <Card className="p-4">
            <TrendCharts points={weeklySeries(sessions, 12, now)} />
          </Card>
        </section>

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

        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft">
              Planning
            </h2>
            <Link
              href={`/planifier?athlete=${athlete.id}`}
              className={`${btnPrimary} px-3 py-1.5 text-[13px]`}
            >
              <IconPlus className="size-4" />
              Planifier
            </Link>
          </div>
          <Card className="p-3">
            <WeekPlanner athleteId={athlete.id} sessions={sessions} />
          </Card>
          {upcoming.length === 0 && (
            <p className="mt-2 text-center text-[13px] text-ink-soft">
              Rien de planifié pour {athlete.full_name.split(" ")[0]} dans les
              jours à venir.
            </p>
          )}
        </section>

        <section>
          <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft mb-2">
            Historique récent
          </h2>
          {history.length === 0 ? (
            <Card>
              <EmptyState
                title="Aucune séance réalisée"
                hint="Les séances complétées et leur analyse apparaîtront ici."
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {history.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </Card>
          )}
        </section>

        <section className="pt-2">
          <RemoveAthleteButton
            athleteId={athlete.id}
            athleteName={athlete.full_name}
          />
        </section>
      </div>
    </div>
  );
}
