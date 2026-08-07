"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { LIMITS } from "@/lib/types";
import { MAX_BATCH_SESSIONS } from "@/lib/planning";
import { validerTrace } from "@/lib/activites";

export type ActionState = { error?: string; ok?: boolean } | null;

async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser();
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

export async function planBatch(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const athleteIds = formData.getAll("athlete_ids").map(String).filter(Boolean);
  const dates = formData.getAll("dates").map(String).filter(Boolean);
  if (athleteIds.length === 0) return { error: "Choisis au moins un athlète." };
  if (dates.length === 0) return { error: "Choisis au moins une date." };
  if (athleteIds.length * dates.length > MAX_BATCH_SESSIONS) {
    return {
      error: `Trop de séances d'un coup (maximum ${MAX_BATCH_SESSIONS}). Réduis le nombre d'athlètes ou de dates.`,
    };
  }

  const title = text(formData, "title", LIMITS.title);
  if (title === null) return tooLong("Le titre", LIMITS.title);
  if (!title) return { error: "Donne un titre à la séance." };

  const description = optionalText(formData, "description", LIMITS.description);
  if (description === undefined) return tooLong("Les consignes", LIMITS.description);

  const type = String(formData.get("type") ?? "endurance");
  const rawDuration = Number(formData.get("duration_planned_min"));
  const duration =
    Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;

  const rows = athleteIds.flatMap((athlete_id) =>
    dates.map((date) => ({
      athlete_id,
      coach_id: user.id,
      date,
      title,
      type,
      description,
      duration_planned_min: duration,
    }))
  );

  // La RLS refuse toute ligne visant un athlète hors du groupe du coach.
  const { error } = await supabase.from("sessions").insert(rows);
  if (error) {
    return { error: "Impossible d'enregistrer ces séances. Réessaie." };
  }

  if (formData.get("save_template") === "on") {
    await supabase.from("session_templates").insert({
      coach_id: user.id,
      title,
      type,
      description,
      duration_planned_min: duration,
    });
  }

  revalidatePath("/", "layout");
  redirect(`/?planifiees=${rows.length}`);
}

export async function updateSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(formData.get("session_id") ?? "");
  const athleteId = String(formData.get("athlete_id") ?? "");
  if (!id) return { error: "Séance introuvable." };

  const title = text(formData, "title", LIMITS.title);
  if (title === null) return tooLong("Le titre", LIMITS.title);
  const date = String(formData.get("date") ?? "");
  if (!title || !date) return { error: "Titre et date sont obligatoires." };

  const description = optionalText(formData, "description", LIMITS.description);
  if (description === undefined) return tooLong("Les consignes", LIMITS.description);

  const rawDuration = Number(formData.get("duration_planned_min"));

  // Le trigger enforce_session_ownership garantit qu'un coach ne touche
  // qu'à la prescription, jamais au compte rendu de l'athlète.
  const { error } = await supabase
    .from("sessions")
    .update({
      title,
      date,
      type: String(formData.get("type") ?? "endurance"),
      description,
      duration_planned_min:
        Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null,
    })
    .eq("id", id)
    .eq("status", "planned");
  if (error) return { error: "Modification impossible. Réessaie." };

  revalidatePath("/", "layout");
  redirect(athleteId ? `/athletes/${athleteId}` : "/");
}

export async function deleteTemplate(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("template_id") ?? "");
  if (!id) return;
  await supabase.from("session_templates").delete().eq("id", id);
  revalidatePath("/", "layout");
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

// ---------- Activités importées ----------

/**
 * Enregistre une activité lue par le navigateur.
 *
 * Le fichier n'arrive jamais jusqu'ici : il est analysé côté client, ce qui
 * évite de transporter plusieurs mégaoctets et donne son aperçu à l'athlète
 * avant qu'il ne valide. Ne transitent que les valeurs retenues — donc
 * modifiables par qui les envoie, mais c'est déjà le cas d'une séance saisie
 * à la main : personne d'autre que l'athlète n'écrit son propre compte rendu.
 * Elles sont malgré tout bornées ci-dessous, pour que la base ne reçoive rien
 * d'absurde.
 *
 * L'activité est insérée **avant** que la séance ne soit touchée : c'est elle
 * qui porte la contrainte d'unicité, et un doublon doit être refusé sans avoir
 * rien créé au passage.
 */
export async function importActivity(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const externalId = text(formData, "external_id", LIMITS.externalId);
  const startedAt = String(formData.get("started_at") ?? "");
  const date = String(formData.get("date") ?? "");
  const duration = Number(formData.get("duration_min"));
  const rpe = Number(formData.get("rpe"));

  if (!externalId || !startedAt || !date) {
    return { error: "Dépose à nouveau le fichier : sa lecture s'est perdue." };
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 24 * 60) {
    return { error: "La durée lue dans le fichier est inexploitable." };
  }
  if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
    return { error: "Choisis ton effort ressenti (RPE) de 1 à 10." };
  }

  const fileName = optionalText(formData, "file_name", LIMITS.fileName);
  if (fileName === undefined) return tooLong("Le nom du fichier", LIMITS.fileName);

  const nombreOuNull = (champ: string, min: number, max: number) => {
    const brut = String(formData.get(champ) ?? "").trim();
    if (brut === "") return null;
    const valeur = Number(brut);
    return Number.isFinite(valeur) && valeur >= min && valeur <= max
      ? Math.round(valeur)
      : null;
  };

  const { data: activite, error: erreurActivite } = await supabase
    .from("activities")
    .insert({
      athlete_id: user.id,
      source: "fichier",
      external_id: externalId,
      file_name: fileName,
      started_at: startedAt,
      date,
      duration_min: Math.round(duration),
      distance_m: nombreOuNull("distance_m", 0, 1_000_000),
      avg_heart_rate: nombreOuNull("avg_heart_rate", 20, 240),
    })
    .select("id")
    .single();

  if (erreurActivite) {
    // 23505 : la contrainte unique (athlete_id, source, external_id).
    if (erreurActivite.code === "23505") {
      return { error: "Cette séance a déjà été importée." };
    }
    return { error: "Impossible d'enregistrer l'activité." };
  }

  // Enrichissement visuel, pas la donnée de référence : son échec ne doit
  // pas faire perdre l'activité déjà enregistrée.
  const points = validerTrace(String(formData.get("trace") ?? ""));
  if (points.length > 0) {
    await supabase.from("activity_traces").insert({
      activity_id: activite.id,
      athlete_id: user.id,
      t_s: points.map((p) => p.tOffsetS),
      heart_rate: points.map((p) => p.heartRate),
      pace_sec_per_km: points.map((p) => p.paceSecPerKm),
      altitude_m: points.map((p) => p.altitudeM),
    });
  }

  // Rattachement : soit une séance existante que l'athlète a désignée, soit
  // une séance libre créée pour l'occasion. Jamais de choix silencieux — si
  // deux séances tombent le même jour, lui seul sait laquelle il a faite.
  // « nouvelle » est la sentinelle du formulaire : le select ne peut pas
  // utiliser la valeur vide pour ce choix, elle y signale l'absence de choix.
  const choixSeance = String(formData.get("session_id") ?? "");
  const sessionId = choixSeance === "nouvelle" ? "" : choixSeance;
  const comment = optionalText(formData, "athlete_comment", LIMITS.comment);
  const compteRendu = {
    status: "completed" as const,
    rpe,
    duration_actual_min: Math.round(duration),
    athlete_comment: comment === undefined ? null : comment,
    completed_at: new Date().toISOString(),
  };

  let seanceLiee = sessionId;

  if (sessionId) {
    const { error } = await supabase
      .from("sessions")
      .update(compteRendu)
      .eq("id", sessionId)
      .eq("athlete_id", user.id);
    if (error) {
      return {
        error:
          "L'activité est enregistrée, mais le rattachement à la séance a échoué.",
      };
    }
  } else {
    const titre = text(formData, "title", LIMITS.title);
    if (titre === null) return tooLong("Le titre", LIMITS.title);
    const { data: creee, error } = await supabase
      .from("sessions")
      .insert({
        athlete_id: user.id,
        coach_id: null,
        date,
        title: titre || "Séance importée",
        type: String(formData.get("type") ?? "endurance"),
        ...compteRendu,
      })
      .select("id")
      .single();
    if (error) {
      return {
        error: "L'activité est enregistrée, mais la séance n'a pas pu être créée.",
      };
    }
    seanceLiee = creee.id;
  }

  await supabase
    .from("activities")
    .update({ session_id: seanceLiee })
    .eq("id", activite.id);

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
