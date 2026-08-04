import { redirect } from "next/navigation";
import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SessionRow } from "@/components/SessionRow";
import type { TrainingSession } from "@/lib/types";

function monthLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("athlete_id", user.id)
    .in("status", ["completed", "missed"])
    .order("date", { ascending: false })
    .limit(120);
  const sessions = (data ?? []) as TrainingSession[];

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
      />
      <div className="px-5 space-y-4">
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
                  <SessionRow key={s.id} session={s} />
                ))}
              </Card>
            </Fragment>
          ))
        )}
      </div>
    </div>
  );
}
