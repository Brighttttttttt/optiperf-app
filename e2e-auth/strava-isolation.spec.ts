import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Ce que le coach voit des connexions de son athlète : rien (#105).
 *
 * Aucune politique RLS ne lui est écrite, et une table protégée sans
 * politique ne rend rien. L'invisibilité tient donc à une **absence**, qui ne
 * se relit pas dans un diff — d'où ce test, comme pour `coach_notes` (015).
 *
 * Ce n'est pas du confort : les conditions d'API de Strava interdisent
 * d'exposer les données d'un athlète à un tiers, et la première d'entre elles
 * est le fait même qu'il ait un compte chez eux.
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

test("le coach ne voit pas la connexion Strava de son athlète", async ({
  request,
}) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const coach = await ouvrirSession(request, "coach@example.com");

  // L'athlète pose sa propre connexion. Les jetons sont ici de la ficelle :
  // ce qui se vérifie est la visibilité de la ligne, pas son contenu.
  const creation = await request.post(`${URL}/rest/v1/provider_connections`, {
    headers: entetes(lea.jeton),
    data: {
      athlete_id: lea.id,
      provider: "strava",
      external_athlete_id: `e2e-${crypto.randomUUID().slice(0, 8)}`,
      access_token: "chiffre-factice-acces",
      refresh_token: "chiffre-factice-renouvellement",
      expires_at: "2030-01-01T00:00:00Z",
      scope: "activity:read_all",
    },
  });
  expect(creation.ok(), await creation.text()).toBeTruthy();

  // Le coach demande tout ce que la table veut bien lui rendre.
  const vueCoach = await request.get(
    `${URL}/rest/v1/provider_connections?select=*`,
    { headers: entetes(coach.jeton) }
  );
  expect(vueCoach.ok()).toBeTruthy();
  expect(await vueCoach.json()).toEqual([]);

  // Et en visant explicitement son athlète, au cas où la RLS ne filtrerait
  // que la liste générale.
  const cible = await request.get(
    `${URL}/rest/v1/provider_connections?select=*&athlete_id=eq.${lea.id}`,
    { headers: entetes(coach.jeton) }
  );
  expect(await cible.json()).toEqual([]);

  // L'athlète, lui, retrouve la sienne.
  const vueAthlete = await request.get(
    `${URL}/rest/v1/provider_connections?select=provider`,
    { headers: entetes(lea.jeton) }
  );
  expect(await vueAthlete.json()).toHaveLength(1);

  // Remise en état : la connexion factice ne doit pas survivre au test.
  await request.delete(
    `${URL}/rest/v1/provider_connections?athlete_id=eq.${lea.id}&provider=eq.strava`,
    { headers: entetes(lea.jeton) }
  );
});

test("un autre athlète n'y accède pas davantage", async ({ request }) => {
  const lea = await ouvrirSession(request, "lea@example.com");
  const nino = await ouvrirSession(request, "nino@example.com");

  const usurpation = await request.post(`${URL}/rest/v1/provider_connections`, {
    headers: entetes(nino.jeton),
    data: {
      athlete_id: lea.id,
      provider: "strava",
      external_athlete_id: "usurpation",
      access_token: "x",
      refresh_token: "y",
      expires_at: "2030-01-01T00:00:00Z",
    },
  });
  // Écrire chez quelqu'un d'autre est refusé net.
  expect(usurpation.status()).toBe(403);
});

test("les réglages du coach ne parlent pas de Strava", async ({ page }) => {
  // La carte vit dans la vue athlète. Un coach en mode « je coache » n'a rien
  // à y connecter — et surtout rien à y lire de ses athlètes.
  await seConnecter(page, "coach@example.com");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Réglages" })).toBeVisible();
  await expect(page.getByText("Strava")).toBeHidden();
});

test("l'athlète voit l'entrée Strava dans ses réglages", async ({ page }) => {
  await seConnecter(page, "lea@example.com");
  await page.goto("/settings");

  await expect(page.getByText("Strava")).toBeVisible();
  // En intégration continue, les identifiants d'API ne sont pas configurés :
  // l'app le dit au lieu d'offrir un bouton qui mènerait à une erreur.
  await expect(
    page.getByText(/n'est pas configurée sur cet environnement|Se connecter avec Strava/)
  ).toBeVisible();
});
