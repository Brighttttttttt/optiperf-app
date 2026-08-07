import { expect, test, type Page } from "@playwright/test";

/**
 * Séances structurées en blocs (#75), de bout en bout : le coach construit
 * une séance de fractionné bloc par bloc dans /planifier, l'athlète (ou lui-
 * même) la retrouve clairement structurée sur la fiche de la séance.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("le coach construit une séance de fractionné bloc par bloc", async ({ page }) => {
  // Connexion, planification à deux blocs (plusieurs champs chacun) puis
  // navigation jusqu'à la fiche : plus d'étapes que le budget par défaut
  // (30 s) ne supporte en CI.
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");

  const titre = `Fractionné e2e ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/planifier");

  await page.getByLabel("Titre").fill(titre);
  await page.getByRole("button", { name: "Léa Martin" }).click();
  // Premier jour du calendrier de planification : toujours aujourd'hui (le
  // fuseau du calcul est celui du serveur, Europe/Paris — pas question de le
  // redériver ici avec `new Date()`, en UTC dans ce test).
  await page.locator('button[aria-label^="20"]').first().click();

  await page.getByRole("button", { name: "Structurer en blocs" }).click();

  // Le formulaire de planification porte sa propre « Durée (min) » (durée
  // globale de la séance) : scoper chaque champ à la ligne de son bloc
  // (repère : bg-surface, propre à WorkoutBlocksEditor) évite de viser ce
  // champ général au lieu du premier bloc.
  const lignesBlocs = page.locator("div.bg-surface");

  // Bloc 1 : échauffement, type par défaut.
  await page.getByRole("button", { name: "Ajouter un bloc" }).click();
  await lignesBlocs.nth(0).getByLabel("Durée (min)").fill("15");

  // Bloc 2 : intervalle répété, avec allure cible.
  await page.getByRole("button", { name: "Ajouter un bloc" }).click();
  await lignesBlocs.nth(1).getByLabel("Type de bloc").selectOption("intervalle");
  await lignesBlocs.nth(1).getByLabel("Durée (min)").fill("3");
  await lignesBlocs.nth(1).getByLabel("Allure cible (min/km)").fill("4:30");
  await lignesBlocs.nth(1).getByLabel("Répétitions").fill("4");

  await page.getByRole("button", { name: /Planifier \d+ séance/ }).click();
  await expect(page).toHaveURL(/planifiees=1/);

  // La séance créée : via la fiche de Léa, onglet Planning. Le titre n'est
  // qu'un texte dans la ligne ; seul « Modifier », à côté, mène à la fiche.
  // Le titre et « Modifier » sont dans des div frères (pas l'une dans
  // l'autre) : filtrer sur le seul texte prend la div la plus profonde qui
  // le contient, sans le lien. Exiger aussi le lien comme descendant
  // retombe sur la ligne qui les contient tous les deux.
  await page.getByText("Léa Martin").click();
  await page.getByRole("link", { name: "Planning" }).click();
  const ligne = page
    .locator("div")
    .filter({ hasText: titre })
    .filter({ has: page.getByRole("link", { name: "Modifier" }) })
    .last();
  await ligne.getByRole("link", { name: "Modifier" }).click();

  // « Modifier » mène toujours au formulaire d'édition tant que la séance
  // est planifiée (page.tsx ne réserve la fiche en lecture seule — et donc
  // WorkoutBlocksList — qu'aux séances déjà rapportées) : on vérifie que les
  // blocs reviennent correctement préremplis, plutôt qu'un affichage en
  // lecture seule inatteignable depuis ce parcours.
  await expect(lignesBlocs.nth(0).getByLabel("Type de bloc")).toHaveValue("echauffement");
  await expect(lignesBlocs.nth(0).getByLabel("Durée (min)")).toHaveValue("15");
  await expect(lignesBlocs.nth(1).getByLabel("Type de bloc")).toHaveValue("intervalle");
  await expect(lignesBlocs.nth(1).getByLabel("Durée (min)")).toHaveValue("3");
  await expect(lignesBlocs.nth(1).getByLabel("Allure cible (min/km)")).toHaveValue("4:30");
  await expect(lignesBlocs.nth(1).getByLabel("Répétitions")).toHaveValue("4");
});

test("une séance simple reste aussi rapide à créer, sans bloc", async ({ page }) => {
  await seConnecter(page, "coach@example.com");

  await page.goto("/planifier");
  // Le bouton reste replié tant qu'on ne l'ouvre pas : rien de nouveau à
  // remplir pour une sortie sans structure particulière.
  await expect(page.getByRole("button", { name: "Ajouter un bloc" })).toBeHidden();
});
