import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Isolation de `workout_blocks` (migration 011), sur le modèle de
 * `activites.spec.ts` : la RLS et les contraintes SQL, qu'aucune interface
 * ne doit avoir à faire respecter. Les séances utilisées sont créées ici
 * plutôt que reprises du peuplement, pour contrôler leur statut (planifiée
 * ou non) — la mutabilité d'un bloc en dépend directement.
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

async function creerSeance(
  request: APIRequestContext,
  coach: { jeton: string; id: string },
  athleteId: string,
  status: "planned" | "completed" = "planned"
) {
  const reponse = await request.post(`${URL}/rest/v1/sessions`, {
    headers: entetes(coach.jeton),
    data: {
      athlete_id: athleteId,
      coach_id: coach.id,
      date: "2026-01-20",
      title: "Séance de test (isolation blocs)",
      type: "intervalles",
      ...(status === "completed"
        ? { status: "completed", rpe: 6, duration_actual_min: 45, completed_at: new Date().toISOString() }
        : {}),
    },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
  const [seance] = await reponse.json();
  return seance.id as string;
}

test("le coach ajoute un bloc à une séance planifiée de son athlète", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeance(request, coach, lea.id);

  const reponse = await request.post(`${URL}/rest/v1/workout_blocks`, {
    headers: entetes(coach.jeton),
    data: { session_id: sessionId, position: 0, block_type: "echauffement", duration_sec: 900 },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
});

test("un autre athlète ne voit jamais ce bloc", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");
  const sessionId = await creerSeance(request, coach, lea.id);
  await request.post(`${URL}/rest/v1/workout_blocks`, {
    headers: entetes(coach.jeton),
    data: { session_id: sessionId, position: 0, block_type: "echauffement", duration_sec: 900 },
  });

  const reponse = await request.get(
    `${URL}/rest/v1/workout_blocks?select=id&session_id=eq.${sessionId}`,
    { headers: entetes(nino.jeton) }
  );
  expect(reponse.ok()).toBeTruthy();
  expect(await reponse.json()).toHaveLength(0);
});

test("l'athlète ne peut pas écrire un bloc sur une séance prescrite par son coach", async ({ request }) => {
  // Même règle que pour la séance elle-même : la prescription appartient au
  // coach, le compte rendu à l'athlète.
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeance(request, coach, lea.id);

  const reponse = await request.post(`${URL}/rest/v1/workout_blocks`, {
    headers: entetes(lea.jeton),
    data: { session_id: sessionId, position: 0, block_type: "echauffement", duration_sec: 900 },
  });
  expect(reponse.status()).toBe(403);
});

test("un bloc devient immuable dès que la séance quitte le statut planifié", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeance(request, coach, lea.id, "completed");

  const reponse = await request.post(`${URL}/rest/v1/workout_blocks`, {
    headers: entetes(coach.jeton),
    data: { session_id: sessionId, position: 0, block_type: "echauffement", duration_sec: 900 },
  });
  expect(reponse.status()).toBe(403);
});

test("un bloc refuse d'exister sans durée ni distance", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeance(request, coach, lea.id);

  const reponse = await request.post(`${URL}/rest/v1/workout_blocks`, {
    headers: entetes(coach.jeton),
    data: { session_id: sessionId, position: 0, block_type: "recuperation" },
  });
  expect(reponse.status()).toBe(400);
});

test("le visiteur non connecté n'a aucun accès à la table", async ({ request }) => {
  const reponse = await request.get(`${URL}/rest/v1/workout_blocks?select=id`, {
    headers: { apikey: CLE },
  });
  expect(reponse.ok()).toBeFalsy();
});
