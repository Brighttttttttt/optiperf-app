import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader, StatTile, StatusBadge } from "@/components/ui";
import { SessionActions } from "@/components/SessionActions";
import { FreeSessionSheet } from "@/components/FreeSessionSheet";
import { LinkCoachForm } from "@/components/LinkCoachForm";
import { computeMetrics } from "@/lib/metrics";
import { addDays, formatDayRelative, formatDuration, toISODate } from "@/lib/dates";
import { sessionTypeLabel, type Objective, type Profile, type TrainingSession } from "@/lib/types";

function PlannedSessionCard({ session }: { session: TrainingSession }) {
  return (
    <Card className="p-4">
      <p className="font-display text-[13px] font-semibold uppercase tracking-[0.14em] text-pine">
        {formatDayRelative(session.date)}
      </p>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <p className="font-semibold text-[17px] truncate">{session.title}</p>
        <p className="shrink-0 text-[13px] text-ink-soft">
          {sessionTypeLabel(session.type)}
          {session.duration_planned_min
            ? ` · ${formatDuration(session.duration_planned_min)}`
            : ""}
        </p>
      </div>
      {session.description && (
        <p className="mt-1 text-[14px] text-ink-soft whitespace-pre-line">
          {session.description}
        </p>
      )}
      <SessionActions
        sessionId={session.id}
        defaultDuration={session.duration_planned_min}
      />
    </Card>
  );
}

export async function AthleteHome({ athlete }: { athlete: Profile }) {
  const supabase = await createClient();
  const now = new Date();
  const today = toISODate(now);
  const d28 = toISODate(addDays(now, -27));
  const d7ahead = toISODate(addDays(now, 7));

  const [linkRes, sessionsRes, objectivesRes] = await Promise.all([
    supabase
      .from("coach_athletes")
      .select("coach_id")
      .eq("athlete_id", athlete.id)
      .maybeSingle(),
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", athlete.id)
      .gte("date", d28)
      .lte("date", d7ahead)
      .order("date"),
    supabase
      .from("objectives")
      .select("*")
      .eq("athlete_id", athlete.id)
      .order("target_date", { ascending: true }),
  ]);

  const sessions = (sessionsRes.data ?? []) as TrainingSession[];
  const objectives = (objectivesRes.data ?? []) as Objective[];
  const hasCoach = Boolean(linkRes.data);

  const metrics = computeMetrics(sessions, now);
  const upcoming = sessions.filter((s) => s.status === "planned" && s.date >= today);
  const overdue = sessions.filter((s) => s.status === "planned" && s.date < today);
  const objective =
    objectives.find((o) => o.target_date && o.target_date >= today) ??
    objectives[0];

  const firstName = athlete.full_name.split(" ")[0];
  const weekLabel = `Semaine du ${addDays(now, -((now.getDay() + 6) % 7)).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`;

  return (
    <div>
      <PageHeader eyebrow={weekLabel} title={`Bonjour ${firstName}`} />

      <div className="px-5 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-semibold text-ink-soft">
              7 derniers jours
            </p>
            <StatusBadge status={metrics.status} />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <StatTile
              value={metrics.weeklyVolumeMin > 0 ? formatDuration(metrics.weeklyVolumeMin) : "0 min"}
              label="Volume"
            />
            <StatTile
              value={String(Math.round(metrics.weeklyLoad))}
              label="Charge"
            />
            <StatTile
              value={metrics.avgRpe !== null ? String(metrics.avgRpe) : "—"}
              label="RPE moyen"
            />
          </div>
          {objective && (
            <p className="mt-3 pt-3 border-t border-line text-[13px] text-ink-soft">
              <span className="font-semibold text-ink">Objectif :</span>{" "}
              {objective.title}
              {objective.target_date &&
                ` · ${new Date(`${objective.target_date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}`}
            </p>
          )}
        </Card>

        {!hasCoach && (
          <Card className="p-4">
            <p className="font-semibold">Rejoins ton coach</p>
            <p className="mt-0.5 text-[13px] text-ink-soft">
              Saisis le code qu&apos;il t&apos;a partagé pour recevoir ton
              planning.
            </p>
            <LinkCoachForm />
          </Card>
        )}

        {overdue.length > 0 && (
          <section>
            <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-rpe-high mb-2">
              À rattraper
            </h2>
            <div className="space-y-3">
              {overdue.map((s) => (
                <PlannedSessionCard key={s.id} session={s} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="font-display text-[16px] font-semibold uppercase tracking-[0.12em] text-ink-soft mb-2">
            À venir
          </h2>
          {upcoming.length === 0 ? (
            <Card>
              <EmptyState
                title="Rien de planifié pour le moment"
                hint={
                  hasCoach
                    ? "Ton coach n'a pas encore planifié la suite."
                    : "Ton planning apparaîtra ici une fois lié à ton coach."
                }
              />
            </Card>
          ) : (
            <div className="space-y-3">
              {upcoming.map((s) => (
                <PlannedSessionCard key={s.id} session={s} />
              ))}
            </div>
          )}
        </section>

        <FreeSessionSheet />
      </div>
    </div>
  );
}
