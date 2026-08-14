import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/supabase/session";
import { stravaConfigure, urlAutorisation } from "@/lib/strava";

/** Durée de vie du jeton anti-rejeu : le temps d'autoriser, pas davantage. */
const ETAT_MAX_AGE = 10 * 60;
export const ETAT_COOKIE = "strava-etat";

/**
 * Départ vers Strava.
 *
 * Une **navigation** (un simple lien) et non la soumission d'un formulaire :
 * la CSP pose `form-action 'self'`, qui interdirait de poster vers
 * `strava.com`. Un `<a>` ne tombe pas sous cette directive.
 *
 * Le `state` est tiré au hasard et déposé en cookie `httpOnly`, pour être
 * recomparé au retour. Sans lui, n'importe qui pourrait faire rattacher **son**
 * compte Strava à la session d'un autre en lui faisant ouvrir un lien de
 * retour fabriqué.
 *
 * `/auth/*` est public dans le proxy — la session se vérifie donc ici, sans
 * quoi on ne saurait pas à qui rattacher la connexion.
 */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!stravaConfigure()) {
    return NextResponse.redirect(`${origin}/settings?strava=indisponible`);
  }

  const etat = crypto.randomUUID();
  const reponse = NextResponse.redirect(urlAutorisation(origin, etat));
  reponse.cookies.set(ETAT_COOKIE, etat, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ETAT_MAX_AGE,
  });
  return reponse;
}
