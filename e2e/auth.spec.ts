import { expect, test } from "@playwright/test";

test("redirige les visiteurs non connectés vers la connexion", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});

test("les routes protégées restent inaccessibles sans session", async ({
  page,
}) => {
  for (const path of ["/messages", "/notifications", "/settings", "/history"]) {
    await page.goto(path);
    await expect(page, `${path} doit rediriger`).toHaveURL(/\/login$/);
  }
});

test("la page de connexion présente le formulaire complet", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Mot de passe")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await page.getByRole("link", { name: "Créer un compte" }).click();
  await expect(page).toHaveURL(/\/signup$/);
});

test("l'inscription adapte le formulaire au rôle choisi", async ({ page }) => {
  await page.goto("/signup");

  // Athlète par défaut : le champ code coach est proposé.
  await expect(page.getByLabel(/Code coach/)).toBeVisible();

  await page.getByRole("radio", { name: /^Coach/ }).click();
  await expect(page.getByLabel(/Code coach/)).toBeHidden();

  await page.getByRole("radio", { name: /^Athlète/ }).click();
  await expect(page.getByLabel(/Code coach/)).toBeVisible();
});
