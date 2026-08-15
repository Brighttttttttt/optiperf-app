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
  for (const path of [
    "/messages",
    "/notifications",
    "/settings",
    "/history",
    "/planning",
  ]) {
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

// Régression : sous 16px, Safari iOS zoome la page au focus d'un champ et
// ne dézoome pas toujours après (signalé depuis un téléphone).
test("les champs de saisie n'ont pas une police sous le seuil de zoom iOS", async ({
  page,
}) => {
  await page.goto("/login");
  const taille = await page
    .getByLabel("Email")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(taille).toBeGreaterThanOrEqual(16);
});

/**
 * Le consentement aux données de santé (#155).
 *
 * Le RGPD le veut **explicite** (art. 9.2.a) : une case dédiée, décochée par
 * défaut, dont le texte nomme ce dont il s'agit. Une case pré-cochée, ou noyée
 * dans une acceptation globale, ne vaudrait rien — et c'est un détail qui se
 * perd au premier remaniement du formulaire si rien ne le retient.
 */
test("l'inscription demande un consentement explicite aux données de santé", async ({
  page,
}) => {
  await page.goto("/signup");

  const consentement = page.getByRole("checkbox", { name: /données de santé/i });
  await expect(consentement).toBeVisible();

  // Jamais pré-cochée : un consentement présumé n'est pas un consentement.
  await expect(consentement).not.toBeChecked();

  // Et le formulaire ne part pas sans elle. Le navigateur bloque sur le champ
  // requis : on reste sur la page.
  await page.getByLabel("Nom complet").fill("Test Consentement");
  await page.getByLabel("Email").fill(`consent-${Date.now()}@example.com`);
  await page.getByLabel("Mot de passe").fill("motdepasse123");
    // « Créer **mon** compte » : le titre de la page, lui, dit « Créer un
  // compte » — deux libellés proches qu'il ne faut pas confondre.
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/signup$/);
  await expect(consentement).not.toBeChecked();
});
