import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Quand une adresse est fournie, on teste un site déjà déployé : pas de
// serveur local à démarrer.
const DEPLOYE = process.env.PLAYWRIGHT_BASE_URL;

// Les tests de fumée n'ont pas besoin d'une vraie base : un env factice
// suffit, les visiteurs non connectés étant simplement redirigés. Les
// parcours connectés, eux, reçoivent l'adresse d'une base réelle.
const env = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "sb_publishable_placeholder",
};

export default defineConfig({
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    {
      // Rapides, sans dépendance : redirections, en-têtes, pages publiques.
      name: "fumee",
      testDir: "./e2e",
      use: { ...devices["Pixel 7"] },
    },
    {
      // Parcours connectés contre une base réelle. Ce sont les seuls tests
      // qui vérifient qu'une page **affiche son contenu** — le trou par
      // lequel est passé l'incident #44.
      name: "authentifie",
      testDir: "./e2e-auth",
      use: { ...devices["Pixel 7"] },
    },
    {
      // Les mêmes parcours connectés, en largeur d'ordinateur. Tout le reste
      // de la suite tourne en Pixel 7 : sans ce projet, rien ne garantirait
      // qu'une vue reprise pour le grand écran ne se casse pas plus tard —
      // et le coach planifie souvent assis devant un clavier.
      name: "bureau",
      testDir: "./e2e-bureau",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // Contrôle après déploiement, dans un vrai navigateur, contre le site
      // en ligne. C'est le seul dispositif capable de voir qu'une page
      // répond correctement tout en n'affichant rien — le mode de panne de
      // l'incident #44, invisible pour une vérification sur le HTML brut.
      name: "production",
      testDir: "./e2e-prod",
      use: { ...devices["Pixel 7"], baseURL: DEPLOYE },
    },
  ],
  webServer: DEPLOYE
    ? undefined
    : {
        command: `npm run start -- --port ${PORT}`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
        env,
      },
});
