import { expect, test } from "@playwright/test";

test("les en-têtes de sécurité sont servis sur toutes les pages", async ({
  request,
}) => {
  const response = await request.get("/login");
  const headers = response.headers();

  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("geolocation=()");

  const csp = headers["content-security-policy"];
  expect(csp, "la CSP doit être présente").toBeTruthy();
  // Anti-clickjacking et anti-injection : les directives critiques.
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  expect(csp).toContain("form-action 'self'");
  // Assertion négative : la CSP de production ne doit pas contenir la
  // directive 'unsafe-eval' (autorisée uniquement en dev pour le HMR).
  expect(csp).not.toContain("unsafe-eval");
});

test("aucune violation de CSP au chargement de l'app", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (/content security policy/i.test(msg.text())) violations.push(msg.text());
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
  await page.goto("/signup");
  await expect(page.getByRole("radio", { name: /^Coach/ })).toBeVisible();

  expect(violations).toEqual([]);
});
