import { expect, test } from "@playwright/test";

// La vue semaine vit sur la fiche athlète, réservée au coach connecté.
test("la fiche athlète reste protégée", async ({ page }) => {
  await page.goto("/athletes/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

// La planification accepte une date préremplie, sur laquelle pointent les
// jours vides du calendrier.
test("la planification accepte une date préremplie", async ({ page }) => {
  await page.goto("/planifier?athlete=00000000-0000-0000-0000-000000000000&date=2026-08-06");
  await expect(page).toHaveURL(/\/login$/);
});
