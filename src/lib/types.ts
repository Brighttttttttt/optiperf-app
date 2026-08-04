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
