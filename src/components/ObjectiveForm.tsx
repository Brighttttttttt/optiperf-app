"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addObjective } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { IconPlus } from "./Icons";
import { btnGhost, inputClass, labelClass } from "@/lib/styles";

export function ObjectiveForm({ athleteId }: { athleteId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addObjective, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [state]);

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
      ref={formRef}
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
