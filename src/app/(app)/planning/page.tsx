import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/supabase/session";
import { Card, PageHeader } from "@/components/ui";
import { WeekPlanner } from "@/components/WeekPlanner";
import { addDays, toISODate } from "@/lib/dates";
import { chargerFenetrePlanning } from "@/lib/session-details";
import { fenetreAutour, pluralize } from "@/lib/planning";

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
  // semaine à l'autre s'y fait sans aller-retour serveur. Au-delà, la vue va
  // chercher elle-même ce qui lui manque (#141) — d'où la fenêtre transmise :
  // elle seule dit ce que ces données couvrent, y compris quand elles sont
  // vides.
  const fenetre = fenetreAutour(now);
  const { sessions, ...contenu } = await chargerFenetrePlanning(
    supabase,
    profile.id,
    fenetre.debut,
    fenetre.fin
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
            fenetre={fenetre}
            canPlan={false}
            {...contenu}
          />
        </Card>
      </div>
    </div>
  );
}
