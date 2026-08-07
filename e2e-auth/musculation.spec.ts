import { expect, test, type Page } from "@playwright/test";

/**
 * Séances de musculation (#93-96), de bout en bout : le coach construit une
 * séance exercice par exercice, l'athlète coche ce qu'il a réellement fait.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("le coach construit une séance de muscu, l'athlète saisit ce qu'il a fait", async ({
  page,
  browser,
}) => {
  // Deux connexions complètes, une planification à plusieurs champs et un
  // compte rendu : sensiblement plus d'étapes que les autres parcours à deux
  // comptes, qui dépassent le timeout par défaut (30 s) en CI.
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");

  const titre = `Muscu e2e ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/planifier");

  await page.getByLabel("Titre").fill(titre);
  await page.getByLabel("Type").selectOption("renfo");
  await page.getByRole("button", { name: "Nino Rossi" }).click();
  await page.locator('button[aria-label^="20"]').first().click();

  await page.getByLabel("Nom de l'exercice").fill("Squat");
  await page.getByLabel("Séries").fill("4");
  await page.getByLabel("Répétitions").fill("8");
  await page.getByLabel("Charge (kg)").fill("60");

  await page.getByRole("button", { name: /Planifier \d+ séance/ }).click();
  await expect(page).toHaveURL(/planifiees=1/);

  // L'athlète voit et complète la séance depuis son propre accueil.
  const pageAthlete = await browser.newPage();
  await seConnecter(pageAthlete, "nino@example.com");
  await expect(pageAthlete.getByText(titre)).toBeVisible();

  // Le titre est dans une div frère du bouton, pas une ancêtre : filtrer sur
  // le seul texte prend la div la plus profonde qui le contient, sans le
  // bouton. `rounded-2xl` est la marque de la carte elle-même (Card, dans
  // ui.tsx) — un repère stable avant et après le compte rendu, contrairement
  // à un filtre sur la présence du bouton, qui disparaît une fois la séance
  // marquée faite. Nino a d'autres séances planifiées : sans ce scope, la
  // vérification finale porterait sur les 5 boutons de la page.
  const carte = pageAthlete.locator("div.rounded-2xl").filter({ hasText: titre });
  await carte.getByRole("button", { name: "C'est fait" }).click();

  await pageAthlete.getByRole("radio", { name: "6", exact: true }).click();
  await pageAthlete.getByLabel("Durée réelle (minutes)").fill("45");
  // La ligne d'exercice est préremplie avec la prescription : on ne
  // corrige que la charge, réellement soulevée un peu plus légère.
  await pageAthlete.getByLabel("Charge (kg)").fill("55");
  await pageAthlete.getByRole("button", { name: "Enregistrer" }).click();

  await expect(carte.getByRole("button", { name: "C'est fait" })).toBeHidden();

  // Une fois complétée, la séance quitte l'accueil (qui ne montre que les
  // séances encore "planned") et son titre n'y est de toute façon pas un
  // lien — seule la ligne d'historique (SessionRow) mène à la fiche.
  // Retrouvée structurée là, prescription et réalisé.
  await pageAthlete.getByRole("link", { name: "Historique" }).click();
  // Clique le lien lui-même plutôt qu'un <p> imbriqué : celui du titre porte
  // `truncate`, contrairement au texte cliqué avec succès ailleurs dans la
  // suite pour la même navigation (parcours.spec.ts). Vérifier l'URL avant
  // le contenu suit le même repère que ces tests, déjà éprouvé.
  await pageAthlete.getByRole("link", { name: new RegExp(titre) }).click();
  await expect(pageAthlete).toHaveURL(/\/seances\//);
  await expect(pageAthlete.getByText("4 × 8 @ 60 kg")).toBeVisible();
  await expect(pageAthlete.getByText(/Fait · 4 × 8 @ 55 kg/)).toBeVisible();
});
