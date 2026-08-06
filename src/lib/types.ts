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
  created_at: string;
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
