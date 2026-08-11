import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Un compte qui tient les deux rôles (issue #62).
 *
 * Ce que ces tests vérifient tient en une phrase : le trigger
 * `enforce_session_ownership` (migration 002) et la RLS tranchent **par
 * séance**, pas par personne. Le même compte coach est donc l'athlète de ses
 * propres séances et le coach de celles qu'il prescrit — avec, sur les deux,
 * des droits exactement opposés.
 *
 * On interroge l'API directement : c'est la base qu'on vérifie, aucune
 * interface ne doit avoir à faire respecter cette règle.
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

/** Séance libre du coach : il en est l'athlète, personne ne la lui prescrit. */
async function creerSeancePersonnelle(
  request: APIRequestContext,
  coach: { jeton: string; id: string }
) {
  const reponse = await request.post(`${URL}/rest/v1/sessions`, {
    headers: entetes(coach.jeton),
    data: {
      athlete_id: coach.id,
      coach_id: null,
      date: new Date().toISOString().slice(0, 10),
      title: `Perso ${crypto.randomUUID().slice(0, 8)}`,
      type: "endurance",
      status: "planned",
    },
  });
  expect(reponse.status(), "un coach peut se créer une séance").toBe(201);
  const [seance] = (await reponse.json()) as Array<{ id: string }>;
  return seance;
}

/** Séance que le coach prescrit à l'un de ses athlètes. */
async function creerSeancePrescrite(
  request: APIRequestContext,
  coach: { jeton: string; id: string },
  athleteId: string
) {
  const reponse = await request.post(`${URL}/rest/v1/sessions`, {
    headers: entetes(coach.jeton),
    data: {
      athlete_id: athleteId,
      coach_id: coach.id,
      date: new Date().toISOString().slice(0, 10),
      title: `Prescrite ${crypto.randomUUID().slice(0, 8)}`,
      type: "endurance",
      status: "planned",
    },
  });
  expect(reponse.status()).toBe(201);
  const [seance] = (await reponse.json()) as Array<{ id: string }>;
  return seance;
}

test("le coach rapporte ses propres séances, mais jamais celles de ses athlètes", async ({
  request,
}) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");

  const sienne = await creerSeancePersonnelle(request, coach);
  const prescrite = await creerSeancePrescrite(request, coach, lea.id);

  // Sur la sienne, il est l'athlète : le compte rendu lui appartient.
  const surLaSienne = await request.patch(
    `${URL}/rest/v1/sessions?id=eq.${sienne.id}`,
    {
      headers: entetes(coach.jeton),
      data: { status: "completed", rpe: 7, duration_actual_min: 50 },
    }
  );
  expect(surLaSienne.status(), "son propre compte rendu").toBe(200);

  // Sur celle de Léa, il est le coach : le compte rendu ne lui appartient
  // pas, et le trigger le refuse — même compte, même requête, autre séance.
  const surCelleDeLea = await request.patch(
    `${URL}/rest/v1/sessions?id=eq.${prescrite.id}`,
    {
      headers: entetes(coach.jeton),
      data: { status: "completed", rpe: 7 },
    }
  );
  expect(surCelleDeLea.ok(), "le compte rendu de son athlète").toBeFalsy();

  // Ménage.
  await request.delete(`${URL}/rest/v1/sessions?id=eq.${sienne.id}`, {
    headers: entetes(coach.jeton),
  });
  await request.delete(`${URL}/rest/v1/sessions?id=eq.${prescrite.id}`, {
    headers: entetes(coach.jeton),
  });
});

test("la séance personnelle d'un coach reste invisible à ses athlètes", async ({
  request,
}) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const sienne = await creerSeancePersonnelle(request, coach);

  // Léa voit son coach dans `profiles` (elle lui écrit), mais l'entraînement
  // de celui-ci ne la regarde pas : la visibilité des séances passe par
  // `is_my_athlete`, et le coach n'est l'athlète de personne ici.
  const vueDeLea = await request.get(
    `${URL}/rest/v1/sessions?select=id&id=eq.${sienne.id}`,
    { headers: entetes(lea.jeton) }
  );
  expect(vueDeLea.ok()).toBeTruthy();
  expect(await vueDeLea.json()).toHaveLength(0);

  await request.delete(`${URL}/rest/v1/sessions?id=eq.${sienne.id}`, {
    headers: entetes(coach.jeton),
  });
});

test("un compte ne peut pas devenir son propre coach", async ({ request }) => {
  // Une liaison sur soi-même rendrait `is_my_athlete(soi)` vrai, ce qui
  // élargirait silencieusement toutes les politiques écrites en « moi **ou**
  // mes athlètes ». C'est le seul enchaînement que la migration 014 interdit.
  const coach = await ouvrirSession(request, "coach@example.com");

  const profil = await request.get(
    `${URL}/rest/v1/profiles?select=invite_code&id=eq.${coach.id}`,
    { headers: entetes(coach.jeton) }
  );
  const [{ invite_code }] = (await profil.json()) as Array<{ invite_code: string }>;

  const reponse = await request.post(`${URL}/rest/v1/rpc/link_to_coach`, {
    headers: entetes(coach.jeton),
    data: { code: invite_code },
  });
  expect(reponse.ok()).toBeFalsy();
  expect(JSON.stringify(await reponse.json())).toContain("son propre coach");
});
