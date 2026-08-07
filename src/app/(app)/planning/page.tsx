import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/supabase/session";
import { Card, PageHeader } from "@/components/ui";
import { WeekPlanner } from "@/components/WeekPlanner";
import { addDays, toISODate } from "@/lib/dates";
import { chargerDetailsSeances } from "@/lib/session-details";
import { pluralize } from "@/lib/planning";
import type { TrainingSession } from "@/lib/types";

/**
 * Semaine de l'athlète : ce que le coach voit de lui sur `/athletes/[id]/planning`,
 * côté athlète et en lecture seule. Il y lit le contenu de ses séances (blocs
 * ou exercices) sans avoir à les ouvrir, et où il en est de sa semaine.
 *
 * Les actions restent sur l'accueil : c'est là qu'il déclare une séance faite
 * ou manquée, et cette page ne mène pas à `/seances/[id]` pour une séance
 * encore planifiée — cette route ouvre le formulaire de prescription.
 */
export default async function PlanningPage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const now = new Date();
  const today = toISODate(now);

  // Même fenêtre que la fiche coach (±8 semaines) : la navigation d'une
  // semaine à l'autre se fait sans aller-retour serveur.
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("athlete_id", profile.id)
    .gte("date", toISODate(addDays(now, -56)))
    .lte("date", toISODate(addDays(now, 56)))
    .order("date");
  const sessions = (data ?? []) as TrainingSession[];
  const details = await chargerDetailsSeances(
    supabase,
    sessions.map((s) => s.id)
  );

  const semaine = sessions.filter(
    (s) => s.date >= toISODate(addDays(now, -((now.getDay() + 6) % 7)))
  );
  const restantes = semaine.filter((s) => s.status === "planned" && s.date >= today);

  return (
    <div>
      <PageHeader
        eyebrow={
          restantes.length > 0
            ? `${pluralize(restantes.length, "séance")} à venir`
            : "Rien à venir cette semaine"
        }
        title="Mon planning"
      />
      <div className="px-5">
        <Card className="p-3">
          <WeekPlanner
            athleteId={profile.id}
            sessions={sessions}
            canPlan={false}
            {...details}
          />
        </Card>
      </div>
    </div>
  );
}
