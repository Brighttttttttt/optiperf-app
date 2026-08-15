import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Ce que l'app dit à quelqu'un qui s'entraîne sans coach (#138).
 *
 * Elle lui présentait son autonomie comme un manque à corriger : une carte
 * « Rejoins ton coach » impossible à écarter sur l'accueil, et un planning
 * vide annonçant « une fois lié à ton coach » — un planning qui n'arrivera
 * jamais. Trois des athlètes du jeu de test ont un coach ; `solo@example.com`
 * existe précisément pour couvrir celui qui n'en a pas.
 *
 * Ce qui se vérifie ici est un **discours**, pas un droit : rien de tout cela
 * n'ouvre ni ne ferme quoi que ce soit. Les droits sont ailleurs, et tenus
 * par la RLS.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const MOT_DE_PASSE = "optiperf-demo";

/**
 * Rend au compte son état de départ : aucune séance.
 *
 * Le dernier test en crée une, et les trois autres reposent sur son absence.
 * En intégration continue la base est refaite à chaque exécution, mais en
 * local la suite se rejoue sur la même — sans ce nettoyage, elle passerait
 * une fois puis échouerait ensuite, ce qui se lit à tort comme un test
 * instable.
 */
async function reinitialiser(request: APIRequestContext) {
  const auth = await request.post(`${URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: CLE, "Content-Type": "application/json" },
    data: { email: "solo@example.com", password: MOT_DE_PASSE },
  });
  const { access_token, user } = await auth.json();
  await request.delete(`${URL}/rest/v1/sessions?athlete_id=eq.${user.id}`, {
    headers: { apikey: CLE, Authorization: `Bearer ${access_token}` },
  });
}

test.afterEach(async ({ request }) => {
  await reinitialiser(request);
});

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("un compte tout neuf sans coach est accueilli, pas mis en attente", async ({
  page,
}) => {
  await seConnecter(page, "solo@example.com");

  // Sans coach ni séance, on lui dit par où commencer — et la première voie
  // proposée est la sienne, pas celle qui dépend de quelqu'un d'autre.
  await expect(page.getByText("Par où commencer")).toBeVisible();
  await expect(page.getByText(/Enregistre tes séances toi-même/)).toBeVisible();

  // Rejoindre un coach reste possible, sur le même écran.
  await expect(page.getByLabel("Code coach")).toBeVisible();

  // Et ce qu'il peut faire seul est là.
  await expect(
    page.getByRole("button", { name: "Ajouter une séance" })
  ).toBeVisible();
});

test("le planning vide ne promet pas un coach", async ({ page }) => {
  await seConnecter(page, "solo@example.com");

  await expect(page.getByText(/Rien de planifié pour le moment/)).toBeVisible();
  await expect(
    page.getByText(/nourrissent tes courbes, tes zones et ton historique/)
  ).toBeVisible();
  // La formule qui posait problème : elle annonçait un planning à venir de la
  // part de quelqu'un qui n'existe pas.
  await expect(page.getByText(/une fois lié à ton coach/)).toBeHidden();
});

test("la messagerie vide énonce un fait, sans « pas encore »", async ({ page }) => {
  await seConnecter(page, "solo@example.com");
  await page.goto("/messages");

  await expect(page.getByText("Aucune discussion")).toBeVisible();
  await expect(page.getByText(/Tu n'es pas encore lié/)).toBeHidden();
});

test("l'invitation quitte l'accueil dès la première séance enregistrée", async ({
  page,
}) => {
  await seConnecter(page, "solo@example.com");

  await page.getByRole("button", { name: "Ajouter une séance" }).click();
  await page.getByText("Séance libre").click();
  await page.getByLabel("Titre").fill("Footing en autonomie");
  await page.getByRole("radio", { name: "5", exact: true }).click();
  await page.getByLabel("Durée (minutes)").fill("40");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  await expect(
    page.getByRole("button", { name: "Ajouter une séance" })
  ).toBeVisible();

  // S'entraîner seul devient un choix assumé : plus rien ne le désigne comme
  // un compte à compléter. Le lien vers un coach reste dans les réglages.
  await expect(page.getByText("Par où commencer")).toBeHidden();

  await page.goto("/settings");
  await expect(page.getByText("Mon coach")).toBeVisible();
  await expect(page.getByLabel("Code coach")).toBeVisible();
});
