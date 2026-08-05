import { expect, test } from "@playwright/test";

/**
 * Contrôle après déploiement, dans un vrai navigateur, contre le site en
 * ligne. Il ne fait que **lire** : aucune donnée n'est créée en production.
 *
 * Raison d'être : lors de l'incident #44, toutes les routes répondaient 200
 * et le HTML contenait bien les données — mais l'app restait figée sur son
 * écran d'attente. Ni les tests locaux (trop rapides pour déclencher le
 * défaut) ni une vérification sur le texte brut ne pouvaient le voir. Seul
 * un navigateur qui regarde ce qui est *affiché* le peut.
 */

test("le dashboard affiche réellement ses athlètes", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("coach@example.com");
  await page.getByLabel("Mot de passe").fill("optiperf-demo");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByText("Léa Martin")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Volume 7 j").first()).toBeVisible();
  await expect(page.getByText("Chargement", { exact: false })).toBeHidden();
});

test("les onglets affichent leur contenu", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("coach@example.com");
  await page.getByLabel("Mot de passe").fill("optiperf-demo");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Léa Martin")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("link", { name: "Messages" }).click();
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();

  await page.getByRole("link", { name: "Réglages" }).click();
  await expect(page.getByText("Ton code coach")).toBeVisible();
});
