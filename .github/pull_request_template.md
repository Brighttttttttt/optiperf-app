<!--
Titre de la PR = message du commit final sur master (merge squash).

Format : type(portée): résumé à l'impératif, EN ANGLAIS, 70 caractères max,
sans point final. Types : feat, fix, perf, refactor, test, docs, ci, chore.
Exemple : fix(auth): keep cookies on redirect responses

Le corps ci-dessous est en anglais lui aussi — il devient le corps du commit.
Le reste du projet (app, issues, code, documentation) reste en français.
-->

## Why

<!--
Le quoi se lit dans le diff. Explique le problème, et comment il a été
constaté : une mesure, une erreur, un comportement observé.
-->

## Decisions

<!-- Les choix non évidents, et ce qui a été écarté. Supprime si inutile. -->

-

## Verified

<!-- Ce qui a été lancé, et ce qui a été regardé à l'œil. -->

- [ ] `npm run lint && npm run typecheck && npm test && npm run build`
- [ ] `npm run test:e2e`
- [ ] `npm run test:e2e:auth` — obligatoire si le rendu d'une page connectée change
- [ ] Préversion Vercel ouverte sur téléphone

## Documentation

- [ ] `CLAUDE.md` — une règle ou un piège a changé
- [ ] `README.md` — l'installation ou l'usage a changé
- [ ] `docs/architecture.md` — la structure a changé
- [ ] `docs/fonctionnalites.md` — une fonctionnalité apparaît ou disparaît
- [ ] `docs/parcours.md` — une page apparaît, disparaît, ou change d'accès
- [ ] Rien à mettre à jour

## After merge

- [ ] Nouvelle migration à appliquer à la main dans le SQL Editor Supabase
- [ ] Rien à faire

Closes #
