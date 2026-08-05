import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { IconCalendar, IconPulse, IconBell } from "@/components/Icons";
import { markAllNotificationsRead } from "@/app/(app)/actions";
import { formatTimestamp } from "@/lib/dates";
import { btnGhost } from "@/lib/styles";
import type { AppNotification } from "@/lib/types";

function typeIcon(type: string) {
  if (type === "session_planned" || type === "week_unplanned") return IconCalendar;
  if (type === "session_completed") return IconPulse;
  return IconBell;
}

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const notifications = (data ?? []) as AppNotification[];
  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  return (
    <div>
      <PageHeader
        eyebrow={unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "À jour"}
        title="Notifications"
        action={
          unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <button type="submit" className={btnGhost}>
                Tout lire
              </button>
            </form>
          ) : undefined
        }
      />
      <div className="px-5">
        {notifications.length === 0 ? (
          <Card>
            <EmptyState
              title="Rien à signaler"
              hint="Séances planifiées, analyses publiées : tout ce qui te concerne arrive ici."
            />
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            {notifications.map((n) => {
              const Icon = typeIcon(n.type);
              const unread = n.read_at === null;
              const row = (
                <div className="flex items-start gap-3 px-4 py-3.5">
                  <span
                    className={`mt-0.5 size-9 shrink-0 rounded-full flex items-center justify-center ${
                      unread ? "bg-pine-soft text-pine" : "bg-surface text-ink-soft"
                    }`}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={unread ? "font-semibold" : "font-medium"}>
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[12px] text-ink-soft">
                        {formatTimestamp(n.created_at)}
                      </span>
                    </span>
                    {n.body && (
                      <span className="block text-[13px] text-ink-soft truncate">
                        {n.body}
                      </span>
                    )}
                  </span>
                  {unread && (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-pine" />
                  )}
                </div>
              );
              return n.link ? (
                <Link
                  key={n.id}
                  href={n.link as never}
                  className="block hover:bg-surface/60 transition-colors"
                >
                  {row}
                </Link>
              ) : (
                <div key={n.id}>{row}</div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
