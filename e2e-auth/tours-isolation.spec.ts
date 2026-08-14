import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Isolation de `activity_laps` (migration 016).
 *
 * Même méthode que `traces.spec.ts` : on interroge l'API avec de vrais jetons,
 * parce que c'est la RLS qu'on vérifie — aucune interface ne doit avoir à la
 * faire respecter.
 *
 * Les tours sont créés ici plutôt que repris du peuplement : leur écriture
 * fait partie de ce qu'on vérifie, et un tour posé par le seed ne dirait rien
 * de ce qu'un athlète a le droit d'insérer.
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
  return {
    apikey: CLE,
    Authorization: `Bearer ${jeton}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

/** Une activité neuve, pour ne dépendre d'aucune donnée de peuplement. */
async function creerActivite(
  request: APIRequestContext,
  athlete: { jeton: string; id: string }
) {
  const reponse = await request.post(`${URL}/rest/v1/activities`, {
    headers: entetes(athlete.jeton),
    data: {
      athlete_id: athlete.id,
      source: "fichier",
      external_id: `tours-${crypto.randomUUID()}`,
      started_at: "2026-01-20T09:00:00Z",
      date: "2026-01-20",
      duration_min: 45,
      distance_m: 10000,
    },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
  const [activite] = await reponse.json();
  return activite.id as string;
}

const tour = (activityId: string, athleteId: string, position: number) => ({
  activity_id: activityId,
  athlete_id: athleteId,
  position,
  duration_s: 300,
  distance_m: 1000,
  avg_heart_rate: 165,
  avg_cadence: 172,
});

test("l'athlète enregistre les tours de sa propre activité", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const activityId = await creerActivite(request, lea);

  const reponse = await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(lea.jeton),
    data: [0, 1, 2].map((p) => tour(activityId, lea.id, p)),
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
  expect(await reponse.json()).toHaveLength(3);
});

test("le coach lit les tours de son athlète", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const activityId = await creerActivite(request, lea);
  await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(lea.jeton),
    data: [tour(activityId, lea.id, 0)],
  });

  const reponse = await request.get(
    `${URL}/rest/v1/activity_laps?select=position,duration_s&activity_id=eq.${activityId}`,
    { headers: entetes(coach.jeton) }
  );
  expect(reponse.ok()).toBeTruthy();
  expect(await reponse.json()).toHaveLength(1);
});

test("un autre athlète ne voit rien de ces tours", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");
  const activityId = await creerActivite(request, lea);
  await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(lea.jeton),
    data: [tour(activityId, lea.id, 0)],
  });

  const reponse = await request.get(
    `${URL}/rest/v1/activity_laps?select=position&activity_id=eq.${activityId}`,
    { headers: entetes(nino.jeton) }
  );
  expect(reponse.ok()).toBeTruthy();
  expect(await reponse.json()).toHaveLength(0);
});

test("un athlète ne peut pas poser de tour sur l'activité d'un autre", async ({
  request,
}) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");
  const activityId = await creerActivite(request, lea);

  // Nino signe avec son propre athlete_id : la clé étrangère composée vers
  // (activities.id, athlete_id) refuse le rattachement, même si la policy
  // d'insertion, qui ne regarde que athlete_id, était satisfaite.
  const reponse = await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(nino.jeton),
    data: [tour(activityId, nino.id, 0)],
  });
  expect(reponse.ok()).toBeFalsy();
});

test("un tour ne peut pas exister deux fois au même rang", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const activityId = await creerActivite(request, lea);
  await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(lea.jeton),
    data: [tour(activityId, lea.id, 0)],
  });

  const doublon = await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(lea.jeton),
    data: [tour(activityId, lea.id, 0)],
  });
  expect(doublon.status()).toBe(409);
});

test("les tours disparaissent avec leur activité", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const activityId = await creerActivite(request, lea);
  await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(lea.jeton),
    data: [tour(activityId, lea.id, 0)],
  });

  await request.delete(`${URL}/rest/v1/activities?id=eq.${activityId}`, {
    headers: entetes(lea.jeton),
  });

  const restants = await request.get(
    `${URL}/rest/v1/activity_laps?select=position&activity_id=eq.${activityId}`,
    { headers: entetes(lea.jeton) }
  );
  expect(await restants.json()).toHaveLength(0);
});

test("le visiteur non connecté n'a aucun accès à la table", async ({ request }) => {
  const reponse = await request.get(`${URL}/rest/v1/activity_laps?select=position`, {
    headers: { apikey: CLE },
  });
  expect(reponse.ok()).toBeFalsy();
});
