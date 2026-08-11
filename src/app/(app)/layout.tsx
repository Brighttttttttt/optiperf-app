import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/session";
import { BottomNav } from "@/components/BottomNav";
import { ViewModeSwitch } from "@/components/ViewModeSwitch";
import { canSwitchView, getViewMode } from "@/lib/view-mode";

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

  // Le mode d'affichage, pas le rôle : un coach qui s'entraîne voit l'app
  // d'un athlète (issue #62). `getViewMode` lit le cookie et le ramène au
  // rôle quand il ne s'applique pas.
  const mode = await getViewMode();

  return (
    <div className="w-full max-w-md mx-auto min-h-dvh flex flex-col">
      {canSwitchView(profile) && (
        // Collée en haut plutôt que posée dans le flux : le mode reste lisible
        // en permanence, y compris après avoir fait défiler une longue page.
        <div className="sticky top-0 z-20 flex justify-center bg-surface/95 px-5 py-2 backdrop-blur">
          <ViewModeSwitch mode={mode} />
        </div>
      )}
      <main className="flex-1 pb-28">{children}</main>
      <BottomNav
        mode={mode}
        userId={user.id}
        unreadMessages={msgRes.count ?? 0}
        unreadNotifications={notifRes.count ?? 0}
      />
    </div>
  );
}
