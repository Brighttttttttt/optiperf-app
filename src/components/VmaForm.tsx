"use client";

import { useActionState } from "react";
import { updateVma } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";

export function VmaForm({ vmaKmh }: { vmaKmh: number | null }) {
  const [state, action] = useActionState(updateVma, null);

  return (
    <form action={action} className="grid grid-cols-2 gap-2.5">
      <div className="col-span-2">
        <label className={labelClass} htmlFor="settings-vma">
          VMA (km/h)
        </label>
        <input
          id="settings-vma"
          name="vma_kmh"
          type="number"
          step={0.1}
          min={8}
          max={26}
          defaultValue={vmaKmh ?? ""}
          placeholder="16.5"
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p className="col-span-2 text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      {state?.ok && <p className="col-span-2 text-sm font-medium text-pine">Enregistré.</p>}
      <SubmitButton className="col-span-2 py-2.5">Enregistrer</SubmitButton>
    </form>
  );
}
