import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * L'analyse de séance telle qu'elle s'affiche (#125, #126).
 *
 * La séance et ses tours sont posés par l'API avant d'ouvrir les pages : le
 * parcours d'import complet est déjà couvert ailleurs (`import.spec.ts`), et
 * le reconstituer ici rendrait le test long sans rien vérifier de plus. Ce
 * qu'on regarde, c'est que la structure lue dans les tours **arrive à
 * l'écran** — des deux côtés, et avant même d'ouvrir la séance.
 *
 * **Plage horaire de ce fichier : 05 h UTC.** Depuis #107, deux activités du
 * même athlète dont les départs sont à moins de cinq minutes sont reconnues
 * comme la même sortie. Les fichiers de spec s'exécutent en parallèle et
 * partagent les mêmes comptes : dater à `new Date()` entrait en collision
 * avec `import.spec.ts` — qui dépose vers 10 h UTC — dès que la suite tournait
 * à cette heure-là (#151). Voir le tableau des plages dans CLAUDE.md.
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

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

/**
 * Un 5×1km avec récupérations : la séance la plus reconnaissable qui soit,
 * et celle dont le libellé se vérifie sans ambiguïté.
 */
async function poserSeanceAnalysable(
  request: APIRequestContext,
  athlete: { jeton: string; id: string },
  titre: string
) {
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const seanceRes = await request.post(`${URL}/rest/v1/sessions`, {
    headers: entetes(athlete.jeton),
    data: {
      athlete_id: athlete.id,
      coach_id: null,
      date: aujourdhui,
      title: titre,
      type: "intervalles",
      status: "completed",
      duration_actual_min: 45,
      rpe: 7,
      completed_at: new Date().toISOString(),
    },
  });
  expect(seanceRes.ok(), await seanceRes.text()).toBeTruthy();
  const [seance] = await seanceRes.json();

  const activiteRes = await request.post(`${URL}/rest/v1/activities`, {
    headers: entetes(athlete.jeton),
    data: {
      athlete_id: athlete.id,
      session_id: seance.id,
      source: "fichier",
      external_id: `analyse-${crypto.randomUUID()}`,
      started_at: `${aujourdhui}T05:00:00Z`,
      date: aujourdhui,
      duration_min: 45,
      distance_m: 11000,
      avg_heart_rate: 162,
    },
  });
  expect(activiteRes.ok(), await activiteRes.text()).toBeTruthy();
  const [activite] = await activiteRes.json();

  // Échauffement, 5×(1 km + trot), retour au calme. Les allures sont
  // réalistes : 3'30"/km sur les efforts, 8 km/h sur les récupérations.
  const tours = [
    { duration_s: 900, distance_m: 2500, avg_heart_rate: 135 },
    ...[210, 209, 211, 210, 212].flatMap((s) => [
      { duration_s: s, distance_m: 1000, avg_heart_rate: 175 },
      { duration_s: 90, distance_m: 200, avg_heart_rate: 150 },
    ]),
    { duration_s: 600, distance_m: 1600, avg_heart_rate: 140 },
  ];

  const toursRes = await request.post(`${URL}/rest/v1/activity_laps`, {
    headers: entetes(athlete.jeton),
    data: tours.map((t, position) => ({
      activity_id: activite.id,
      athlete_id: athlete.id,
      position,
      ...t,
    })),
  });
  expect(toursRes.ok(), await toursRes.text()).toBeTruthy();

  return seance.id as string;
}

test("l'athlète lit la structure de sa séance, avant et après l'avoir ouverte", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  const lea = await ouvrirSession(request, "lea@example.com");
  const titre = `Analyse e2e ${crypto.randomUUID().slice(0, 8)}`;
  await poserSeanceAnalysable(request, lea, titre);

  await seConnecter(page, "lea@example.com");
  await page.getByRole("link", { name: "Historique" }).click();

  // Avant d'ouvrir : la structure et la phrase de résumé sur la ligne.
  const ligne = page.locator("a").filter({ hasText: titre });
  await expect(ligne.getByText("5×1km", { exact: false })).toBeVisible();
  await expect(ligne.getByText(/5 réps à \d:\d\d\/km/)).toBeVisible();

  // Après : les trois onglets.
  await ligne.click();
  await expect(page.getByRole("tab", { name: "Analyse" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Graphique" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Tours" })).toBeVisible();

  // L'onglet Analyse est ouvert d'office : le sens avant la forme.
  await expect(page.getByRole("tabpanel")).toContainText("5×1km");
  await expect(page.getByRole("tabpanel")).toContainText("FC 162 bpm");
});

test("les trois onglets montrent chacun leur contenu", async ({ page, request }) => {
  test.setTimeout(60_000);

  const nino = await ouvrirSession(request, "nino@example.com");
  const titre = `Onglets e2e ${crypto.randomUUID().slice(0, 8)}`;
  const seanceId = await poserSeanceAnalysable(request, nino, titre);

  await seConnecter(page, "nino@example.com");
  await page.goto(`/seances/${seanceId}`);

  await page.getByRole("tab", { name: "Graphique" }).click();
  // Le graphique est du SVG écrit à la main : il porte son propre résumé
  // accessible, sans quoi il ne dirait rien à un lecteur d'écran.
  await expect(page.getByRole("img", { name: /Vitesse et fréquence cardiaque/ })).toBeVisible();

  await page.getByRole("tab", { name: "Tours" }).click();
  const tableau = page.getByRole("table");
  await expect(tableau).toBeVisible();
  // 12 tours posés : le tableau les montre tous, groupés par phase.
  await expect(tableau.getByRole("row")).toHaveCount(12 + 1 + 4);
  await expect(tableau.getByText("Échauffement")).toBeVisible();
  await expect(tableau.getByText("Intervalles")).toBeVisible();
});

test("le coach voit la même analyse sur la séance de son athlète", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  const lea = await ouvrirSession(request, "lea@example.com");
  const titre = `Coach e2e ${crypto.randomUUID().slice(0, 8)}`;
  const seanceId = await poserSeanceAnalysable(request, lea, titre);

  await seConnecter(page, "coach@example.com");
  await page.goto(`/seances/${seanceId}`);

  await expect(page.getByRole("tabpanel")).toContainText("5×1km");
  await expect(page.getByRole("tab", { name: "Tours" })).toBeVisible();
});

test("une séance sans tours explique son absence d'analyse", async ({
  page,
  request,
}) => {
  test.setTimeout(60_000);

  // Une activité sans le moindre tour : le cas d'un GPX.
  const sofia = await ouvrirSession(request, "sofia@example.com");
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const titre = `Sans tours e2e ${crypto.randomUUID().slice(0, 8)}`;

  const seanceRes = await request.post(`${URL}/rest/v1/sessions`, {
    headers: entetes(sofia.jeton),
    data: {
      athlete_id: sofia.id,
      coach_id: null,
      date: aujourdhui,
      title: titre,
      type: "endurance",
      status: "completed",
      duration_actual_min: 40,
      rpe: 5,
      completed_at: new Date().toISOString(),
    },
  });
  const [seance] = await seanceRes.json();

  await request.post(`${URL}/rest/v1/activities`, {
    headers: entetes(sofia.jeton),
    data: {
      athlete_id: sofia.id,
      session_id: seance.id,
      source: "fichier",
      external_id: `sans-tours-${crypto.randomUUID()}`,
      started_at: `${aujourdhui}T05:30:00Z`,
      date: aujourdhui,
      duration_min: 40,
      distance_m: 8000,
    },
  });

  await seConnecter(page, "sofia@example.com");
  await page.goto(`/seances/${seance.id}`);

  await expect(page.getByText(/ne contient pas de tours/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "Tours" })).toHaveCount(0);
});
