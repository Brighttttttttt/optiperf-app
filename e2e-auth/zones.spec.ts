import { expect, test, type Page } from "@playwright/test";

/**
 * Zones de fréquence cardiaque (#76), sur les données de démo :
 * `scripts/seed.mjs` pose une FC max de 188 sur Léa et une trace fixe sur sa
 * sortie longue (148 bpm de moyenne, 15,2 km) — le seul repère stable dans
 * un historique par ailleurs randomisé (titres et durées tirés au hasard à
 * chaque peuplement). Cette ligne se retrouve par son relevé, déterministe,
 * plutôt que par un titre qui ne l'est pas.
 *
 * 120/145/150/148/152 bpm sur 188 de FC max, un intervalle de 1170 s chacun :
 * Z3 (70–80 %) porte 3 des 4 intervalles (3510 s, 75 %), Z4 le dernier
 * (1170 s, 25 %).
 */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("la fiche séance affiche la répartition en zones de la sortie longue", async ({ page }) => {
  await seConnecter(page, "coach@example.com");
  await page.getByText("Léa Martin").click();
  await page.getByRole("link", { name: "Historique" }).click();

  await page.getByText("15,2 km · 148 bpm").click();

  await expect(page.getByRole("heading", { name: "Zones de fréquence cardiaque" })).toBeVisible();
  await expect(page.getByText("Z3 75 % · 59 min")).toBeVisible();
  await expect(page.getByText("Z4 25 % · 20 min")).toBeVisible();
  // Une seule activité tracée : aucune autre zone n'a de temps à afficher.
  await expect(page.getByText(/^Z1 /)).toBeHidden();
});

test("la fiche athlète affiche la moyenne des zones sur les dernières séances", async ({ page }) => {
  await seConnecter(page, "coach@example.com");
  await page.getByText("Léa Martin").click();

  await expect(
    page.getByRole("heading", { name: "Zones (10 dernières séances)" })
  ).toBeVisible();
  await expect(page.getByText("Z3 75 % · 59 min")).toBeVisible();
});

// Deux formulaires de la page se soumettent tous deux par un bouton
// "Enregistrer" (nom, FC) : on cible celui qui contient le champ FC max
// plutôt que le libellé seul, ambigu depuis que les deux coexistent.
function formulaireFc(page: Page) {
  return page.locator("form").filter({ has: page.getByLabel("FC max (bpm)") });
}

test("l'athlète enregistre sa FC max depuis les réglages", async ({ page }) => {
  await seConnecter(page, "nino@example.com");
  await page.goto("/settings");

  await page.getByLabel("FC max (bpm)").fill("192");
  await formulaireFc(page).getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("FC max (bpm)")).toHaveValue("192");
});

test("une FC de repos supérieure ou égale à la FC max est refusée", async ({ page }) => {
  await seConnecter(page, "nino@example.com");
  await page.goto("/settings");

  // Chacune dans les bornes de son propre champ (25–120 pour la FC repos,
  // 100–230 pour la FC max) : seule la comparaison entre les deux doit
  // faire échouer l'enregistrement, pas la validation HTML5 native d'un
  // <input min max>, qui bloquerait la soumission avant même le serveur.
  await page.getByLabel("FC max (bpm)").fill("110");
  await page.getByLabel("FC repos (bpm)").fill("110");
  await formulaireFc(page).getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText(/FC de repos doit être inférieure/)).toBeVisible();
});
