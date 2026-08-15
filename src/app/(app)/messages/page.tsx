import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/session";
import { getViewMode } from "@/lib/view-mode";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { formatTimestamp } from "@/lib/dates";
import { initials } from "@/lib/initials";
import type { Message, Profile } from "@/lib/types";

export default async function MessagesPage() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const profile = await getSessionProfile();
  if (!user || !profile) redirect("/login");
  // Sert au seul texte de l'état vide : un coach qui s'entraîne et n'a pas
  // encore de coach doit lire l'invitation qui le concerne.
  const mode = await getViewMode();

  // La sécurité RLS ne laisse voir que les profils liés : tout profil autre
  // que le sien est donc un interlocuteur — ses athlètes s'il est coach, son
  // coach s'il est athlète. Un coach qui s'entraîne y trouve les deux, sans
  // rien à filtrer ici. Une seule requête, en parallèle des messages.
  const [partnersRes, msgRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .neq("id", user.id)
      .order("full_name"),
    supabase
      .from("messages")
      .select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const partners = (partnersRes.data ?? []) as Profile[];
  const messages = (msgRes.data ?? []) as Message[];

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
                mode === "coach"
                  ? "Aucun athlète dans ton groupe"
                  : "Aucune discussion"
              }
              // « Tu n'es pas encore lié à un coach » présentait l'absence de
              // coach comme un état transitoire à corriger (#138). Le fait
              // suffit, et le geste reste indiqué pour qui le cherche.
              hint={
                mode === "coach"
                  ? "Partage ton code coach (Réglages) pour ouvrir tes premières discussions."
                  : "La messagerie s'ouvre avec ton coach. Si tu en as un, saisis son code dans Réglages."
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
