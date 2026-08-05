"use client";

import { useActionState, useState } from "react";
import { addObjective } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { IconPlus } from "./Icons";
import { btnGhost, inputClass, labelClass } from "@/lib/styles";
import { LIMITS } from "@/lib/types";

export function ObjectiveForm({ athleteId }: { athleteId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addObjective, null);

  // Referme le formulaire quand l'action serveur aboutit ; il se
  // remonte vierge à la prochaine ouverture.
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${btnGhost} w-full`}
      >
        <IconPlus className="size-4" />
        Ajouter un objectif
      </button>
    );
  }

  return (
    <form
      action={action}
      className="space-y-3 rounded-2xl border border-line bg-card p-4"
    >
      <input type="hidden" name="athlete_id" value={athleteId} />
      <div>
        <label className={labelClass} htmlFor="obj-title">
          Objectif
        </label>
        <input
          id="obj-title"
          name="title"
          required
          maxLength={LIMITS.title}
          placeholder="Ex. Marathon de Paris"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="obj-date">
          Échéance <span className="font-normal text-ink-soft">(optionnel)</span>
        </label>
        <input id="obj-date" name="target_date" type="date" className={inputClass} />
      </div>
      {state?.error && (
        <p className="text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton className="flex-1 py-2.5">Ajouter</SubmitButton>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          Annuler
        </button>
      </div>
    </form>
  );
}
