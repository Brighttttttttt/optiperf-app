@AGENTS.md

# Optiperf — instructions projet

App mobile-first de suivi d'entraînement coach ↔ athlète. Toute l'interface est en **français**. Thème « carnet d'entraînement » : tokens dans `src/app/globals.css`, signature visuelle = rampe RPE colorée (`src/lib/rpe.ts`).

## Commandes

- `npm run dev` — serveur de dev
- `npm test` — tests unitaires Vitest (`src/lib/*.test.ts`)
- `npm run test:e2e` — e2e Playwright (faire `npm run build` avant)
- `npm run lint` et `npm run typecheck` — exigés par la CI
- `npm run smoke` — test de fumée contre la production déployée (routage CDN, en-têtes, POST des server actions) ; rejoué automatiquement après chaque déploiement
- `npm run seed` — données de démo (demande `SUPABASE_SECRET_KEY` dans `.env.local`)

## Architecture

- Next.js 16 App Router + Supabase (Postgres, Auth, Realtime, RLS). Le schéma et les politiques RLS vivent dans `supabase/migrations/` — toute évolution de schéma = nouveau fichier de migration numéroté, appliqué dans l'éditeur SQL Supabase.
- `src/lib/supabase/middleware.ts` est fragile par nature. Trois règles, chacune née d'un bug réel (couvertes par `e2e/session.spec.ts`) :
  1. ne rien insérer entre `createServerClient` et `getUser()` ;
  2. **toute réponse de redirection doit propager les cookies** de `supabaseResponse`, sinon la rotation du jeton se perd → boucle de redirections (visible surtout sur Safari) ;
  3. un compte authentifié **sans ligne dans `profiles`** doit être déconnecté, sinon le layout `(app)` (→ `/login`) et le proxy (→ `/`) se renvoient la balle à l'infini.
- `src/proxy.ts` protège les routes ; clients Supabase dans `src/lib/supabase/` (browser, server, middleware).
- Métriques d'entraînement (charge session-RPE de Foster, état ACWR) : fonctions pures dans `src/lib/metrics.ts`, couvertes par les tests — les modifier avec leurs tests.
- Dates : toujours passer par `src/lib/dates.ts` — le fuseau Europe/Paris y est forcé car Vercel tourne en UTC. Ne jamais formater une date « à la main » côté serveur.
- Mutations : actions serveur dans `src/app/(auth)/actions.ts` et `src/app/(app)/actions.ts`.
- Liens d'email (confirmation, mot de passe) : l'inscription passe `emailRedirectTo` calculé depuis l'origine servie. `src/app/auth/callback/route.ts` traite les formes lisibles côté serveur (`?code=`, `?token_hash=`), puis relaie vers `src/app/auth/finaliser/page.tsx` pour le flux implicite, où les jetons arrivent dans le **fragment** (`#access_token=…`) que le navigateur n'envoie jamais au serveur. Tout `/auth/*` est public dans le proxy, sinon la confirmation serait interrompue avant de s'exécuter.

## Workflow

GitHub Flow, protégé par ruleset : jamais de push direct sur `master`. Branche → PR → CI verte (lint, typecheck, unitaires, build, e2e) → merge squash. Vercel déploie une préversion par PR et la prod au merge.

## Sécurité

- RLS sur toutes les tables ; les tests d'isolation comptent.
- Séparation stricte prescription / compte rendu sur `sessions`, imposée par le trigger `enforce_session_ownership` (migration 002) : le coach ne modifie ni RPE, ni durée réelle, ni commentaire, ni statut ; l'athlète ne modifie pas la consigne d'une séance prescrite. Toute nouvelle colonne de `sessions` doit être classée d'un côté ou de l'autre dans ce trigger.
- Les limites de longueur sont doublées : contraintes SQL (migration 002) et constante `LIMITS` dans `src/lib/types.ts`, utilisée par les actions serveur et les `maxLength` des formulaires. Garder les deux synchronisées.
- En-têtes de sécurité (dont la CSP) dans `src/lib/security-headers.ts`, appliqués par le proxy et vérifiés par `e2e/headers.spec.ts`. Toute nouvelle origine appelée par le navigateur (analytics, CDN, stockage Supabase…) doit être ajoutée à la directive correspondante, sinon elle sera bloquée en production.
- Sur Vercel, un POST **sans** en-tête `Next-Action` vers une page prérendue (`/login`, `/signup`) répond 405 : c'est le CDN qui sert la page, comportement normal et non un bug. Les server actions du navigateur envoient cet en-tête et atteignent bien la fonction.
- `SUPABASE_SECRET_KEY` ne sert qu'aux scripts locaux (seed) — jamais côté client, jamais sur Vercel, jamais commitée (`.env.local` est ignoré par git).
