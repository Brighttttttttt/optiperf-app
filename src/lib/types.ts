/** Limites de longueur — miroir des contraintes SQL (migrations 002 et 007). */
export const LIMITS = {
  fullName: 80,
  title: 120,
  description: 4000,
  comment: 4000,
  notes: 2000,
  message: 4000,
  externalId: 200,
  fileName: 200,
} as const;

export type Role = "coach" | "athlete";

export type Profile = {
  id: string;
  role: Role;
  full_name: string;
  invite_code: string | null;
  /** Base du calcul des zones de fréquence cardiaque (src/lib/zones.ts). */
  fc_max: number | null;
  /** Facultative, sans usage aujourd'hui : pas de calcul par réserve. */
  fc_repos: number | null;
  /** Saisie directement, éventuellement à partir d'une suggestion (src/lib/records.ts). */
  vma_kmh: number | null;
  created_at: string;
};

/**
 * Record personnel sur une distance standard. Une ligne par distance et par
 * athlète (contrainte unique) : un record se remplace quand il est battu,
 * il ne s'empile pas.
 */
export type PersonalRecord = {
  id: string;
  athlete_id: string;
  distance: string;
  duration_sec: number;
  achieved_on: string | null;
  updated_at: string;
};

export type SessionStatus = "planned" | "completed" | "missed";

export const SESSION_TYPES = [
  { value: "endurance", label: "Endurance" },
  { value: "intervalles", label: "Intervalles" },
  { value: "tempo", label: "Tempo / Seuil" },
  { value: "renfo", label: "Renforcement" },
  { value: "recuperation", label: "Récupération" },
  { value: "competition", label: "Compétition" },
  { value: "autre", label: "Autre" },
] as const;

export type SessionType = (typeof SESSION_TYPES)[number]["value"];

export function sessionTypeLabel(type: string): string {
  return SESSION_TYPES.find((t) => t.value === type)?.label ?? type;
}

/**
 * Exercice prescrit d'une séance de musculation. Le pendant `workout_blocks`
 * pour le running : une table à part, pas des colonnes sur `sessions`.
 */
export type Exercise = {
  id: string;
  session_id: string;
  position: number;
  name: string;
  sets: number;
  reps: number;
  charge_kg: number | null;
  rest_sec: number | null;
  created_at: string;
};

/** Ce que l'athlète a réellement fait sur un exercice — le pendant muscu de `athlete_comment`. */
export type ExerciseLog = {
  id: string;
  exercise_id: string;
  athlete_id: string;
  sets_done: number | null;
  reps_done: number | null;
  charge_kg_done: number | null;
  done: boolean;
  athlete_comment: string | null;
  updated_at: string;
};

export type TrainingSession = {
  id: string;
  athlete_id: string;
  coach_id: string | null;
  date: string; // YYYY-MM-DD
  title: string;
  type: string;
  description: string | null;
  duration_planned_min: number | null;
  status: SessionStatus;
  duration_actual_min: number | null;
  rpe: number | null;
  athlete_comment: string | null;
  completed_at: string | null;
  created_at: string;
};

/**
 * Un bloc d'une séance running structurée (échauffement, intervalle,
 * récupération, retour au calme). Le texte libre `description` reste le
 * repli pour une séance simple.
 */
export type WorkoutBlock = {
  id: string;
  session_id: string;
  position: number;
  block_type: string;
  duration_sec: number | null;
  distance_m: number | null;
  target_pace_sec_per_km: number | null;
  repetitions: number | null;
  created_at: string;
};

export type SessionTemplate = {
  id: string;
  coach_id: string;
  title: string;
  type: string;
  description: string | null;
  duration_planned_min: number | null;
  created_at: string;
};

export type Objective = {
  id: string;
  athlete_id: string;
  title: string;
  target_date: string | null;
  notes: string | null;
  created_at: string;
};

/**
 * Note libre du coach sur un athlète (migration 015). Invisible pour
 * l'athlète : la RLS ne lui écrit aucune politique.
 */
export type CoachNote = {
  id: string;
  coach_id: string;
  athlete_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
};

/**
 * Provenance d'une activité importée. `fichier` est le dépôt manuel d'un
 * export de montre ; les autres viendront avec les connexions déléguées.
 */
export const ACTIVITY_SOURCES = [
  // Ce que l'athlète comprend, et non le moyen technique : il importe sa
  // montre, la valeur stockée restant `fichier`.
  { value: "fichier", label: "Montre" },
  { value: "strava", label: "Strava" },
  { value: "garmin", label: "Garmin" },
  { value: "coros", label: "Coros" },
] as const;

export type ActivitySource = (typeof ACTIVITY_SOURCES)[number]["value"];

export function activitySourceLabel(source: string): string {
  return ACTIVITY_SOURCES.find((s) => s.value === source)?.label ?? source;
}

/**
 * Ce qu'une montre a enregistré. Le lien vers une séance est facultatif : une
 * activité peut rester non rattachée, et une séance en agréger plusieurs.
 */
export type Activity = {
  id: string;
  athlete_id: string;
  session_id: string | null;
  source: ActivitySource;
  external_id: string;
  file_name: string | null;
  started_at: string;
  date: string; // YYYY-MM-DD, jour vécu à Paris
  duration_min: number;
  distance_m: number | null;
  avg_heart_rate: number | null;
  created_at: string;
};

/**
 * Trace d'une activité importée (FC/allure/altitude au fil du temps) : une
 * ligne par activité, quatre tableaux parallèles plutôt qu'une ligne par
 * point. Absente si le fichier ne portait ni FC, ni position, ni altitude
 * exploitables.
 */
export type ActivityTrace = {
  activity_id: string;
  athlete_id: string;
  t_s: number[];
  heart_rate: (number | null)[] | null;
  pace_sec_per_km: (number | null)[] | null;
  altitude_m: (number | null)[] | null;
  created_at: string;
};

/**
 * Un tour d'une activité importée (migration 016) : ce que la montre a
 * enregistré entre deux bips. Une ligne par tour, contrairement à la trace —
 * une séance en compte une vingtaine, pas sept mille points.
 *
 * Absent d'un GPX, qui ne contient pas de tours.
 */
export type ActivityLap = {
  activity_id: string;
  athlete_id: string;
  position: number;
  duration_s: number;
  distance_m: number | null;
  avg_heart_rate: number | null;
  avg_cadence: number | null;
  created_at: string;
};

export type AppNotification = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};
