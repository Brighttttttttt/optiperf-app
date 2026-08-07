import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Isolation de `activity_traces` (migration 009).
 *
 * Même méthode que `activites.spec.ts` : on interroge directement l'API avec
 * de vrais jetons, parce que c'est la RLS elle-même qu'on vérifie — aucune
 * interface ne doit avoir à la faire respecter.
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

async function lireTraceSortieLongue(request: APIRequestContext, jeton: string) {
  // La trace de démo est posée sur `demo-sortie-longue` (scripts/seed.mjs) :
  // on la retrouve par l'activité plutôt que par un id fixe, non connu ici.
  const activite = await request.get(
    `${URL}/rest/v1/activities?select=id&external_id=eq.demo-sortie-longue`,
    { headers: entetes(jeton) }
  );
  expect(activite.ok()).toBeTruthy();
  const [trouvee] = (await activite.json()) as Array<{ id: string }>;
  if (!trouvee) return [];

  const reponse = await request.get(
    `${URL}/rest/v1/activity_traces?select=activity_id,t_s,heart_rate&activity_id=eq.${trouvee.id}`,
    { headers: entetes(jeton) }
  );
  expect(reponse.ok()).toBeTruthy();
  return (await reponse.json()) as Array<{ t_s: number[]; heart_rate: number[] }>;
}

test("l'athlète lit la trace de sa propre activité", async ({ request }) => {
  const { jeton } = await ouvrirSession(request, "lea@example.com");
  const traces = await lireTraceSortieLongue(request, jeton);

  expect(traces).toHaveLength(1);
  expect(traces[0].t_s).toHaveLength(5);
  expect(traces[0].heart_rate).toHaveLength(5);
});

test("un athlète ne voit jamais la trace d'un autre", async ({ request }) => {
  const { jeton } = await ouvrirSession(request, "nino@example.com");
  expect(await lireTraceSortieLongue(request, jeton)).toHaveLength(0);
});

test("le coach voit la trace de ses athlètes", async ({ request }) => {
  const { jeton } = await ouvrirSession(request, "coach@example.com");
  expect(await lireTraceSortieLongue(request, jeton)).toHaveLength(1);
});

test("le coach ne peut pas écrire une trace", async ({ request }) => {
  // Même règle que pour `activities` : compte rendu, pas prescription.
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");

  const activite = await request.get(
    `${URL}/rest/v1/activities?select=id&external_id=eq.demo-footing-libre`,
    { headers: entetes(lea.jeton) }
  );
  const [footingLibre] = (await activite.json()) as Array<{ id: string }>;

  const reponse = await request.post(`${URL}/rest/v1/activity_traces`, {
    headers: entetes(coach.jeton),
    data: {
      activity_id: footingLibre.id,
      athlete_id: lea.id,
      t_s: [0],
      heart_rate: [140],
      pace_sec_per_km: [300],
      altitude_m: [100],
    },
  });

  expect(reponse.status()).toBe(403);
});

test("le visiteur non connecté n'a aucun accès à la table", async ({ request }) => {
  // Le premier des deux verrous : les droits SQL, avant même la RLS.
  const reponse = await request.get(`${URL}/rest/v1/activity_traces?select=activity_id`, {
    headers: { apikey: CLE },
  });
  expect(reponse.ok()).toBeFalsy();
});
