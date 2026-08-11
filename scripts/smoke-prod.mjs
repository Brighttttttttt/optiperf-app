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

// 2. Les server actions des pages publiques (connexion, inscription)
//    atteignent bien l'application. Le navigateur les envoie avec l'en-tête
//    Next-Action ; c'est lui qui fait router la requête vers la fonction
//    plutôt que vers la page prérendue du CDN. Un identifiant d'action bidon
//    doit donner un 4xx applicatif — un 405 signalerait que la requête n'a
//    jamais quitté le CDN, donc une connexion cassée en production.
//    (Un POST sans cet en-tête répond 405 : c'est le comportement normal
//    de Vercel pour une page prérendue, pas une anomalie.)
for (const path of ["/login", "/signup"]) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Next-Action": "smoke-test-invalid-action-id" },
    body: new URLSearchParams({ smoke: "1" }),
    redirect: "manual",
  });
  check(
    `les server actions de ${path} atteignent l'application`,
    res.status !== 405,
    `reçu ${res.status} — la requête n'a pas dépassé le CDN`
  );
}

// 3. Le manifeste et les icônes doivent rester accessibles sans session :
//    c'est le système d'exploitation qui les récupère au moment de l'ajout
//    à l'écran d'accueil, sans cookie.
for (const path of ["/manifest.webmanifest", "/icon", "/apple-icon"]) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  check(
    `${path} est servi sans authentification`,
    res.status === 200,
    `reçu ${res.status}${res.status === 307 ? " — protégé par erreur" : ""}`
  );
}

const manifest = await fetch(`${BASE}/manifest.webmanifest`).then((r) => r.json());
check(
  "le manifeste déclare le mode plein écran",
  manifest.display === "standalone" && !!manifest.name,
  `display=${manifest.display}`
);

// 4. Une route protégée redirige vers la connexion, en une seule fois.
const guarded = await fetch(`${BASE}/messages`, { redirect: "manual" });
check(
  "GET /messages redirige vers /login",
  [307, 302].includes(guarded.status) &&
    (guarded.headers.get("location") ?? "").includes("/login"),
  `${guarded.status} → ${guarded.headers.get("location") ?? "sans Location"}`
);

// 5. La racine ne boucle pas : une seule redirection suffit à atterrir.
const root = await fetch(`${BASE}/`, { redirect: "follow" });
check("GET / se stabilise", root.status === 200, `reçu ${root.status}`);

// 6. Une page connectée affiche vraiment son contenu.
//    C'est la vérification qui manquait lors de l'incident #44 : l'app
//    répondait 200 sur toutes les routes tout en restant bloquée sur son
//    écran d'attente. Les tests locaux ne reproduisent pas ce défaut, qui
//    ne se manifeste qu'avec la latence réelle : il se constate ici.
//    Le compte utilisé est celui de démonstration, documenté publiquement.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.log(
    "ℹ Contrôle connecté ignoré : SUPABASE_URL et SUPABASE_PUBLISHABLE_KEY absents."
  );
} else {
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "coach@example.com",
      password: "optiperf-demo",
    }),
  });
  const session = await auth.json();
  check("le compte de démonstration se connecte", !!session.access_token, session.error_description ?? "");

  if (session.access_token) {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(
      JSON.stringify(session)
    ).toString("base64")}`;

    const page = await fetch(`${BASE}/`, {
      headers: { cookie },
      redirect: "manual",
    });
    const html = await page.text();

    check("le dashboard répond 200 une fois connecté", page.status === 200, `reçu ${page.status}`);
    // Une carte d'athlète rendue, sans nommer personne : le jeu de démo en
    // ligne ne vient pas de `npm run seed`, et il change quand on le
    // régénère. Chercher « Léa Martin » ici couplait le contrôle après
    // déploiement à des données qu'il ne maîtrise pas — il est passé au rouge
    // le jour où la démo a été repeuplée, sans qu'aucune page ne soit cassée.
    // Ce qui se vérifie, c'est que la page affiche ses données, pas
    // lesquelles.
    check(
      "le dashboard affiche ses athlètes",
      /\/athletes\/[0-9a-f]{8}-[0-9a-f]{4}-/.test(html),
      "aucun lien vers une fiche athlète dans la page"
    );
    check(
      "le dashboard n'est pas bloqué sur l'écran d'attente",
      !/Chargement…/.test(html) || /MON GROUPE/i.test(html),
      "la page ne contient que son écran d'attente"
    );
  }
}

const failed = checks.filter((c) => !c.ok);
for (const c of checks) {
  console.log(`${c.ok ? "✔" : "✘"} ${c.name}${c.ok ? "" : ` — ${c.detail}`}`);
}
console.log(
  `\n${checks.length - failed.length}/${checks.length} vérifications passées sur ${BASE}`
);
process.exit(failed.length === 0 ? 0 : 1);
