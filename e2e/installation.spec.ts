import { expect, test } from "@playwright/test";

// Le système d'exploitation récupère ces ressources sans cookie au moment
// de l'ajout à l'écran d'accueil : les protéger casserait l'installation.
test("le manifeste est servi sans session", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);

  const manifest = await res.json();
  expect(manifest.name).toContain("Optiperf");
  expect(manifest.display, "plein écran une fois installée").toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.icons.length).toBeGreaterThan(0);
});

test("les icônes d'installation sont servies sans session", async ({
  request,
}) => {
  for (const path of ["/icon", "/apple-icon"]) {
    const res = await request.get(path);
    expect(res.status(), `${path} doit être public`).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});

test("la page déclare l'ajout à l'écran d'accueil iOS", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.locator('link[rel="apple-touch-icon"]')
  ).toHaveCount(1);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
});

// L'écran de modification reste réservé au coach connecté.
test("la modification de séance est protégée", async ({ page }) => {
  await page.goto("/seances/00000000-0000-0000-0000-000000000000");
  await expect(page).toHaveURL(/\/login$/);
});
