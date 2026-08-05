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

// La vérification du jeton se fait localement : elle doit vraiment vérifier
// la signature, et non se contenter de lire ce qu'on lui donne. Un jeton
// bien formé mais non signé par le projet ne doit ouvrir aucune porte.
test("un jeton bien formé mais non signé par le projet est refusé", async ({
  page,
  context,
}) => {
  const faux = {
    access_token: [
      Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url"),
      Buffer.from(
        JSON.stringify({
          sub: "00000000-0000-0000-0000-000000000000",
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url"),
      "signature-inventee",
    ].join("."),
    refresh_token: "faux",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: "bearer",
    user: { id: "00000000-0000-0000-0000-000000000000" },
  };

  await context.addCookies([
    {
      name: "sb-placeholder-auth-token",
      value: "base64-" + Buffer.from(JSON.stringify(faux)).toString("base64"),
      domain: "localhost",
      path: "/",
    },
  ]);

  await page.goto("/");
  await expect(page, "aucun accès avec un jeton non signé").toHaveURL(/\/login$/);

  await page.goto("/messages");
  await expect(page).toHaveURL(/\/login$/);
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
