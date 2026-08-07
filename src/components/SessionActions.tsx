"use client";

import { useActionState, useState } from "react";
import { completeSession, missSession } from "@/app/(app)/actions";
import { RpeScale } from "./RpeScale";
import { SubmitButton } from "./SubmitButton";
import { ExerciseLogsEditor } from "./ExerciseLogsEditor";
import { btnGhost, btnPrimary, inputClass, labelClass } from "@/lib/styles";
import { LIMITS, type Exercise } from "@/lib/types";

/** Boutons « C'est fait » / « Manquée » d'une séance planifiée,
 *  avec le formulaire de saisie du réalisé (RPE, durée, commentaire, et
 *  exercice par exercice pour une séance de musculation). */
export function SessionActions({
  sessionId,
  defaultDuration,
  exercises = [],
}: {
  sessionId: string;
  defaultDuration: number | null;
  exercises?: Exercise[];
}) {
  const [open, setOpen] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [state, action] = useActionState(completeSession, null);

  // Referme le formulaire quand l'action serveur aboutit (ajustement
  // d'état pendant le rendu, pattern React recommandé).
  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) {
      setOpen(false);
      setRpe(null);
    }
  }

  if (!open) {
    return (
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${btnPrimary} flex-1 py-2.5 text-[15px]`}
        >
          C&apos;est fait
        </button>
        <form action={missSession}>
          <input type="hidden" name="session_id" value={sessionId} />
          <button type="submit" className={`${btnGhost} py-2.5 text-ink-soft`}>
            Manquée
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={action} className="mt-3 pt-3 border-t border-line space-y-3.5">
      <input type="hidden" name="session_id" value={sessionId} />
      <input type="hidden" name="rpe" value={rpe ?? ""} />
      <div>
        <span className={labelClass}>Effort ressenti (RPE)</span>
        <RpeScale value={rpe} onChange={setRpe} />
      </div>
      <div>
        <label className={labelClass} htmlFor={`duration-${sessionId}`}>
          Durée réelle (minutes)
        </label>
        <input
          id={`duration-${sessionId}`}
          name="duration_actual_min"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={defaultDuration ?? undefined}
          required
          className={inputClass}
        />
      </div>
      {exercises.length > 0 && <ExerciseLogsEditor exercises={exercises} />}
      <div>
        <label className={labelClass} htmlFor={`comment-${sessionId}`}>
          Analyse de séance
        </label>
        <textarea
          id={`comment-${sessionId}`}
          name="athlete_comment"
          rows={3}
          maxLength={LIMITS.comment}
          placeholder="Sensations, contexte, points à signaler…"
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p className="text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      <div className="flex gap-2">
        <SubmitButton className="flex-1 py-2.5">Enregistrer</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={btnGhost}
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
