import { expect, test, type Page } from "@playwright/test";

/**
 * Le carnet du coach sur la fiche d'un athlète (#86), côté interface.
 *
 * L'isolation elle-même est vérifiée en s'adressant à la base sans passer par
 * les pages (`note-coach-isolation.spec.ts`). Ici on vérifie le geste : écrire,
 * relire après navigation, effacer — et qu'aucune page de l'athlète ne laisse
 * fuiter le texte.
 *
 * Ce fichier écrit uniquement sur Nino ; le fichier d'isolation, uniquement
 * sur Léa et Sofia. Il n'y a qu'une note par paire coach / athlète, et les
 * deux fichiers tournent en parallèle.
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("le coach écrit une note, la retrouve, puis l'efface", async ({ page }) => {
  // Deux connexions et plusieurs allers-retours : au-delà du budget par défaut.
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");
  await page.getByRole("link", { name: "Nino Rossi" }).click();

  const note = `Genou droit fragile ${crypto.randomUUID().slice(0, 8)}`;
  const carnet = page.locator("div.rounded-2xl").filter({ hasText: "Mes notes" });

  await carnet.getByRole("button", { name: /Écrire une note|Modifier la note/ }).click();
  await carnet.getByLabel("Note sur cet athlète").fill(note);
  await carnet.getByRole("button", { name: "Enregistrer" }).click();

  // Le formulaire se referme et la note se lit, sans avoir à rouvrir.
  await expect(carnet.getByText(note)).toBeVisible();

  // Elle survit à la navigation entre onglets — troisième critère de #86.
  await page.getByRole("link", { name: "Planning" }).click();
  await page.goBack();
  await expect(carnet.getByText(note)).toBeVisible();

  // Vider le champ efface la note : c'est le geste attendu, pas un second
  // bouton « Supprimer ».
  await carnet.getByRole("button", { name: "Modifier la note" }).click();
  await carnet.getByLabel("Note sur cet athlète").fill("");
  await carnet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carnet.getByText("Rien de noté pour l'instant.")).toBeVisible();
});

test("l'athlète ne croise la note nulle part dans l'app", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);

  await seConnecter(page, "coach@example.com");
  await page.getByRole("link", { name: "Nino Rossi" }).click();

  const note = `Contrainte horaire ${crypto.randomUUID().slice(0, 8)}`;
  const carnet = page.locator("div.rounded-2xl").filter({ hasText: "Mes notes" });
  await carnet.getByRole("button", { name: /Écrire une note|Modifier la note/ }).click();
  await carnet.getByLabel("Note sur cet athlète").fill(note);
  await carnet.getByRole("button", { name: "Enregistrer" }).click();
  await expect(carnet.getByText(note)).toBeVisible();

  // Les pages où une fuite serait plausible : celles qui affichent quelque
  // chose venu du coach.
  const pageAthlete = await browser.newPage();
  await seConnecter(pageAthlete, "nino@example.com");
  for (const chemin of ["/", "/planning", "/history", "/messages", "/settings"]) {
    await pageAthlete.goto(chemin);
    await expect(pageAthlete.getByText(note)).toHaveCount(0);
  }
  await pageAthlete.close();

  // Remise en état : ce fichier partage la paire coach / Nino entre ses tests.
  await carnet.getByRole("button", { name: "Modifier la note" }).click();
  await carnet.getByLabel("Note sur cet athlète").fill("");
  await carnet.getByRole("button", { name: "Enregistrer" }).click();
});
