import Link from "next/link";
import { redirect } from "next/navigation";
import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SessionRow } from "@/components/SessionRow";
import { chargerAnalysesSeances } from "@/lib/session-details";
import { TrendCharts } from "@/components/TrendCharts";
import { weeklySeries } from "@/lib/metrics";
import { addDays, toISODate } from "@/lib/dates";
import type { Activity, TrainingSession } from "@/lib/types";

function monthLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const now = new Date();

  const [historyRes, trendRes, activitiesRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", user.id)
      .in("status", ["completed", "missed"])
      .order("date", { ascending: false })
      .limit(120),
    // Fenêtre dédiée aux courbes : 12 semaines, tous statuts confondus, pour
    // pouvoir comparer le réalisé au prévu.
    supabase
      .from("sessions")
      .select("*")
      .eq("athlete_id", user.id)
      .gte("date", toISODate(addDays(now, -84)))
      .order("date"),
    // Ce que la montre a relevé, pour les séances qui en viennent.
    supabase
      .from("activities")
      .select("*")
      .eq("athlete_id", user.id)
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
  // Une séance peut en agréger plusieurs ; la plus récente la représente.
  const activityBySession = new Map<string, Activity>();
  for (const a of (activitiesRes.data ?? []) as Activity[]) {
    if (a.session_id && !activityBySession.has(a.session_id)) {
      activityBySession.set(a.session_id, a);
    }
  }

  // Regroupe par mois pour la lecture chronologique.
  const groups: { label: string; sessions: TrainingSession[] }[] = [];
  for (const s of sessions) {
    const label = monthLabel(s.date);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.sessions.push(s);
    else groups.push({ label, sessions: [s] });
  }

  return (
    <div>
      <PageHeader
        eyebrow={`${sessions.length} séance${sessions.length > 1 ? "s" : ""}`}
        title="Historique"
        action={
          <Link
            href="/activites"
            className="shrink-0 text-[13px] font-semibold text-pine hover:underline"
          >
            Fichiers importés
          </Link>
        }
      />
      <div className="px-5 space-y-4">
        {trend.length > 0 && (
          <Card className="p-4">
            <TrendCharts points={weeklySeries(trend, 12, now)} />
          </Card>
        )}

        {groups.length === 0 ? (
          <Card>
            <EmptyState
              title="Aucune séance enregistrée"
              hint="Tes séances complétées et leur analyse apparaîtront ici."
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
    </div>
  );
}
