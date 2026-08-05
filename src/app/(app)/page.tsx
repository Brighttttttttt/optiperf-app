import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/supabase/session";
import { CoachDashboard } from "@/components/home/CoachDashboard";
import { AthleteHome } from "@/components/home/AthleteHome";

export default async function HomePage() {
  // Déjà résolu par la mise en page : `cache()` évite un second aller-retour.
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  return profile.role === "coach" ? (
    <CoachDashboard coach={profile} />
  ) : (
    <AthleteHome athlete={profile} />
  );
}
