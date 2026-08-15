// Données de démo pour l'app en ligne : 1 coach + 5 athlètes, avec des
// identifiants simples à retenir pour basculer d'un compte à l'autre.
//
// Distinct de `npm run seed` : celui-là peuple une base fraîche pour les
// tests e2e authentifiés (3 athlètes, dont les noms et emails sont lus en dur
// dans e2e-auth/*.spec.ts — n'y toucherait pas sans casser ces tests). Celui-ci
// cible la base réelle derrière l'app déployée, pour la parcourir soi-même.
//
// Usage : npm run demo  (nécessite SUPABASE_SECRET_KEY dans .env.local)
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
const COACH = { email: "coach@example.com", name: "Antoine Roy" };

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
    // Le consentement aux donnees de sante (migration 020) : sans lui, les
    // comptes de demonstration afficheraient la demande en tete d'accueil.
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

// Cinq profils contrastés : de quoi voir tous les états d'adhésion et de
// charge à l'écran (frais, normal, fatigué, décroché).
const ATHLETES = [
  {
    email: "emma@example.com",
    name: "Emma Girard",
    days: [1, 2, 4, 6], // lun, mar, jeu, sam
    adherence: 0.92,
    rpe: [5, 7],
    objective: { title: "Marathon de Paris", inDays: 75 },
    fcMax: 188,
  },
  {
    email: "louis@example.com",
    name: "Louis Bernard",
    days: [0, 1, 3, 4, 6], // dim, lun, mer, jeu, sam — volume élevé
    adherence: 0.88,
    rpe: [7, 9], // surcharge récente → état « Fatigué »
    objective: { title: "Trail des Templiers 100 km", inDays: 50 },
    fcMax: 182,
  },
  {
    email: "chloe@example.com",
    name: "Chloé Faure",
    days: [2, 4], // mar, jeu — peu de créneaux
    adherence: 0.45, // décrochage → adhérence faible
    rpe: [4, 6],
    objective: { title: "10 km de Paris", inDays: 40 },
    fcMax: 192,
  },
  {
    email: "maxime@example.com",
    name: "Maxime Lambert",
    days: [1, 3, 5, 6],
    adherence: 0.8,
    rpe: [5, 7],
    objective: { title: "Semi-marathon de Nice", inDays: 55 },
    fcMax: 185,
  },
  {
    email: "theo@example.com",
    name: "Théo Petit",
    days: [2, 6], // débute : deux séances par semaine
    adherence: 0.7,
    rpe: [3, 5],
    objective: { title: "Premier 10 km", inDays: 70 },
    fcMax: 195,
  },
];

const TITLES = {
  endurance: ["Footing souple", "Sortie longue", "Endurance fondamentale"],
  intervalles: ["6 × 3 min allure 5 km", "10 × 400 m piste", "Fartlek 8 × 1 min"],
  tempo: ["Tempo 2 × 15 min", "Seuil 3 × 10 min"],
  renfo: ["Renfo gainage + jambes", "PPG complète"],
};
const TYPES = Object.keys(TITLES);

async function main() {
  console.log("→ Création des comptes…");
  const coachId = await ensureUser(COACH.email, COACH.name, "coach");
  const athleteIds = [];
  for (const a of ATHLETES) {
    athleteIds.push(await ensureUser(a.email, a.name, "athlete"));
  }
  const allIds = [coachId, ...athleteIds];

  console.log("→ Nettoyage des anciennes données de démo…");
  await admin.from("messages").delete().in("sender_id", allIds);
  await admin.from("notifications").delete().in("recipient_id", allIds);
  await admin.from("activities").delete().in("athlete_id", athleteIds);
  await admin.from("sessions").delete().in("athlete_id", athleteIds);
  await admin.from("objectives").delete().in("athlete_id", athleteIds);

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

  // 8 semaines passées + une semaine à venir : assez pour remplir les
  // courbes (weeklySeries en trace 12, les premières restent vides).
  console.log("→ Séances (8 semaines passées + semaine à venir)…");
  const sessions = [];
  for (let i = 0; i < ATHLETES.length; i++) {
    const a = ATHLETES[i];
    for (let d = -56; d <= 6; d++) {
      const day = addDays(now, d);
      if (!a.days.includes(day.getDay())) continue;
      const type = TYPES[rand(0, TYPES.length - 1)];
      const title = TITLES[type][rand(0, TITLES[type].length - 1)];
      const planned = rand(40, 95);
      const base = {
        athlete_id: athleteIds[i],
        coach_id: coachId,
        date: toISO(day),
        title,
        type,
        duration_planned_min: planned,
        description:
          type === "intervalles"
            ? "Échauffement 15 min, récup trot, retour au calme 10 min."
            : null,
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
  // Une séance planifiée aujourd'hui pour Théo : de quoi tester le dépôt
  // d'un fichier de montre sans attendre la prochaine séance du planning.
  sessions.push({
    athlete_id: athleteIds[4],
    coach_id: coachId,
    date: toISO(now),
    title: "Séance du jour",
    type: "endurance",
    duration_planned_min: 35,
    status: "planned",
  });

  verifier("séances", await admin.from("sessions").insert(sessions));

  // Une activité importée par athlète, rattachée à sa dernière séance
  // complétée — de quoi voir tout de suite ce qu'un dépôt de fichier donne.
  console.log("→ Activités importées…");
  const activites = [];
  for (let i = 0; i < ATHLETES.length; i++) {
    const { data: derniereSeance } = await admin
      .from("sessions")
      .select("id, date, duration_planned_min")
      .eq("athlete_id", athleteIds[i])
      .eq("status", "completed")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!derniereSeance) continue; // tirage aléatoire : peut arriver pour Chloé, adhérence faible

    const duree = derniereSeance.duration_planned_min + rand(-8, 8);
    activites.push({
      athlete_id: athleteIds[i],
      session_id: derniereSeance.id,
      source: "fichier",
      external_id: `demo-${ATHLETES[i].email}-${derniereSeance.date}`,
      file_name: `sortie-${derniereSeance.date}.gpx`,
      started_at: new Date(`${derniereSeance.date}T08:30:00Z`).toISOString(),
      date: derniereSeance.date,
      duration_min: Math.max(1, duree),
      distance_m: Math.round(duree * rand(150, 190)), // ~allure d'endurance
      avg_heart_rate: rand(140, 165),
    });
  }
  if (activites.length > 0) {
    verifier("activités", await admin.from("activities").insert(activites));
  }

  console.log("→ Notifications…");
  await admin.from("notifications").delete().in("recipient_id", allIds);
  verifier(
    "notifications",
    await admin.from("notifications").insert([
      {
        recipient_id: coachId,
        type: "session_completed",
        title: `${ATHLETES[0].name} a terminé une séance`,
        body: "Sortie longue — RPE 6",
        link: `/athletes/${athleteIds[0]}`,
      },
      {
        recipient_id: athleteIds[4],
        type: "session_planned",
        title: "Nouvelle séance planifiée",
        body: "Ton planning de la semaine est prêt",
        link: "/",
      },
    ])
  );

  console.log("→ Messages…");
  const t = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
  verifier(
    "messages",
    await admin.from("messages").insert([
      { sender_id: coachId, recipient_id: athleteIds[0], content: "Bien récupéré de la sortie longue ?", created_at: t(180), read_at: t(150) },
      { sender_id: athleteIds[0], recipient_id: coachId, content: "Oui nickel ! Un peu de raideur aux mollets mais rien de méchant.", created_at: t(140), read_at: t(120) },
      { sender_id: coachId, recipient_id: athleteIds[1], content: "Je te sens un peu chargé cette semaine, on allège le week-end ?", created_at: t(200) },
      { sender_id: athleteIds[1], recipient_id: coachId, content: "Je me sens vraiment cramé, ça me va bien.", created_at: t(30) },
      { sender_id: athleteIds[2], recipient_id: coachId, content: "Désolée, semaine chargée au boulot, j'ai dû sauter deux séances.", created_at: t(90) },
      { sender_id: coachId, recipient_id: athleteIds[2], content: "Pas de souci, on reprend doucement dès que tu peux.", created_at: t(60) },
    ])
  );

  console.log("\n✔ Données de démo prêtes. Mot de passe (tous les comptes) : " + PASSWORD);
  console.log(`   Coach   : ${COACH.email} (${COACH.name})`);
  for (const a of ATHLETES) console.log(`   Athlète : ${a.email} (${a.name})`);
}

main().catch((e) => {
  console.error("Échec de la démo :", e.message ?? e);
  process.exit(1);
});
