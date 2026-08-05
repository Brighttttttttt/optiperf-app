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

  // Reste le flux implicite, où Supabase place les jetons dans le fragment
  // (`#access_token=…`) : le navigateur ne l'envoie jamais au serveur. Seul
  // du code client peut le lire, d'où le relais vers /auth/finaliser — le
  // fragment survit à la redirection.
  return NextResponse.redirect(`${origin}/auth/finaliser`);
}
