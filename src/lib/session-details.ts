import type { createClient } from "./supabase/server";
import type { Exercise, ExerciseLog, WorkoutBlock } from "./types";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Ce qu'une séance porte en plus de ses champs propres, indexé par séance. */
export type SessionDetails = {
  blocksBySession: Record<string, WorkoutBlock[]>;
  exercisesBySession: Record<string, Exercise[]>;
  logsBySession: Record<string, ExerciseLog[]>;
};

const VIDE: SessionDetails = {
  blocksBySession: {},
  exercisesBySession: {},
  logsBySession: {},
};

function grouper<T>(lignes: T[], cle: (l: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const ligne of lignes) {
    (out[cle(ligne)] ??= []).push(ligne);
  }
  return out;
}

/**
 * Blocs, exercices et compte rendu d'exercices de plusieurs séances, en une
 * passe plutôt qu'une requête par séance.
 *
 * Chargé pour toute la fenêtre de la vue semaine (±8 semaines) et non pour
 * la seule semaine affichée : la navigation d'une semaine à l'autre est
 * volontairement sans aller-retour serveur, et le rester suppose d'avoir
 * déjà sous la main ce qu'elle affichera.
 *
 * La RLS fait le tri : rien à filtrer ici par athlète.
 */
export async function chargerDetailsSeances(
  supabase: Client,
  sessionIds: string[]
): Promise<SessionDetails> {
  if (sessionIds.length === 0) return VIDE;

  const [blocsRes, exercicesRes] = await Promise.all([
    supabase.from("workout_blocks").select("*").in("session_id", sessionIds).order("position"),
    supabase.from("exercises").select("*").in("session_id", sessionIds).order("position"),
  ]);

  const blocs = (blocsRes.data ?? []) as WorkoutBlock[];
  const exercices = (exercicesRes.data ?? []) as Exercise[];

  // Le compte rendu se rattache à l'exercice, pas à la séance : il n'y a rien
  // à demander tant qu'aucun exercice n'a été prescrit.
  const { data: logsData } =
    exercices.length > 0
      ? await supabase
          .from("exercise_logs")
          .select("*")
          .in(
            "exercise_id",
            exercices.map((e) => e.id)
          )
      : { data: null };
  const logs = (logsData ?? []) as ExerciseLog[];

  const seanceParExercice = new Map(exercices.map((e) => [e.id, e.session_id]));

  return {
    blocksBySession: grouper(blocs, (b) => b.session_id),
    exercisesBySession: grouper(exercices, (e) => e.session_id),
    logsBySession: grouper(logs, (l) => seanceParExercice.get(l.exercise_id) ?? ""),
  };
}
