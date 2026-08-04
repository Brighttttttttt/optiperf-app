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
    user_metadata: { full_name: fullName, role },
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

async function main() {
  console.log("→ Création des comptes…");
  const coachId = await ensureUser("coach@example.com", "Camille Dupont", "coach");
  const athleteIds = [];
  for (const a of ATHLETES) {
    athleteIds.push(await ensureUser(a.email, a.name, a.role ?? "athlete"));
  }
  const allIds = [coachId, ...athleteIds];

  console.log("→ Nettoyage des anciennes données de démo…");
  await admin.from("messages").delete().in("sender_id", allIds);
  await admin.from("notifications").delete().in("recipient_id", allIds);
  await admin.from("sessions").delete().in("athlete_id", athleteIds);
  await admin.from("objectives").delete().in("athlete_id", athleteIds);

  console.log("→ Liaison coach ↔ athlètes…");
  for (const id of athleteIds) {
    await admin
      .from("coach_athletes")
      .upsert({ coach_id: coachId, athlete_id: id }, { onConflict: "athlete_id" });
  }

  console.log("→ Objectifs…");
  const now = new Date();
  for (let i = 0; i < ATHLETES.length; i++) {
    const a = ATHLETES[i];
    await admin.from("objectives").insert({
      athlete_id: athleteIds[i],
      title: a.objective.title,
      target_date: toISO(addDays(now, a.objective.inDays)),
    });
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
  const { error: sessErr } = await admin.from("sessions").insert(sessions);
  if (sessErr) throw sessErr;

  // Les triggers ont généré une notification par insertion : on repart
  // d'une liste courte et crédible.
  console.log("→ Notifications…");
  await admin.from("notifications").delete().in("recipient_id", allIds);
  await admin.from("notifications").insert([
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
  ]);

  console.log("→ Messages…");
  const t = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
  await admin.from("messages").insert([
    { sender_id: coachId, recipient_id: athleteIds[0], content: "Bien récupéré de la sortie longue ?", created_at: t(180), read_at: t(150) },
    { sender_id: athleteIds[0], recipient_id: coachId, content: "Oui nickel ! Un peu de raideur aux mollets mais rien de méchant.", created_at: t(140), read_at: t(120) },
    { sender_id: coachId, recipient_id: athleteIds[0], content: "Parfait. Pense à bien t'hydrater avant la séance de jeudi 💪", created_at: t(60) },
    { sender_id: athleteIds[1], recipient_id: coachId, content: "Je me sens vraiment cramé cette semaine, on peut alléger ?", created_at: t(30) },
  ]);

  console.log("\n✔ Données de démo prêtes. Comptes (mot de passe : " + PASSWORD + ")");
  console.log("   Coach   : coach@example.com");
  for (const a of ATHLETES) console.log(`   Athlète : ${a.email} (${a.name})`);
}

main().catch((e) => {
  console.error("Échec du seed :", e.message ?? e);
  process.exit(1);
});
