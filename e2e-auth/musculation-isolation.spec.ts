import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Isolation de `exercises` et `exercise_logs` (migration 013), sur le
 * modèle de `blocs-isolation.spec.ts`.
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

async function creerSeanceMuscu(
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
      title: "Séance de muscu (isolation)",
      type: "renfo",
      ...(status === "completed"
        ? { status: "completed", rpe: 6, duration_actual_min: 45, completed_at: new Date().toISOString() }
        : {}),
    },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
  const [seance] = await reponse.json();
  return seance.id as string;
}

async function creerExercice(
  request: APIRequestContext,
  jeton: string,
  sessionId: string
) {
  const reponse = await request.post(`${URL}/rest/v1/exercises`, {
    headers: entetes(jeton),
    data: { session_id: sessionId, position: 0, name: "Squat", sets: 4, reps: 8 },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
  const [exercice] = await reponse.json();
  return exercice.id as string;
}

test("le coach prescrit un exercice à son athlète", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeanceMuscu(request, coach, lea.id);
  await creerExercice(request, coach.jeton, sessionId);
});

test("un autre athlète ne voit jamais cet exercice", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");
  const sessionId = await creerSeanceMuscu(request, coach, lea.id);
  await creerExercice(request, coach.jeton, sessionId);

  const reponse = await request.get(
    `${URL}/rest/v1/exercises?select=id&session_id=eq.${sessionId}`,
    { headers: entetes(nino.jeton) }
  );
  expect(await reponse.json()).toHaveLength(0);
});

test("l'athlète ne peut pas écrire un exercice sur une séance prescrite", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeanceMuscu(request, coach, lea.id);

  const reponse = await request.post(`${URL}/rest/v1/exercises`, {
    headers: entetes(lea.jeton),
    data: { session_id: sessionId, position: 0, name: "Squat", sets: 4, reps: 8 },
  });
  expect(reponse.status()).toBe(403);
});

test("un exercice devient immuable dès que la séance quitte le statut planifié", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeanceMuscu(request, coach, lea.id, "completed");

  const reponse = await request.post(`${URL}/rest/v1/exercises`, {
    headers: entetes(coach.jeton),
    data: { session_id: sessionId, position: 0, name: "Squat", sets: 4, reps: 8 },
  });
  expect(reponse.status()).toBe(403);
});

test("l'athlète écrit son propre compte rendu d'exercice", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeanceMuscu(request, coach, lea.id);
  const exerciseId = await creerExercice(request, coach.jeton, sessionId);

  const reponse = await request.post(`${URL}/rest/v1/exercise_logs`, {
    headers: entetes(lea.jeton),
    data: { exercise_id: exerciseId, athlete_id: lea.id, sets_done: 4, reps_done: 8, done: true },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
});

test("le coach ne peut pas écrire le compte rendu d'un exercice", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sessionId = await creerSeanceMuscu(request, coach, lea.id);
  const exerciseId = await creerExercice(request, coach.jeton, sessionId);

  const reponse = await request.post(`${URL}/rest/v1/exercise_logs`, {
    headers: entetes(coach.jeton),
    data: { exercise_id: exerciseId, athlete_id: lea.id, sets_done: 4, reps_done: 8, done: true },
  });
  expect(reponse.status()).toBe(403);
});

test("un athlète ne peut pas écrire un compte rendu sur l'exercice d'un autre", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");
  const sessionId = await creerSeanceMuscu(request, coach, lea.id);
  const exerciseId = await creerExercice(request, coach.jeton, sessionId);

  const reponse = await request.post(`${URL}/rest/v1/exercise_logs`, {
    headers: entetes(nino.jeton),
    data: { exercise_id: exerciseId, athlete_id: nino.id, sets_done: 4, reps_done: 8, done: true },
  });
  expect(reponse.status()).toBe(403);
});

test("le visiteur non connecté n'a aucun accès aux deux tables", async ({ request }) => {
  const r1 = await request.get(`${URL}/rest/v1/exercises?select=id`, { headers: { apikey: CLE } });
  expect(r1.ok()).toBeFalsy();
  const r2 = await request.get(`${URL}/rest/v1/exercise_logs?select=id`, { headers: { apikey: CLE } });
  expect(r2.ok()).toBeFalsy();
});
