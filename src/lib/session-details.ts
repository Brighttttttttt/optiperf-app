import type { createClient } from "./supabase/server";
import type {
  Activity,
  ActivityLap,
  Exercise,
  ExerciseLog,
  WorkoutBlock,
} from "./types";
import { analyserSeance, type AnalyseSeance } from "./analyse-seance";

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

/**
 * L'analyse de plusieurs séances, en deux requêtes plutôt qu'une par séance.
 *
 * Même raison d'être que `chargerDetailsSeances` : les listes affichent la
 * structure et le résumé de chaque séance, et les demander une par une ferait
 * autant d'allers-retours qu'il y a de lignes.
 *
 * L'analyse n'est pas stockée (voir `analyse-seance.ts`) : elle se recalcule
 * ici à chaque affichage. C'est du calcul pur sur une vingtaine de tours —
 * sans commune mesure avec le coût d'une requête.
 *
 * Une séance sans tours n'apparaît pas dans le résultat : c'est le cas d'un
 * GPX, d'une saisie à la main, ou d'une séance sans activité rattachée.
 */
export async function chargerAnalysesSeances(
  supabase: Client,
  sessionIds: string[]
): Promise<Record<string, AnalyseSeance>> {
  if (sessionIds.length === 0) return {};

  // Une séance peut agréger plusieurs activités ; la plus récente la
  // représente, comme partout ailleurs dans l'app.
  const { data: activitesData } = await supabase
    .from("activities")
    .select("id, session_id, avg_heart_rate")
    .in("session_id", sessionIds)
    .order("started_at", { ascending: false });

  const activites = (activitesData ?? []) as Pick<
    Activity,
    "id" | "session_id" | "avg_heart_rate"
  >[];

  const representante = new Map<string, (typeof activites)[number]>();
  for (const a of activites) {
    if (a.session_id && !representante.has(a.session_id)) {
      representante.set(a.session_id, a);
    }
  }
  if (representante.size === 0) return {};

  const { data: toursData } = await supabase
    .from("activity_laps")
    .select("activity_id, position, duration_s, distance_m, avg_heart_rate")
    .in("activity_id", [...representante.values()].map((a) => a.id))
    .order("position");

  const parActivite = grouper(
    (toursData ?? []) as Pick<
      ActivityLap,
      "activity_id" | "position" | "duration_s" | "distance_m" | "avg_heart_rate"
    >[],
    (t) => t.activity_id
  );

  const out: Record<string, AnalyseSeance> = {};
  for (const [sessionId, activite] of representante) {
    const tours = parActivite[activite.id];
    if (!tours || tours.length === 0) continue;
    out[sessionId] = analyserSeance(
      tours.map((t) => ({
        position: t.position,
        durationS: t.duration_s,
        distanceM: t.distance_m,
        avgHeartRate: t.avg_heart_rate,
      })),
      activite.avg_heart_rate
    );
  }
  return out;
}
