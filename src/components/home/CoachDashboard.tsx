import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { PlanningToast } from "@/components/PlanningToast";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { AthleteCard } from "@/components/AthleteCard";
import { InviteCode } from "@/components/InviteCode";
import { IconPlus } from "@/components/Icons";
import { btnPrimary } from "@/lib/styles";
import { computeMetrics } from "@/lib/metrics";
import { addDays, toISODate } from "@/lib/dates";
import type { Objective, Profile, TrainingSession } from "@/lib/types";

export async function CoachDashboard({ coach }: { coach: Profile }) {
  const supabase = await createClient();
  const now = new Date();
  const today = toISODate(now);
  const d28 = toISODate(addDays(now, -27));
  const d7ahead = toISODate(addDays(now, 7));

  // La sécurité RLS restreint déjà chaque table aux athlètes de ce coach :
  // inutile de récupérer d'abord la liste des liaisons pour filtrer ensuite.
  // Les trois requêtes partent donc ensemble, au lieu d'attendre la première.
  const [profilesRes, sessionsRes, objectivesRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "athlete").order("full_name"),
    supabase
      .from("sessions")
      .select("*")
      .gte("date", d28)
      .lte("date", d7ahead)
      .order("date"),
    supabase.from("objectives").select("*"),
  ]);

  const athletes = (profilesRes.data ?? []) as Profile[];
  const allSessions = (sessionsRes.data ?? []) as TrainingSession[];
  const allObjectives = (objectivesRes.data ?? []) as Objective[];

  if (athletes.length === 0) {
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
        action={
          <Link href="/planifier" className={`${btnPrimary} px-3.5 py-2 text-[14px]`}>
            <IconPlus className="size-4" />
            Planifier
          </Link>
        }
      />
      <Suspense>
        <PlanningToast />
      </Suspense>
      {/* Deux colonnes dès que la place existe : les cartes d'athlète sont
          des tuiles, pas du texte suivi — les empiler sur un écran large
          oblige à faire défiler pour comparer deux athlètes. */}
      <div className="px-5 space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
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
