"use client";

import { useState } from "react";
import { inputClass, btnGhost } from "@/lib/styles";
import type { ExerciseDraft } from "@/lib/exercises";

type LigneExercice = {
  name: string;
  sets: string;
  reps: string;
  charge_kg: string;
  rest_sec: string;
};

const ligneVide = (): LigneExercice => ({
  name: "",
  sets: "",
  reps: "",
  charge_kg: "",
  rest_sec: "",
});

function versBrouillon(l: LigneExercice): ExerciseDraft | null {
  const name = l.name.trim();
  const sets = l.sets.trim() ? Math.round(Number(l.sets)) : null;
  const reps = l.reps.trim() ? Math.round(Number(l.reps)) : null;
  if (!name || sets === null || reps === null) return null;
  return {
    name,
    sets,
    reps,
    charge_kg: l.charge_kg.trim() ? Number(l.charge_kg) : null,
    rest_sec: l.rest_sec.trim() ? Math.round(Number(l.rest_sec) * 60) : null,
  };
}

/**
 * Construction d'une séance de musculation exercice par exercice. Sur le
 * modèle de `WorkoutBlocksEditor` : n'apparaît que pour une séance de type
 * « Renforcement », sérialise en JSON dans un champ caché, revalidé côté
 * serveur (`validerExercices`) — un formulaire se manipule.
 */
export function ExercisesEditor({ initial = [] }: { initial?: ExerciseDraft[] }) {
  const [lignes, setLignes] = useState<LigneExercice[]>(() =>
    initial.length > 0
      ? initial.map((e) => ({
          name: e.name,
          sets: String(e.sets),
          reps: String(e.reps),
          charge_kg: e.charge_kg !== null ? String(e.charge_kg) : "",
          rest_sec: e.rest_sec !== null ? String(e.rest_sec / 60) : "",
        }))
      : [ligneVide()]
  );

  function majLigne(i: number, patch: Partial<LigneExercice>) {
    setLignes(lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const exercicesValides = lignes.map(versBrouillon).filter((e): e is ExerciseDraft => e !== null);

  return (
    <div>
      <p className="text-[13px] font-semibold text-ink-soft mb-2">Exercices</p>
      <div className="space-y-2.5">
        {lignes.map((l, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={l.name}
                onChange={(e) => majLigne(i, { name: e.target.value })}
                placeholder="Nom de l'exercice"
                aria-label="Nom de l'exercice"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => setLignes(lignes.filter((_, idx) => idx !== i))}
                aria-label="Retirer cet exercice"
                className="shrink-0 size-11 rounded-lg border border-line text-ink-soft hover:text-rpe-max hover:border-rpe-max/40"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] text-ink-soft" htmlFor={`ex-series-${i}`}>
                  Séries
                </label>
                <input
                  id={`ex-series-${i}`}
                  type="number"
                  min={1}
                  value={l.sets}
                  onChange={(e) => majLigne(i, { sets: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-soft" htmlFor={`ex-reps-${i}`}>
                  Répétitions
                </label>
                <input
                  id={`ex-reps-${i}`}
                  type="number"
                  min={1}
                  value={l.reps}
                  onChange={(e) => majLigne(i, { reps: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-soft" htmlFor={`ex-charge-${i}`}>
                  Charge (kg)
                </label>
                <input
                  id={`ex-charge-${i}`}
                  type="number"
                  step={0.5}
                  min={0}
                  placeholder="Poids du corps"
                  value={l.charge_kg}
                  onChange={(e) => majLigne(i, { charge_kg: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-[11px] text-ink-soft" htmlFor={`ex-repos-${i}`}>
                  Repos (min)
                </label>
                <input
                  id={`ex-repos-${i}`}
                  type="number"
                  step={0.5}
                  min={0}
                  value={l.rest_sec}
                  onChange={(e) => majLigne(i, { rest_sec: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setLignes([...lignes, ligneVide()])}
          className={`${btnGhost} w-full`}
        >
          Ajouter un exercice
        </button>
      </div>

      <input
        type="hidden"
        name="exercises"
        value={exercicesValides.length > 0 ? JSON.stringify(exercicesValides) : ""}
      />
    </div>
  );
}
