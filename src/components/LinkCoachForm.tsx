"use client";

import { useActionState } from "react";
import { linkToCoach } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass } from "@/lib/styles";

export function LinkCoachForm() {
  const [state, action] = useActionState(linkToCoach, null);

  return (
    <form action={action} className="mt-3">
      <div className="flex gap-2">
        <input
          name="code"
          required
          placeholder="Code coach"
          autoCapitalize="characters"
          aria-label="Code coach"
          className={`${inputClass} uppercase tracking-[0.2em] font-display`}
        />
        <SubmitButton className="shrink-0 px-4 py-2.5">Rejoindre</SubmitButton>
      </div>
      {state?.error && (
        <p className="mt-2 text-sm font-medium text-rpe-max">{state.error}</p>
      )}
    </form>
  );
}
