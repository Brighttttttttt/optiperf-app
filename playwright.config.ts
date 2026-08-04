import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Les e2e de fumée tournent sans Supabase réel : un env factice suffit,
// les visiteurs non connectés sont simplement redirigés vers /login.
const env = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    "sb_publishable_placeholder",
};

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [
    // L'app est mobile-first : on teste dans un viewport mobile.
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env,
  },
});
