import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Atterrissage des liens envoyés par email (confirmation d'inscription,
 * réinitialisation de mot de passe). Supabase y renvoie l'utilisateur après
 * vérification ; il reste à échanger le jeton contre une session.
 *
 * Deux formes possibles selon le gabarit d'email configuré :
 * `?code=…` (flux PKCE, gabarit par défaut) ou `?token_hash=…&type=…`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(`${origin}/`);
  }

  // Lien expiré, déjà utilisé, ou ouvert sur un autre appareil que celui
  // d'inscription : on renvoie vers la connexion avec un message clair.
  return NextResponse.redirect(`${origin}/login?confirmation=echec`);
}
