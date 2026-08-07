/** Séances de musculation : exercices prescrits, puis réalisés. */

/** Un exercice tel que manipulé côté formulaire coach, avant enregistrement. */
export type ExerciseDraft = {
  name: string;
  sets: number;
  reps: number;
  charge_kg: number | null;
  rest_sec: number | null;
};

/** Ce que l'athlète a réellement fait sur un exercice donné. */
export type ExerciseLogDraft = {
  exercise_id: string;
  sets_done: number | null;
  reps_done: number | null;
  charge_kg_done: number | null;
  done: boolean;
};

/** "4×8 @ 40 kg" ; "4×8" sans charge (poids du corps). */
export function formatExercise(sets: number, reps: number, chargeKg: number | null): string {
  const base = `${sets} × ${reps}`;
  return chargeKg !== null ? `${base} @ ${formatCharge(chargeKg)}` : base;
}

/** 40 → "40 kg" ; 42.5 → "42,5 kg". */
export function formatCharge(kg: number): string {
  return `${kg.toFixed(kg % 1 === 0 ? 0 : 1).replace(".", ",")} kg`;
}

const nombreOuNull = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined) return null;
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
};

/**
 * Revalide côté serveur la liste d'exercices prescrits par le coach (JSON
 * dans un champ caché) : un formulaire se manipule. Un exercice sans nom,
 * sans séries ou sans répétitions est écarté plutôt que de faire échouer
 * tout l'enregistrement de la séance.
 */
export function validerExercices(brut: string): ExerciseDraft[] {
  if (!brut) return [];
  let donnees: unknown;
  try {
    donnees = JSON.parse(brut);
  } catch {
    return [];
  }
  if (!Array.isArray(donnees)) return [];

  return donnees
    .slice(0, 30)
    .map((e): ExerciseDraft | null => {
      if (typeof e !== "object" || e === null) return null;
      const o = e as Record<string, unknown>;
      const name = typeof o.name === "string" ? o.name.trim().slice(0, 120) : "";
      const sets = nombreOuNull(o.sets, 1, 20);
      const reps = nombreOuNull(o.reps, 1, 100);
      if (!name || sets === null || reps === null) return null;

      return {
        name,
        sets,
        reps,
        charge_kg: nombreOuNull(o.charge_kg, 0, 500),
        rest_sec: nombreOuNull(o.rest_sec, 0, 1800),
      };
    })
    .filter((e): e is ExerciseDraft => e !== null);
}

/**
 * Revalide côté serveur le compte rendu envoyé par l'athlète : un exercice
 * sans `exercise_id` reconnaissable est écarté, les valeurs hors bornes
 * remplacées par null plutôt que de rejeter tout l'enregistrement.
 */
export function validerExerciseLogs(brut: string): ExerciseLogDraft[] {
  if (!brut) return [];
  let donnees: unknown;
  try {
    donnees = JSON.parse(brut);
  } catch {
    return [];
  }
  if (!Array.isArray(donnees)) return [];

  return donnees
    .slice(0, 30)
    .map((e): ExerciseLogDraft | null => {
      if (typeof e !== "object" || e === null) return null;
      const o = e as Record<string, unknown>;
      const exercise_id = typeof o.exercise_id === "string" ? o.exercise_id : "";
      if (!exercise_id) return null;

      return {
        exercise_id,
        sets_done: nombreOuNull(o.sets_done, 0, 20),
        reps_done: nombreOuNull(o.reps_done, 0, 100),
        charge_kg_done: nombreOuNull(o.charge_kg_done, 0, 500),
        done: o.done === true,
      };
    })
    .filter((e): e is ExerciseLogDraft => e !== null);
}
