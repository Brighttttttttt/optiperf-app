import { expect, test, type Page } from "@playwright/test";

/**
 * Les vues reprises pour le grand écran (issue #65), en 1440 × 900.
 *
 * Tout le reste de la suite tourne en Pixel 7 : ces tests sont les seuls à
 * voir une régression de mise en page à la souris — l'écran où le coach
 * passe le plus de temps.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

const nav = (page: Page) =>
  page.locator('nav[aria-label="Navigation principale"]');

test("la navigation passe sur le côté, sans perdre son retour visuel", async ({
  page,
}) => {
  await seConnecter(page, "coach@example.com");

  const barre = nav(page);
  await expect(barre).toBeVisible();

  // Une colonne à gauche, pas une barre en bas : elle commence près du bord
  // gauche et occupe la hauteur, au lieu de s'étaler sur toute la largeur.
  const boite = (await barre.boundingBox())!;
  const fenetre = page.viewportSize()!;
  expect(boite.width).toBeLessThan(fenetre.width / 3);
  expect(boite.height).toBeGreaterThan(fenetre.height / 2);

  // Le retour visuel de navigation (#49) survit au passage en colonne : un
  // trait par onglet, toujours rendu, invisible au repos.
  const traits = barre.locator('a > span[aria-hidden="true"]');
  await expect(traits).toHaveCount(4);
  await expect(traits.first()).toHaveCSS("opacity", "0");
});

test("le dashboard coach étale ses athlètes sur deux colonnes", async ({
  page,
}) => {
  await seConnecter(page, "coach@example.com");
  await expect(page.getByRole("heading", { name: "Mon groupe" })).toBeVisible();

  // Deux athlètes côte à côte : sur un écran large, les empiler oblige à
  // faire défiler pour en comparer deux.
  const lea = (await page.getByText("Léa Martin").first().boundingBox())!;
  const nino = (await page.getByText("Nino Rossi").first().boundingBox())!;
  expect(Math.abs(lea.y - nino.y)).toBeLessThan(20);
  expect(nino.x).toBeGreaterThan(lea.x + 100);
});

test("la planification met les athlètes et les dates côte à côte", async ({
  page,
}) => {
  await seConnecter(page, "coach@example.com");
  await page.goto("/planifier");

  const pourQui = (await page.getByText("Pour qui").boundingBox())!;
  const quand = (await page.getByText("Quand").boundingBox())!;

  // C'est le croisement athlètes × dates que le coach fait des yeux : les
  // séparer par un défilement est ce qui rendait cet écran pénible.
  expect(Math.abs(pourQui.y - quand.y)).toBeLessThan(20);
  expect(quand.x).toBeGreaterThan(pourQui.x + 100);
});

test("les courbes s'étirent sans déborder de la page", async ({ page }) => {
  await seConnecter(page, "lea@example.com");
  await page.getByRole("link", { name: "Historique" }).click();
  await expect(page.getByText("Charge par semaine")).toBeVisible();

  const svg = page.locator('svg[role="img"]').first();
  await expect(svg).toBeVisible();

  // Le SVG est écrit à la main : il doit suivre la largeur disponible sans
  // pousser la page à défiler horizontalement.
  const largeurPage = await page.evaluate(
    () => document.documentElement.scrollWidth
  );
  const fenetre = page.viewportSize()!;
  expect(largeurPage).toBeLessThanOrEqual(fenetre.width);

  // Et le tableau de chiffres reste accessible : aucune valeur ne doit
  // n'exister qu'au survol.
  await expect(page.getByRole("button", { name: "Voir les chiffres" })).toBeVisible();
});

test("aucune page ne déborde horizontalement", async ({ page }) => {
  await seConnecter(page, "coach@example.com");
  const fenetre = page.viewportSize()!;

  for (const chemin of ["/", "/planifier", "/messages", "/notifications", "/settings"]) {
    await page.goto(chemin);
    const largeur = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    expect(largeur, `${chemin} déborde`).toBeLessThanOrEqual(fenetre.width);
  }
});
