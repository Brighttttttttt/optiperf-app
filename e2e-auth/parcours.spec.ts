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

  test("le retour visuel de navigation est en place sans décaler la barre", async ({
    page,
  }) => {
    await seConnecter(page, "coach@example.com");

    const nav = page.locator('nav[aria-label="Navigation principale"]');
    const traits = nav.locator('a > span[aria-hidden="true"]');

    // Un trait par onglet, toujours rendu : s'il n'apparaissait qu'au clic,
    // il décalerait la barre au moment même où l'utilisateur attend.
    await expect(traits).toHaveCount(4);
    // Et invisible au repos — seule l'opacité change pendant la navigation.
    await expect(traits.first()).toHaveCSS("opacity", "0");
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

    // Le bouton d'un athlète porte aussi ses initiales : on vise le texte
    // contenu, pas le nom accessible complet.
    await page
      .getByRole("button")
      .filter({ hasText: "Léa Martin" })
      .click();

    // Les jours de la grille portent leur date en repère accessible.
    const demain = new Date(Date.now() + 86400000).toLocaleDateString("en-CA", {
      timeZone: "Europe/Paris",
    });
    await page.getByRole("button", { name: demain, exact: true }).click();

    await page.getByRole("button", { name: /Planifier 1 séance/ }).click();

    await expect(page.getByText(/1 séance planifiée/)).toBeVisible();

    // Côté athlète, dans une session distincte.
    const contexteAthlete = await browser.newContext();
    const pageAthlete = await contexteAthlete.newPage();
    await seConnecter(pageAthlete, "lea@example.com");
    await expect(pageAthlete.getByText(titre)).toBeVisible();
    await contexteAthlete.close();
  });

  test("la fiche athlète montre ce que la montre a relevé", async ({ page }) => {
    await seConnecter(page, "coach@example.com");
    await page.getByText("Léa Martin").click();

    // Le coach lit le résumé — durée, distance, fréquence — mais jamais la
    // trace : ces chiffres suffisent à lire la séance sans poser les mêmes
    // questions de vie privée.
    await expect(
      page.getByText("Montre · 15,2 km · 148 bpm").first()
    ).toBeVisible();
  });

  test("le détail d'une séance importée est accessible depuis la fiche athlète", async ({
    page,
  }) => {
    await seConnecter(page, "coach@example.com");
    await page.getByText("Léa Martin").click();

    await page.getByText("Montre · 15,2 km · 148 bpm").first().click();

    await expect(page).toHaveURL(/\/seances\//);
    await expect(page.getByText("148 bpm")).toBeVisible();
    await expect(page.getByText("15,2 km")).toBeVisible();

    // Le retour ramène à la fiche athlète, pas à l'accueil.
    await page.getByLabel("Retour").click();
    await expect(page.getByRole("heading", { name: "Léa Martin" })).toBeVisible();
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

  test("l'origine d'une séance importée se lit dans l'historique", async ({
    page,
  }) => {
    await seConnecter(page, "lea@example.com");
    await page.getByRole("link", { name: "Historique" }).click();

    // En toutes lettres, sur sa propre ligne : l'athlète doit distinguer ce
    // qu'il a déclaré de ce qui a été mesuré, sans avoir à survoler.
    await expect(page.getByText("Montre · 15,2 km · 148 bpm").first()).toBeVisible();
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

  // Régression : la barre disparaissait volontairement sur un fil de
  // discussion, jusqu'à ce que le retrait soit signalé comme gênant plutôt
  // que voulu.
  test("la barre de navigation reste visible dans une conversation", async ({
    page,
  }) => {
    await seConnecter(page, "lea@example.com");
    await page.getByRole("link", { name: "Messages" }).click();
    await page.getByText("Camille Dupont").click();

    await expect(page.getByText("Camille Dupont")).toBeVisible();
    await expect(
      page.locator('nav[aria-label="Navigation principale"]')
    ).toBeVisible();
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

  test("un message envoyé notifie son destinataire", async ({ page, browser }) => {
    const texte = `Notif auto ${Date.now()}`;

    await seConnecter(page, "lea@example.com");
    await page.getByRole("link", { name: "Messages" }).click();
    await page.getByText("Camille Dupont").click();
    await page.getByLabel("Ton message").fill(texte);
    await page.getByRole("button", { name: "Envoyer" }).click();
    await expect(page.getByText(texte)).toBeVisible();

    // Côté coach, dans une session distincte : la notification déclenchée
    // par le trigger sur `messages` (migration 008). Le corps du message
    // identifie la bonne notification — le titre seul se répète d'un
    // message à l'autre, y compris ceux des tentatives précédentes.
    const contexteCoach = await browser.newContext();
    const pageCoach = await contexteCoach.newPage();
    await seConnecter(pageCoach, "coach@example.com");
    await pageCoach.getByRole("link", { name: "Notifs" }).click();
    await expect(pageCoach.getByText("Léa Martin t'a écrit").first()).toBeVisible();
    await expect(pageCoach.getByText(texte)).toBeVisible();
    await contexteCoach.close();
  });

  // Régression : sur iOS, le contrôle natif de date ignore en partie le
  // padding CSS et rend plus haut qu'un <select> avec les mêmes classes.
  test("les champs type et date de la séance libre ont la même hauteur", async ({
    page,
  }) => {
    await seConnecter(page, "lea@example.com");
    await page.getByRole("button", { name: "Ajouter une séance" }).click();
    await page.getByText("Séance libre").click();

    const type = await page.getByLabel("Type").boundingBox();
    const date = await page.getByLabel("Date").boundingBox();
    expect(type).not.toBeNull();
    expect(date).not.toBeNull();
    expect(Math.abs(date!.height - type!.height)).toBeLessThanOrEqual(1);
  });

  test("le détail d'une séance importée est accessible depuis l'historique", async ({
    page,
  }) => {
    await seConnecter(page, "lea@example.com");
    await page.getByRole("link", { name: "Historique" }).click();

    await page.getByText("Montre · 15,2 km · 148 bpm").first().click();

    await expect(page).toHaveURL(/\/seances\//);
    await expect(page.getByText("148 bpm")).toBeVisible();

    // Le retour ramène à l'historique, pas à l'accueil.
    await page.getByLabel("Retour").click();
    await expect(page.getByRole("heading", { name: "Historique" })).toBeVisible();
  });
});

test("un athlète ne voit jamais les données d'un autre", async ({ page }) => {
  await seConnecter(page, "lea@example.com");
  await expect(page.getByText("Nino Rossi")).toBeHidden();
  await expect(page.getByText("Sofia Alves")).toBeHidden();
});
