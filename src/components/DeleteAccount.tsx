"use client";

import { useActionState, useState } from "react";
import { deleteOwnAccount } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { btnGhost, inputClass } from "@/lib/styles";
import type { Role } from "@/lib/types";

/** Suppression définitive du compte et de toutes ses données. */
export function DeleteAccount({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteOwnAccount, null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl px-4 py-3 text-[14px] font-semibold text-ink-soft transition-colors hover:text-rpe-max"
      >
        Supprimer mon compte
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-rpe-max/30 bg-card p-4">
      <p className="font-semibold text-rpe-max">Supprimer définitivement</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        Ton compte et toutes tes données seront effacés :{" "}
        {role === "coach"
          ? "profil, séances planifiées, objectifs, messages et liens avec tes athlètes"
          : "profil, séances, objectifs, messages et lien avec ton coach"}
        . Cette action est irréversible.
      </p>
      <form action={action} className="mt-3 space-y-3">
        <div>
          <label
            className="block text-[13px] font-semibold text-ink-soft mb-1.5"
            htmlFor="confirmation"
          >
            Saisis SUPPRIMER pour confirmer
          </label>
          <input
            id="confirmation"
            name="confirmation"
            autoComplete="off"
            placeholder="SUPPRIMER"
            className={inputClass}
          />
        </div>
        {state?.error && (
          <p className="text-sm font-medium text-rpe-max">{state.error}</p>
        )}
        <div className="flex gap-2">
          <SubmitButton
            className="flex-1 bg-rpe-max py-2.5 hover:bg-rpe-max/85"
            pendingText="Suppression…"
          >
            Supprimer mon compte
          </SubmitButton>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={btnGhost}
          >
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
