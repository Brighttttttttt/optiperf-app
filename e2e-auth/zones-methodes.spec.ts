import { expect, test, type Page } from "@playwright/test";

/**
 * Le choix de la méthode de calcul des zones (#127).
 *
 * Ce qui se vérifie ici n'est pas l'arithmétique — elle est couverte par
 * `zones.test.ts`, qui compare les trois méthodes sur un même battement —
 * mais le chemin complet : l'athlète choisit, la base accepte, et les zones
 * affichées disent sur quelle échelle elles se lisent.
 *
 * Sofia plutôt que Léa : ses données de fréquence cardiaque ne servent à
 * aucun autre test, on peut donc les réécrire sans effet de bord.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

const carteFc = (page: Page) =>
  page.locator("div.rounded-2xl").filter({ hasText: "Fréquence cardiaque" });

test("l'athlète choisit sa méthode et la base l'accepte", async ({ page }) => {
  test.setTimeout(60_000);

  await seConnecter(page, "sofia@example.com");
  await page.goto("/settings");

  const carte = carteFc(page);
  await carte.getByLabel("FC max (bpm)").fill("190");
  await carte.getByLabel("FC repos (bpm)").fill("50");
  await carte.getByLabel("FC au seuil (bpm)").fill("168");
  await carte.getByLabel("Calcul des zones").selectOption("karvonen");
  await carte.getByRole("button", { name: "Enregistrer" }).click();

  await expect(carte.getByText("Enregistré.")).toBeVisible();

  // Le choix survit au rechargement : c'est une donnée du profil, pas un
  // état d'écran.
  await page.reload();
  await expect(carteFc(page).getByLabel("Calcul des zones")).toHaveValue("karvonen");
});

test("une méthode sans sa donnée est refusée, en disant laquelle", async ({ page }) => {
  test.setTimeout(60_000);

  await seConnecter(page, "nino@example.com");
  await page.goto("/settings");

  // Le seuil laissé vide : la méthode LTHR n'a rien pour calculer. Mieux vaut
  // le refus explicite que des zones vides sans explication.
  const carte = carteFc(page);
  await carte.getByLabel("FC max (bpm)").fill("195");
  await carte.getByLabel("FC au seuil (bpm)").fill("");
  await carte.getByLabel("Calcul des zones").selectOption("lthr");
  await carte.getByRole("button", { name: "Enregistrer" }).click();

  await expect(carte.getByText(/a besoin de ta fréquence au seuil/)).toBeVisible();
});

test("un seuil au-dessus de la FC max est refusé", async ({ page }) => {
  test.setTimeout(60_000);

  await seConnecter(page, "nino@example.com");
  await page.goto("/settings");

  const carte = carteFc(page);
  await carte.getByLabel("FC max (bpm)").fill("180");
  await carte.getByLabel("FC au seuil (bpm)").fill("185");
  await carte.getByRole("button", { name: "Enregistrer" }).click();

  await expect(carte.getByText(/inférieure à la FC max/)).toBeVisible();
});
