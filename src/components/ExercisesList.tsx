import { formatExercise } from "@/lib/exercises";
import type { Exercise, ExerciseLog } from "@/lib/types";

/**
 * Lecture seule des exercices d'une séance de musculation, prescription et
 * réalisé côte à côte quand ce dernier existe — la structure doit se
 * distinguer d'un paragraphe, pas seulement s'y ajouter.
 */
export function ExercisesList({
  exercises,
  logs = [],
}: {
  exercises: Exercise[];
  logs?: ExerciseLog[];
}) {
  if (exercises.length === 0) return null;

  const logByExercise = new Map(logs.map((l) => [l.exercise_id, l]));
  const tries = [...exercises].sort((a, b) => a.position - b.position);

  return (
    <ol className="mt-2.5 space-y-2">
      {tries.map((ex) => {
        const log = logByExercise.get(ex.id);
        return (
          <li key={ex.id} className="text-[14px]">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{ex.name}</span>
              <span className="text-ink-soft shrink-0">
                {formatExercise(ex.sets, ex.reps, ex.charge_kg)}
              </span>
            </div>
            {log && (
              <p className="text-[13px] text-ink-soft">
                {log.done ? "Fait" : "Non fait"}
                {log.sets_done !== null && log.reps_done !== null
                  ? ` · ${formatExercise(log.sets_done, log.reps_done, log.charge_kg_done)}`
                  : ""}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
