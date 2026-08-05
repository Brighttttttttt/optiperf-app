"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/types";

export type ActionState = { error?: string; ok?: boolean } | null;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Champ obligatoire, nettoyé et borné. Renvoie null si trop long. */
function text(formData: FormData, field: string, max: number): string | null {
  const value = String(formData.get(field) ?? "").trim();
  return value.length > max ? null : value;
}

/** Champ optionnel : chaîne vide → null, trop long → undefined (rejet). */
function optionalText(
  formData: FormData,
  field: string,
  max: number
): string | null | undefined {
  const value = String(formData.get(field) ?? "").trim();
  if (value.length > max) return undefined;
  return value || null;
}

const tooLong = (what: string, max: number) => ({
  error: `${what} ne doit pas dépasser ${max} caractères.`,
});

// ---------- Séances ----------

export async function planSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const athleteId = String(formData.get("athlete_id") ?? "");
  const title = text(formData, "title", LIMITS.title);
  const date = String(formData.get("date") ?? "");
  if (title === null) return tooLong("Le titre", LIMITS.title);
  if (!athleteId || !title || !date) {
    return { error: "Titre et date sont obligatoires." };
  }
  const description = optionalText(formData, "description", LIMITS.description);
  if (description === undefined) {
    return tooLong("Les consignes", LIMITS.description);
  }

  const duration = Number(formData.get("duration_planned_min"));
  const { error } = await supabase.from("sessions").insert({
    athlete_id: athleteId,
    coach_id: user.id,
    date,
    title,
    type: String(formData.get("type") ?? "endurance"),
    description,
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
  const comment = optionalText(formData, "athlete_comment", LIMITS.comment);
  if (comment === undefined) return tooLong("Ton analyse", LIMITS.comment);

  const { error } = await supabase
    .from("sessions")
    .update({
      status: "completed",
      rpe,
      duration_actual_min: duration,
      athlete_comment: comment,
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
  const title = text(formData, "title", LIMITS.title);
  const date = String(formData.get("date") ?? "");
  const rpe = Number(formData.get("rpe"));
  const duration = Number(formData.get("duration_actual_min"));
  if (title === null) return tooLong("Le titre", LIMITS.title);
  if (!title || !date) return { error: "Titre et date sont obligatoires." };
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
    return { error: "Choisis ton effort ressenti (RPE) de 1 à 10." };
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    return { error: "Indique la durée en minutes." };
  }
  const comment = optionalText(formData, "athlete_comment", LIMITS.comment);
  if (comment === undefined) return tooLong("Ton analyse", LIMITS.comment);

  const { error } = await supabase.from("sessions").insert({
    athlete_id: user.id,
    coach_id: null,
    date,
    title,
    type: String(formData.get("type") ?? "autre"),
    status: "completed",
    rpe,
    duration_actual_min: duration,
    athlete_comment: comment,
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
  const title = text(formData, "title", LIMITS.title);
  if (title === null) return tooLong("Le titre", LIMITS.title);
  if (!athleteId || !title) return { error: "Donne un titre à l'objectif." };
  const notes = optionalText(formData, "notes", LIMITS.notes);
  if (notes === undefined) return tooLong("Les notes", LIMITS.notes);

  const targetDate = String(formData.get("target_date") ?? "");
  const { error } = await supabase.from("objectives").insert({
    athlete_id: athleteId,
    title,
    target_date: targetDate || null,
    notes,
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
  const fullName = text(formData, "full_name", LIMITS.fullName);
  if (fullName === null) return tooLong("Le nom", LIMITS.fullName);
  if (!fullName) return { error: "Le nom ne peut pas être vide." };

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
  if (error) return { error: "Impossible d'enregistrer." };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Groupe du coach ----------

export async function removeAthlete(formData: FormData) {
  const { supabase, user } = await requireUser();
  const athleteId = String(formData.get("athlete_id") ?? "");
  if (!athleteId) return;

  // La politique RLS restreint déjà la suppression aux liaisons du coach.
  // Les séances et messages passés restent chez l'athlète.
  await supabase
    .from("coach_athletes")
    .delete()
    .eq("coach_id", user.id)
    .eq("athlete_id", athleteId);

  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- Compte ----------

export async function deleteOwnAccount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (String(formData.get("confirmation") ?? "").trim() !== "SUPPRIMER") {
    return { error: "Saisis SUPPRIMER en majuscules pour confirmer." };
  }

  // Les cascades du schéma effacent profil, séances, objectifs,
  // messages, notifications et liaisons.
  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    return {
      error:
        "Suppression indisponible. Si le problème persiste, contacte le support.",
    };
  }

  await supabase.auth.signOut();
  redirect("/login");
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
