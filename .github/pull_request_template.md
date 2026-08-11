<!--
Titre de la PR = message du commit final sur master (merge squash).
Impératif ou groupe nominal, sans préfixe technique, 70 caractères max.
Exemple : « Vérifie les jetons localement au lieu d'interroger Supabase »
-->

## Pourquoi

<!--
Le quoi se lit dans le diff. Explique le problème, et comment il a été
constaté : une mesure, une erreur, un comportement observé.
-->

## Décisions

<!-- Les choix non évidents, et ce qui a été écarté. Supprime si inutile. -->

-

## Vérifié

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

## Après le merge

- [ ] Nouvelle migration à appliquer à la main dans le SQL Editor Supabase
- [ ] Rien à faire

Closes #
