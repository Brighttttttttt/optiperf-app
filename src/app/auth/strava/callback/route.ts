import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { chiffrer } from "@/lib/chiffrement";
import { echangerCode } from "@/lib/strava";
import { ETAT_COOKIE } from "../connexion/route";

/**
 * Retour d'autorisation Strava.
 *
 * Toutes les sorties reviennent sur `/settings` avec un paramètre : c'est de
 * là qu'on est parti, et un écran d'erreur nu ne dirait pas quoi faire.
 */
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const reglages = (issue: string) =>
    NextResponse.redirect(`${origin}/settings?strava=${issue}`);

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // L'athlète a refusé, ou décoché l'autorisation de lecture : ce n'est pas
  // une panne, et le dire autrement serait mentir.
  if (searchParams.get("error")) return reglages("refuse");

  // Anti-rejeu : le `state` revenu doit être celui qu'on a posé. Un cookie
  // absent signifie aussi bien un lien fabriqué qu'une autorisation laissée
  // ouverte trop longtemps — dans les deux cas, on recommence.
  const attendu = request.cookies.get(ETAT_COOKIE)?.value;
  const recu = searchParams.get("state");
  if (!attendu || !recu || attendu !== recu) return reglages("etat");

  const code = searchParams.get("code");
  if (!code) return reglages("echec");

  const jetons = await echangerCode(code, origin);
  if (!jetons) return reglages("echec");

  // Strava laisse décocher les cases au moment d'autoriser. Sans la lecture
  // des activités, la connexion ne servirait à rien : mieux vaut le dire tout
  // de suite que de laisser découvrir une synchronisation qui ne ramène rien.
  if (!jetons.scope?.includes("activity:read")) return reglages("portee");

  const supabase = await createClient();
  const { error } = await supabase.from("provider_connections").upsert(
    {
      athlete_id: user.id,
      provider: "strava",
      external_athlete_id: jetons.externalAthleteId,
      // Chiffrés avant d'atteindre la base : ni elle ni le navigateur ne
      // doivent pouvoir s'en servir (migration 019).
      access_token: await chiffrer(jetons.accessToken),
      refresh_token: await chiffrer(jetons.refreshToken),
      expires_at: jetons.expiresAt,
      scope: jetons.scope,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "athlete_id,provider" }
  );
  if (error) return reglages("echec");

  const reponse = reglages("ok");
  // Le jeton anti-rejeu a servi : le laisser traîner n'apporterait rien.
  reponse.cookies.delete(ETAT_COOKIE);
  return reponse;
}
