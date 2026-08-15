import { expect, test, type Page } from "@playwright/test";

/**
 * Le glisser-déposer d'une séance, à la souris (issue #85).
 *
 * Ce test vit dans le projet `bureau` parce qu'il lui faut un vrai pointeur
 * qu'on peut déplacer par étapes. Le geste est écrit en événements de
 * pointeur — les mêmes que produit un doigt — mais seule la souris se pilote
 * assez finement pour vérifier que le jour survolé est bien calculé en cours
 * de route, et pas seulement au moment du lâcher.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("une séance se glisse d'un jour à l'autre dans la grille du mois", async ({
  page,
}) => {
  // Connexion, planification, navigation, glissement puis rechargement.
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");

  const titre = `Glisser e2e ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/planifier");
  await page.getByLabel("Titre").fill(titre);
  await page.getByRole("button", { name: "Nino Rossi" }).click();
  // Premier jour de la grille : toujours aujourd'hui (fuseau du serveur).
  await page.locator('button[aria-label^="20"]').first().click();
  await page.getByRole("button", { name: /Planifier \d+ séance/ }).click();
  await expect(page).toHaveURL(/planifiees=1/);

  await page.getByRole("link", { name: "Nino Rossi" }).click();
  await page.getByRole("link", { name: "Planning" }).click();

  const jourOuvert = page.locator('button[aria-pressed="true"]');
  const depuis = await jourOuvert.getAttribute("data-jour");

  // Le jour suivant de la grille : lequel n'a pas d'importance, et le
  // calculer ici éviterait de dépendre du jour où la suite tourne. On vise
  // l'avant plutôt que l'après pour rester dans le mois ouvert — la grille en
  // affiche désormais un entier (#143), débordements compris.
  const jours = await page
    .locator("button[data-jour]")
    .evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.jour as string)
    );
  const vers = jours.find((j) => j > depuis!) ?? jours.find((j) => j !== depuis)!;

  const poignee = page.getByRole("button", {
    name: new RegExp(`^Déplacer « ${titre}`),
  });
  const depart = (await poignee.boundingBox())!;
  const arrivee = (await page
    .locator(`button[data-jour="${vers}"]`)
    .boundingBox())!;

  await page.mouse.move(
    depart.x + depart.width / 2,
    depart.y + depart.height / 2
  );
  await page.mouse.down();
  // Par étapes, et non d'un seul saut : un saut unique ne produit qu'un
  // `pointermove`, et le jour survolé ne serait jamais mis en évidence.
  await page.mouse.move(
    arrivee.x + arrivee.width / 2,
    arrivee.y + arrivee.height / 2,
    { steps: 12 }
  );
  await page.mouse.up();

  await expect(page.getByRole("status")).toContainText("déplacée au");
  // Le jour ouvert suit la séance, sinon elle semblerait avoir disparu.
  await expect(jourOuvert).toHaveAttribute("data-jour", vers);

  // Le déplacement est enregistré, pas seulement affiché.
  await page.reload();
  const carte = page.locator("div.rounded-xl").filter({ hasText: titre });
  await expect(carte).toBeHidden();
  await page.locator(`button[data-jour="${vers}"]`).click();
  await expect(carte).toBeVisible();
});
