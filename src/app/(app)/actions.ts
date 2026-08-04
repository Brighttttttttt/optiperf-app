"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean } | null;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

// ---------- Séances ----------

export async function planSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const athleteId = String(formData.get("athlete_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!athleteId || !title || !date) {
    return { error: "Titre et date sont obligatoires." };
  }

  const duration = Number(formData.get("duration_planned_min"));
  const { error } = await supabase.from("sessions").insert({
    athlete_id: athleteId,
    coach_id: user.id,
    date,
    title,
    type: String(formData.get("type") ?? "endurance"),
    description: String(formData.get("description") ?? "").trim() || null,
    duration_planned_min: Number.isFinite(duration) && duration > 0 ? duration : null,
  });
  if (error) return { error: "Impossible d'enregistrer la séance." };

  revalidatePath("/", "layout");
  redirect(`/athletes/${athleteId}`);
}

export async function completeSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(formData.get("session_id") ?? "");
  const rpe = Number(formData.get("rpe"));
  const duration = Number(formData.get("duration_actual_min"));
  if (!id) return { error: "Séance introuvable." };
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
    return { error: "Choisis ton effort ressenti (RPE) de 1 à 10." };
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "Indique la durée réelle en minutes." };
  }

  const { error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      rpe,
      duration_actual_min: duration,
      athlete_comment: String(formData.get("athlete_comment") ?? "").trim() || null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: "Impossible d'enregistrer. Réessaie." };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addFreeSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const rpe = Number(formData.get("rpe"));
  const duration = Number(formData.get("duration_actual_min"));
  if (!title || !date) return { error: "Titre et date sont obligatoires." };
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
    return { error: "Choisis ton effort ressenti (RPE) de 1 à 10." };
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "Indique la durée en minutes." };
  }

  const { error } = await supabase.from("sessions").insert({
    athlete_id: user.id,
    coach_id: null,
    date,
    title,
    type: String(formData.get("type") ?? "autre"),
    status: "completed",
    rpe,
    duration_actual_min: duration,
    athlete_comment: String(formData.get("athlete_comment") ?? "").trim() || null,
    completed_at: new Date().toISOString(),
  });
  if (error) return { error: "Impossible d'enregistrer la séance." };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function missSession(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("session_id") ?? "");
  if (!id) return;
  await supabase.from("sessions").update({ status: "missed" }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteSession(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("session_id") ?? "");
  if (!id) return;
  await supabase.from("sessions").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// ---------- Objectifs ----------

export async function addObjective(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const athleteId = String(formData.get("athlete_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!athleteId || !title) return { error: "Donne un titre à l'objectif." };

  const targetDate = String(formData.get("target_date") ?? "");
  const { error } = await supabase.from("objectives").insert({
    athlete_id: athleteId,
    title,
    target_date: targetDate || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
  });
  if (error) return { error: "Impossible d'ajouter l'objectif." };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteObjective(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("objective_id") ?? "");
  if (!id) return;
  await supabase.from("objectives").delete().eq("id", id);
  revalidatePath("/", "layout");
}

// ---------- Liaison coach ↔ athlète ----------

export async function linkToCoach(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Saisis le code partagé par ton coach." };

  const { error } = await supabase.rpc("link_to_coach", { code });
  if (error) return { error: "Code invalide. Vérifie auprès de ton coach." };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Profil ----------

export async function updateName(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Le nom ne peut pas être vide." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (error) return { error: "Impossible d'enregistrer." };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Notifications ----------

export async function markAllNotificationsRead() {
  const { supabase, user } = await requireUser();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  revalidatePath("/", "layout");
}
