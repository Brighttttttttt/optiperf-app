"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  IconAthletes,
  IconBell,
  IconCalendar,
  IconChat,
  IconHistory,
  IconPulse,
  IconSettings,
} from "./Icons";
import type { ViewMode } from "@/lib/view-mode";

type Tab = {
  href: string;
  label: string;
  icon: (p: { className?: string }) => React.ReactNode;
  badge?: "messages" | "notifications";
};

/**
 * Les onglets suivent le **mode d'affichage**, pas le rôle : un coach qui
 * bascule sur « je m'entraîne » retrouve la navigation d'un athlète, sur ses
 * propres données (issue #62).
 */
const TABS: Record<ViewMode, Tab[]> = {
  coach: [
    { href: "/", label: "Athlètes", icon: IconAthletes },
    { href: "/messages", label: "Messages", icon: IconChat, badge: "messages" },
    { href: "/notifications", label: "Notifs", icon: IconBell, badge: "notifications" },
    { href: "/settings", label: "Réglages", icon: IconSettings },
  ],
  athlete: [
    { href: "/", label: "Accueil", icon: IconPulse },
    { href: "/planning", label: "Planning", icon: IconCalendar },
    { href: "/history", label: "Historique", icon: IconHistory },
    { href: "/messages", label: "Messages", icon: IconChat, badge: "messages" },
    { href: "/notifications", label: "Notifs", icon: IconBell, badge: "notifications" },
    { href: "/settings", label: "Réglages", icon: IconSettings },
  ],
};

const COLONNES: Record<number, string> = {
  4: "grid grid-cols-4",
  5: "grid grid-cols-5",
  6: "grid grid-cols-6",
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
 *
 * Le trait longe le bord par lequel l'onglet touche le contenu : en haut de
 * la tuile sur téléphone (barre en bas), à gauche de la ligne sur ordinateur
 * (colonne à gauche).
 */
function TraitDeNavigation() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`absolute rounded-full bg-pine transition-opacity duration-150 inset-x-4 top-0 h-0.5 md:inset-x-auto md:inset-y-1 md:left-0 md:h-auto md:w-0.5 ${
        pending ? "opacity-100 animate-pulse" : "opacity-0"
      }`}
    />
  );
}

export function Nav({
  mode,
  userId,
  unreadMessages,
  unreadNotifications,
}: {
  mode: ViewMode;
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

  const counts = { messages: unreadMessages, notifications: unreadNotifications };
  const tabs = TABS[mode];

  return (
    // Barre collée en bas sur téléphone — c'est un geste de pouce. Colonne
    // à gauche sur ordinateur, où le pouce n'a rien à voir et où la hauteur
    // est la ressource abondante. `sticky` plutôt que `fixed` au-delà de
    // `md` : la colonne appartient alors au flux, et le contenu n'a plus à
    // réserver de place sous lui.
    //
    // Les deux mises en page sont écrites dans des variantes exclusives
    // (`max-md:` / `md:`) plutôt qu'en surcharge, parce que la surcharge s'est
    // révélée fausse : deux positions étaient déclarées au même palier, et
    // c'est la dernière émise par Tailwind — non la dernière écrite ici — qui
    // l'emportait, tandis que le décalage horizontal du téléphone n'était
    // neutralisé nulle part. La contrainte horizontale du positionnement
    // collant déportait alors la colonne au milieu du contenu où, transparente,
    // elle absorbait les clics sur une bande pleine hauteur. Deux jeux
    // disjoints ne peuvent pas se contredire : aucune propriété n'est posée
    // des deux côtés.
    <nav
      aria-label="Navigation principale"
      className="z-10 border-line max-md:fixed max-md:bottom-0 max-md:left-1/2 max-md:w-full max-md:max-w-md max-md:-translate-x-1/2 max-md:border-t max-md:bg-card/95 max-md:pb-[env(safe-area-inset-bottom)] max-md:backdrop-blur md:sticky md:top-0 md:h-dvh md:w-52 md:shrink-0 md:self-start md:border-r md:pt-6"
    >
      {/* Classes écrites en toutes lettres : Tailwind ne voit pas une classe
          construite à la volée. */}
      <div
        className={`${COLONNES[tabs.length] ?? "grid grid-cols-5"} md:flex md:flex-col md:gap-1 md:pr-3`}
      >
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
              className={`relative flex min-w-0 flex-col items-center gap-0.5 px-0.5 pt-2.5 pb-2 text-[11px] font-medium transition-colors md:flex-row md:items-center md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-[15px] ${
                active
                  ? "text-pine md:bg-pine-soft"
                  : "text-ink-soft hover:text-ink md:hover:bg-line/40"
              }`}
            >
              <TraitDeNavigation />
              <span className="relative md:shrink-0">
                <tab.icon className="size-6" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-rpe-max text-card text-[10px] font-bold flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              {/* Six onglets sur un écran de téléphone : le libellé le plus
                  long tient de justesse, mais ne doit jamais pousser la
                  colonne ni passer à la ligne. Aligné à gauche en colonne. */}
              <span className="w-full truncate text-center md:text-left">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
