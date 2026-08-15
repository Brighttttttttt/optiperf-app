"use client";

import { useActionState } from "react";
import { deleteSession } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { btnGhost } from "@/lib/styles";
import { useState } from "react";

/**
 * Supprime une séance — confirmation en deux temps, comme pour retirer un
 * athlète.
 *
 * Le bouton n'apparaît que si la suppression est possible (`peutSupprimer`,
 * miroir de la policy 018) : proposer un geste qui échoue est pire que ne pas
 * le proposer. La base reste seule juge, et son refus s'affiche si l'affichage
 * s'est trompé.
 *
 * Le texte dit **ce qui part avec** : c'est la seule chose qu'on ne peut pas
 * découvrir après coup.
 *
 * Discret mais pleine largeur, comme la suppression de compte : une action
 * définitive ne se propose pas en bouton plein qu'on heurte du pouce, mais
 * elle doit se trouver quand on la cherche. C'est le placement — un pied de
 * page à part — qui la rend trouvable, pas la couleur (#137).
 */
export function DeleteSessionButton({
  sessionId,
  libelle = "Supprimer la séance",
  aDuContenu = false,
}: {
  sessionId: string;
  libelle?: string;
  /** Blocs, exercices ou comptes rendus d'exercices tomberont avec elle. */
  aDuContenu?: boolean;
}) {
  const [confirme, setConfirme] = useState(false);
  const [state, action] = useActionState(deleteSession, null);

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        // `py-3` sur une pleine largeur : au moins 44 px de haut, la cible
        // minimale au pouce — le geste vit en bas d'une page qu'on a fait
        // défiler, il ne doit pas se rater.
        className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:text-rpe-max"
      >
        {libelle}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-rpe-max/30 bg-card p-3">
      <p className="text-[14px] font-semibold">Supprimer cette séance ?</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        C&apos;est définitif.
        {aDuContenu && " Son contenu détaillé disparaît avec elle."} Une
        activité importée qui y était rattachée, elle, est conservée : ce que
        ta montre a mesuré reste vrai.
      </p>
      {state?.error && (
        <p className="mt-2 text-[13px] font-medium text-rpe-max">{state.error}</p>
      )}
      <div className="mt-3 flex gap-2">
        <form action={action} className="flex-1">
          <input type="hidden" name="session_id" value={sessionId} />
          <SubmitButton className="w-full bg-rpe-max py-2 text-[14px] hover:bg-rpe-max/85">
            Supprimer
          </SubmitButton>
        </form>
        <button
          type="button"
          onClick={() => setConfirme(false)}
          className={`${btnGhost} py-2 text-[14px]`}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
