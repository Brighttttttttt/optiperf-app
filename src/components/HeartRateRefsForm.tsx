"use client";

import { useActionState } from "react";
import { updateHeartRateRefs } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";

export function HeartRateRefsForm({
  fcMax,
  fcRepos,
}: {
  fcMax: number | null;
  fcRepos: number | null;
}) {
  const [state, action] = useActionState(updateHeartRateRefs, null);

  return (
    <form action={action} className="grid grid-cols-2 gap-2.5">
      <div>
        <label className={labelClass} htmlFor="settings-fc-max">
          FC max (bpm)
        </label>
        <input
          id="settings-fc-max"
          name="fc_max"
          type="number"
          inputMode="numeric"
          min={100}
          max={230}
          defaultValue={fcMax ?? ""}
          placeholder="185"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="settings-fc-repos">
          FC repos (bpm)
        </label>
        <input
          id="settings-fc-repos"
          name="fc_repos"
          type="number"
          inputMode="numeric"
          min={25}
          max={120}
          defaultValue={fcRepos ?? ""}
          placeholder="Facultatif"
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p className="col-span-2 text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      {state?.ok && (
        <p className="col-span-2 text-sm font-medium text-pine">Enregistré.</p>
      )}
      <SubmitButton className="col-span-2 py-2.5">Enregistrer</SubmitButton>
    </form>
  );
}
