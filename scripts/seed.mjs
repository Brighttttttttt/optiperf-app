// Données de démo : 1 coach + 3 athlètes aux profils contrastés.
// Usage : npm run seed  (nécessite SUPABASE_SERVICE_ROLE_KEY dans .env.local)
// Relançable : les données de démo existantes sont remplacées.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(url) {
  try {
    for (const line of readFileSync(url, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // pas de .env.local : on compte sur l'environnement
  }
}
loadEnv(new URL("../.env.local", import.meta.url));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !serviceKey) {
  console.error(
    "Il manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SECRET_KEY dans .env.local"
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(
  `→ Cible : ${url} (clé ${serviceKey.slice(0, 10)}…, ${serviceKey.length} caractères)`
);

/** Toute erreur doit s'arrêter ici, en disant laquelle : une insertion qui
 *  échoue en silence produit un jeu de données incomplet et des tests
 *  incompréhensibles. */
function verifier(etape, { error } = {}) {
  if (!error) return;
  console.error(
    `\n✘ ${etape} — ${error.message}` +
      (error.code ? ` [${error.code}]` : "") +
      (error.details ? `\n   détails : ${error.details}` : "") +
      (error.hint ? `\n   piste : ${error.hint}` : "")
  );
  process.exit(1);
}

const PASSWORD = "optiperf-demo";

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

async function ensureUser(email, fullName, role) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    // Le consentement aux données de santé (migration 020) : sans lui,
    // tous les comptes peuplés afficheraient la demande en tête d'accueil,
    // et les parcours connectés buteraient dessus.
    user_metadata: {
      full_name: fullName,
      role,
      health_consent_at: new Date().toISOString(),
    },
  });
  if (!error) return data.user.id;
  if (String(error.message).toLowerCase().includes("already")) {
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 });
    const existing = list.users.find((u) => u.email === email);
    if (existing) return existing.id;
  }
  throw error;
}

// Profils : adhérence (probabilité de faire la séance), RPE typique, jours d'entraînement.
const ATHLETES = [
  {
    email: "lea@example.com",
    name: "Léa Martin",
    days: [1, 3, 5, 6],
    adherence: 0.95,
    rpe: [5, 7],
    objective: { title: "Marathon de Valence", inDays: 90 },
  },
  {
    email: "nino@example.com",
    name: "Nino Rossi",
    days: [1, 2, 3, 5, 6],
    adherence: 0.9,
    rpe: [7, 9], // surcharge récente → état « Fatigué »
    objective: { title: "Trail des Cévennes 45 km", inDays: 40 },
  },
  {
    email: "sofia@example.com",
    name: "Sofia Alves",
    days: [2, 4],
    adherence: 0.5, // décrochage → adhérence faible
    rpe: [4, 6],
    objective: { title: "10 km de Lyon en moins de 50 min", inDays: 60 },
  },
];

const TITLES = {
  endurance: ["Footing souple", "Sortie longue", "Endurance fondamentale"],
  intervalles: ["6 × 3 min allure 5 km", "10 × 400 m piste", "Fartlek 8 × 1 min"],
  tempo: ["Tempo 2 × 15 min", "Seuil 3 × 10 min"],
  renfo: ["Renfo gainage + jambes", "PPG complète"],
};
const TYPES = Object.keys(TITLES);

/**
 * Un athlète sans coach et sans la moindre séance.
 *
 * Il ne fait partie ni de `ATHLETES` (donc ni liaison, ni objectif, ni
 * séance) ni des jeux de données : c'est tout son intérêt. L'app doit lui
 * parler comme à quelqu'un d'autonome, pas comme à un compte incomplet
 * (#138), et rien ne le vérifiait — les trois autres ont tous un coach.
 */
const SOLO = { email: "solo@example.com", name: "Alex Bernard" };

async function main() {
  console.log("→ Création des comptes…");
  const coachId = await ensureUser("coach@example.com", "Camille Dupont", "coach");
  const athleteIds = [];
  for (const a of ATHLETES) {
    athleteIds.push(await ensureUser(a.email, a.name, a.role ?? "athlete"));
  }
  const soloId = await ensureUser(SOLO.email, SOLO.name, "athlete");
  const allIds = [coachId, ...athleteIds, soloId];

  console.log("→ Nettoyage des anciennes données de démo…");
  await admin.from("messages").delete().in("sender_id", allIds);
  await admin.from("notifications").delete().in("recipient_id", allIds);
  await admin.from("activities").delete().in("athlete_id", [...athleteIds, soloId]);
  await admin.from("sessions").delete().in("athlete_id", [...athleteIds, soloId]);
  await admin.from("objectives").delete().in("athlete_id", [...athleteIds, soloId]);
  // Son absence de coach est la donnée : la reposer à chaque exécution, pour
  // qu'une session de test l'ayant lié à la main ne rende pas le suivant vert
  // à tort.
  await admin.from("coach_athletes").delete().eq("athlete_id", soloId);

  console.log("→ Liaison coach ↔ athlètes…");
  for (const id of athleteIds) {
    verifier(
      "liaison coach ↔ athlète",
      await admin
        .from("coach_athletes")
        .upsert({ coach_id: coachId, athlete_id: id }, { onConflict: "athlete_id" })
    );
  }

  console.log("→ Objectifs…");
  const now = new Date();
  for (let i = 0; i < ATHLETES.length; i++) {
    const a = ATHLETES[i];
    verifier(
      "objectifs",
      await admin.from("objectives").insert({
        athlete_id: athleteIds[i],
        title: a.objective.title,
        target_date: toISO(addDays(now, a.objective.inDays)),
      })
    );
  }

  console.log("→ Séances (5 semaines passées + semaine à venir)…");
  const sessions = [];
  for (let i = 0; i < ATHLETES.length; i++) {
    const a = ATHLETES[i];
    for (let d = -35; d <= 6; d++) {
      const day = addDays(now, d);
      if (!a.days.includes(day.getDay())) continue;
      const type = TYPES[rand(0, TYPES.length - 1)];
      const title = TITLES[type][rand(0, TITLES[type].length - 1)];
      const planned = rand(45, 90);
      const base = {
        athlete_id: athleteIds[i],
        coach_id: coachId,
        date: toISO(day),
        title,
        type,
        duration_planned_min: planned,
        description: type === "intervalles" ? "Échauffement 15 min, récup trot, retour au calme 10 min." : null,
      };
      if (d >= 0) {
        sessions.push({ ...base, status: "planned" });
      } else if (Math.random() < a.adherence) {
        const rpe = rand(a.rpe[0], a.rpe[1]);
        sessions.push({
          ...base,
          status: "completed",
          rpe,
          duration_actual_min: planned + rand(-10, 10),
          completed_at: new Date(day.getTime() + 19 * 3600 * 1000).toISOString(),
          athlete_comment:
            rpe >= 8
              ? "Grosse séance, jambes lourdes sur la fin."
              : rpe <= 4
                ? "Très facile, bonnes sensations."
                : null,
        });
      } else {
        sessions.push({ ...base, status: "missed" });
      }
    }
  }
  // Une séance planifiée aujourd'hui pour Sofia : le parcours d'import a
  // besoin d'une candidate au rattachement, à une date qui ne vieillira pas.
  // Sofia plutôt que Léa, dont les activités servent aux comptages.
  sessions.push({
    athlete_id: athleteIds[2],
    coach_id: coachId,
    date: toISO(now),
    title: "Séance du jour",
    type: "endurance",
    duration_planned_min: 40,
    status: "planned",
  });

  verifier("séances", await admin.from("sessions").insert(sessions));

  // Deux activités pour Léa : l'une rattachée à une séance, l'autre non —
  // les deux cas que le modèle doit savoir porter.
  console.log("→ Activités importées…");
  const { data: derniereSeance } = await admin
    .from("sessions")
    .select("id, date")
    .eq("athlete_id", athleteIds[0])
    .eq("status", "completed")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!derniereSeance) {
    console.error(
      "\n✘ activités — aucune séance terminée pour rattacher une activité." +
        "\n   Le tirage des séances est aléatoire : relancer le peuplement." +
        "\n   Sans ce rattachement, les tests d'isolation portent sur un jeu incomplet."
    );
    process.exit(1);
  }

  const activites = [
    {
      athlete_id: athleteIds[0],
      session_id: derniereSeance.id,
      source: "fichier",
      external_id: "demo-sortie-longue",
      file_name: "sortie-longue.gpx",
      started_at: new Date(`${derniereSeance.date}T09:12:00Z`).toISOString(),
      date: derniereSeance.date,
      duration_min: 78,
      distance_m: 15230,
      avg_heart_rate: 148,
    },
    {
      // Rattachée à rien : une sortie qui n'était pas au programme.
      athlete_id: athleteIds[0],
      session_id: null,
      source: "fichier",
      external_id: "demo-footing-libre",
      file_name: "footing-libre.tcx",
      started_at: new Date(addDays(now, -2).getTime() + 18 * 3600 * 1000).toISOString(),
      date: toISO(addDays(now, -2)),
      duration_min: 34,
      distance_m: 6100,
      avg_heart_rate: 132,
    },
  ];
  const { data: activitesInserees, error: erreurActivites } = await admin
    .from("activities")
    .insert(activites)
    .select("id, external_id");
  verifier("activités", { error: erreurActivites });

  // FC max de Léa : sans elle, la trace ci-dessous ne produirait aucune zone
  // à afficher.
  verifier(
    "FC max",
    await admin.from("profiles").update({ fc_max: 188 }).eq("id", athleteIds[0])
  );

  // Une trace pour la sortie longue seulement : la seconde (footing libre)
  // couvre le cas d'une activité sans trace, tout aussi normal.
  console.log("→ Trace de la sortie longue…");
  const sortieLongue = activitesInserees.find((a) => a.external_id === "demo-sortie-longue");
  verifier(
    "trace d'activité",
    await admin.from("activity_traces").insert({
      activity_id: sortieLongue.id,
      athlete_id: athleteIds[0],
      t_s: [0, 1170, 2340, 3510, 4680],
      heart_rate: [120, 145, 150, 148, 152],
      pace_sec_per_km: [320, 310, 305, 315, 300],
      altitude_m: [180, 220, 260, 240, 200],
    })
  );

  // Les triggers ont généré une notification par insertion : on repart
  // d'une liste courte et crédible.
  console.log("→ Notifications…");
  await admin.from("notifications").delete().in("recipient_id", allIds);
  verifier("notifications", await admin.from("notifications").insert([
    {
      recipient_id: coachId,
      type: "session_completed",
      title: "Léa Martin a terminé une séance",
      body: "Sortie longue — RPE 6",
      link: `/athletes/${athleteIds[0]}`,
    },
    {
      recipient_id: athleteIds[0],
      type: "session_planned",
      title: "Nouvelle séance planifiée",
      body: "Ton planning de la semaine est prêt",
      link: "/",
    },
  ]));

  console.log("→ Messages…");
  const t = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
  verifier("messages", await admin.from("messages").insert([
    { sender_id: coachId, recipient_id: athleteIds[0], content: "Bien récupéré de la sortie longue ?", created_at: t(180), read_at: t(150) },
    { sender_id: athleteIds[0], recipient_id: coachId, content: "Oui nickel ! Un peu de raideur aux mollets mais rien de méchant.", created_at: t(140), read_at: t(120) },
    { sender_id: coachId, recipient_id: athleteIds[0], content: "Parfait. Pense à bien t'hydrater avant la séance de jeudi 💪", created_at: t(60) },
    { sender_id: athleteIds[1], recipient_id: coachId, content: "Je me sens vraiment cramé cette semaine, on peut alléger ?", created_at: t(30) },
  ]));

  console.log("\n✔ Données de démo prêtes. Comptes (mot de passe : " + PASSWORD + ")");
  console.log("   Coach   : coach@example.com");
  for (const a of ATHLETES) console.log(`   Athlète : ${a.email} (${a.name})`);
  console.log(`   Athlète sans coach : ${SOLO.email} (${SOLO.name})`);
}

main().catch((e) => {
  console.error("Échec du seed :", e.message ?? e);
  process.exit(1);
});
