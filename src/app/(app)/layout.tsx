import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: ReactNode }) {
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
