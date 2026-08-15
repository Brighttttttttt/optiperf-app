import { expect, test } from "@playwright/test";

/**
 * Les pages qui doivent se lire **sans compte**.
 *
 * Le proxy protège tout par défaut : c'est la bonne façon de s'y prendre, mais
 * elle rend l'oubli silencieux dans l'autre sens — une page publique qu'on
 * oublie de déclarer redirige vers `/login` sans rien casser d'apparent, et
 * personne ne s'en aperçoit avant que quelqu'un d'extérieur ne suive le lien.
 *
 * C'est précisément le cas de la politique de confidentialité : on la donne à
 * qui hésite à s'inscrire, et les programmes d'API des fabricants de montres
 * la réclament pour instruire une demande d'accès.
 */
test("la politique de confidentialité s'ouvre sans être connecté", async ({
  page,
}) => {
  const reponse = await page.goto("/confidentialite");

  expect(reponse?.status()).toBe(200);
  await expect(page).toHaveURL(/\/confidentialite$/);
  await expect(
    page.getByRole("heading", { name: "Confidentialité", level: 1 })
  ).toBeVisible();

  // Les trois engagements qui décident quelqu'un à s'inscrire — et les
  // premiers qu'un fabricant vient vérifier.
  await expect(page.getByText(/Aucune publicité, aucun traceur/)).toBeVisible();
  await expect(page.getByText(/Aucune donnée vendue/)).toBeVisible();
  await expect(page.getByText(/ne quitte pas votre appareil/)).toBeVisible();
});

test("elle se rejoint depuis la page de connexion", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Confidentialité" }).click();
  await expect(page).toHaveURL(/\/confidentialite$/);
});
