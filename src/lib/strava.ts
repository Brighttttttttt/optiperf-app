/**
 * Le lien de compte Strava — et rien d'autre (#105).
 *
 * Cette étape n'importe aucune activité. C'est délibéré, et pas seulement
 * parce qu'il faut bien commencer quelque part : les conditions d'API de
 * Strava interdisent d'exposer les données d'un athlète à un tiers, or le
 * tiers d'Optiperf est son coach. Voir la note dans la PR et l'issue #87.
 *
 * Ce qui est fait ici — autoriser, révoquer — ne montre aucune donnée
 * d'entraînement à personne, et reste utile quelle que soit la suite.
 */

const AUTORISATION = "https://www.strava.com/oauth/authorize";
const JETON = "https://www.strava.com/oauth/token";
const REVOCATION = "https://www.strava.com/oauth/deauthorize";

/**
 * `activity:read_all` couvre aussi les sorties privées ; `read` seul ne donne
 * accès à rien d'utile. Pas de `write` : Optiperf ne publie rien chez eux.
 */
const PORTEE = "activity:read_all";

export type JetonsStrava = {
  accessToken: string;
  refreshToken: string;
  /** Instant d'expiration, en ISO. */
  expiresAt: string;
  externalAthleteId: string;
  scope: string | null;
};

export function stravaConfigure(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET
  );
}

/**
 * L'URL vers laquelle envoyer l'athlète.
 *
 * `approval_prompt=force` : sans lui, Strava renvoie immédiatement quiconque a
 * déjà autorisé l'app, sans jamais montrer les autorisations demandées. Après
 * une déconnexion, on veut que le consentement soit redemandé pour de bon.
 */
export function urlAutorisation(origine: string, etat: string): string {
  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ?? "",
    redirect_uri: `${origine}/auth/strava/callback`,
    response_type: "code",
    approval_prompt: "force",
    scope: PORTEE,
    state: etat,
  });
  return `${AUTORISATION}?${params}`;
}

/**
 * Échange le code d'autorisation contre des jetons.
 *
 * Rend `null` sur tout écart plutôt que de lever : l'appelant redirige vers
 * les réglages avec un message, et il n'y a rien d'exploitable à afficher
 * d'une réponse de Strava qui n'a pas la forme attendue.
 */
export async function echangerCode(
  code: string,
  origine: string
): Promise<JetonsStrava | null> {
  const reponse = await fetch(JETON, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${origine}/auth/strava/callback`,
    }),
    cache: "no-store",
  });
  if (!reponse.ok) return null;

  return lireJetons(await reponse.json());
}

/** Renouvelle un jeton d'accès expiré. Servira dès la synchronisation (#106). */
export async function renouveler(
  refreshToken: string
): Promise<Omit<JetonsStrava, "externalAthleteId"> | null> {
  const reponse = await fetch(JETON, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!reponse.ok) return null;

  const jetons = lireJetons(await reponse.json(), false);
  return jetons && { ...jetons };
}

/**
 * Retire l'autorisation **chez Strava**, pas seulement chez nous.
 *
 * Se « déconnecter » en effaçant sa propre ligne laisserait l'app dans la
 * liste des applications autorisées de l'athlète, et un jeton vivant dans la
 * nature. L'échec n'empêche pas la suppression locale : mieux vaut une
 * autorisation orpheline chez Strava qu'un athlète qui ne peut pas partir.
 */
export async function revoquer(accessToken: string): Promise<boolean> {
  try {
    const reponse = await fetch(REVOCATION, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    return reponse.ok;
  } catch {
    return false;
  }
}

function lireJetons(brut: unknown, exigeAthlete = true): JetonsStrava | null {
  if (typeof brut !== "object" || brut === null) return null;
  const o = brut as Record<string, unknown>;

  const accessToken = typeof o.access_token === "string" ? o.access_token : null;
  const refreshToken = typeof o.refresh_token === "string" ? o.refresh_token : null;
  // `expires_at` est en secondes depuis l'époque, comme partout chez Strava.
  const expiresAt = typeof o.expires_at === "number" ? o.expires_at : null;
  if (!accessToken || !refreshToken || !expiresAt) return null;

  const athlete = o.athlete as { id?: unknown } | undefined;
  const externalAthleteId =
    typeof athlete?.id === "number" || typeof athlete?.id === "string"
      ? String(athlete.id)
      : null;
  if (exigeAthlete && !externalAthleteId) return null;

  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    externalAthleteId: externalAthleteId ?? "",
    scope: typeof o.scope === "string" ? o.scope : null,
  };
}
