# Conventions de travail

Tout est en **français**, y compris les issues, les branches, les commits et les
pull requests. Vue d'ensemble du projet :
[docs/architecture.md](docs/architecture.md).

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
branche peuvent rester bruts (`wip`, `corrige le test`) — ils disparaissent au
squash.

Si tu veux quand même les soigner, même format que les titres de PR ci-dessous.

## Titres (PR et commit final)

Un verbe à l'**impératif** ou un **groupe nominal**, ce que la modification fait
pour l'utilisateur ou pour le projet. Pas de préfixe technique (`feat:`,
`fix:`), pas de point final, 70 caractères maximum.

✅ `Rappel hebdomadaire de planification`
✅ `Vérifie les jetons localement au lieu d'interroger Supabase`
✅ `Urgence : retire le squelette de chargement qui bloquait l'affichage`
❌ `feat: add reminder`
❌ `Fix bug`
❌ `Modifications diverses`

Préfixe `Urgence :` pour un correctif qui rétablit le service.

## Description de PR

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
- [ ] `docs/architecture.md` si la structure change.

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
