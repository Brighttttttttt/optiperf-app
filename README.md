# Optiperf

[![CI](https://github.com/Brighttttttttt/optiperf-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Brighttttttttt/optiperf-app/actions/workflows/ci.yml)

Web app mobile-first de suivi d'entraînement entre **coach** et **athlètes** — planification de séances, saisie du réalisé (RPE, durée, analyse), métriques de charge, messagerie temps réel et notifications. Une seule app : l'interface s'adapte au rôle du compte connecté.

**Stack** : Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, Realtime, RLS) · Vercel

**Démo en production** : https://optiperf-app.vercel.app

## Mise en route

### 1. Créer le projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (offre gratuite suffisante).
2. Dashboard → **SQL Editor** → exécute les migrations de [`supabase/migrations/`](supabase/migrations/) **dans l'ordre numérique** (coller le contenu → **Run**) :
   - `001_init.sql` — tables, sécurité (RLS), triggers de notifications, temps réel
   - `002_hardening.sql` — limites de longueur, séparation prescription/compte rendu, suppression de compte
   - `003_session_templates.sql` — modèles de séances réutilisables
   - `004_codes_et_debit.sql` — codes d'invitation à 10 caractères, limite de débit sur les messages
3. Dashboard → **Authentication → URL Configuration** :
   - **Site URL** : l'URL publique de l'app (ex. `https://optiperf-app.vercel.app`) — jamais `localhost`, sinon les liens des emails de confirmation sont inutilisables pour tes utilisateurs.
   - **Redirect URLs** : ajoute `https://<ton-domaine>/**` et, pour développer en local, `http://localhost:3000/**`.

   La confirmation par email peut rester activée : l'app fournit la route d'atterrissage `/auth/callback` qui ouvre la session.

### 2. Configurer l'app

```bash
cp .env.example .env.local
```

Remplis `.env.local`. Le plus rapide : bouton **Connect** en haut du dashboard → onglet **App Frameworks** → **Next.js**, qui affiche le bloc tout prêt.

- `NEXT_PUBLIC_SUPABASE_URL` — l'URL du projet
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — la clé publique, destinée au navigateur
- `SUPABASE_SECRET_KEY` — la clé secrète (ex-`service_role`), uniquement pour le seed : jamais côté client, jamais sur Vercel

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
3. Dans **Environment Variables**, ajoute `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (⚠️ pas la clé secrète).
4. **Deploy** — l'app est en ligne et partageable.

## Qualité et workflow

Le projet suit le **GitHub Flow** : jamais de commit direct sur `master`. Branche → pull request → CI verte → merge (squash). La protection de branche impose une PR et le passage de la CI ; Vercel déploie une préversion par PR et la production au merge.

La CI (GitHub Actions) enchaîne : lint, typecheck, tests unitaires, build, tests e2e. En local :

```bash
npm run lint        # ESLint
npm run typecheck   # types de routes + tsc
npm test            # tests unitaires (Vitest) — métriques, dates, RPE
npm run test:e2e    # e2e de fumée (Playwright, viewport mobile) — build requis avant
npm run smoke       # test de fumée contre la production déployée
```

Un second workflow rejoue le test de fumée sur l'URL de production après chaque déploiement Vercel : il couvre ce que les tests locaux ne voient pas (routage et cache du CDN).

Dependabot propose chaque semaine les mises à jour npm et GitHub Actions.

## Fonctionnement

- **Coach** : dashboard avec une carte par athlète (volume 7 j, adhérence, RPE moyen, charge, état de forme), fiche athlète (objectifs, planning, historique), messagerie, notifications. Les athlètes rejoignent le groupe avec le **code coach** (visible dans Réglages).
- **Installable** : depuis Safari ou Chrome, « Ajouter à l'écran d'accueil » pose l'icône Optiperf sur le téléphone ; l'app s'ouvre alors en plein écran, sans barre d'adresse.
- **Planification groupée** : un écran unique où le coach décrit la séance une fois, coche plusieurs athlètes et plusieurs dates, et crée tout en un envoi. Les séances récurrentes se gardent en **modèles** réutilisables ; une séance déjà planifiée se **duplique** en un tap.
- **Athlète** : séances à venir, saisie du réalisé avec la rampe RPE 1–10, séances libres, historique, messagerie avec son coach.
- **Métriques** ([`src/lib/metrics.ts`](src/lib/metrics.ts)) : charge = RPE × durée (session-RPE, Foster) ; état de forme = ratio charge aiguë (7 j) / chronique (28 j).
- **Sécurité** : Row Level Security sur toutes les tables — un athlète ne voit que ses données, un coach uniquement celles de ses athlètes liés. En-têtes HTTP durcis (CSP, anti-clickjacking, HSTS) définis dans `next.config.ts`.

## Structure

```
supabase/migrations/   Schéma SQL (tables, RLS, triggers, RPC)
scripts/seed.mjs       Données de démo
src/proxy.ts           Protection des routes (session Supabase)
src/lib/               Clients Supabase, métriques, types, dates (+ tests unitaires)
src/app/(auth)/        Connexion / inscription
src/app/(app)/         Pages authentifiées (dashboard, séances, messages…)
src/components/        UI (rampe RPE, cartes athlètes, fil de discussion…)
e2e/                   Tests e2e Playwright
.github/               CI (workflows) et Dependabot
```
