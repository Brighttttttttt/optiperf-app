import { expect, test, type Page } from "@playwright/test";

/**
 * Séances structurées en blocs (#75), de bout en bout : le coach construit
 * une séance de fractionné bloc par bloc dans /planifier, l'athlète (ou lui-
 * même) la retrouve clairement structurée sur la fiche de la séance.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("le coach construit une séance de fractionné bloc par bloc", async ({ page }) => {
  // Connexion, planification à deux blocs (plusieurs champs chacun) puis
  // navigation jusqu'à la fiche : plus d'étapes que le budget par défaut
  // (30 s) ne supporte en CI.
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");

  const titre = `Fractionné e2e ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/planifier");

  await page.getByLabel("Titre").fill(titre);
  await page.getByRole("button", { name: "Léa Martin" }).click();
  // Premier jour du calendrier de planification : toujours aujourd'hui (le
  // fuseau du calcul est celui du serveur, Europe/Paris — pas question de le
  // redériver ici avec `new Date()`, en UTC dans ce test).
  await page.locator('button[aria-label^="20"]').first().click();

  await page.getByRole("button", { name: "Structurer en blocs" }).click();

  // Bloc 1 : échauffement, type par défaut.
  await page.getByRole("button", { name: "Ajouter un bloc" }).click();
  await page.getByLabel("Durée (min)").nth(0).fill("15");

  // Bloc 2 : intervalle répété, avec allure cible.
  await page.getByRole("button", { name: "Ajouter un bloc" }).click();
  await page.getByLabel("Type de bloc").nth(1).selectOption("intervalle");
  await page.getByLabel("Durée (min)").nth(1).fill("3");
  await page.getByLabel("Allure cible (min/km)").nth(1).fill("4:30");
  await page.getByLabel("Répétitions").nth(1).fill("4");

  await page.getByRole("button", { name: /Planifier \d+ séance/ }).click();
  await expect(page).toHaveURL(/planifiees=1/);

  // La séance créée : via la fiche de Léa, onglet Planning. Le titre n'est
  // qu'un texte dans la ligne ; seul « Modifier », à côté, mène à la fiche —
  // on cible la ligne contenant le titre pour retrouver son lien.
  await page.getByText("Léa Martin").click();
  await page.getByRole("link", { name: "Planning" }).click();
  const ligne = page.locator("div").filter({ hasText: titre }).last();
  await ligne.getByRole("link", { name: "Modifier" }).click();

  await expect(page.getByText("Échauffement")).toBeVisible();
  await expect(page.getByText("15 min", { exact: true })).toBeVisible();
  await expect(page.getByText("4 × Intervalle")).toBeVisible();
  await expect(page.getByText("3 min · 4:30 /km")).toBeVisible();
});

test("une séance simple reste aussi rapide à créer, sans bloc", async ({ page }) => {
  await seConnecter(page, "coach@example.com");

  await page.goto("/planifier");
  // Le bouton reste replié tant qu'on ne l'ouvre pas : rien de nouveau à
  // remplir pour une sortie sans structure particulière.
  await expect(page.getByRole("button", { name: "Ajouter un bloc" })).toBeHidden();
});
