# Comment Optiperf est fait

Vue d'ensemble, volontairement simple. Les détails et les pièges vivent dans
[CLAUDE.md](../CLAUDE.md) ; les conventions de travail dans
[CONTRIBUTING.md](../CONTRIBUTING.md).

Ce document explique **pourquoi** le projet est fait ainsi. Pour ce qui existe
et où, va aux références : [fonctionnalites.md](fonctionnalites.md),
[parcours.md](parcours.md), [donnees.md](donnees.md). Pour les gestes courants,
[guides.md](guides.md). L'index complet est dans [docs/](README.md).

## En une phrase

Une app web mobile-first où un coach planifie des séances et où ses athlètes
notent ce qu'ils ont réellement fait — une seule application, dont l'interface
change selon le rôle du compte connecté.

## Les quatre briques

```mermaid
flowchart LR
    N["Navigateur<br/>(téléphone)"] --> V["Vercel<br/>région cdg1 — Paris"]
    V --> S["Supabase<br/>Postgres · Auth · Realtime"]
    G["GitHub<br/>code + CI"] -.->|déploie| V
    N -.->|temps réel| S
```

| Brique | Rôle |
|---|---|
| **Next.js** (sur Vercel) | Fabrique les pages, exécute les mutations, protège les routes. |
| **Supabase** | La base de données, les comptes, le temps réel — et **la sécurité**. |
| **Vercel** | Héberge et déploie. Configuré pour tourner à Paris, à côté de la base. |
| **GitHub** | Le code, et la CI qui vérifie chaque modification avant qu'elle parte. |

Il n'y a **pas de serveur d'API séparé** : Next.js parle directement à Supabase.

## Le trajet d'une page

1. **Le proxy** ([src/proxy.ts](../src/proxy.ts)) intercepte la requête, vérifie
   la session et pose les en-têtes de sécurité. Pas de session sur une page
   protégée → redirection vers `/login`.
2. **La page** (un composant serveur) demande ses données à Supabase et renvoie
   du HTML déjà rempli.
3. **Une action** (bouton « Enregistrer ») rappelle le serveur, qui écrit dans
   Supabase et rafraîchit la page.

## La sécurité vit dans la base, pas dans le code

C'est le choix structurant du projet. Postgres refuse lui-même les lectures et
les écritures interdites, via la **RLS** (Row Level Security) : un athlète ne
voit que ses données, un coach uniquement celles de ses athlètes liés.

Conséquence : un bug dans une page ne peut pas faire fuiter les données d'un
autre utilisateur. Et toute évolution du schéma passe par un fichier SQL
numéroté dans [supabase/migrations/](../supabase/migrations/) — jamais par une
modification à la main dans le dashboard.

## Où vit quoi

```
supabase/migrations/   Le schéma et la sécurité (SQL numéroté, appliqué à la main)
src/proxy.ts           Le gardien : session + en-têtes de sécurité
src/app/(auth)/        Connexion, inscription
src/app/(app)/         Toutes les pages qui demandent d'être connecté
src/app/auth/          Retour des liens d'email (confirmation, mot de passe)
src/lib/               Le cerveau : métriques, dates, planning, clients Supabase
src/components/        L'interface
scripts/               Données de démo (seed) et test de fumée production
e2e/ e2e-auth/ e2e-prod/   Les trois familles de tests de bout en bout
.github/workflows/     La CI et le contrôle après déploiement
```

Règle utile : **tout ce qui calcule vit dans `src/lib/`** (et y est testé), tout
ce qui affiche vit dans `src/components/`.

## Le workflow, de l'idée au déploiement

```mermaid
flowchart LR
    I["Issue"] --> B["Branche"] --> P["Pull request"]
    P --> C["CI verte"] --> M["Merge squash"] --> D["Prod + contrôle après déploiement"]
    P -.-> V["Préversion Vercel"]
```

1. **Une issue** décrit le besoin ou le défaut.
2. **Une branche** par sujet — jamais de commit direct sur `master`, la
   protection GitHub le refuse.
3. **Une pull request** ouvre la discussion. Vercel en déploie une préversion
   à part, avec sa propre URL.
4. **La CI doit être verte** pour pouvoir fusionner.
5. **Merge squash** : la PR devient **un seul commit** sur `master`. Son message
   est le titre + la description de la PR — c'est pour ça qu'on les soigne, et
   pourquoi ce sont les seuls textes du projet écrits en **anglais**, au format
   Conventional Commits (voir [CONTRIBUTING.md](../CONTRIBUTING.md)).
6. **Vercel déploie la production**, puis un second workflow va vérifier le site
   réellement en ligne.

## Les tests : six étages, six métiers différents

Chaque étage voit ce que le précédent ne peut pas voir. C'est pour ça qu'ils
existent tous.

| Étage | Commande | Ce que c'est | Ce qu'il attrape | Son angle mort |
|---|---|---|---|---|
| **Unitaires** | `npm test` | Vérifie les fonctions de calcul isolément (charge, dates, semaines, RPE). Instantané. | Une formule fausse, un décalage de fuseau. | Ne sait rien de l'app réelle. |
| **Fumée** | `npm run test:e2e` | Un vrai navigateur, **sans base**. Redirections, en-têtes, pages publiques, installation sur l'écran d'accueil. | Une route qui ne protège plus, une CSP cassée. | Ne voit aucune page connectée. |
| **Connectés** | `npm run test:e2e:auth` | Un vrai navigateur **avec de vrais comptes**, contre une vraie base. Les seuls qui vérifient qu'une page connectée **affiche son contenu**. | Une page vide, une donnée manquante, un athlète qui verrait les données d'un autre. | Trop rapide en local pour reproduire certains défauts d'affichage. |
| **Largeur bureau** | `npm run test:e2e:bureau` | Les mêmes comptes et la même base que les connectés, mais en 1440 × 900. | Une mise en page qui casse à la souris : navigation, grilles, débordement horizontal. | Ne teste que la largeur, pas la logique. |
| **Fumée production** | `npm run smoke` | Interroge le **site en ligne** sans navigateur : routage du CDN, en-têtes, réponses attendues. | Un problème apparu seulement une fois déployé. | Regarde les réponses, pas l'écran. |
| **Affichage production** | `npm run test:prod` | Un vrai navigateur contre le **site en ligne**, connecté au compte de démo. | Le cas où une page **répond correctement mais n'affiche rien** — le mode de panne de l'incident #44. | Ne tourne qu'après déploiement. |

**Quand ça tourne tout seul :** les quatre premiers étages à chaque pull request
(GitHub Actions) ; les deux derniers automatiquement après chaque déploiement
de production.

**Pourquoi six et pas trois** : un incident a traversé une CI entièrement verte
parce qu'aucun test n'ouvrait une page **avec une session**, et parce qu'aucun
ne regardait le site **réellement déployé**. Les étages « connectés » et
« affichage production » sont nés de là. Le sixième, « largeur bureau », est né
d'un constat plus simple : toute la suite tournait en viewport de téléphone,
donc rien n'aurait signalé une régression sur l'écran où le coach planifie.

## Les trois automatismes de la CI

- **À chaque pull request** ([ci.yml](../.github/workflows/ci.yml)) : lint,
  types, tests unitaires, build, tests de fumée — puis un second travail qui
  démarre une base Supabase neuve, y applique **les migrations du dépôt** et
  joue les parcours connectés. Ce second travail garantit que le dépôt seul
  suffit à reconstruire une base qui marche.
- **Sur chaque préversion** ([preview.yml](../.github/workflows/preview.yml)) :
  le contrôle d'affichage, joué contre la préversion Vercel de la pull request.
  C'est le même dispositif que celui d'après déploiement, mais **avant** la mise
  en ligne — là où un défaut ne coûte aucun incident. Il demande le secret
  `VERCEL_AUTOMATION_BYPASS_SECRET` (voir plus bas) ; sans lui, le contrôle est
  sauté avec un avertissement plutôt que de rendre un vert qui ne veut rien dire.
- **Après chaque déploiement de production**
  ([smoke-prod.yml](../.github/workflows/smoke-prod.yml)) : fumée production
  puis contrôle d'affichage dans un vrai navigateur. En cas d'échec, une issue
  `incident` est ouverte automatiquement — une seule à la fois, tant qu'elle
  n'est pas refermée.

## Le seul geste manuel qui reste

Les migrations SQL sont appliquées **à la main** en production, dans le SQL
Editor de Supabase, dans l'ordre numérique. La CI vérifie qu'elles sont valides
sur une base neuve — elle ne peut pas les poser à votre place.

En revanche, une migration oubliée ne passe plus inaperçue : `npm run smoke`
compare les tables déclarées dans `supabase/migrations/` à celles réellement
présentes en base, et met le contrôle de production au rouge si l'une manque.
La portée est celle des migrations qui **créent une table** ; un ajout de
colonne ou de politique lui échappe encore.

## Retour arrière

À faire quand la production est inutilisable — pas quand un détail cloche, où
un correctif en avant vaut mieux.

1. Ouvrir [le tableau de bord Vercel](https://vercel.com) → projet
   **optiperf-app** → onglet **Deployments**.
2. Repérer le dernier déploiement de production **antérieur** à celui qui pose
   problème, et vérifier à son horodatage que c'est bien le bon.
3. Menu `⋯` de cette ligne → **Promote to Production**. La bascule prend
   quelques secondes, sans reconstruction : le résultat est déjà bâti.
4. Vérifier : `npm run smoke` en local, ou relancer le workflow « Smoke
   production » à la main (`workflow_dispatch`).

**Ce que le retour arrière ne défait pas :** les migrations SQL. Elles ne sont
pas versionnées avec le code, et revenir à un déploiement antérieur laisse la
base telle qu'elle est. Une migration qui a cassé la production se répare par
une **nouvelle** migration qui l'annule, jamais en promouvant l'ancien code.

Ensuite seulement, comprendre : la branche `master` porte encore le code fautif,
et un déploiement ultérieur le remettrait en ligne. Corriger ou révoquer
(`git revert`) avant de laisser repartir la chaîne.

## Ce qu'il faut configurer une fois

| Secret / variable | Où | À quoi ça sert |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Variables du dépôt GitHub | Laissent les contrôles de production se connecter au compte de démonstration. Publiques par nature. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Secret du dépôt GitHub | Traverse le SSO qui protège les préversions. À copier depuis Vercel → projet → Settings → **Deployment Protection** → *Protection Bypass for Automation*. Sans lui, le contrôle de préversion se saute. |
| `NEXT_PUBLIC_STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `PROVIDER_TOKEN_KEY` | Variables d'environnement Vercel | La connexion Strava (#105). Voir `.env.example`. |
