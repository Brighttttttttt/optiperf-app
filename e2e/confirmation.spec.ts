import { expect, test } from "@playwright/test";

// La route d'atterrissage des liens d'email doit rester accessible sans
// session : c'est elle qui l'ouvre. Le proxy ne doit donc pas l'intercepter.
test("un lien de confirmation invalide renvoie vers la connexion", async ({
  page,
}) => {
  await page.goto("/auth/callback?code=jeton-invalide");
  await expect(page).toHaveURL(/\/login\?confirmation=echec$/);
  await expect(
    page.getByText(/lien de confirmation a expiré ou a déjà été utilisé/)
  ).toBeVisible();
});

test("la route d'atterrissage n'est pas renvoyée vers la connexion sans motif", async ({
  page,
}) => {
  // Sans paramètre exploitable, on doit atterrir sur /login avec le motif
  // d'échec — et non sur une redirection nue du proxy.
  const response = await page.goto("/auth/callback");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/confirmation=echec/);
});

test("la page de connexion reste vierge sans paramètre", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByText(/lien de confirmation a expiré/)
  ).toBeHidden();
});
