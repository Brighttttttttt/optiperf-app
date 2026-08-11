import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/session";
import { Nav } from "@/components/Nav";
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
    // Colonne de téléphone jusqu'à `md`, puis barre latérale + contenu.
    // La largeur du contenu reste bornée au-delà : une ligne de texte étalée
    // sur 1500 px se lit mal, l'espace gagné sert aux grilles, pas aux
    // paragraphes.
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col md:max-w-6xl md:flex-row md:gap-6 md:px-6">
      <Nav
        mode={mode}
        userId={user.id}
        unreadMessages={msgRes.count ?? 0}
        unreadNotifications={notifRes.count ?? 0}
      />
      <div className="flex min-w-0 flex-1 flex-col md:max-w-4xl">
        {canSwitchView(profile) && (
          // Collée en haut plutôt que posée dans le flux : le mode reste
          // lisible en permanence, y compris après avoir fait défiler une
          // longue page.
          <div className="sticky top-0 z-20 flex justify-center bg-surface/95 px-5 py-2 backdrop-blur md:justify-start md:pt-6">
            <ViewModeSwitch mode={mode} />
          </div>
        )}
        <main className="flex-1 pb-28 md:pb-10">{children}</main>
      </div>
    </div>
  );
}
