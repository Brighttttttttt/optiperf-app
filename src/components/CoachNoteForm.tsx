"use client";

import { useActionState, useState } from "react";
import { saveCoachNote } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { btnGhost, inputClass } from "@/lib/styles";
import { LIMITS } from "@/lib/types";

/**
 * Carnet du coach sur un athlète : ce qui ne se rattache ni à un objectif ni
 * à une séance.
 *
 * Affiché en lecture tant qu'on n'y touche pas — c'est ainsi qu'on s'en sert
 * neuf fois sur dix. La zone de saisie ne s'ouvre qu'à la demande, sinon la
 * fiche donnerait l'impression d'un formulaire à remplir alors qu'elle est
 * d'abord un tableau de bord.
 *
 * Vider le champ et enregistrer efface la note : c'est le geste attendu, et
 * l'action serveur le traite comme tel.
 */
export function CoachNoteForm({
  athleteId,
  note,
}: {
  athleteId: string;
  note: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(saveCoachNote, null);

  // Referme la saisie quand l'action serveur aboutit ; la note rendue vient
  // alors du serveur, pas d'un état local qui pourrait diverger.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <div>
        {note ? (
          <p className="whitespace-pre-line text-[14px] text-ink-soft">{note}</p>
        ) : (
          <p className="text-[14px] text-ink-soft/70 italic">
            Rien de noté pour l&apos;instant.
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${btnGhost} mt-2.5 w-full`}
        >
          {note ? "Modifier la note" : "Écrire une note"}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="athlete_id" value={athleteId} />
      <label className="sr-only" htmlFor="coach-note">
        Note sur cet athlète
      </label>
      <textarea
        id="coach-note"
        name="content"
        rows={5}
        defaultValue={note ?? ""}
        maxLength={LIMITS.notes}
        placeholder="Blessure passée, contrainte d'emploi du temps, préférence d'entraînement…"
        className={inputClass}
      />
      {state?.error && (
        <p className="text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton className="flex-1 py-2.5">Enregistrer</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Annuler
        </button>
      </div>
      <p className="text-[12px] text-ink-soft">
        Visible par toi seul. Vider le champ efface la note.
      </p>
    </form>
  );
}
