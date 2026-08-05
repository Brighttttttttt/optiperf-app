import { expect, test } from "@playwright/test";

// L'écran de planification est réservé au coach connecté : sans session, le
// proxy doit le protéger comme les autres routes de l'app.
test("l'écran de planification est protégé", async ({ page }) => {
  await page.goto("/planifier");
  await expect(page).toHaveURL(/\/login$/);
});

test("l'écran de planification reste protégé avec ses paramètres", async ({
  page,
}) => {
  await page.goto("/planifier?athlete=00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});

// L'ancienne page de planification par athlète a été remplacée par /planifier.
// Sans session, le proxy la protège comme le reste : on vérifie au moins
// qu'aucun contenu n'échappe, la disparition de la route étant attestée par
// la sortie du build.
test("l'ancienne page de planification n'expose rien", async ({ page }) => {
  await page.goto("/athletes/00000000-0000-0000-0000-000000000000/plan");
  await expect(page).toHaveURL(/\/login$/);
});
