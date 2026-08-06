"use client";

import { useActionState } from "react";
import { updateSession } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";
import { LIMITS, SESSION_TYPES, type TrainingSession } from "@/lib/types";

export function EditSessionForm({ session }: { session: TrainingSession }) {
  const [state, action] = useActionState(updateSession, null);

  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="session_id" value={session.id} />
      <input type="hidden" name="athlete_id" value={session.athlete_id} />

      <div>
        <label className={labelClass} htmlFor="edit-title">
          Titre
        </label>
        <input
          id="edit-title"
          name="title"
          required
          maxLength={LIMITS.title}
          defaultValue={session.title}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelClass} htmlFor="edit-date">
            Date
          </label>
          <input
            id="edit-date"
            name="date"
            type="date"
            required
            defaultValue={session.date}
            // Hauteur explicite : sur iOS, le contrôle natif de date ignore
            // en partie le padding et rend plus haut qu'un <select> avec les
            // mêmes classes.
            className={`${inputClass} h-12`}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="edit-type">
            Type
          </label>
          <select
            id="edit-type"
            name="type"
            defaultValue={session.type}
            className={`${inputClass} h-12`}
          >
            {SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="edit-duration">
          Durée prévue (minutes)
        </label>
        <input
          id="edit-duration"
          name="duration_planned_min"
          type="number"
          inputMode="numeric"
          min={1}
          defaultValue={session.duration_planned_min ?? undefined}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="edit-description">
          Consignes
        </label>
        <textarea
          id="edit-description"
          name="description"
          rows={4}
          maxLength={LIMITS.description}
          defaultValue={session.description ?? ""}
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p className="text-sm font-medium text-rpe-max">{state.error}</p>
      )}

      <SubmitButton className="w-full">Enregistrer les modifications</SubmitButton>
    </form>
  );
}
