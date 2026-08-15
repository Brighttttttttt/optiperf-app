import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { withSecurityHeaders } from "@/lib/security-headers";

// Les routes /auth/* reçoivent les liens d'email : elles doivent rester
// accessibles sans session, puisque ce sont elles qui l'ouvrent.
// `/confidentialite` doit se lire sans compte : c'est l'adresse qu'on
// donne à qui hésite à s'inscrire, et celle que réclament les programmes
// d'API des fabricants de montres.
const PUBLIC_PATHS = ["/login", "/signup", "/auth/", "/confidentialite"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Ne rien insérer entre createServerClient et cet appel : il rafraîchit le
  // jeton expiré et synchronise les cookies. getClaims vérifie la signature
  // localement (clé ES256 du projet) — ~1 ms au lieu d'un aller-retour réseau,
  // et un jeton falsifié est rejeté tout autant.
  const { data: claimsData } = await supabase.auth.getClaims();
  let user: { id: string } | null = claimsData?.claims?.sub
    ? { id: claimsData.claims.sub }
    : null;

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Un compte authentifié sans profil (créé hors app, ex. via le dashboard
  // Supabase avant la migration 001) ferait boucler le layout (→ /login)
  // et le proxy (→ /) à l'infini : on le déconnecte proprement.
  if (user && isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) {
      await supabase.auth.signOut();
      user = null;
    }
  }

  // Les routes d'échange de jeton se chargent elles-mêmes de rediriger : les
  // renvoyer vers / couperait la confirmation en cours.
  const isCallback = path.startsWith("/auth/");
  const destination =
    !user && !isPublic
      ? "/login"
      : user && isPublic && !isCallback
        ? "/"
        : null;
  if (destination) {
    const url = request.nextUrl.clone();
    url.pathname = destination;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Propage les cookies de session rafraîchis par getUser() : sans eux,
    // le navigateur repart avec l'ancien jeton (déjà consommé par la
    // rotation) et boucle entre / et /login — « trop de redirections ».
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    // Auto-guérison : une session invalide laisse parfois des cookies
    // d'auth résiduels (voire corrompus) — on les purge au passage.
    if (!user) {
      for (const cookie of request.cookies.getAll()) {
        if (cookie.name.startsWith("sb-")) {
          redirect.cookies.set({ name: cookie.name, value: "", path: "/", maxAge: 0 });
        }
      }
    }
    return withSecurityHeaders(redirect);
  }

  return withSecurityHeaders(supabaseResponse);
}
