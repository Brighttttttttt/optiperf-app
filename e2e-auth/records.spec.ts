import { expect, test, type Page } from "@playwright/test";

/** Records personnels et VMA (#78), de bout en bout depuis les réglages. */

const MOT_DE_PASSE = "optiperf-demo";

async function seConnecter(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(MOT_DE_PASSE);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
}

test("l'athlète enregistre un record et voit une VMA suggérée", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");
  await page.goto("/settings");

  const ligne5km = page.locator("form").filter({ hasText: "5 km" });
  await ligne5km.getByPlaceholder("mm:ss").fill("20:00");
  await expect(page.getByText(/VMA suggérée : 16/)).toBeVisible();
  await ligne5km.getByRole("button", { name: "OK" }).click();

  await page.reload();
  await expect(page.locator("form").filter({ hasText: "5 km" }).getByPlaceholder("mm:ss")).toHaveValue("20:00");
});

test("la VMA se met à jour depuis les réglages", async ({ page }) => {
  await seConnecter(page, "sofia@example.com");
  await page.goto("/settings");

  await page.getByLabel("VMA (km/h)").fill("15.5");
  const formulaireVma = page.locator("form").filter({ has: page.getByLabel("VMA (km/h)") });
  await formulaireVma.getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText("Enregistré.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("VMA (km/h)")).toHaveValue("15.5");
});

test("le coach voit et modifie les records de son athlète, mais pas sa VMA", async ({ page }) => {
  await seConnecter(page, "coach@example.com");
  await page.getByText("Léa Martin").click();

  await expect(page.getByText("Records personnels")).toBeVisible();
  const ligne10km = page.locator("form").filter({ hasText: "10 km" });
  await ligne10km.getByPlaceholder("mm:ss").fill("42:30");
  await ligne10km.getByRole("button", { name: "OK" }).click();

  // La VMA n'a qu'un affichage ici, jamais de champ modifiable par le coach.
  await expect(page.getByText(/^VMA/)).toBeVisible();
  await expect(page.getByLabel("VMA (km/h)")).toHaveCount(0);
});
