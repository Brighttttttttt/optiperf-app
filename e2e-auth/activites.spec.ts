import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Isolation et intégrité de `activities` (migration 007).
 *
 * Ces tests ne passent par aucune page : l'écran de dépôt n'existe pas encore
 * (#54). Ils interrogent directement l'API, avec de vrais jetons, parce que
 * c'est la base elle-même qu'on vérifie ici — la RLS et les contraintes SQL,
 * qu'aucune interface ne doit avoir à faire respecter.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const MOT_DE_PASSE = "optiperf-demo";

async function ouvrirSession(request: APIRequestContext, email: string) {
  const reponse = await request.post(`${URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CLE, "Content-Type": "application/json" },
    data: { email, password: MOT_DE_PASSE },
  });
  expect(reponse.ok(), `connexion de ${email}`).toBeTruthy();
  const { access_token, user } = await reponse.json();
  return { jeton: access_token as string, id: user.id as string };
}

function entetes(jeton: string) {
  return { apikey: CLE, Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };
}

/**
 * Seules les activités du peuplement sont comptées : le parcours d'import
 * (import.spec.ts) tourne en parallèle et en crée d'autres. Compter tout
 * rendrait ces tests dépendants de l'ordre d'exécution.
 */
async function lireActivites(request: APIRequestContext, jeton: string) {
  const reponse = await request.get(
    `${URL}/rest/v1/activities?select=id,athlete_id,session_id,source,external_id&external_id=like.demo-*`,
    { headers: entetes(jeton) }
  );
  expect(reponse.ok()).toBeTruthy();
  return (await reponse.json()) as Array<{ session_id: string | null }>;
}

test("l'athlète lit ses activités, rattachées ou non", async ({ request }) => {
  const { jeton } = await ouvrirSession(request, "lea@example.com");
  const activites = await lireActivites(request, jeton);

  expect(activites).toHaveLength(2);
  // Le modèle doit porter les deux cas : c'est la raison d'être d'une table
  // reliée plutôt que de colonnes sur `sessions`.
  expect(activites.filter((a) => a.session_id !== null)).toHaveLength(1);
  expect(activites.filter((a) => a.session_id === null)).toHaveLength(1);
});

test("un athlète ne voit jamais les activités d'un autre", async ({ request }) => {
  const { jeton } = await ouvrirSession(request, "nino@example.com");
  expect(await lireActivites(request, jeton)).toHaveLength(0);
});

test("le coach voit les activités de ses athlètes", async ({ request }) => {
  const { jeton } = await ouvrirSession(request, "coach@example.com");
  expect(await lireActivites(request, jeton)).toHaveLength(2);
});

test("le coach ne peut pas écrire une activité", async ({ request }) => {
  // Compte rendu, pas prescription : même règle que le trigger
  // enforce_session_ownership sur les séances.
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");

  const reponse = await request.post(`${URL}/rest/v1/activities`, {
    headers: entetes(coach.jeton),
    data: {
      athlete_id: lea.id,
      source: "fichier",
      external_id: "ecrite-par-le-coach",
      started_at: new Date().toISOString(),
      date: "2026-01-15",
      duration_min: 42,
    },
  });

  expect(reponse.status()).toBe(403);
});

test("le même fichier déposé deux fois est refusé par la base", async ({ request }) => {
  const { jeton, id } = await ouvrirSession(request, "lea@example.com");

  const reponse = await request.post(`${URL}/rest/v1/activities`, {
    headers: entetes(jeton),
    data: {
      athlete_id: id,
      source: "fichier",
      // Déjà présent dans les données de démo.
      external_id: "demo-sortie-longue",
      started_at: new Date().toISOString(),
      date: "2026-01-15",
      duration_min: 78,
    },
  });

  expect(reponse.status()).toBe(409);
  expect((await reponse.json()).code).toBe("23505");
});

test("le visiteur non connecté n'a aucun accès à la table", async ({ request }) => {
  // Le premier des deux verrous : les droits SQL, avant même la RLS.
  const reponse = await request.get(`${URL}/rest/v1/activities?select=id`, {
    headers: { apikey: CLE },
  });
  expect(reponse.ok()).toBeFalsy();
});
