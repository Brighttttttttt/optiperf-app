import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoachDashboard } from "@/components/home/CoachDashboard";
import { AthleteHome } from "@/components/home/AthleteHome";
import type { Profile } from "@/lib/types";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login");

  return profile.role === "coach" ? (
    <CoachDashboard coach={profile} />
  ) : (
    <AthleteHome athlete={profile} />
  );
}
