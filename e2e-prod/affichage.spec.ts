import { expect, test, type Page } from "@playwright/test";

/**
 * Contrôle après déploiement, dans un vrai navigateur, contre le site en
 * ligne. Il ne fait que **lire** : aucune donnée n'est créée en production.
 *
 * Raison d'être : lors de l'incident #44, toutes les routes répondaient 200
 * et le HTML contenait bien les données — mais l'app restait figée sur son
 * écran d'attente. Ni les tests locaux (trop rapides pour déclencher le
 * défaut) ni une vérification sur le texte brut ne pouvaient le voir. Seul
 * un navigateur qui regarde ce qui est *affiché* le peut.
 *
 * Ces tests ne nomment **aucun athlète**. Le jeu de démo en ligne n'est pas
 * celui de `npm run seed` : il vient d'un script propre à la production, et
 * il change quand on le régénère. Chercher « Léa Martin » ici revenait à
 * coupler le contrôle après déploiement à un jeu de données qu'il ne
 * contrôle pas — il a suffi que la démo en ligne soit repeuplée avec
 * d'autres noms pour que ce contrôle passe au rouge sans qu'aucune page ne
 * soit cassée. Ce qui se vérifie, c'est que la page **affiche ses données**,
 * pas lesquelles.
 */

const COACH = "coach@example.com";
const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(COACH);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

/** Les cartes d'athlète du tableau de bord, quel que soit leur contenu. */
const cartesAthletes = (page: Page) => page.locator('a[href^="/athletes/"]');

test("le dashboard affiche réellement ses athlètes", async ({ page }) => {
  await seConnecter(page);

  // Au moins une carte réellement rendue : c'est la preuve que les données
  // sont arrivées jusqu'à l'écran, sans dépendre de qui est dans la démo.
  await expect(cartesAthletes(page).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Volume 7 j").first()).toBeVisible();
  await expect(page.getByText("Chargement", { exact: false })).toBeHidden();
});

test("les onglets affichent leur contenu", async ({ page }) => {
  await seConnecter(page);
  await expect(cartesAthletes(page).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Messages" }).click();
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();

  await page.getByRole("link", { name: "Réglages" }).click();
  await expect(page.getByText("Ton code coach")).toBeVisible();
});

test("la fiche d'un athlète affiche ses sections", async ({ page }) => {
  // La page la plus chargée de l'app, et celle qui interroge le plus de
  // tables : si l'une d'elles manque en production, c'est ici que ça se voit.
  await seConnecter(page);
  await cartesAthletes(page).first().click({ timeout: 15_000 });

  await expect(page.getByText("7 derniers jours")).toBeVisible();
  await expect(page.getByText("Records personnels")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Objectifs" })).toBeVisible();
  await expect(page.getByText("Chargement", { exact: false })).toBeHidden();

  // Les quatre onglets, qui sont quatre routes distinctes.
  for (const onglet of ["Planning", "Historique", "Messagerie"]) {
    await page.getByRole("link", { name: onglet }).click();
    await expect(page.getByRole("link", { name: "Fiche" })).toBeVisible();
  }
});
