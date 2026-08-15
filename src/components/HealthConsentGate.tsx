"use client";

import Link from "next/link";
import { useActionState } from "react";
import { accepterDonneesSante } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";

/**
 * Le consentement des comptes créés avant qu'on ne le demande (#155).
 *
 * Les comptes antérieurs à la migration 020 n'ont jamais rien signé. Deux
 * façons de traiter ce vide, et une seule est honnête : leur poser la
 * question. Considérer leur inscription passée comme un accord serait
 * exactement le consentement présumé que l'article 9 exclut.
 *
 * Affiché en tête de l'accueil plutôt qu'en fenêtre modale : on ne piège
 * personne dans un dialogue dont l'app est déjà pleine de données. Rien
 * n'est masqué, rien n'est bloqué — mais la demande reste là tant qu'on n'y
 * a pas répondu, et refuser revient à supprimer son compte, ce que la carte
 * dit sans détour.
 */
export function HealthConsentGate() {
  const [state, action] = useActionState(accepterDonneesSante, null);

  return (
    <div className="rounded-2xl border border-pine/40 bg-pine-soft/40 p-4">
      <p className="font-semibold">Une autorisation à confirmer</p>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
        Optiperf calcule tes zones et ta charge à partir de{" "}
        <strong>données de santé</strong> — fréquence cardiaque, seuil, VMA,
        effort ressenti. La loi demande ton accord explicite pour les traiter,
        et ton compte est plus ancien que cette demande.{" "}
        <Link href="/confidentialite" className="font-semibold text-pine hover:underline">
          Ce qui est enregistré, et qui le voit
        </Link>
        .
      </p>
      {state?.error && (
        <p className="mt-2 text-[13px] font-medium text-rpe-max">{state.error}</p>
      )}
      <form action={action} className="mt-3">
        <SubmitButton className="py-2 text-[14px]" pendingText="Enregistrement…">
          J&apos;autorise
        </SubmitButton>
      </form>
      <p className="mt-2.5 text-[12px] text-ink-soft">
        Tu peux revenir sur cet accord à tout moment : le retirer revient à
        supprimer ton compte et tes données, depuis les réglages.
      </p>
    </div>
  );
}
