# Conventions de travail

**L'app, les issues et le code sont en français ; les commits et les pull
requests sont en anglais**, au format [Conventional
Commits](https://www.conventionalcommits.org/fr/v1.0.0/). Vue d'ensemble du
projet : [docs/architecture.md](docs/architecture.md).

La frontière est nette et datée : tout ce qui précède
[#109](https://github.com/Brighttttttttt/optiperf-app/pull/109) est en français
sans préfixe, tout ce qui suit est en anglais préfixé. Un outil de journal des
changements installé plus tard devra partir de là.

## Le principe

Une PR est fusionnée en **squash** : elle devient **un seul commit** sur
`master`, dont le message est le **titre et la description de la pull request**.

C'est donc la PR qu'on soigne — pas les commits intermédiaires. L'historique de
`master` doit rester lisible dans six mois, quand personne ne se souviendra du
contexte.

## Branches

Une branche par sujet, partant de `master` :

```
planification-groupee
corrige-boucle-redirection-safari
docs-architecture
```

Minuscules, tirets, sans accents. Pas de commit direct sur `master` : la
protection GitHub le refuse.

## Commits

**Ce qui compte, c'est le titre et le corps de la PR.** Les commits sur la
branche peuvent rester bruts (`wip`, `fix test`) — ils disparaissent au squash.

Si tu veux quand même les soigner, même format que les titres de PR ci-dessous.
C'est le **titre de la PR** qui doit être conforme, puisque c'est lui qui
atterrit sur `master`.

## Titres (PR et commit final)

Format : `type(portée): résumé à l'impératif`, **en anglais**, sans point final,
70 caractères maximum. La portée est facultative.

✅ `feat(planning): add a weekly reminder for unplanned athletes`
✅ `fix(auth): keep cookies on redirect responses`
✅ `docs: record why loading.tsx stays out of this app`
❌ `feat: Add reminder.` (majuscule, point final)
❌ `fix stuff`
❌ `Rappel hebdomadaire de planification` (ancienne convention)

| Type | Pour quoi |
|---|---|
| `feat` | Une fonctionnalité que le coach ou l'athlète peut voir |
| `fix` | Un défaut corrigé |
| `perf` | Même comportement, plus rapide — avec la mesure dans la description |
| `refactor` | Ni fonctionnalité ni correctif : la forme change, pas le résultat |
| `test` | Couverture ajoutée ou réparée, sans toucher au code testé |
| `docs` | `README`, `CLAUDE.md`, `docs/`, commentaires |
| `ci` | Workflows GitHub, Playwright, Dependabot |
| `chore` | Dépendances, outillage, ménage |
| `revert` | Annulation d'un commit précédent |

Portées usuelles, telles qu'un lecteur extérieur les comprendrait :
`auth`, `planning`, `sessions`, `athletes`, `activities`, `messages`,
`nav`, `settings`, `db`.

**Pas de `BREAKING CHANGE`, pas de versionnage sémantique.** Il n'existe aucun
dépendant à prévenir : Optiperf est déployé en continu, il n'y a que la
production. Ce qui mérite d'être signalé, c'est une **migration à poser à la
main** — et ça se dit en fin de description, pas dans le titre.

Pour un correctif qui rétablit le service, `fix` suffit : l'urgence se lit dans
la description et dans l'heure du merge, pas dans un préfixe de plus.

## Description de PR

Le corps de la PR devient le corps du commit : **en anglais**, comme le titre.

La règle : **le quoi se lit dans le diff, la description explique le pourquoi.**

1. **Un paragraphe** : quel problème, constaté comment. Une mesure ou un fait
   observé vaut mieux qu'une intention (« le dashboard mettait 1,5 s », « passé
   à travers 24 e2e et une CI verte »).
2. **Une liste** des décisions non évidentes, si la PR en contient.
3. `Closes #12` quand ça ferme une issue.

Ce qui rend une description utile, c'est ce qu'elle empêche de refaire : la
raison d'un choix, l'alternative écartée, le piège découvert en route.

## Issues

Trois modèles proposés à l'ouverture ([.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE)) :

| Modèle | Pour quoi |
|---|---|
| **Défaut** | Quelque chose ne marche pas. Ce qui devait arriver, ce qui est arrivé. |
| **Évolution** | Un manque côté coach ou athlète. Le besoin d'abord, la solution ensuite. |
| **Dette / entretien** | Fragilité connue, documentation à jour, mise à niveau. |

Une issue = un sujet. Si elle contient « et aussi », c'est deux issues.

## Avant d'ouvrir la PR

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

Et si la PR touche au rendu d'une page connectée, les parcours connectés en plus
(Docker requis) :

```bash
npm run test:e2e:auth
```

**Dans la même PR que le code** — ce n'est pas un travail « à faire après » :

- [ ] les tests qui couvrent le changement,
- [ ] `CLAUDE.md` si une règle ou un piège change,
- [ ] `README.md` si l'installation ou l'usage change,
- [ ] `docs/architecture.md` si la structure change,
- [ ] `docs/fonctionnalites.md` si une fonctionnalité apparaît ou disparaît,
- [ ] `docs/parcours.md` si une page apparaît, disparaît, ou change d'accès,
- [ ] `docs/donnees.md` si une table, une politique ou un trigger change,
- [ ] `docs/guides.md` si un geste courant change de mode d'emploi.

Les quatre documents de `docs/` sont le contrat passé avec quelqu'un qui arrive
sur le projet : ils ne valent que s'ils sont exacts. **Un catalogue faux coûte
plus cher que pas de catalogue** — on lui fait confiance, donc on ne vérifie
plus. Un seul est tenu par un test (`src/lib/docs-parcours.test.ts` échoue si
une route n'est pas dans la carte) ; les autres reposent sur la relecture.

## Migrations SQL

Toute évolution du schéma = **un nouveau fichier numéroté** dans
`supabase/migrations/`, jamais une modification d'un fichier existant : les
anciens ont déjà été appliqués en production, les rejouer est impossible.

Après le merge, applique le fichier **à la main** dans le SQL Editor de
Supabase. La CI valide la migration, mais elle ne peut pas la poser en
production à ta place.

Toute nouvelle table doit déclarer ses droits comme le fait `006` : Supabase en
accorde automatiquement au visiteur non connecté, et il faut les retirer.

## Travailler avec Claude

Claude Code écrit la plus grande partie du code de ce projet. Ce qui rend son
travail exploitable :

- **Décrire le problème, pas la solution.** « Le coach ne voit pas qui n'a rien
  de prévu » donne un meilleur résultat que « ajoute un cron ».
- **Dire ce qui a été observé** : le message d'erreur, la mesure, la page
  concernée. C'est ce qui finit dans la description de PR.
- **Lui demander de vérifier** plutôt que d'affirmer : lancer les tests, sonder
  la base, lire le fichier. Une réponse non vérifiée doit être annoncée comme
  telle.
- **Un sujet par session** quand c'est possible : les PR qui mélangent trois
  sujets sont plus difficiles à relire et à annuler.

Les commits co-écrits portent la ligne :

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

`/code-review ultra` lance une relecture multi-agents de la branche ou d'une PR,
avant de demander une relecture humaine.
