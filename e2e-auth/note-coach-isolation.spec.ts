import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Isolation de `coach_notes` (migration 015).
 *
 * C'est la table la plus asymétrique du schéma : le coach y écrit *sur*
 * quelqu'un qui ne peut pas la lire. Cette invisibilité n'est tenue par aucune
 * politique — elle vient de l'absence délibérée de politique pour l'athlète —
 * et une absence ne se relit pas dans un diff. D'où ces tests, qui font
 * l'inventaire de ce que chacun obtient en s'adressant à la base directement,
 * sans passer par l'interface.
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

/**
 * Une note par paire (coach, athlète) : sans ce nettoyage, le deuxième test
 * qui vise la même paire buterait sur la contrainte d'unicité.
 */
async function viderNote(
  request: APIRequestContext,
  coach: { jeton: string; id: string },
  athleteId: string
) {
  await request.delete(
    `${URL}/rest/v1/coach_notes?coach_id=eq.${coach.id}&athlete_id=eq.${athleteId}`,
    { headers: entetes(coach.jeton) }
  );
}

async function ecrireNote(
  request: APIRequestContext,
  coach: { jeton: string; id: string },
  athleteId: string,
  content = "Genou droit fragile depuis mars."
) {
  return request.post(`${URL}/rest/v1/coach_notes`, {
    headers: entetes(coach.jeton),
    data: { coach_id: coach.id, athlete_id: athleteId, content },
  });
}

test("le coach écrit une note sur son athlète", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  await viderNote(request, coach, lea.id);

  const reponse = await ecrireNote(request, coach, lea.id);
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
});

test("l'athlète concerné ne voit pas la note écrite sur lui", async ({ request }) => {
  // Le cœur de #86. Ce n'est pas l'interface qui cache la note : c'est que la
  // RLS n'écrit aucune politique pour l'athlète, et qu'une table protégée sans
  // politique ne rend rien.
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  await viderNote(request, coach, lea.id);
  await ecrireNote(request, coach, lea.id, "Ne doit jamais lui parvenir.");

  const reponse = await request.get(`${URL}/rest/v1/coach_notes?select=content`, {
    headers: entetes(lea.jeton),
  });
  expect(reponse.ok()).toBeTruthy();
  expect(await reponse.json()).toHaveLength(0);
});

test("un autre athlète du même coach ne la voit pas davantage", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");
  await viderNote(request, coach, lea.id);
  await ecrireNote(request, coach, lea.id);

  const reponse = await request.get(
    `${URL}/rest/v1/coach_notes?select=content&athlete_id=eq.${lea.id}`,
    { headers: entetes(nino.jeton) }
  );
  expect(reponse.ok()).toBeTruthy();
  expect(await reponse.json()).toHaveLength(0);
});

test("l'athlète ne peut pas écrire de note, même sur lui-même", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");

  const reponse = await request.post(`${URL}/rest/v1/coach_notes`, {
    headers: entetes(lea.jeton),
    data: { coach_id: lea.id, athlete_id: lea.id, content: "Tentative." },
  });
  expect(reponse.ok()).toBeFalsy();
});

test("une note ne peut pas viser quelqu'un qui n'est pas mon athlète", async ({ request }) => {
  // Le coach vise son propre compte : il n'est l'athlète de personne, donc ni
  // la clé étrangère vers `coach_athletes` ni la politique ne l'acceptent.
  const coach = await ouvrirSession(request, "coach@example.com");

  const reponse = await request.post(`${URL}/rest/v1/coach_notes`, {
    headers: entetes(coach.jeton),
    data: { coach_id: coach.id, athlete_id: coach.id, content: "Hors groupe." },
  });
  expect(reponse.ok()).toBeFalsy();
});

test("une seule note par paire coach / athlète", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const sofia = await ouvrirSession(request, "sofia@example.com");
  await viderNote(request, coach, sofia.id);

  expect((await ecrireNote(request, coach, sofia.id, "Première.")).ok()).toBeTruthy();
  // La deuxième ne s'empile pas : le carnet se réécrit, il ne s'accumule pas.
  const doublon = await ecrireNote(request, coach, sofia.id, "Deuxième.");
  expect(doublon.status()).toBe(409);
});

test("une note trop longue est refusée par la base", async ({ request }) => {
  // La limite est doublée (contrainte SQL + LIMITS côté application) : ce test
  // vérifie celle qui reste quand l'interface est contournée.
  // Sofia et Léa seulement dans ce fichier : le parcours d'interface écrit sur
  // Nino, et les deux fichiers tournent en parallèle. Une note par paire — se
  // marcher dessus produirait un échec qui ressemblerait à un défaut de RLS.
  const coach = await ouvrirSession(request, "coach@example.com");
  const sofia = await ouvrirSession(request, "sofia@example.com");
  await viderNote(request, coach, sofia.id);

  const reponse = await ecrireNote(request, coach, sofia.id, "a".repeat(2001));
  expect(reponse.status()).toBe(400);
});

test("le visiteur non connecté n'a aucun accès à la table", async ({ request }) => {
  const reponse = await request.get(`${URL}/rest/v1/coach_notes?select=id`, {
    headers: { apikey: CLE },
  });
  expect(reponse.ok()).toBeFalsy();
});
