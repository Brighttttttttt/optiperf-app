import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours connectés, contre une vraie base Supabase (locale en intégration
 * continue). Ce sont les seuls tests qui vérifient qu'une page **affiche son
 * contenu** — le trou par lequel est passé l'incident #44, où l'app restait
 * bloquée sur son écran d'attente alors que tous les autres tests étaient verts.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test.describe("Coach", () => {
  test("le dashboard affiche ses athlètes et leurs métriques", async ({ page }) => {
    await seConnecter(page, "coach@example.com");

    // Le contenu, pas seulement la coquille : c'est l'assertion qui manquait.
    await expect(page.getByText("Léa Martin")).toBeVisible();
    await expect(page.getByText("Nino Rossi")).toBeVisible();
    await expect(page.getByText("Sofia Alves")).toBeVisible();

    await expect(page.getByText("Volume 7 j").first()).toBeVisible();
    await expect(page.getByText("Adhérence").first()).toBeVisible();
    await expect(page.getByText(/Chargement/)).toBeHidden();
  });

  test("chaque onglet affiche son contenu", async ({ page }) => {
    await seConnecter(page, "coach@example.com");

    await page.getByRole("link", { name: "Messages" }).click();
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(page.getByText("Nino Rossi")).toBeVisible();

    await page.getByRole("link", { name: "Notifs" }).click();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();

    await page.getByRole("link", { name: "Réglages" }).click();
    await expect(page.getByText("Ton code coach")).toBeVisible();
    await expect(page.getByText("coach@example.com")).toBeVisible();
  });

  test("la fiche athlète affiche l'évolution et la semaine", async ({ page }) => {
    await seConnecter(page, "coach@example.com");
    await page.getByText("Léa Martin").click();

    await expect(page.getByRole("heading", { name: "Léa Martin" })).toBeVisible();
    await expect(page.getByText("Charge par semaine")).toBeVisible();
    await expect(page.getByText("Cette semaine")).toBeVisible();
    // Les graphiques sont bien tracés, pas seulement leurs titres.
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
  });

  test("planifier une séance la rend visible à l'athlète", async ({
    page,
    browser,
  }) => {
    const titre = `Test auto ${Date.now()}`;

    await seConnecter(page, "coach@example.com");
    await page.getByRole("link", { name: "Planifier" }).first().click();
    await page.getByLabel("Titre").fill(titre);

    // Un athlète, un jour : le récapitulatif doit suivre.
    await page.getByRole("button", { name: /^Léa Martin/ }).click();
    const demain = new Date(Date.now() + 86400000);
    await page
      .getByRole("button", { name: new RegExp(`^${demain.getDate()}$`) })
      .first()
      .click();
    await page.getByRole("button", { name: /Planifier 1 séance/ }).click();

    await expect(page.getByText(/1 séance planifiée/)).toBeVisible();

    // Côté athlète, dans une session distincte.
    const contexteAthlete = await browser.newContext();
    const pageAthlete = await contexteAthlete.newPage();
    await seConnecter(pageAthlete, "lea@example.com");
    await expect(pageAthlete.getByText(titre)).toBeVisible();
    await contexteAthlete.close();
  });
});

test.describe("Athlète", () => {
  test("l'accueil affiche ses séances et son résumé", async ({ page }) => {
    await seConnecter(page, "lea@example.com");

    await expect(page.getByText(/Bonjour/)).toBeVisible();
    await expect(page.getByText("Volume")).toBeVisible();
    await expect(page.getByText("À venir")).toBeVisible();
    await expect(page.getByText(/Chargement/)).toBeHidden();
  });

  test("l'historique affiche les séances passées et les courbes", async ({
    page,
  }) => {
    await seConnecter(page, "lea@example.com");
    await page.getByRole("link", { name: "Historique" }).click();

    await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
    await expect(page.getByText("Charge par semaine")).toBeVisible();
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
  });

  test("un message envoyé apparaît dans le fil", async ({ page }) => {
    const texte = `Message auto ${Date.now()}`;

    await seConnecter(page, "lea@example.com");
    await page.getByRole("link", { name: "Messages" }).click();
    await page.getByText("Camille Dupont").click();

    await page.getByLabel("Ton message").fill(texte);
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByText(texte)).toBeVisible();
  });
});

test("un athlète ne voit jamais les données d'un autre", async ({ page }) => {
  await seConnecter(page, "lea@example.com");
  await expect(page.getByText("Nino Rossi")).toBeHidden();
  await expect(page.getByText("Sofia Alves")).toBeHidden();
});
