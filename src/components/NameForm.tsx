"use client";

import { useActionState } from "react";
import { updateName } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";
import { LIMITS } from "@/lib/types";

export function NameForm({ currentName }: { currentName: string }) {
  const [state, action] = useActionState(updateName, null);

  return (
    <form action={action}>
      <label className={labelClass} htmlFor="settings-name">
        Nom complet
      </label>
      <div className="flex gap-2">
        <input
          id="settings-name"
          name="full_name"
          defaultValue={currentName}
          required
          maxLength={LIMITS.fullName}
          className={inputClass}
        />
        <SubmitButton className="shrink-0 px-4 py-2.5">Enregistrer</SubmitButton>
      </div>
      {state?.error && (
        <p className="mt-2 text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-2 text-sm font-medium text-pine">Nom enregistré.</p>
      )}
    </form>
  );
}
