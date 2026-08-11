import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/session";
import { getViewMode } from "@/lib/view-mode";
import { CoachDashboard } from "@/components/home/CoachDashboard";
import { AthleteHome } from "@/components/home/AthleteHome";

export default async function HomePage() {
  // Déjà résolu par la mise en page : `cache()` évite un second aller-retour.
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  // Le mode d'affichage et non le rôle : un coach qui s'entraîne voit son
  // propre entraînement, sur ses propres séances (issue #62).
  const mode = await getViewMode();

  return mode === "coach" ? (
    <CoachDashboard coach={profile} />
  ) : (
    <AthleteHome athlete={profile} />
  );
}
