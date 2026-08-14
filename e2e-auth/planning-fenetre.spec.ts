import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Le planning au-delà de sa fenêtre initiale (#141).
 *
 * La vue semaine charge ±8 semaines d'un coup pour naviguer sans attendre le
 * serveur. Les flèches, elles, n'étaient bornées par rien : passé la fenêtre,
 * chaque jour affichait « Rien de prévu ce jour-là », strictement
 * indistinguable d'un jour réellement libre. Une séance importée d'une sortie
 * ancienne n'apparaissait donc nulle part dans le planning.
 *
 * Douze semaines en arrière : franchement au-delà des huit chargées, et sur
 * un multiple de sept pour que le nombre de clics soit déterministe — le jour
 * ouvert suit la semaine, il tombe donc pile sur la séance.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const MOT_DE_PASSE = "optiperf-demo";
const SEMAINES = 12;

/**
 * Composants locaux, jamais `toISOString()` : celui-ci bascule en UTC et
 * peut reculer d'un jour, donc d'une semaine entière quand la date tombe un
 * lundi — le décompte de clics ne tomberait plus juste.
 */
function ilYADouzeSemaines() {
  const d = new Date();
  d.setDate(d.getDate() - SEMAINES * 7);
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

async function ouvrirSession(request: APIRequestContext, email: string) {
  const reponse = await request.post(`${URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CLE, "Content-Type": "application/json" },
    data: { email, password: MOT_DE_PASSE },
  });
  expect(reponse.ok(), `connexion de ${email}`).toBeTruthy();
  const { access_token, user } = await reponse.json();
  return { jeton: access_token as string, id: user.id as string };
}

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

async function remonter(page: Page, semaines: number) {
  const precedente = page.getByRole("button", { name: "Semaine précédente" });
  for (let i = 0; i < semaines; i++) await precedente.click();
}

test("une séance plus ancienne que la fenêtre finit par s'afficher", async ({
  page,
  request,
}) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const titre = `Fenêtre e2e ${crypto.randomUUID().slice(0, 8)}`;

  // Une séance libre, comme celle que crée l'import d'un fichier ancien.
  const creation = await request.post(`${URL}/rest/v1/sessions`, {
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${lea.jeton}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: {
      athlete_id: lea.id,
      coach_id: null,
      date: ilYADouzeSemaines(),
      title: titre,
      type: "endurance",
      status: "completed",
      rpe: 5,
      duration_actual_min: 50,
    },
  });
  expect(creation.ok(), await creation.text()).toBeTruthy();

  await seConnecter(page, "lea@example.com");
  await page.goto("/planning");
  await expect(page.getByText("Cette semaine")).toBeVisible();

  await remonter(page, SEMAINES);

  // Le jour ouvert a suivi les douze semaines : c'est celui de la séance.
  // Sans le chargement à la demande, on lirait ici « Rien de prévu ».
  await expect(page.getByText(titre)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Rien de prévu ce jour-là.")).toBeHidden();
});

test("le coach voit lui aussi au-delà de la fenêtre", async ({ page, request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const titre = `Fenêtre coach e2e ${crypto.randomUUID().slice(0, 8)}`;

  const creation = await request.post(`${URL}/rest/v1/sessions`, {
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${coach.jeton}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: {
      athlete_id: lea.id,
      coach_id: coach.id,
      date: ilYADouzeSemaines(),
      title: titre,
      type: "endurance",
    },
  });
  expect(creation.ok(), await creation.text()).toBeTruthy();

  await seConnecter(page, "coach@example.com");
  await page.goto(`/athletes/${lea.id}/planning`);
  await expect(page.getByText("Cette semaine")).toBeVisible();

  await remonter(page, SEMAINES);

  await expect(page.getByText(titre)).toBeVisible({ timeout: 15_000 });
});
