"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IconAthletes,
  IconBell,
  IconChat,
  IconHistory,
  IconPulse,
  IconSettings,
} from "./Icons";
import type { Role } from "@/lib/types";

type Tab = {
  href: string;
  label: string;
  icon: (p: { className?: string }) => React.ReactNode;
  badge?: "messages" | "notifications";
};

const TABS: Record<Role, Tab[]> = {
  coach: [
    { href: "/", label: "Athlètes", icon: IconAthletes },
    { href: "/messages", label: "Messages", icon: IconChat, badge: "messages" },
    { href: "/notifications", label: "Notifs", icon: IconBell, badge: "notifications" },
    { href: "/settings", label: "Réglages", icon: IconSettings },
  ],
  athlete: [
    { href: "/", label: "Accueil", icon: IconPulse },
    { href: "/history", label: "Historique", icon: IconHistory },
    { href: "/messages", label: "Messages", icon: IconChat, badge: "messages" },
    { href: "/notifications", label: "Notifs", icon: IconBell, badge: "notifications" },
    { href: "/settings", label: "Réglages", icon: IconSettings },
  ],
};

/**
 * Trait sous l'onglet touché, le temps que la page arrive.
 *
 * Le retour visuel passe par un état client posé après hydratation, et non
 * par un `loading.tsx` : celui de #36 ouvrait une frontière de suspension sur
 * la route entière, et l'échange de fin de flux ne se produisait pas en
 * production — les pages restaient définitivement sur leur squelette
 * (incident #44, corrigé en urgence par #43). Ce mode de panne est
 * structurellement hors d'atteinte ici : aucune frontière n'est créée.
 *
 * Toujours rendu, seule l'opacité change : un élément qui apparaît décalerait
 * la mise en page au moment même où l'utilisateur attend.
 */
function TraitDeNavigation() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`absolute inset-x-4 top-0 h-0.5 rounded-full bg-pine transition-opacity duration-150 ${
        pending ? "opacity-100 animate-pulse" : "opacity-0"
      }`}
    />
  );
}

export function BottomNav({
  role,
  userId,
  unreadMessages,
  unreadNotifications,
}: {
  role: Role;
  userId: string;
  unreadMessages: number;
  unreadNotifications: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Nouveaux messages / notifications → rafraîchit les compteurs serveur.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`nav:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${userId}`,
        },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, router]);

  // Plein écran conversation : la barre laisse toute la place au fil.
  if (/^\/messages\/./.test(pathname)) return null;

  const counts = { messages: unreadMessages, notifications: unreadNotifications };
  const tabs = TABS[role];

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <div className={`grid ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {tabs.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          const count = tab.badge ? counts[tab.badge] : 0;
          return (
            <Link
              key={tab.href}
              href={tab.href as never}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors ${
                active ? "text-pine" : "text-ink-soft hover:text-ink"
              }`}
            >
              <TraitDeNavigation />
              <span className="relative">
                <tab.icon className="size-6" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-rpe-max text-card text-[10px] font-bold flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
