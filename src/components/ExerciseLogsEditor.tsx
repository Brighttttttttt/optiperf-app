"use client";

import { useState } from "react";
import { inputClass } from "@/lib/styles";
import type { ExerciseLogDraft } from "@/lib/exercises";
import type { Exercise } from "@/lib/types";

type LigneLog = {
  exercise_id: string;
  sets_done: string;
  reps_done: string;
  charge_kg_done: string;
  done: boolean;
};

/**
 * Compte rendu exercice par exercice, à la complétion d'une séance de
 * musculation — le pendant de la saisie RPE/durée pour le running.
 * Préremplie avec la prescription : l'athlète n'a qu'à corriger ce qui a
 * réellement différé, pas tout retaper.
 */
export function ExerciseLogsEditor({ exercises }: { exercises: Exercise[] }) {
  const tries = [...exercises].sort((a, b) => a.position - b.position);
  const [lignes, setLignes] = useState<LigneLog[]>(() =>
    tries.map((e) => ({
      exercise_id: e.id,
      sets_done: String(e.sets),
      reps_done: String(e.reps),
      charge_kg_done: e.charge_kg !== null ? String(e.charge_kg) : "",
      done: true,
    }))
  );

  function majLigne(i: number, patch: Partial<LigneLog>) {
    setLignes(lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const logs: ExerciseLogDraft[] = lignes.map((l) => ({
    exercise_id: l.exercise_id,
    sets_done: l.sets_done.trim() ? Math.round(Number(l.sets_done)) : null,
    reps_done: l.reps_done.trim() ? Math.round(Number(l.reps_done)) : null,
    charge_kg_done: l.charge_kg_done.trim() ? Number(l.charge_kg_done) : null,
    done: l.done,
  }));

  return (
    <div>
      <p className={`text-[13px] font-semibold text-ink-soft mb-1.5`}>Exercices</p>
      <div className="space-y-2">
        {tries.map((ex, i) => (
          <div key={ex.id} className="rounded-xl border border-line bg-surface p-2.5">
            <label className="flex items-center gap-2 text-[14px] font-semibold">
              <input
                type="checkbox"
                checked={lignes[i].done}
                onChange={(e) => majLigne(i, { done: e.target.checked })}
                className="size-4 accent-pine"
              />
              {ex.name}
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-ink-soft" htmlFor={`log-series-${ex.id}`}>
                  Séries
                </label>
                <input
                  id={`log-series-${ex.id}`}
                  type="number"
                  min={0}
                  value={lignes[i].sets_done}
                  onChange={(e) => majLigne(i, { sets_done: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-soft" htmlFor={`log-reps-${ex.id}`}>
                  Répétitions
                </label>
                <input
                  id={`log-reps-${ex.id}`}
                  type="number"
                  min={0}
                  value={lignes[i].reps_done}
                  onChange={(e) => majLigne(i, { reps_done: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-soft" htmlFor={`log-charge-${ex.id}`}>
                  Charge (kg)
                </label>
                <input
                  id={`log-charge-${ex.id}`}
                  type="number"
                  step={0.5}
                  min={0}
                  value={lignes[i].charge_kg_done}
                  onChange={(e) => majLigne(i, { charge_kg_done: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <input type="hidden" name="exercise_logs" value={JSON.stringify(logs)} />
    </div>
  );
}
