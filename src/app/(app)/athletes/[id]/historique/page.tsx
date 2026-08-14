import { redirect } from "next/navigation";
import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState } from "@/components/ui";
import { SessionRow } from "@/components/SessionRow";
import { chargerAnalysesSeances } from "@/lib/session-details";
import { TrendMois } from "@/components/TrendMois";
import { fenetreAutour } from "@/lib/planning";
import type { Activity, Profile, TrainingSession } from "@/lib/types";

function monthLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export default async function AthleteHistoriquePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const now = new Date();
  const fenetre = fenetreAutour(now);

  const { data: athlete } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", id)
    .maybeSingle<Pick<Profile, "id">>();
  if (!athlete) redirect("/");

  const [historyRes, trendRes, activitiesRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", id)
      .in("status", ["completed", "missed"])
      .order("date", { ascending: false })
      .limit(120),
    // Fenêtre dédiée aux courbes, tous statuts confondus pour pouvoir
    // comparer le réalisé au prévu. Elle borne aussi ce que la navigation
    // mensuelle peut afficher sans redemander le serveur (#143).
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", id)
      .gte("date", fenetre.debut)
      .lte("date", fenetre.fin)
      .order("date"),
    // Ce que la montre a relevé, pour les séances qui en viennent.
    supabase
      .from("activities")
      .select("*")
      .eq("athlete_id", id)
      .not("session_id", "is", null)
      .order("started_at", { ascending: false })
      .limit(200),
  ]);

  const sessions = (historyRes.data ?? []) as TrainingSession[];

  // L'analyse de chaque séance, en deux requêtes pour toute la liste : c'est
  // elle qui donne la structure et le résumé lisibles sans ouvrir la séance.
  const analyses = await chargerAnalysesSeances(
    supabase,
    sessions.map((s) => s.id)
  );
  const trend = (trendRes.data ?? []) as TrainingSession[];
  const activityBySession = new Map<string, Activity>();
  for (const a of (activitiesRes.data ?? []) as Activity[]) {
    if (a.session_id && !activityBySession.has(a.session_id)) {
      activityBySession.set(a.session_id, a);
    }
  }

  const groups: { label: string; sessions: TrainingSession[] }[] = [];
  for (const s of sessions) {
    const label = monthLabel(s.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.sessions.push(s);
    else groups.push({ label, sessions: [s] });
  }

  return (
    <div className="px-5 space-y-4">
      {trend.length > 0 && (
        <Card className="p-4">
          <TrendMois athleteId={id} sessions={trend} fenetre={fenetre} />
        </Card>
      )}

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Aucune séance réalisée"
            hint="Les séances complétées et leur analyse apparaîtront ici."
          />
        </Card>
      ) : (
        groups.map((g) => (
          <Fragment key={g.label}>
            <h2 className="font-display text-[15px] font-semibold uppercase tracking-[0.12em] text-ink-soft first-letter:uppercase">
              {g.label}
            </h2>
            <Card className="divide-y divide-line">
              {g.sessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  activity={activityBySession.get(s.id)}
                  analyse={analyses[s.id]}
                />
              ))}
            </Card>
          </Fragment>
        ))
      )}
    </div>
  );
}
