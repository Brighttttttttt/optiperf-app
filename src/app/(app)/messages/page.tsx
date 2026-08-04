import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatTimestamp } from "@/lib/dates";
import { initials } from "@/lib/initials";
import type { Message, Profile } from "@/lib/types";

export default async function MessagesPage() {
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

  // Interlocuteurs possibles : ses athlètes (coach) ou son coach (athlète).
  let partners: Profile[] = [];
  if (profile.role === "coach") {
    const { data: links } = await supabase
      .from("coach_athletes")
      .select("athlete_id")
      .eq("coach_id", user.id);
    const ids = (links ?? []).map((l) => l.athlete_id);
    if (ids.length > 0) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .in("id", ids)
        .order("full_name");
      partners = (data ?? []) as Profile[];
    }
  } else {
    const { data: link } = await supabase
      .from("coach_athletes")
      .select("coach_id")
      .eq("athlete_id", user.id)
      .maybeSingle();
    if (link) {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", link.coach_id)
        .maybeSingle();
      if (data) partners = [data as Profile];
    }
  }

  const { data: msgData } = await supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false })
    .limit(500);
  const messages = (msgData ?? []) as Message[];

  const conversations = partners
    .map((partner) => {
      const last = messages.find(
        (m) => m.sender_id === partner.id || m.recipient_id === partner.id
      );
      const unread = messages.filter(
        (m) =>
          m.sender_id === partner.id &&
          m.recipient_id === user.id &&
          m.read_at === null
      ).length;
      return { partner, last, unread };
    })
    // Tri façon WhatsApp : conversation la plus récente en premier.
    .sort((a, b) => {
      if (a.last && b.last) return b.last.created_at.localeCompare(a.last.created_at);
      if (a.last) return -1;
      if (b.last) return 1;
      return a.partner.full_name.localeCompare(b.partner.full_name);
    });

  return (
    <div>
      <PageHeader eyebrow="Discussions" title="Messages" />
      <div className="px-5">
        {conversations.length === 0 ? (
          <Card>
            <EmptyState
              title={
                profile.role === "coach"
                  ? "Aucun athlète dans ton groupe"
                  : "Tu n'es pas encore lié à un coach"
              }
              hint={
                profile.role === "coach"
                  ? "Partage ton code coach (Réglages) pour ouvrir tes premières discussions."
                  : "Ajoute le code de ton coach dans Réglages pour discuter avec lui."
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {conversations.map(({ partner, last, unread }) => (
              <Link
                key={partner.id}
                href={`/messages/${partner.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface/60 transition-colors"
              >
                <span className="size-11 shrink-0 rounded-full bg-pine-soft text-pine font-display font-semibold text-[15px] flex items-center justify-center">
                  {initials(partner.full_name)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate ${unread > 0 ? "font-semibold" : "font-medium"}`}>
                      {partner.full_name}
                    </span>
                    {last && (
                      <span className="shrink-0 text-[12px] text-ink-soft">
                        {formatTimestamp(last.created_at)}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span
                      className={`truncate text-[13px] ${
                        unread > 0 ? "text-ink font-medium" : "text-ink-soft"
                      }`}
                    >
                      {last
                        ? `${last.sender_id === user.id ? "Vous : " : ""}${last.content}`
                        : "Écris le premier message"}
                    </span>
                    {unread > 0 && (
                      <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-pine text-card text-[11px] font-bold flex items-center justify-center">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
