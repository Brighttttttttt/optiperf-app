import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AthleteCard } from "@/components/AthleteCard";
import { InviteCode } from "@/components/InviteCode";
import { computeMetrics } from "@/lib/metrics";
import { addDays, toISODate } from "@/lib/dates";
import type { Objective, Profile, TrainingSession } from "@/lib/types";

export async function CoachDashboard({ coach }: { coach: Profile }) {
  const supabase = await createClient();
  const now = new Date();
  const today = toISODate(now);
  const d28 = toISODate(addDays(now, -27));
  const d7ahead = toISODate(addDays(now, 7));

  const { data: links } = await supabase
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_id", coach.id);
  const ids = (links ?? []).map((l) => l.athlete_id);

  if (ids.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Mon groupe" title="Athlètes" />
        <div className="px-5 space-y-4">
          {coach.invite_code && <InviteCode code={coach.invite_code} />}
          <Card>
            <EmptyState
              title="Aucun athlète pour le moment"
              hint="Dès qu'un athlète rejoint ton groupe avec ton code, il apparaît ici avec ses métriques."
            />
          </Card>
        </div>
      </div>
    );
  }

  const [profilesRes, sessionsRes, objectivesRes] = await Promise.all([
    supabase.from("profiles").select("*").in("id", ids).order("full_name"),
    supabase
      .from("sessions")
      .select("*")
      .in("athlete_id", ids)
      .gte("date", d28)
      .lte("date", d7ahead)
      .order("date"),
    supabase.from("objectives").select("*").in("athlete_id", ids),
  ]);

  const athletes = (profilesRes.data ?? []) as Profile[];
  const allSessions = (sessionsRes.data ?? []) as TrainingSession[];
  const allObjectives = (objectivesRes.data ?? []) as Objective[];

  const cards = athletes.map((athlete) => {
    const sessions = allSessions.filter((s) => s.athlete_id === athlete.id);
    const objectives = allObjectives
      .filter((o) => o.athlete_id === athlete.id)
      .sort((a, b) => (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"));
    return {
      athlete,
      metrics: computeMetrics(sessions, now),
      nextSession: sessions.find((s) => s.status === "planned" && s.date >= today),
      objective:
        objectives.find((o) => o.target_date && o.target_date >= today) ??
        objectives[0],
    };
  });

  // Les athlètes sans séance planifiée remontent en premier : c'est là
  // que le coach doit agir.
  cards.sort((a, b) => Number(Boolean(a.nextSession)) - Number(Boolean(b.nextSession)));

  return (
    <div>
      <PageHeader
        eyebrow={`${cards.length} athlète${cards.length > 1 ? "s" : ""}`}
        title="Mon groupe"
      />
      <div className="px-5 space-y-3">
        {cards.map((c) => (
          <AthleteCard
            key={c.athlete.id}
            athlete={c.athlete}
            metrics={c.metrics}
            nextSession={c.nextSession}
            objective={c.objective}
          />
        ))}
      </div>
    </div>
  );
}
