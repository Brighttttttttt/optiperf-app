import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * Qui peut supprimer une séance (migration 018).
 *
 * On s'adresse à la base directement : c'est la policy qu'on vérifie, et elle
 * doit tenir même si quelqu'un contourne l'interface. La règle affichée
 * (`peutSupprimer`, testée à part) n'en est que le miroir.
 *
 * Le cas qui compte est le troisième : jusqu'à cette migration, la policy de
 * 001 laissait un athlète effacer une prescription de son coach. Personne ne
 * s'en était aperçu parce qu'aucun écran n'appelait la suppression.
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

const entetes = (jeton: string) => ({
  apikey: CLE,
  Authorization: `Bearer ${jeton}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
});

async function creerSeance(
  request: APIRequestContext,
  auteur: { jeton: string; id: string },
  champs: Record<string, unknown>
) {
  const reponse = await request.post(`${URL}/rest/v1/sessions`, {
    headers: entetes(auteur.jeton),
    data: {
      date: "2026-03-15",
      title: `Suppression e2e ${crypto.randomUUID().slice(0, 8)}`,
      type: "endurance",
      ...champs,
    },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
  const [seance] = await reponse.json();
  return seance.id as string;
}

/** Combien de lignes ont réellement disparu, plutôt que le seul code HTTP. */
async function supprimer(
  request: APIRequestContext,
  jeton: string,
  seanceId: string
) {
  const reponse = await request.delete(`${URL}/rest/v1/sessions?id=eq.${seanceId}`, {
    headers: entetes(jeton),
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
  return ((await reponse.json()) as unknown[]).length;
}

test("le coach supprime une prescription encore à venir", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const id = await creerSeance(request, coach, {
    athlete_id: lea.id,
    coach_id: coach.id,
  });

  expect(await supprimer(request, coach.jeton, id)).toBe(1);
});

test("le coach ne supprime pas une séance déjà rapportée", async ({ request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const id = await creerSeance(request, coach, {
    athlete_id: lea.id,
    coach_id: coach.id,
  });

  // C'est l'athlète qui la déclare faite — le trigger interdit au coach de
  // toucher au compte rendu.
  const rapport = await request.patch(`${URL}/rest/v1/sessions?id=eq.${id}`, {
    headers: entetes(lea.jeton),
    data: { status: "completed", rpe: 6, duration_actual_min: 45 },
  });
  expect(rapport.ok(), await rapport.text()).toBeTruthy();

  // Zéro ligne touchée : la policy filtre, elle ne renvoie pas d'erreur.
  expect(await supprimer(request, coach.jeton, id)).toBe(0);
});

test("l'athlète ne supprime pas une séance prescrite par son coach", async ({
  request,
}) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const id = await creerSeance(request, coach, {
    athlete_id: lea.id,
    coach_id: coach.id,
  });

  expect(await supprimer(request, lea.jeton, id)).toBe(0);

  // Et elle est toujours là : ce n'est pas une suppression silencieuse.
  const restante = await request.get(`${URL}/rest/v1/sessions?select=id&id=eq.${id}`, {
    headers: entetes(lea.jeton),
  });
  expect(await restante.json()).toHaveLength(1);
});

test("l'athlète supprime sa propre séance libre, faite ou non", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");

  const aVenir = await creerSeance(request, lea, {
    athlete_id: lea.id,
    coach_id: null,
  });
  expect(await supprimer(request, lea.jeton, aVenir)).toBe(1);

  const faite = await creerSeance(request, lea, {
    athlete_id: lea.id,
    coach_id: null,
    status: "completed",
    rpe: 5,
    duration_actual_min: 40,
  });
  expect(await supprimer(request, lea.jeton, faite)).toBe(1);
});

test("un autre athlète ne supprime rien du tout", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");
  const id = await creerSeance(request, lea, { athlete_id: lea.id, coach_id: null });

  expect(await supprimer(request, nino.jeton, id)).toBe(0);
});

test("une activité importée survit à la suppression de sa séance", async ({
  request,
}) => {
  // `activities.session_id` est `on delete set null` (007) : ce qu'une montre
  // a mesuré reste vrai même sans la séance qui la portait.
  const lea = await ouvrirSession(request, "lea@example.com");
  const seanceId = await creerSeance(request, lea, {
    athlete_id: lea.id,
    coach_id: null,
    status: "completed",
    rpe: 5,
    duration_actual_min: 40,
  });

  const activiteRes = await request.post(`${URL}/rest/v1/activities`, {
    headers: entetes(lea.jeton),
    data: {
      athlete_id: lea.id,
      session_id: seanceId,
      source: "fichier",
      external_id: `survie-${crypto.randomUUID()}`,
      started_at: "2026-03-15T09:00:00Z",
      date: "2026-03-15",
      duration_min: 40,
    },
  });
  const [activite] = await activiteRes.json();

  expect(await supprimer(request, lea.jeton, seanceId)).toBe(1);

  const apres = await request.get(
    `${URL}/rest/v1/activities?select=id,session_id&id=eq.${activite.id}`,
    { headers: entetes(lea.jeton) }
  );
  const [trouvee] = (await apres.json()) as Array<{ session_id: string | null }>;
  expect(trouvee).toBeDefined();
  expect(trouvee.session_id).toBeNull();
});
