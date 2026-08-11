import { expect, test, type Page } from "@playwright/test";

/**
 * Le coach bascule entre encadrer et s'entraîner (issue #62), sans changer
 * de compte et sans jamais douter du mode dans lequel il se trouve.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

const bascule = (page: Page) => page.getByRole("navigation", { name: "Vue" });

test("le coach bascule vers son propre entraînement et y saisit une séance", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await seConnecter(page, "coach@example.com");

  // Par défaut, il arrive là où il encadre.
  await expect(page.getByRole("heading", { name: "Mon groupe" })).toBeVisible();
  await expect(bascule(page).getByRole("button", { name: "Je coache" })).toBeDisabled();

  await bascule(page).getByRole("button", { name: "Je m'entraîne" }).click();

  // Son propre accueil d'athlète, sur ses propres données.
  await expect(page.getByText(/Bonjour/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mon groupe" })).toBeHidden();
  // Il ne voit surtout pas ses athlètes dans sa vue d'entraînement.
  await expect(page.getByText("Léa Martin")).toBeHidden();

  // Il déclare une séance libre, comme n'importe quel athlète.
  const titre = `Coach e2e ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByRole("button", { name: "Ajouter une séance" }).click();
  await page.getByText("Séance libre").click();
  await page.getByLabel("Titre").fill(titre);
  await page.getByRole("radio", { name: "6", exact: true }).click();
  await page.getByLabel("Durée (minutes)").fill("40");
  await page.getByRole("button", { name: "Enregistrer" }).click();

  // Elle atterrit dans son historique à lui.
  await page.getByRole("link", { name: "Historique" }).click();
  await expect(page.getByText(titre)).toBeVisible();
});

test("le mode survit au rechargement et reste lisible en permanence", async ({
  page,
}) => {
  await seConnecter(page, "coach@example.com");
  await bascule(page).getByRole("button", { name: "Je m'entraîne" }).click();
  await expect(page.getByText(/Bonjour/)).toBeVisible();

  // Le cookie, pas un état de navigateur : un rechargement complet le garde.
  await page.reload();
  await expect(page.getByText(/Bonjour/)).toBeVisible();
  await expect(
    bascule(page).getByRole("button", { name: "Je m'entraîne" })
  ).toBeDisabled();

  // Et il reste affiché en changeant de page — se croire dans le mauvais
  // mode est la pire issue.
  await page.getByRole("link", { name: "Réglages" }).click();
  await expect(bascule(page)).toBeVisible();
  await expect(page.getByText("Compte athlète")).toBeVisible();
  // Les réglages suivent le mode : ce sont ceux d'un athlète qui s'affichent.
  await expect(page.getByText("Records personnels")).toBeVisible();
  await expect(page.getByText("Ton code coach")).toBeHidden();

  // Retour à l'encadrement : les réglages de coach reviennent.
  await bascule(page).getByRole("button", { name: "Je coache" }).click();
  await page.getByRole("link", { name: "Réglages" }).click();
  await expect(page.getByText("Ton code coach")).toBeVisible();
});

test("prescrire n'est pas accessible depuis la vue « je m'entraîne »", async ({
  page,
}) => {
  await seConnecter(page, "coach@example.com");
  await bascule(page).getByRole("button", { name: "Je m'entraîne" }).click();
  await expect(page.getByText(/Bonjour/)).toBeVisible();

  // Même en forçant l'adresse : l'app doit se comporter comme le mode
  // qu'elle affiche, sans quoi on ne sait plus dans lequel on se trouve.
  await page.goto("/planifier");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Bonjour/)).toBeVisible();
});

test("l'athlète ne se voit jamais proposer la bascule", async ({ page }) => {
  await seConnecter(page, "lea@example.com");
  await expect(page.getByText(/Bonjour/)).toBeVisible();
  await expect(bascule(page)).toBeHidden();
});
