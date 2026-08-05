@AGENTS.md

# Optiperf — instructions projet

App mobile-first de suivi d'entraînement coach ↔ athlète. Toute l'interface est en **français**. Thème « carnet d'entraînement » : tokens dans `src/app/globals.css`, signature visuelle = rampe RPE colorée (`src/lib/rpe.ts`).

## Commandes

- `npm run dev` — serveur de dev
- `npm test` — tests unitaires Vitest (`src/lib/*.test.ts`)
- `npm run test:e2e` — e2e de fumée, sans base (faire `npm run build` avant)
- `npm run test:e2e:auth` — parcours connectés contre une base réelle. **Tout changement touchant au rendu d'une page authentifiée doit être couvert ici** : les tests de fumée ne voient pas si une page affiche son contenu, c'est ainsi qu'un écran d'attente a rendu l'app invisible en production sans qu'aucun test ne réagisse.
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
- Métriques d'entraînement (charge session-RPE de Foster, état ACWR, agrégation hebdomadaire `weeklySeries`) : fonctions pures dans `src/lib/metrics.ts`, couvertes par les tests — les modifier avec leurs tests.
- Graphiques (`TrendCharts`) : SVG écrit à la main, sans dépendance. Une seule teinte porte les données et un neutre porte le repère — l'identité vient de la **forme** (barre contre ligne), car deux verts proches échouent au seuil de distinction en vision normale. Tout graphique doit garder son tableau de chiffres : aucune valeur ne doit être accessible uniquement au survol.
- L'app est installable sur l'écran d'accueil : `src/app/manifest.ts`, icônes générées par `ImageResponse` (`icon.tsx`, `apple-icon.tsx`), métadonnées `appleWebApp` dans le layout. Ces routes **doivent rester hors du matcher du proxy** (`src/proxy.ts`) : le système d'exploitation les récupère sans cookie, et les protéger casserait l'installation. Vérifié par `e2e/installation.spec.ts` et le test de fumée.
- La fiche athlète charge une fenêtre large de séances (±8 semaines) pour que la vue semaine (`WeekPlanner`) navigue sans aller-retour serveur. Les helpers de semaine sont dans `src/lib/planning.ts`, testés.
- Planification : un seul écran, `/planifier` (athlètes × dates en une fois), alimenté par `src/lib/planning.ts` (grille de dates, récapitulatif) et les modèles de `session_templates`. Il n'existe plus de formulaire par athlète — toute nouvelle entrée de planification doit pointer vers `/planifier`, éventuellement avec `?athlete=` ou `?depuis=`.
- Dates : toujours passer par `src/lib/dates.ts` — le fuseau Europe/Paris y est forcé car Vercel tourne en UTC. Ne jamais formater une date « à la main » côté serveur.
- Mutations : actions serveur dans `src/app/(auth)/actions.ts` et `src/app/(app)/actions.ts`.
- Liens d'email (confirmation, mot de passe) : l'inscription passe `emailRedirectTo` calculé depuis l'origine servie. `src/app/auth/callback/route.ts` traite les formes lisibles côté serveur (`?code=`, `?token_hash=`), puis relaie vers `src/app/auth/finaliser/page.tsx` pour le flux implicite, où les jetons arrivent dans le **fragment** (`#access_token=…`) que le navigateur n'envoie jamais au serveur. Tout `/auth/*` est public dans le proxy, sinon la confirmation serait interrompue avant de s'exécuter.

- **Région d'exécution** : `vercel.json` fixe `cdg1` (Paris), à côté de la base Supabase. Sans cela, Vercel exécute les fonctions à Washington et chaque requête traverse l'Atlantique — le dashboard passait de 630 ms à 1 500 ms. Ne pas retirer ce fichier, et vérifier `x-vercel-id` (attendu : `cdg1::cdg1::…`) si des lenteurs réapparaissent.
- L'utilisateur et son profil se lisent via `getSessionUser` / `getSessionProfile` (`src/lib/supabase/session.ts`), mémorisés par `cache()` : ne jamais rappeler `supabase.auth.getUser()` dans une page, la mise en page l'a déjà fait.
- Tâches de fond : elles vivent dans la base via `pg_cron` (migration 005), pas dans un cron d'hébergeur — cela évite d'y déployer la clé secrète et d'exposer une URL à protéger. Le planificateur tourne en UTC : toute tâche à heure locale fixe se déclenche sur les deux heures UTC possibles et vérifie l'heure de Paris à l'intérieur de la fonction.

## Workflow

GitHub Flow, protégé par ruleset : jamais de push direct sur `master`. Branche → PR → CI verte (lint, typecheck, unitaires, build, e2e) → merge squash. Vercel déploie une préversion par PR et la prod au merge.

## Sécurité

- RLS sur toutes les tables ; les tests d'isolation comptent.
- Séparation stricte prescription / compte rendu sur `sessions`, imposée par le trigger `enforce_session_ownership` (migration 002) : le coach ne modifie ni RPE, ni durée réelle, ni commentaire, ni statut ; l'athlète ne modifie pas la consigne d'une séance prescrite. Toute nouvelle colonne de `sessions` doit être classée d'un côté ou de l'autre dans ce trigger.
- Codes d'invitation : 10 caractères tirés d'un alphabet sans signes confondables (`generate_invite_code`, migration 004). Ils se lisent et se retapent à la main — ne pas rallonger sans repenser la saisie.
- Un compte ne peut pas envoyer plus de 20 messages par minute (trigger `enforce_message_rate_limit`). L'erreur remonte jusqu'au fil de discussion : toute nouvelle voie d'écriture doit afficher l'échec plutôt que l'avaler.
- Les limites de longueur sont doublées : contraintes SQL (migration 002) et constante `LIMITS` dans `src/lib/types.ts`, utilisée par les actions serveur et les `maxLength` des formulaires. Garder les deux synchronisées.
- En-têtes de sécurité (dont la CSP) dans `src/lib/security-headers.ts`, appliqués par le proxy et vérifiés par `e2e/headers.spec.ts`. Toute nouvelle origine appelée par le navigateur (analytics, CDN, stockage Supabase…) doit être ajoutée à la directive correspondante, sinon elle sera bloquée en production.
- Sur Vercel, un POST **sans** en-tête `Next-Action` vers une page prérendue (`/login`, `/signup`) répond 405 : c'est le CDN qui sert la page, comportement normal et non un bug. Les server actions du navigateur envoient cet en-tête et atteignent bien la fonction.
- `SUPABASE_SECRET_KEY` ne sert qu'aux scripts locaux (seed) — jamais côté client, jamais sur Vercel, jamais commitée (`.env.local` est ignoré par git).
