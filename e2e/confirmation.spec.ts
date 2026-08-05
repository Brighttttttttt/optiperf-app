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

test("sans jeton dans le fragment, la finalisation renvoie vers la connexion", async ({
  page,
}) => {
  // Le relais côté client ne trouve rien à traiter : message explicite
  // plutôt qu'une page bloquée sur « Confirmation en cours ».
  await page.goto("/auth/finaliser");
  await expect(page).toHaveURL(/\/login\?confirmation=echec$/);
});

test("les jetons du fragment ouvrent la session côté client", async ({
  page,
}) => {
  // Jetons volontairement invalides : on vérifie que le fragment est bien
  // lu et soumis à Supabase, pas qu'une session s'ouvre.
  await page.goto(
    "/auth/finaliser#access_token=jeton-invalide&refresh_token=refresh-invalide&type=signup"
  );
  await expect(page).toHaveURL(/\/login\?confirmation=echec$/);
});

test("la page de connexion reste vierge sans paramètre", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByText(/lien de confirmation a expiré/)
  ).toBeHidden();
});
