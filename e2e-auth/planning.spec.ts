import { expect, test, type Page } from "@playwright/test";

/**
 * Vue mois, des deux côtés : le coach construit une séance structurée, la
 * retrouve dans le mois de son athlète avec son contenu et son état, et
 * l'athlète lit la même chose depuis son propre onglet Planning.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

/** La carte d'une séance dans le panneau du jour, repérée par son titre. */
function carte(page: Page, titre: string) {
  return page.locator("div.rounded-xl").filter({ hasText: titre });
}

test("la semaine montre le contenu et l'état des séances, côté coach et côté athlète", async ({
  page,
  browser,
}) => {
  // Deux connexions complètes et une planification à deux blocs : plus
  // d'étapes que le budget par défaut (30 s) ne supporte en CI.
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");

  const titre = `Planning e2e ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/planifier");

  await page.getByLabel("Titre").fill(titre);
  await page.getByRole("button", { name: "Nino Rossi" }).click();
  // Premier jour de la grille : toujours aujourd'hui (fuseau du serveur).
  await page.locator('button[aria-label^="20"]').first().click();

  await page.getByRole("button", { name: "Structurer en blocs" }).click();
  // Le formulaire porte sa propre « Durée (min) » (durée globale) : chaque
  // champ se vise dans la ligne de son bloc (bg-surface, WorkoutBlocksEditor).
  const lignesBlocs = page.locator("div.bg-surface");
  await page.getByRole("button", { name: "Ajouter un bloc" }).click();
  await lignesBlocs.nth(0).getByLabel("Durée (min)").fill("15");
  await page.getByRole("button", { name: "Ajouter un bloc" }).click();
  await lignesBlocs.nth(1).getByLabel("Type de bloc").selectOption("intervalle");
  await lignesBlocs.nth(1).getByLabel("Durée (min)").fill("3");
  await lignesBlocs.nth(1).getByLabel("Répétitions").fill("4");

  await page.getByRole("button", { name: /Planifier \d+ séance/ }).click();
  await expect(page).toHaveURL(/planifiees=1/);

  // ---- Côté coach : la semaine de Nino, aujourd'hui sélectionné d'office.
  await page.getByRole("link", { name: "Nino Rossi" }).click();
  await page.getByRole("link", { name: "Planning" }).click();

  const carteCoach = carte(page, titre);
  await expect(carteCoach.getByText("À venir")).toBeVisible();
  // Le contenu de la séance, sans avoir à l'ouvrir.
  await expect(carteCoach.getByText("Échauffement")).toBeVisible();
  await expect(carteCoach.getByText("15 min")).toBeVisible();
  await expect(carteCoach.getByText("4 × Intervalle")).toBeVisible();

  // ---- Côté athlète : le même contenu, depuis son propre onglet.
  const pageAthlete = await browser.newPage();
  await seConnecter(pageAthlete, "nino@example.com");
  await pageAthlete.getByRole("link", { name: "Planning" }).click();
  await expect(
    pageAthlete.getByRole("heading", { name: "Mon planning" })
  ).toBeVisible();

  const carteAthlete = carte(pageAthlete, titre);
  await expect(carteAthlete.getByText("À venir")).toBeVisible();
  await expect(carteAthlete.getByText("Échauffement")).toBeVisible();
  await expect(carteAthlete.getByText("4 × Intervalle")).toBeVisible();

  // L'athlète ne prescrit pas depuis cette vue : ni « Modifier », qui ouvre
  // le formulaire de prescription, ni les entrées de planification, ni la
  // poignée de déplacement — déplacer une séance, c'est prescrire.
  await expect(carteAthlete.getByRole("link", { name: "Modifier" })).toBeHidden();
  await expect(
    pageAthlete.getByRole("link", { name: /Ajouter une séance ce jour/ })
  ).toBeHidden();
  await expect(
    pageAthlete.getByRole("button", { name: /^Déplacer/ })
  ).toHaveCount(0);

  await pageAthlete.close();
});

test("un mois passé porte l'état de chaque séance", async ({ page }) => {
  await seConnecter(page, "lea@example.com");
  await page.getByRole("link", { name: "Planning" }).click();
  await page.getByRole("button", { name: "Mois précédent" }).click();

  // Un jour qui porte au moins une séance, plutôt que le jour ouvert d'office :
  // le peuplement tire les jours d'entraînement, et le premier du mois peut
  // être vide. Le compte est annoncé dans le repère accessible.
  await page.getByRole("button", { name: /, [1-9] séance\(s\)/ }).first().click();

  // Le vocabulaire du passé, jamais « À venir » : le peuplement tire au sort
  // ce qui a été fait ou manqué, mais une séance d'un mois écoulé tombe
  // forcément dans l'un de ces trois états.
  const carte = page.locator("div.rounded-xl.bg-card").first();
  await expect(
    carte.getByText(/^(Fait|Manquée|À rattraper)$/)
  ).toBeVisible();
});

test("le jour ouvert suit le changement de mois", async ({ page }) => {
  // Régression : le panneau du bas continuait de détailler le jour
  // sélectionné avant la navigation — donc un jour absent de la grille
  // affichée, en croyant lire le mois qu'on regarde.
  await seConnecter(page, "lea@example.com");
  await page.getByRole("link", { name: "Planning" }).click();

  const jourOuvert = page.locator('button[aria-pressed="true"]');
  const avant = await jourOuvert.getAttribute("aria-label");

  await page.getByRole("button", { name: "Mois précédent" }).click();

  // Toujours exactement un jour ouvert, et il appartient à la grille visible.
  await expect(jourOuvert).toHaveCount(1);
  expect(await jourOuvert.getAttribute("aria-label")).not.toBe(avant);

  // Il est bien dans la grille affichée, et non hérité du mois d'avant.
  const iso = await jourOuvert.getAttribute("data-jour");
  await expect(page.locator(`[data-jour="${iso}"]`)).toHaveCount(1);
});

test("le coach déplace une séance d'un jour, au clavier", async ({ page }) => {
  // Connexion, planification, navigation vers la fiche puis vérification
  // après rechargement : plus d'étapes que le budget par défaut en CI.
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");

  const titre = `Deplacement e2e ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/planifier");
  await page.getByLabel("Titre").fill(titre);
  await page.getByRole("button", { name: "Nino Rossi" }).click();
  await page.locator('button[aria-label^="20"]').first().click();
  await page.getByRole("button", { name: /Planifier \d+ séance/ }).click();
  await expect(page).toHaveURL(/planifiees=1/);

  await page.getByRole("link", { name: "Nino Rossi" }).click();
  await page.getByRole("link", { name: "Planning" }).click();

  const jourOuvert = page.locator('button[aria-pressed="true"]');
  const avant = await jourOuvert.getAttribute("data-jour");

  // Le clavier est le seul chemin possible sans souris ni doigt : sans lui,
  // le déplacement n'existerait que pour ceux qui peuvent viser.
  const poignee = page.getByRole("button", {
    name: new RegExp(`^Déplacer « ${titre}`),
  });
  await poignee.focus();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("status")).toContainText("déplacée au");
  const apres = await jourOuvert.getAttribute("data-jour");
  expect(apres).not.toBe(avant);
  // La vue suit la séance plutôt que de la laisser disparaître du panneau.
  await expect(carte(page, titre)).toBeVisible();

  // Et ce n'est pas qu'un effet d'affichage optimiste : au rechargement, la
  // séance a bien quitté son jour d'origine.
  await page.reload();
  await expect(carte(page, titre)).toBeHidden();
  await page.locator(`button[data-jour="${apres}"]`).click();
  await expect(carte(page, titre)).toBeVisible();
});

test("une séance qui n'est plus à venir ne se déplace plus", async ({ page }) => {
  await seConnecter(page, "coach@example.com");
  await page.getByRole("link", { name: "Léa Martin" }).click();
  await page.getByRole("link", { name: "Planning" }).click();
  await page.getByRole("button", { name: "Mois précédent" }).click();
  await page.getByRole("button", { name: /, [1-9] séance\(s\)/ }).first().click();

  // Le peuplement ne laisse aucune séance encore planifiée dans le passé :
  // toutes sont faites ou manquées. Déplacer l'une d'elles réécrirait le jour
  // où l'athlète a couru — la poignée ne doit donc pas exister.
  const cartes = page.locator("div.rounded-xl.bg-card");
  await expect(cartes.first().getByText(/^(Fait|Manquée)$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Déplacer/ })).toHaveCount(0);
});
