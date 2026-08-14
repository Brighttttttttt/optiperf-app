import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Le planning au-delà de sa fenêtre initiale (#141).
 *
 * La vue charge douze semaines de part et d'autre pour naviguer sans attendre
 * le serveur. Les flèches, elles, ne sont bornées par rien : passé la fenêtre,
 * chaque jour affichait « Rien de prévu ce jour-là », strictement
 * indistinguable d'un jour réellement libre. Une séance importée d'une sortie
 * ancienne n'apparaissait donc nulle part dans le planning.
 *
 * Quatre mois en arrière : franchement au-delà des douze semaines chargées,
 * quel que soit le jour du mois où le test s'exécute.
 *
 * Les dates sont calculées **en heure de Paris**, comme l'app (#146) : le
 * fuseau des runners est UTC, et un calcul posé près de minuit viserait un
 * autre jour que celui affiché.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const MOT_DE_PASSE = "optiperf-demo";
const MOIS = 4;

function aujourdhuiAParis(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(
    new Date()
  );
}

/** Le 15 du mois, `n` mois en arrière — jamais de bord de mois à négocier. */
function leQuinzeIlYA(n: number): string {
  const [an, mois] = aujourdhuiAParis().split("-").map(Number);
  return new Date(Date.UTC(an, mois - 1 - n, 15, 12)).toISOString().slice(0, 10);
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

async function creerSeance(
  request: APIRequestContext,
  jeton: string,
  champs: Record<string, unknown>
) {
  const reponse = await request.post(`${URL}/rest/v1/sessions`, {
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${jeton}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    data: { date: leQuinzeIlYA(MOIS), type: "endurance", ...champs },
  });
  expect(reponse.ok(), await reponse.text()).toBeTruthy();
}

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

async function remonter(page: Page, mois: number) {
  const precedent = page
    .getByRole("group", { name: "Mois affiché" })
    .getByRole("button", { name: "Mois précédent" });
  for (let i = 0; i < mois; i++) await precedent.click();
}

test("une séance plus ancienne que la fenêtre finit par s'afficher", async ({
  page,
  request,
}) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const titre = `Fenêtre e2e ${crypto.randomUUID().slice(0, 8)}`;
  await creerSeance(request, lea.jeton, {
    athlete_id: lea.id,
    coach_id: null,
    title: titre,
    status: "completed",
    rpe: 5,
    duration_actual_min: 50,
  });

  await seConnecter(page, "lea@example.com");
  await page.goto("/planning");
  await remonter(page, MOIS);

  // Le mois s'ouvre sur son premier jour : c'est le 15 qu'il faut demander.
  // Sans le chargement à la demande, on lirait ici « Rien de prévu ».
  await page.locator(`[data-jour="${leQuinzeIlYA(MOIS)}"]`).click();
  await expect(page.getByText(titre)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Rien de prévu ce jour-là.")).toBeHidden();
});

test("le coach voit lui aussi au-delà de la fenêtre", async ({ page, request }) => {
  const coach = await ouvrirSession(request, "coach@example.com");
  const lea = await ouvrirSession(request, "lea@example.com");
  const titre = `Fenêtre coach e2e ${crypto.randomUUID().slice(0, 8)}`;
  await creerSeance(request, coach.jeton, {
    athlete_id: lea.id,
    coach_id: coach.id,
    title: titre,
  });

  await seConnecter(page, "coach@example.com");
  await page.goto(`/athletes/${lea.id}/planning`);
  await remonter(page, MOIS);

  await page.locator(`[data-jour="${leQuinzeIlYA(MOIS)}"]`).click();
  await expect(page.getByText(titre)).toBeVisible({ timeout: 15_000 });
});
