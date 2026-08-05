import { expect, test } from "@playwright/test";

// Les courbes vivent sur des pages authentifiées : sans session, rien ne fuit.
test("l'historique de l'athlète reste protégé", async ({ page }) => {
  await page.goto("/history");
  await expect(page).toHaveURL(/\/login$/);
});

test("la fiche athlète, qui porte les courbes, reste protégée", async ({
  page,
}) => {
  await page.goto("/athletes/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});
