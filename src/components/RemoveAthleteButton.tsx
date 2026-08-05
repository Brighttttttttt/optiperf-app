"use client";

import { useState } from "react";
import { removeAthlete } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { btnGhost } from "@/lib/styles";

/** Retire un athlète du groupe du coach — confirmation en deux temps. */
export function RemoveAthleteButton({
  athleteId,
  athleteName,
}: {
  athleteId: string;
  athleteName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="w-full rounded-xl border border-line bg-card px-4 py-3 text-[15px] font-semibold text-ink-soft transition-colors hover:border-rpe-max/40 hover:text-rpe-max"
      >
        Retirer de mon groupe
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-rpe-max/30 bg-card p-4">
      <p className="font-semibold">Retirer {athleteName} ?</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        Tu ne verras plus son suivi et vous ne pourrez plus échanger de
        messages. Son compte et son historique lui restent acquis. Tu pourras
        le réintégrer avec ton code coach.
      </p>
      <div className="mt-3 flex gap-2">
        <form action={removeAthlete} className="flex-1">
          <input type="hidden" name="athlete_id" value={athleteId} />
          <SubmitButton className="w-full bg-rpe-max py-2.5 hover:bg-rpe-max/85">
            Retirer
          </SubmitButton>
        </form>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={btnGhost}
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
