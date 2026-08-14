# Optiperf

[![CI](https://github.com/Brighttttttttt/optiperf-app/actions/workflows/ci.yml/badge.svg)](https://github.com/Brighttttttttt/optiperf-app/actions/workflows/ci.yml)

Web app mobile-first de suivi d'entraînement entre **coach** et **athlètes** — planification de séances, saisie du réalisé (RPE, durée, analyse), métriques de charge, messagerie temps réel et notifications. Une seule app : l'interface s'adapte au rôle du compte connecté.

**Stack** : Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres, Auth, Realtime, RLS) · Vercel

**Démo en production** : https://optiperf-app.vercel.app

📚 **[Toute la documentation](docs/)** — cinq documents, rangés par ce qu'ils
servent à faire. En raccourci :

- 📐 [Comment le projet est fait](docs/architecture.md) — architecture, workflow
  et rôle de chaque famille de tests, en cinq minutes.
- ✨ [Ce que fait Optiperf](docs/fonctionnalites.md) — le catalogue des
  fonctionnalités livrées, et ce qui manque encore.
- 🗺️ [Les pages et leurs enchaînements](docs/parcours.md) — qui accède à quoi,
  et par où l'on passe.
- 🗄️ [Le modèle de données](docs/donnees.md) — chaque table, qui la lit, qui
  l'écrit.
- 🔧 [Guides pratiques](docs/guides.md) — poser une migration, revenir en
  arrière après un mauvais déploiement, ajouter une table.
- 🤝 [Conventions de travail](CONTRIBUTING.md) — branches, pull requests,
  issues, migrations.

## Mise en route

### 1. Créer le projet Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (offre gratuite suffisante).
2. Dashboard → **SQL Editor** → exécute les migrations de [`supabase/migrations/`](supabase/migrations/) **dans l'ordre numérique** (coller le contenu → **Run**) :
   - `001_init.sql` — tables, sécurité (RLS), triggers de notifications, temps réel
   - `002_hardening.sql` — limites de longueur, séparation prescription/compte rendu, suppression de compte
   - `003_session_templates.sql` — modèles de séances réutilisables
   - `004_codes_et_debit.sql` — codes d'invitation à 10 caractères, limite de débit sur les messages
   - `005_rappel_planification.sql` — rappel hebdomadaire au coach (nécessite l'extension `pg_cron`)
   - `006_droits_explicites.sql` — droits du rôle d'administration, pour qu'une base se reconstruise depuis le dépôt seul
   - `007_activites_importees.sql` — activités importées d'une montre, reliées facultativement à une séance
   - `008_notification_messages.sql` — notification à la réception d'un message
   - `009_traces_activites.sql` — trace FC/allure/altitude d'une activité importée
   - `010_zones_fc.sql` — FC max/repos de l'athlète, base du calcul des zones de fréquence cardiaque
   - `011_blocs_seance.sql` — structure d'une séance running (échauffement, intervalle, récupération, retour au calme)
   - `012_records_vma.sql` — records personnels par distance standard et VMA de l'athlète
   - `013_musculation.sql` — exercices prescrits et compte rendu d'une séance de musculation
   - `014_coach_qui_sentraine.sql` — un coach peut aussi s'entraîner, et rejoindre un autre coach
   - `015_note_du_coach.sql` — note libre du coach sur un athlète, que l'athlète ne voit pas
   - `016_tours_activite.sql` — les tours d'une activité importée (FIT et TCX), base de l'analyse de séance
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

Deux scripts, deux usages — ils ne se remplacent pas l'un l'autre.

```bash
npm run seed   # pour faire tourner les tests connectés
npm run demo   # pour parcourir l'app soi-même
```

**`npm run seed`** crée 1 coach + 3 athlètes avec 5 semaines d'historique contrasté (mot de passe : `optiperf-demo`). Ces noms et emails sont **lus en dur** par `e2e-auth/*.spec.ts` : les changer casse les tests connectés.

**`npm run demo`** crée un groupe plus fourni (1 coach + 5 athlètes) destiné à visiter l'app comme un utilisateur. C'est lui qui peuple la démo en ligne. Relançable : il remplace les données des comptes de démo, jamais celles d'un autre compte.

Les deux ciblent la base pointée par `.env.local` et demandent `SUPABASE_SECRET_KEY`. Comptes du `seed` :

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

Le projet suit le **GitHub Flow** : jamais de commit direct sur `master`. Branche → pull request → CI verte → merge (squash). La protection de branche impose une PR et le passage de la CI ; Vercel déploie une préversion par PR et la production au merge. Conventions détaillées : [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
npm run lint          # ESLint
npm run typecheck     # types de routes + tsc
npm test              # tests unitaires (Vitest) — métriques, dates, planning, RPE
npm run test:e2e      # e2e de fumée (Playwright, viewport mobile) — build requis avant
npm run test:e2e:auth # parcours connectés — nécessite une base Supabase accessible
npm run test:e2e:bureau # les mêmes vues en largeur d'ordinateur (1440 × 900)
npm run smoke         # test de fumée contre la production déployée
npm run test:prod     # contrôle d'affichage dans un vrai navigateur, contre la production
```

Six familles de tests, chacune voyant ce que les autres ne peuvent pas voir — le détail de ce que chacune attrape est dans [docs/architecture.md](docs/architecture.md#les-tests--six-étages-six-métiers-différents). En résumé :

- les **parcours connectés** (`e2e-auth/`) sont les seuls à vérifier qu'une page authentifiée **affiche réellement son contenu**. En CI, ils tournent contre une base Supabase démarrée par la CLI, qui applique les migrations du dépôt — ce qui les valide au passage. En local, il faut Docker et `supabase start` ;
- les **vues en largeur bureau** (`e2e-bureau/`) sont les seules à voir une régression de mise en page à la souris — tout le reste tourne en viewport de téléphone ;
- le **contrôle d'affichage en production** (`e2e-prod/`) est le seul dispositif capable de voir qu'une page répond correctement tout en n'affichant rien.

Deux workflows : la CI à chaque pull request, et un contrôle après chaque déploiement de production (fumée + affichage dans un vrai navigateur), qui couvre ce que les tests locaux ne voient pas.

Dependabot propose chaque semaine les mises à jour npm et GitHub Actions.

## Fonctionnement

- **Coach** : dashboard avec une carte par athlète (volume 7 j, adhérence, RPE moyen, charge, état de forme), fiche athlète (objectifs, planning, historique, **note libre visible du coach seul**), messagerie, notifications. Les athlètes rejoignent le groupe avec le **code coach** (visible dans Réglages).
- **Installable** : depuis Safari ou Chrome, « Ajouter à l'écran d'accueil » pose l'icône Optiperf sur le téléphone ; l'app s'ouvre alors en plein écran, sans barre d'adresse.
- **Planification groupée** : un écran unique où le coach décrit la séance une fois, coche plusieurs athlètes et plusieurs dates, et crée tout en un envoi. Les séances récurrentes se gardent en **modèles** réutilisables ; une séance déjà planifiée se **duplique** en un tap.
- **Athlète** : séances à venir, saisie du réalisé avec la rampe RPE 1–10, séances libres, historique, messagerie avec son coach.
- **Un coach s'entraîne aussi** : une bascule « Je coache / Je m'entraîne » en haut de l'écran ouvre son propre entraînement — ses séances, son RPE, ses imports, sa charge — sans changer de compte. Il peut même rejoindre un autre coach avec un code d'invitation.
- **Vue semaine, des deux côtés** : le coach depuis la fiche athlète, l'athlète depuis son onglet **Planning**. Chaque jour ouvre le détail de ses séances — état (fait, manquée, à rattraper, à venir) et contenu (blocs de fractionné, exercices de musculation) lisibles sans avoir à ouvrir la séance. Le coach y déplace une séance encore à venir d'un jour à l'autre, en la glissant sur la grille ou avec les flèches du clavier.
- **Import depuis la montre** : l'athlète dépose le fichier exporté de sa montre (GPX ou TCX), l'app en tire la date, la durée, la distance et la fréquence cardiaque, propose de le rattacher à une séance du même jour — et ne demande plus que le **RPE**, la seule chose qu'aucune montre ne mesure. Le fichier est lu par le navigateur : rien ne transite hors ce qui s'affiche à l'écran. Un même fichier déposé deux fois est refusé.
- **Rappel du dimanche** : chaque dimanche soir, le coach reçoit une notification nommant les athlètes sans séance prévue pour la semaine qui commence — et rien du tout si tout est planifié. La tâche vit dans la base (`pg_cron`), pas côté hébergeur : aucune clé secrète à déployer, aucune URL à protéger.
- **Évolution** : charge et volume semaine par semaine sur 12 semaines, avec la moyenne des 4 dernières en repère — une barre nettement au-dessus signale une montée de charge trop rapide. Visible par le coach sur la fiche athlète, et par l'athlète dans son historique.
- **Métriques** ([`src/lib/metrics.ts`](src/lib/metrics.ts)) : charge = RPE × durée (session-RPE, Foster) ; état de forme = ratio charge aiguë (7 j) / chronique (28 j).
- **Sécurité** : Row Level Security sur toutes les tables — un athlète ne voit que ses données, un coach uniquement celles de ses athlètes liés. En-têtes HTTP durcis (CSP, anti-clickjacking, HSTS) définis dans [`src/lib/security-headers.ts`](src/lib/security-headers.ts) et posés par le proxy.

## Structure

```
supabase/migrations/   Schéma SQL (tables, RLS, triggers, RPC, tâche pg_cron)
scripts/               Données de démo (seed.mjs) et fumée production (smoke-prod.mjs)
src/proxy.ts           Protection des routes et en-têtes de sécurité
src/lib/               Clients Supabase, métriques, planning, types, dates (+ tests unitaires)
src/app/(auth)/        Connexion / inscription
src/app/(app)/         Pages authentifiées (dashboard, séances, messages…)
src/app/auth/          Retour des liens d'email (confirmation, mot de passe)
src/components/        UI (rampe RPE, cartes athlètes, fil de discussion…)
e2e/                   Tests de fumée, sans base
e2e-auth/              Parcours connectés contre une vraie base
e2e-prod/              Contrôle d'affichage contre la production déployée
docs/                  Vue d'ensemble du projet
.github/               CI, contrôle après déploiement, modèles d'issues et de PR
vercel.json            Région d'exécution (cdg1, à côté de la base)
```
