import { expect, test, type Page } from "@playwright/test";

/**
 * Le mois comme unité de lecture (#143).
 *
 * Le planning montrait une semaine, les courbes douze semaines glissantes :
 * on ne pouvait ni regarder son mois de juillet ni le comparer à juin. Les
 * deux vues affichent désormais un mois nommé, et les flèches en changent.
 *
 * Les dates sont calculées **en heure de Paris**, comme l'app (#146) : le
 * fuseau du runner est UTC, et un calcul posé près de minuit viserait un
 * autre jour que celui affiché.
 */

const MOT_DE_PASSE = "optiperf-demo";

function aujourdhuiAParis(): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(
    new Date()
  );
}

function libelleMoisIlYA(n: number): string {
  const [an, mois] = aujourdhuiAParis().split("-").map(Number);
  return new Date(Date.UTC(an, mois - 1 - n, 15, 12)).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("le planning affiche un mois nommé, en lignes de sept jours", async ({
  page,
}) => {
  await seConnecter(page, "lea@example.com");
  await page.goto("/planning");

  const barre = page.getByRole("group", { name: "Mois affiché" });
  await expect(barre.getByText(libelleMoisIlYA(0))).toBeVisible();

  // Une grille mensuelle : entre 28 et 42 cellules de jour, toujours un
  // multiple de sept. Une semaine seule en donnerait exactement 7.
  const cellules = page.locator("[data-jour]");
  const nb = await cellules.count();
  expect(nb).toBeGreaterThanOrEqual(28);
  expect(nb % 7).toBe(0);
});

test("les courbes se lisent mois par mois", async ({ page }) => {
  await seConnecter(page, "lea@example.com");
  await page.goto("/history");

  // Le mois courant nomme la vue, et la charge reste hebdomadaire. Ciblé par
  // le groupe : l'historique juste en dessous titre lui aussi ses mois.
  const barre = page.getByRole("group", { name: "Mois des courbes" });
  await expect(barre.getByText(libelleMoisIlYA(0))).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Charge par semaine" })
  ).toBeVisible();

  await barre.getByRole("button", { name: "Mois précédent" }).click();
  await expect(barre.getByText(libelleMoisIlYA(1))).toBeVisible();

  // Le tableau de chiffres reste accessible : aucune valeur ne doit vivre
  // uniquement dans le graphique.
  await expect(page.getByRole("button", { name: /chiffres/i })).toBeVisible();
});
