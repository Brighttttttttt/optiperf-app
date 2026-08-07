"use client";

import { usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui";

/**
 * L'onglet Messagerie affiche déjà son propre retour (vers la fiche, via
 * MessageThread) : sans ce garde, les deux entêtes empilées produisaient
 * deux liens "Retour" simultanés, ambigus pour les tests comme pour un
 * lecteur d'écran.
 */
export function AthleteHeader({ athleteId, title }: { athleteId: string; title: string }) {
  const pathname = usePathname();
  const onMessagerie = pathname === `/athletes/${athleteId}/messagerie`;

  return (
    <PageHeader eyebrow="Athlète" title={title} backHref={onMessagerie ? undefined : "/"} />
  );
}
