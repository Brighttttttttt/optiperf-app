"use client";

import { useActionState, useState } from "react";
import { deleteActivity } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { btnGhost } from "@/lib/styles";

/**
 * Supprime un fichier importé — confirmation en deux temps, comme pour une
 * séance.
 *
 * Le texte dit ce qui **reste** plutôt que ce qui part : c'est la surprise
 * possible. La séance survit avec son compte rendu, seule la mesure de la
 * montre disparaît. Et le fichier redevient déposable, ce qui est souvent la
 * raison même du geste.
 */
export function DeleteActivityButton({
  activityId,
  rattachee,
}: {
  activityId: string;
  /** Une activité rattachée laisse une séance derrière elle : le dire. */
  rattachee: boolean;
}) {
  const [confirme, setConfirme] = useState(false);
  const [state, action] = useActionState(deleteActivity, null);

  if (!confirme) {
    return (
      <button
        type="button"
        onClick={() => setConfirme(true)}
        className="shrink-0 rounded-lg px-2.5 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-rpe-max-soft hover:text-rpe-max"
      >
        Supprimer
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-xl border border-rpe-max/30 bg-surface p-3">
      <p className="text-[13px] text-ink-soft">
        {rattachee
          ? "La séance et ton compte rendu restent : seule la mesure de ta montre est effacée."
          : "Ce relevé n'est rattaché à aucune séance."}{" "}
        Tu pourras redéposer le fichier ensuite.
      </p>
      {state?.error && (
        <p className="mt-2 text-[13px] font-medium text-rpe-max">{state.error}</p>
      )}
      <div className="mt-3 flex gap-2">
        <form action={action} className="flex-1">
          <input type="hidden" name="activity_id" value={activityId} />
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
