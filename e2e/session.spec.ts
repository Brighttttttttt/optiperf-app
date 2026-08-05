import { expect, test } from "@playwright/test";

// Régression : une session invalide (cookie d'auth périmé ou corrompu)
// doit mener à /login en une seule redirection, cookies purgés — sinon
// le navigateur boucle (« trop de redirections », vu sur Safari).
test("une session invalide est purgée au lieu de boucler", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "sb-placeholder-auth-token",
      value: "base64-cookie-corrompu",
      domain: "localhost",
      path: "/",
    },
  ]);

  const response = await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  expect(response?.status()).toBe(200);

  const remaining = (await context.cookies()).filter((c) =>
    c.name.startsWith("sb-")
  );
  expect(remaining, "les cookies d'auth morts doivent être supprimés").toEqual([]);
});

test("une route protégée avec session invalide ne boucle pas non plus", async ({
  page,
  context,
}) => {
  await context.addCookies([
    {
      name: "sb-placeholder-auth-token",
      value: "base64-cookie-corrompu",
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("/messages");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
});
