import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/session";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Lecture locale du jeton : aucun aller-retour réseau ici.
  const user = await getSessionUser();
  if (!user) redirect("/login");

  // Le profil ne conditionne aucune des deux autres requêtes : les trois
  // partent ensemble plutôt qu'en cascade.
  const supabase = await createClient();
  const [profile, msgRes, notifRes] = await Promise.all([
    getSessionProfile(),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);
  if (!profile) redirect("/login");

  return (
    <div className="w-full max-w-md mx-auto min-h-dvh flex flex-col">
      <main className="flex-1 pb-28">{children}</main>
      <BottomNav
        role={profile.role}
        userId={user.id}
        unreadMessages={msgRes.count ?? 0}
        unreadNotifications={notifRes.count ?? 0}
      />
    </div>
  );
}
