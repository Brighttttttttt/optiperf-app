"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { activitySourceLabel, LIMITS, type Activity } from "@/lib/types";
import { MAX_BATCH_SESSIONS } from "@/lib/planning";
import {
  chargerFenetrePlanning,
  type FenetrePlanning,
} from "@/lib/session-details";
import { validerTours, validerTrace } from "@/lib/activites";
import { trouverDoublon } from "@/lib/doublons";
import { dechiffrer } from "@/lib/chiffrement";
import { revoquer } from "@/lib/strava";
import { validerBlocs } from "@/lib/blocks";
import { parseDurationInput, RECORD_DISTANCE_VALUES } from "@/lib/records";
import { validerExercices, validerExerciseLogs } from "@/lib/exercises";
import { VIEW_MODE_COOKIE, VIEW_MODE_MAX_AGE } from "@/lib/view-mode";
import {
  methodeCalculable,
  METHODES_ZONES,
  type MethodeZones,
} from "@/lib/zones";

export type ActionState = {
  error?: string;
  ok?: boolean;
  /**
   * Le refus est un rapprochement, pas une règle : l'appelant doit pouvoir
   * proposer de passer outre (#107). Un `error` seul se lit comme définitif.
   */
  doublon?: boolean;
} | null;

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
  const { data: creees, error } = await supabase.from("sessions").insert(rows).select("id");
  if (error) {
    return { error: "Impossible d'enregistrer ces séances. Réessaie." };
  }

  // Même contenu structuré pour toutes les séances créées d'un coup : le
  // formulaire n'en propose qu'un seul, quel que soit le nombre d'athlètes
  // ou de dates cochés. Blocs (course) et exercices (musculation) viennent
  // de champs distincts, l'éditeur affiché dépendant du type — au plus un
  // des deux est jamais rempli.
  if (creees) {
    const blocs = validerBlocs(String(formData.get("blocks") ?? ""));
    if (blocs.length > 0) {
      await supabase.from("workout_blocks").insert(
        creees.flatMap((s) =>
          blocs.map((b, position) => ({ session_id: s.id, position, ...b }))
        )
      );
    }

    if (type === "renfo") {
      const exercices = validerExercices(String(formData.get("exercises") ?? ""));
      if (exercices.length > 0) {
        await supabase.from("exercises").insert(
          creees.flatMap((s) =>
            exercices.map((e, position) => ({ session_id: s.id, position, ...e }))
          )
        );
      }
    }
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
  const type = String(formData.get("type") ?? "endurance");

  // Le trigger enforce_session_ownership garantit qu'un coach ne touche
  // qu'à la prescription, jamais au compte rendu de l'athlète.
  const { error } = await supabase
    .from("sessions")
    .update({
      title,
      date,
      type,
      description,
      duration_planned_min:
        Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null,
    })
    .eq("id", id)
    .eq("status", "planned");
  if (error) return { error: "Modification impossible. Réessaie." };

  // Remplacés en bloc plutôt que fusionnés : le formulaire renvoie la liste
  // complète à chaque enregistrement, jamais une modification partielle.
  await supabase.from("workout_blocks").delete().eq("session_id", id);
  const blocs = validerBlocs(String(formData.get("blocks") ?? ""));
  if (blocs.length > 0) {
    await supabase
      .from("workout_blocks")
      .insert(blocs.map((b, position) => ({ session_id: id, position, ...b })));
  }

  await supabase.from("exercises").delete().eq("session_id", id);
  if (type === "renfo") {
    const exercices = validerExercices(String(formData.get("exercises") ?? ""));
    if (exercices.length > 0) {
      await supabase
        .from("exercises")
        .insert(exercices.map((e, position) => ({ session_id: id, position, ...e })));
    }
  }

  revalidatePath("/", "layout");
  redirect(athleteId ? `/athletes/${athleteId}` : "/");
}

/**
 * Déplace une séance d'un jour à l'autre, sans rien toucher d'autre.
 *
 * Appelée depuis la vue semaine par un glisser-déposer ou une flèche du
 * clavier — d'où des arguments simples plutôt qu'un `FormData` : il n'y a pas
 * de formulaire derrière ce geste.
 *
 * Le `status = 'planned'` est répété ici alors que l'affichage l'impose déjà
 * (`peutDeplacer`) : un geste aussi facile ne doit pas dépendre de l'état de
 * l'interface au moment du clic. La RLS dit qui peut écrire, le trigger
 * `enforce_session_ownership` empêche un athlète de déplacer la prescription
 * de son coach, et cette clause empêche de réécrire le jour d'un compte
 * rendu déjà déposé.
 */
export async function moveSession(
  sessionId: string,
  date: string
): Promise<ActionState> {
  const { supabase } = await requireUser();
  if (!sessionId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Déplacement impossible." };
  }

  const { error, count } = await supabase
    .from("sessions")
    .update({ date }, { count: "exact" })
    .eq("id", sessionId)
    .eq("status", "planned");

  if (error) return { error: "Déplacement impossible. Réessaie." };
  // Zéro ligne touchée : la séance a été faite, ou elle ne nous appartient
  // pas. Le dire, plutôt que laisser la carte revenir en place sans raison.
  if (!count) {
    return { error: "Seule une séance encore à venir peut être déplacée." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Les séances d'une période plus ancienne (ou plus lointaine) que la fenêtre
 * initiale de la vue semaine.
 *
 * La vue charge ±8 semaines d'emblée pour naviguer sans attendre le serveur.
 * Au-delà, elle affichait des jours vides indistinguables de jours libres —
 * une séance importée d'une sortie d'il y a trois mois n'apparaissait nulle
 * part dans le planning (#141). Elle vient donc la chercher, et seulement
 * pour ce qui n'a jamais été chargé.
 *
 * Aucun contrôle d'accès ici : la RLS ne rend que les séances du compte ou de
 * ses athlètes, quel que soit l'identifiant demandé.
 */
export async function chargerPlanning(
  athleteId: string,
  debut: string,
  fin: string
): Promise<FenetrePlanning | null> {
  const { supabase } = await requireUser();
  const dateValide = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if (!athleteId || !dateValide(debut) || !dateValide(fin) || debut > fin) {
    return null;
  }
  return chargerFenetrePlanning(supabase, athleteId, debut, fin);
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
  const { supabase, user } = await requireUser();
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

  // Compte rendu exercice par exercice, pour une séance de musculation —
  // enrichissement du compte rendu déjà enregistré ci-dessus, son échec ne
  // doit pas faire perdre RPE/durée/commentaire.
  const logs = validerExerciseLogs(String(formData.get("exercise_logs") ?? ""));
  if (logs.length > 0) {
    await supabase.from("exercise_logs").upsert(
      logs.map((l) => ({ ...l, athlete_id: user.id, updated_at: new Date().toISOString() })),
      { onConflict: "exercise_id" }
    );
  }

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

/**
 * Supprime une séance — le geste le plus irréversible de l'app.
 *
 * La policy `sessions_delete` (migration 018) est seule juge : le coach sur sa
 * prescription encore à venir, l'athlète sur ses séances libres. On ne
 * revérifie donc rien ici, mais on **lit le nombre de lignes touchées** pour
 * distinguer un refus d'un succès — sans quoi une suppression interdite
 * ressemblerait à une suppression réussie.
 *
 * Les activités rattachées survivent (`on delete set null`, 007) : ce qu'une
 * montre a mesuré reste vrai même sans la séance qui la portait.
 */
export async function deleteSession(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = String(formData.get("session_id") ?? "");
  if (!id) return { error: "Séance introuvable." };

  const { error, count } = await supabase
    .from("sessions")
    .delete({ count: "exact" })
    .eq("id", id);

  if (error) return { error: "Suppression impossible. Réessaie." };
  if (!count) {
    return {
      error:
        "Cette séance ne peut pas être supprimée : une séance prescrite par ton coach se déclare manquée, et une séance déjà faite appartient à son compte rendu.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Note du coach ----------

/**
 * Écrit, remplace ou efface la note libre du coach sur un athlète.
 *
 * Une seule action pour les trois cas : le formulaire est un carnet, pas un
 * cycle création / édition / suppression. Vider le champ et enregistrer est la
 * façon naturelle d'effacer une note — inutile d'exiger un second geste.
 *
 * La RLS (migration 015) fait tout le contrôle d'accès : `coach_id` doit être
 * l'utilisateur et `athlete_id` l'un de ses athlètes. Rien n'est revérifié
 * ici, ce serait une seconde vérité à maintenir.
 */
export async function saveCoachNote(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const athleteId = String(formData.get("athlete_id") ?? "");
  if (!athleteId) return { error: "Athlète introuvable." };

  const content = optionalText(formData, "content", LIMITS.notes);
  if (content === undefined) return tooLong("La note", LIMITS.notes);

  if (content === null) {
    const { error } = await supabase
      .from("coach_notes")
      .delete()
      .eq("coach_id", user.id)
      .eq("athlete_id", athleteId);
    if (error) return { error: "Impossible d'effacer la note." };
  } else {
    // `upsert` sur la contrainte d'unicité (coach, athlète) : une note par
    // paire, réécrite en place plutôt qu'empilée.
    const { error } = await supabase.from("coach_notes").upsert(
      {
        coach_id: user.id,
        athlete_id: athleteId,
        content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "coach_id,athlete_id" }
    );
    if (error) return { error: "Impossible d'enregistrer la note." };
  }

  revalidatePath("/", "layout");
  return { ok: true };
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

export async function updateHeartRateRefs(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const nombreOuNull = (champ: string, min: number, max: number) => {
    const brut = String(formData.get(champ) ?? "").trim();
    if (brut === "") return null;
    const valeur = Number(brut);
    if (!Number.isFinite(valeur) || valeur < min || valeur > max) return "invalide" as const;
    return Math.round(valeur);
  };

  const fcMax = nombreOuNull("fc_max", 100, 230);
  if (fcMax === "invalide") {
    return { error: "La FC max doit être comprise entre 100 et 230 bpm." };
  }
  const fcRepos = nombreOuNull("fc_repos", 25, 120);
  if (fcRepos === "invalide") {
    return { error: "La FC de repos doit être comprise entre 25 et 120 bpm." };
  }
  if (fcMax !== null && fcRepos !== null && fcRepos >= fcMax) {
    return { error: "La FC de repos doit être inférieure à la FC max." };
  }

  const lthr = nombreOuNull("lthr", 100, 220);
  if (lthr === "invalide") {
    return { error: "La fréquence au seuil doit être comprise entre 100 et 220 bpm." };
  }
  // Contrainte doublée : la base la refuserait de toute façon (017), mais son
  // message d'erreur ne dirait rien à l'athlète.
  if (lthr !== null && fcMax !== null && lthr >= fcMax) {
    return { error: "La fréquence au seuil doit être inférieure à la FC max." };
  }

  const methodeBrute = String(formData.get("zone_method") ?? "fcmax");
  const methode = METHODES_ZONES.some((m) => m.valeur === methodeBrute)
    ? (methodeBrute as MethodeZones)
    : "fcmax";

  // Une méthode dont la donnée manque se refuse ici plutôt que d'afficher des
  // zones vides sans explication.
  if (!methodeCalculable(methode, { fcMax, fcRepos, lthr })) {
    const besoin = METHODES_ZONES.find((m) => m.valeur === methode)?.besoin ?? "";
    return { error: `Cette méthode de zones a besoin de ${besoin}.` };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ fc_max: fcMax, fc_repos: fcRepos, lthr, zone_method: methode })
    .eq("id", user.id);
  if (error) return { error: "Impossible d'enregistrer." };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateVma(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const brut = String(formData.get("vma_kmh") ?? "").trim();
  let vma: number | null = null;
  if (brut !== "") {
    const valeur = Number(brut.replace(",", "."));
    if (!Number.isFinite(valeur) || valeur < 8 || valeur > 26) {
      return { error: "La VMA doit être comprise entre 8 et 26 km/h." };
    }
    vma = Math.round(valeur * 10) / 10;
  }

  const { error } = await supabase.from("profiles").update({ vma_kmh: vma }).eq("id", user.id);
  if (error) return { error: "Impossible d'enregistrer." };

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Records personnels ----------

export async function saveRecord(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const athleteId = String(formData.get("athlete_id") ?? user.id);
  const distance = String(formData.get("distance") ?? "");
  if (!RECORD_DISTANCE_VALUES.includes(distance)) {
    return { error: "Distance inconnue." };
  }

  const dureeSec = parseDurationInput(String(formData.get("duration") ?? ""));
  if (dureeSec === null) {
    return { error: "Chrono illisible : au format mm:ss ou h:mm:ss." };
  }

  const achievedOn = String(formData.get("achieved_on") ?? "").trim() || null;

  // Un record par distance : la nouvelle valeur remplace l'ancienne, elle ne
  // s'empile pas. La RLS refuse l'écriture si l'appelant n'est ni l'athlète
  // ni son coach.
  const { error } = await supabase.from("personal_records").upsert(
    {
      athlete_id: athleteId,
      distance,
      duration_sec: dureeSec,
      achieved_on: achievedOn,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id,distance" }
  );
  if (error) return { error: "Impossible d'enregistrer ce record." };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteRecord(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("record_id") ?? "");
  if (!id) return;
  await supabase.from("personal_records").delete().eq("id", id);
  revalidatePath("/", "layout");
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

  const mesures = {
    file_name: fileName,
    started_at: startedAt,
    date,
    duration_min: Math.round(duration),
    distance_m: nombreOuNull("distance_m", 0, 1_000_000),
    avg_heart_rate: nombreOuNull("avg_heart_rate", 20, 240),
  };

  // La même sortie sous deux formats (#107) : contenus différents, empreintes
  // différentes, donc la contrainte SQL de 007 ne voit rien. Le rapprochement
  // est souple par nature — on demande donc, on ne décide pas.
  //
  // Les activités du jour suffisent : deux enregistrements de la même sortie
  // partagent forcément sa date, calculée à Paris de part et d'autre.
  if (formData.get("force") !== "1") {
    const { data: duJour } = await supabase
      .from("activities")
      .select("id, started_at, duration_min, file_name, source")
      .eq("athlete_id", user.id)
      .eq("date", date)
      // Le redépôt du même fichier a son propre chemin, plus haut : il reprend
      // l'activité au lieu de la signaler.
      .neq("external_id", externalId);

    const jumelle = trouverDoublon(
      { startedAt, durationMin: Math.round(duration) },
      ((duJour ?? []) as Pick<
        Activity,
        "id" | "started_at" | "duration_min" | "file_name" | "source"
      >[]).map((a) => ({
        ...a,
        startedAt: a.started_at,
        durationMin: a.duration_min,
      }))
    );

    if (jumelle) {
      const quoi = jumelle.file_name
        ? `« ${jumelle.file_name} »`
        : `un relevé ${activitySourceLabel(jumelle.source)}`;
      return {
        doublon: true,
        error: `Cette sortie ressemble à ${quoi}, déjà importée à la même heure. L'enregistrer une seconde fois compterait sa charge en double.`,
      };
    }
  }

  const { data: activite, error: erreurActivite } = await supabase
    .from("activities")
    .insert({
      athlete_id: user.id,
      source: "fichier",
      external_id: externalId,
      ...mesures,
    })
    .select("id")
    .single();

  let activiteId = activite?.id as string | undefined;

  if (erreurActivite) {
    // 23505 : la contrainte unique (athlete_id, source, external_id).
    if (erreurActivite.code !== "23505") {
      return { error: "Impossible d'enregistrer l'activité." };
    }

    // Ce fichier a déjà été déposé. Reste à savoir si son activité mène
    // encore quelque part : `activities.session_id` est `on delete set null`
    // (007), donc supprimer une séance laisse derrière elle une activité que
    // plus aucun écran ne montrait — et qui interdisait pourtant de redéposer
    // le fichier dont elle venait (#135).
    const { data: existante } = await supabase
      .from("activities")
      .select("id, session_id")
      .eq("athlete_id", user.id)
      .eq("source", "fichier")
      .eq("external_id", externalId)
      .maybeSingle<{ id: string; session_id: string | null }>();

    if (!existante) {
      // Le conflit vient d'ailleurs que d'une activité qu'on puisse relire :
      // ne rien affirmer de faux.
      return { error: "Impossible d'enregistrer l'activité." };
    }
    if (existante.session_id) {
      return {
        error:
          "Ce fichier est déjà rattaché à une séance de ton historique. Ouvre-la pour la corriger, ou supprime l'activité depuis « Fichiers importés ».",
      };
    }

    // Orpheline : on la reprend plutôt que de refuser. L'athlète sait très
    // bien qu'il redépose le même fichier — c'est justement ce qu'il veut.
    activiteId = existante.id;
    const { error } = await supabase
      .from("activities")
      .update(mesures)
      .eq("id", existante.id);
    if (error) return { error: "Impossible d'enregistrer l'activité." };
  }

  if (!activiteId) return { error: "Impossible d'enregistrer l'activité." };

  // Enrichissement visuel, pas la donnée de référence : son échec ne doit
  // pas faire perdre l'activité déjà enregistrée.
  //
  // Sur une activité reprise, trace et tours sont **remplacés** et non
  // ajoutés : `activity_laps` a pour clé primaire `(activity_id, position)`,
  // un simple insert échouerait au premier tour.
  const points = validerTrace(String(formData.get("trace") ?? ""));
  const tours = validerTours(String(formData.get("tours") ?? ""));
  if (erreurActivite) {
    await supabase.from("activity_traces").delete().eq("activity_id", activiteId);
    await supabase.from("activity_laps").delete().eq("activity_id", activiteId);
  }

  if (points.length > 0) {
    await supabase.from("activity_traces").insert({
      activity_id: activiteId,
      athlete_id: user.id,
      t_s: points.map((p) => p.tOffsetS),
      heart_rate: points.map((p) => p.heartRate),
      pace_sec_per_km: points.map((p) => p.paceSecPerKm),
      altitude_m: points.map((p) => p.altitudeM),
    });
  }

  // Les tours, même règle : ils enrichissent l'activité sans la conditionner.
  // Un GPX n'en a jamais, et une séance sans eux reste parfaitement valide.
  if (tours.length > 0) {
    await supabase.from("activity_laps").insert(
      tours.map((t) => ({
        activity_id: activiteId,
        athlete_id: user.id,
        position: t.position,
        duration_s: t.durationS,
        distance_m: t.distanceM,
        avg_heart_rate: t.avgHeartRate,
        avg_cadence: t.avgCadence,
      }))
    );
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
    .eq("id", activiteId);

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Supprime une activité importée.
 *
 * `activities_delete` (migration 007) l'autorise à l'athlète seul depuis le
 * début ; il n'y avait simplement aucune voie pour l'exercer. La trace et les
 * tours tombent en cascade avec elle.
 *
 * La **séance reste** : elle porte le compte rendu de l'athlète, RPE et
 * ressenti compris, qu'il a peut-être complété à la main depuis. Effacer le
 * fichier déposé n'efface pas la séance qu'il documentait — l'inverse de la
 * règle qui laisse survivre l'activité quand la séance disparaît (007), et
 * pour la même raison : les deux ne se déduisent pas l'une de l'autre.
 */
export async function deleteActivity(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("activity_id") ?? "");
  if (!id) return { error: "Activité introuvable." };

  // `count` plutôt que l'absence d'erreur : la RLS filtre en silence, un refus
  // ressemblerait trait pour trait à un succès (même leçon qu'en #133).
  const { error, count } = await supabase
    .from("activities")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("athlete_id", user.id);

  if (error) return { error: "Impossible de supprimer cette activité." };
  if (!count) {
    return { error: "Cette activité n'existe plus, ou ne t'appartient pas." };
  }

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

// ---------- Vue (coach qui s'entraîne aussi) ----------

/**
 * Bascule entre encadrer et s'entraîner. Le mode n'est qu'une préférence
 * d'affichage posée en cookie : il n'ouvre aucun droit, et `resolveViewMode`
 * l'ignore pour un compte qui n'est pas coach.
 */
export async function setViewMode(formData: FormData) {
  const { user } = await requireUser();
  const demande = String(formData.get("mode") ?? "");
  if (demande !== "coach" && demande !== "athlete") return;

  // Un athlète n'a rien à basculer : ne rien poser plutôt que d'écrire un
  // cookie que la lecture ignorerait de toute façon.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  if (profile?.role !== "coach") return;

  const store = await cookies();
  store.set(VIEW_MODE_COOKIE, demande, {
    maxAge: VIEW_MODE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  revalidatePath("/", "layout");
  redirect("/");
}

// ---------- Connexions aux fournisseurs d'activités ----------

/**
 * Retire l'autorisation Strava (#105).
 *
 * L'ordre compte : on révoque **chez Strava** avant d'effacer chez nous. Une
 * ligne supprimée d'abord laisserait un jeton vivant qu'on ne saurait plus
 * révoquer, et l'app resterait dans les applications autorisées de l'athlète.
 *
 * L'échec de la révocation n'empêche pas la suppression locale : mieux vaut
 * une autorisation orpheline chez eux qu'un athlète qui ne peut pas partir.
 */
export async function deconnecterStrava(): Promise<ActionState> {
  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("provider_connections")
    .select("access_token")
    .eq("athlete_id", user.id)
    .eq("provider", "strava")
    .maybeSingle<{ access_token: string }>();

  if (data) {
    const jeton = await dechiffrer(data.access_token);
    if (jeton) await revoquer(jeton);
  }

  const { error } = await supabase
    .from("provider_connections")
    .delete()
    .eq("athlete_id", user.id)
    .eq("provider", "strava");
  if (error) return { error: "Impossible de retirer la connexion. Réessaie." };

  revalidatePath("/", "layout");
  return { ok: true };
}
