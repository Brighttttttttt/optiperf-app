import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessageThread } from "@/components/MessageThread";
import type { Message, Profile } from "@/lib/types";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // La RLS ne laisse voir que les profils liés : profil vide = accès refusé.
  const { data: partner } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle<Profile>();
  if (!partner || partner.id === user.id) redirect("/messages");

  const { data } = await supabase
    .from("messages")
    .select("*")
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${partner.id}),and(sender_id.eq.${partner.id},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true })
    .limit(500);

  return (
    <MessageThread
      meId={user.id}
      partner={partner}
      initialMessages={(data ?? []) as Message[]}
    />
  );
}
