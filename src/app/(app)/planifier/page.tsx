import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { BatchPlanner } from "@/components/BatchPlanner";
import type { Profile, SessionTemplate, TrainingSession } from "@/lib/types";

export default async function PlanifierPage({
  searchParams,
}: {
  searchParams: Promise<{ athlete?: string; depuis?: string; date?: string }>;
}) {
  const { athlete: preselected, depuis, date } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();
  if (profile?.role !== "coach") redirect("/");

  const { data: links } = await supabase
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_id", user.id);
  const ids = (links ?? []).map((l) => l.athlete_id);

  if (ids.length === 0) {
    return (
      <div>
        <PageHeader eyebrow="Nouvelle séance" title="Planifier" backHref="/" />
        <div className="px-5">
          <Card>
            <EmptyState
              title="Aucun athlète dans ton groupe"
              hint="Partage ton code coach depuis les Réglages pour commencer à planifier."
            />
          </Card>
        </div>
      </div>
    );
  }

  const [athletesRes, templatesRes] = await Promise.all([
    supabase.from("profiles").select("*").in("id", ids).order("full_name"),
    supabase
      .from("session_templates")
      .select("*")
      .eq("coach_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  // « Dupliquer » : on repart du contenu d'une séance existante.
  let prefill;
  if (depuis) {
    const { data: source } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", depuis)
      .maybeSingle<TrainingSession>();
    if (source) {
      prefill = {
        title: source.title,
        type: source.type,
        description: source.description ?? "",
        duration: source.duration_planned_min
          ? String(source.duration_planned_min)
          : "",
      };
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow={depuis ? "Dupliquer une séance" : "Nouvelle séance"}
        title="Planifier"
        backHref="/"
      />
      <div className="px-5">
        <BatchPlanner
          athletes={(athletesRes.data ?? []) as Profile[]}
          templates={(templatesRes.data ?? []) as SessionTemplate[]}
          preselectedAthleteId={preselected}
          preselectedDate={date}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
