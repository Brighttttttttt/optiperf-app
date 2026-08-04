"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, role } },
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
