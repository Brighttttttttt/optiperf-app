"use client";

import { useActionState } from "react";
import { planSession } from "@/app/(app)/actions";
import { SubmitButton } from "./SubmitButton";
import { inputClass, labelClass } from "@/lib/styles";
import { SESSION_TYPES } from "@/lib/types";
import { addDays, toISODate } from "@/lib/dates";

export function PlanSessionForm({ athleteId }: { athleteId: string }) {
  const [state, action] = useActionState(planSession, null);

  return (
    <form action={action} className="space-y-3.5">
      <input type="hidden" name="athlete_id" value={athleteId} />
      <div>
        <label className={labelClass} htmlFor="plan-title">
          Titre
        </label>
        <input
          id="plan-title"
          name="title"
          required
          placeholder="Ex. Sortie longue vallonnée"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelClass} htmlFor="plan-date">
            Date
          </label>
          <input
            id="plan-date"
            name="date"
            type="date"
            defaultValue={toISODate(addDays(new Date(), 1))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="plan-type">
            Type
          </label>
          <select id="plan-type" name="type" className={inputClass}>
            {SESSION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="plan-duration">
          Durée prévue (minutes)
        </label>
        <input
          id="plan-duration"
          name="duration_planned_min"
          type="number"
          inputMode="numeric"
          min={1}
          placeholder="Ex. 60"
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="plan-description">
          Consignes
        </label>
        <textarea
          id="plan-description"
          name="description"
          rows={4}
          placeholder={"Échauffement 15 min\n6 × 3 min allure 5 km, récup 90 s\nRetour au calme 10 min"}
          className={inputClass}
        />
      </div>
      {state?.error && (
        <p className="text-sm font-medium text-rpe-max">{state.error}</p>
      )}
      <SubmitButton className="w-full">Planifier la séance</SubmitButton>
    </form>
  );
}
