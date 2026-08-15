"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Origine réellement servie, pour que les liens d'email y reviennent. */
async function currentOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type AuthState = { error?: string; info?: string } | null;

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Renseigne ton email et ton mot de passe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Email ou mot de passe incorrect." };
  }
  redirect("/");
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "coach" ? "coach" : "athlete";
  const inviteCode = String(formData.get("invite_code") ?? "").trim();

  if (!fullName) return { error: "Renseigne ton nom." };
  if (!email) return { error: "Renseigne ton email." };
  if (password.length < 8) {
    return { error: "Le mot de passe doit faire au moins 8 caractères." };
  }
  // Revérifié ici : `required` sur la case ne tient que dans le navigateur, et
  // sans consentement explicite il n'existe aucune base légale pour traiter
  // une fréquence cardiaque (RGPD art. 9.2.a).
  if (formData.get("health_consent") !== "on") {
    return {
      error:
        "Coche l'autorisation de traiter tes données de santé : sans elle, Optiperf ne peut pas calculer tes zones ni ta charge.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Le profil naît d'un trigger sur `auth.users`, avant qu'une session
      // n'existe : le consentement voyage donc dans les métadonnées, et c'est
      // `handle_new_user` (migration 020) qui le pose.
      data: {
        full_name: fullName,
        role,
        health_consent_at: new Date().toISOString(),
      },
      // Le lien de confirmation revient sur l'origine servie (production
      // ou préversion), et non sur la Site URL fixe du projet Supabase.
      emailRedirectTo: `${await currentOrigin()}/auth/callback`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Un compte existe déjà avec cet email." };
    }
    return { error: "Impossible de créer le compte. Réessaie." };
  }

  // Confirmation d'email activée côté Supabase : pas de session immédiate.
  if (!data.session) {
    return {
      info: "Compte créé. Confirme ton adresse depuis l'email reçu, puis connecte-toi.",
    };
  }

  // Liaison au coach dès l'inscription si un code a été fourni.
  if (role === "athlete" && inviteCode) {
    await supabase.rpc("link_to_coach", { code: inviteCode });
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
