import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { PlanSessionForm } from "@/components/PlanSessionForm";
import type { Profile } from "@/lib/types";

export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: athlete } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "athlete")
    .maybeSingle<Profile>();
  if (!athlete) redirect("/");

  return (
    <div>
      <PageHeader
        eyebrow={athlete.full_name}
        title="Planifier"
        backHref={`/athletes/${athlete.id}`}
      />
      <div className="px-5">
        <PlanSessionForm athleteId={athlete.id} />
      </div>
    </div>
  );
}
