import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { WeekPlanner } from "@/components/WeekPlanner";
import { IconPlus } from "@/components/Icons";
import { btnPrimary } from "@/lib/styles";
import { toISODate } from "@/lib/dates";
import { chargerFenetrePlanning } from "@/lib/session-details";
import { fenetreAutour } from "@/lib/planning";
import type { Profile } from "@/lib/types";

export default async function AthletePlanningPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const now = new Date();
  const today = toISODate(now);

  const { data: athlete } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", id)
    .maybeSingle<Pick<Profile, "id" | "full_name">>();
  if (!athlete) redirect("/");

  // Fenêtre large (±8 semaines) : la vue semaine y navigue sans aller-retour
  // serveur, et va chercher elle-même les périodes plus lointaines (#141).
  const fenetre = fenetreAutour(now);
  const { sessions, ...contenu } = await chargerFenetrePlanning(
    supabase,
    id,
    fenetre.debut,
    fenetre.fin
  );
  const upcoming = sessions.filter((s) => s.status === "planned" && s.date >= today);

  return (
    <div className="px-5 space-y-3">
      <div className="flex items-center justify-end">
        <Link
          href={`/planifier?athlete=${id}`}
          className={`${btnPrimary} px-3 py-1.5 text-[13px]`}
        >
          <IconPlus className="size-4" />
          Planifier
        </Link>
      </div>
      <Card className="p-3">
        <WeekPlanner
          athleteId={id}
          sessions={sessions}
          fenetre={fenetre}
          {...contenu}
        />
      </Card>
      {upcoming.length === 0 && (
        <p className="text-center text-[13px] text-ink-soft">
          Rien de planifié pour {athlete.full_name.split(" ")[0]} dans les
          jours à venir.
        </p>
      )}
    </div>
  );
}
