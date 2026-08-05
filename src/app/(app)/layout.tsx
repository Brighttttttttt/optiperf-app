import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/session";
import { BottomNav } from "@/components/BottomNav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [msgRes, notifRes] = await Promise.all([
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
