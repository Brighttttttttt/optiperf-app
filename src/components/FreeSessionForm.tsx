"use client";

import { useActionState, useState } from "react";
import { addFreeSession } from "@/app/(app)/actions";
import { RpeScale } from "./RpeScale";
import { SubmitButton } from "./SubmitButton";
import { btnGhost, inputClass, labelClass } from "@/lib/styles";
import { LIMITS, SESSION_TYPES } from "@/lib/types";
import { toISODate } from "@/lib/dates";

/** Enregistrer une séance non planifiée par le coach. */
export function FreeSessionForm({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: () => void;
}) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [state, action] = useActionState(addFreeSession, null);

  const [prevState, setPrevState] = useState(state);
  if (state !== prevState) {
    setPrevState(state);
    if (state?.ok) onDone();
  }

  return (
    <div className="bg-card border border-line rounded-2xl p-4">
      <p className="font-display text-[18px] font-semibold uppercase tracking-wide">
        Séance libre
      </p>
      <form action={action} className="mt-3 space-y-3.5">
        <div>
          <label className={labelClass} htmlFor="free-title">
            Titre
          </label>
          <input
            id="free-title"
            name="title"
            required
            maxLength={LIMITS.title}
            placeholder="Ex. Footing du midi"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass} htmlFor="free-type">
              Type
            </label>
            <select id="free-type" name="type" className={`${inputClass} min-h-[52px]`}>
              {SESSION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="free-date">
              Date
            </label>
            <input
              id="free-date"
              name="date"
              type="date"
              defaultValue={toISODate(new Date())}
              max={toISODate(new Date())}
              required
              // Hauteur minimale plutôt que fixe : sur iOS, le contrôle natif
              // de date ignore le padding et impose sa propre hauteur — la
              // forcer plus petite (h-12) l'a laissée inchangée tout en
              // rétrécissant le <select>, creusant l'écart au lieu de le
              // combler. En hauteur minimale, le <select> peut grandir pour
              // rejoindre la date, jamais l'inverse.
              className={`${inputClass} min-h-[52px]`}
            />
          </div>
        </div>
        <div>
          <span className={labelClass}>Effort ressenti (RPE)</span>
          <RpeScale value={rpe} onChange={setRpe} />
          <input type="hidden" name="rpe" value={rpe ?? ""} />
        </div>
        <div>
          <label className={labelClass} htmlFor="free-duration">
            Durée (minutes)
          </label>
          <input
            id="free-duration"
            name="duration_actual_min"
            type="number"
            inputMode="numeric"
            min={1}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="free-comment">
            Analyse de séance
          </label>
          <textarea
            id="free-comment"
            name="athlete_comment"
            rows={2}
            maxLength={LIMITS.comment}
            placeholder="Sensations, contexte…"
            className={inputClass}
          />
        </div>
        {state?.error && (
          <p className="text-sm font-medium text-rpe-max">{state.error}</p>
        )}
        <div className="flex gap-2">
          <SubmitButton className="flex-1 py-2.5">Enregistrer</SubmitButton>
          <button type="button" onClick={onCancel} className={btnGhost}>
            Annuler
          </button>
        </div>
      </form>
    </div>
  );
}
