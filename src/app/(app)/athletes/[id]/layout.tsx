import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { PageHeader } from "@/components/ui";
import { AthleteNav } from "@/components/AthleteNav";
import type { Profile } from "@/lib/types";

export default async function AthleteLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // La RLS ne laisse voir que ses propres athlètes : profil vide = accès
  // refusé. Ce contrôle gate les quatre onglets d'un coup, posé une seule
  // fois ici plutôt que répété dans chaque page.
  const { data: athlete } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .eq("role", "athlete")
    .maybeSingle<Profile>();
  if (!athlete) redirect("/");

  const { data: links } = await supabase
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_id", user.id);
  const ids = (links ?? []).map((l) => l.athlete_id);

  let roster: { id: string; full_name: string }[] = [];
  if (ids.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .order("full_name");
    roster = (data ?? []) as { id: string; full_name: string }[];
  }

  return (
    <div>
      <PageHeader eyebrow="Athlète" title={athlete.full_name} backHref="/" />
      <div className="px-5">
        <AthleteNav athleteId={athlete.id} roster={roster} />
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
