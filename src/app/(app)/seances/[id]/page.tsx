import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { EditSessionForm } from "@/components/EditSessionForm";
import { formatDayRelative } from "@/lib/dates";
import type { Profile, TrainingSession } from "@/lib/types";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // La RLS ne laisse voir que les séances de ses propres athlètes.
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .maybeSingle<TrainingSession>();
  if (!session) redirect("/");

  // Une séance déjà rapportée appartient au compte rendu de l'athlète :
  // le coach n'en réécrit pas la prescription après coup.
  if (session.status !== "planned") redirect(`/athletes/${session.athlete_id}`);

  const { data: athlete } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.athlete_id)
    .maybeSingle<Pick<Profile, "full_name">>();

  return (
    <div>
      <PageHeader
        eyebrow={`${athlete?.full_name ?? "Athlète"} · ${formatDayRelative(session.date)}`}
        title="Modifier"
        backHref={`/athletes/${session.athlete_id}`}
      />
      <div className="px-5">
        <EditSessionForm session={session} />
      </div>
    </div>
  );
}
