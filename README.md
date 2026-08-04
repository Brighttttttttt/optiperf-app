# Optiperf

Web app mobile-first de suivi d'entraînement entre **coach** et **athlètes** — planification de séances, saisie du réalisé (RPE, durée, analyse), métriques de charge, messagerie temps réel et notifications. Une seule app : l'interface s'adapte au rôle du compte connecté.

**Stack** : Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, Realtime, RLS) · Vercel

## Mise en route

### 1. Créer le projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (offre gratuite suffisante).
2. Dashboard → **SQL Editor** → colle le contenu de [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) → **Run**. Cela crée les tables, la sécurité (RLS), les triggers de notifications et le temps réel.
3. Dashboard → **Authentication → Sign In / Up → Email** : désactive **Confirm email** (pour le MVP, l'inscription connecte directement ; tu pourras le réactiver plus tard).

### 2. Configurer l'app

```bash
cp .env.example .env.local
```

Remplis `.env.local` avec les valeurs de **Project Settings → API** :

- `NEXT_PUBLIC_SUPABASE_URL` — l'URL du projet
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — la clé publique (« anon » ou « publishable »)
- `SUPABASE_SERVICE_ROLE_KEY` — la clé secrète, uniquement pour le seed (jamais côté client, jamais sur Vercel)

### 3. Lancer

```bash
npm install
npm run dev
```

L'app tourne sur http://localhost:3000.

### 4. (Optionnel) Données de démo

```bash
npm run seed
```

Crée 1 coach + 3 athlètes avec 5 semaines d'historique contrasté (mot de passe : `optiperf-demo`) :

| Compte | Rôle | Profil |
|---|---|---|
| `coach@example.com` | Coach | Camille Dupont |
| `lea@example.com` | Athlète | Assidue, en forme |
| `nino@example.com` | Athlète | Surcharge récente → « Fatigué » |
| `sofia@example.com` | Athlète | Décrochage → adhérence faible |

## Déploiement sur Vercel

1. Pousse le repo sur GitHub.
2. [vercel.com](https://vercel.com) → **New Project** → importe le repo (framework détecté : Next.js, rien à changer).
3. Dans **Environment Variables**, ajoute `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` (⚠️ pas la clé service_role).
4. **Deploy** — l'app est en ligne et partageable.

## Fonctionnement

- **Coach** : dashboard avec une carte par athlète (volume 7 j, adhérence, RPE moyen, charge, état de forme), fiche athlète (objectifs, planning, historique), planification de séances, messagerie, notifications. Les athlètes rejoignent le groupe avec le **code coach** (visible dans Réglages).
- **Athlète** : séances à venir, saisie du réalisé avec la rampe RPE 1–10, séances libres, historique, messagerie avec son coach.
- **Métriques** ([`src/lib/metrics.ts`](src/lib/metrics.ts)) : charge = RPE × durée (session-RPE, Foster) ; état de forme = ratio charge aiguë (7 j) / chronique (28 j).
- **Sécurité** : Row Level Security sur toutes les tables — un athlète ne voit que ses données, un coach uniquement celles de ses athlètes liés.

## Structure

```
supabase/migrations/   Schéma SQL (tables, RLS, triggers, RPC)
scripts/seed.mjs       Données de démo
src/proxy.ts           Protection des routes (session Supabase)
src/lib/               Clients Supabase, métriques, types, dates
src/app/(auth)/        Connexion / inscription
src/app/(app)/         Pages authentifiées (dashboard, séances, messages…)
src/components/        UI (rampe RPE, cartes athlètes, fil de discussion…)
```
