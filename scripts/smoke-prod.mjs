// Test de fumée post-déploiement, contre l'URL réellement servie.
// Attrape ce que les e2e locaux ne peuvent pas voir : le routage et le
// cache du CDN Vercel (ex. une page prérendue qui refuse les POST des
// server actions avec un 405).
//
// Usage : node scripts/smoke-prod.mjs [url]

const BASE =
  process.argv[2] ??
  process.env.SMOKE_URL ??
  "https://optiperf-app.vercel.app";

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok, detail });

const REQUIRED_HEADERS = {
  "content-security-policy": /frame-ancestors 'none'/,
  "x-frame-options": /DENY/,
  "x-content-type-options": /nosniff/,
  "referrer-policy": /strict-origin/,
};

// 1. La page de connexion répond et porte les en-têtes de sécurité.
const login = await fetch(`${BASE}/login`, { redirect: "manual" });
check("GET /login répond 200", login.status === 200, `reçu ${login.status}`);
for (const [header, pattern] of Object.entries(REQUIRED_HEADERS)) {
  const value = login.headers.get(header) ?? "";
  check(`en-tête ${header}`, pattern.test(value), value || "absent");
}

// 2. Les pages publiques acceptent les POST : c'est par là que passent les
//    server actions de connexion et d'inscription. Un 405 signifie que le
//    CDN sert la page statique au lieu de router vers la fonction.
for (const path of ["/login", "/signup"]) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: new URLSearchParams({ smoke: "1" }),
    redirect: "manual",
  });
  check(
    `POST ${path} atteint l'application`,
    res.status !== 405,
    `reçu ${res.status}${res.status === 405 ? " — page servie par le CDN" : ""}`
  );
}

// 3. Une route protégée redirige vers la connexion, en une seule fois.
const guarded = await fetch(`${BASE}/messages`, { redirect: "manual" });
check(
  "GET /messages redirige vers /login",
  [307, 302].includes(guarded.status) &&
    (guarded.headers.get("location") ?? "").includes("/login"),
  `${guarded.status} → ${guarded.headers.get("location") ?? "sans Location"}`
);

// 4. La racine ne boucle pas : une seule redirection suffit à atterrir.
const root = await fetch(`${BASE}/`, { redirect: "follow" });
check("GET / se stabilise", root.status === 200, `reçu ${root.status}`);

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "✔" : "✘"} ${c.name}${c.ok ? "" : ` — ${c.detail}`}`);
}
console.log(
  `\n${checks.length - failed.length}/${checks.length} vérifications passées sur ${BASE}`
);
process.exit(failed.length === 0 ? 0 : 1);
