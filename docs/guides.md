# Guides pratiques

Des recettes pour les gestes qui reviennent. Chaque section suppose que le
projet tourne déjà — pour l'installer, c'est le [README](../README.md).

Ces guides disent **quoi faire**. Le pourquoi est dans
[architecture.md](architecture.md) et [CLAUDE.md](../CLAUDE.md).

---

## Poser une migration en production

La CI valide une migration sur une base neuve, mais **elle ne la pose pas** :
c'est le seul geste manuel qui reste, et rien ne vérifie qu'il a été fait.

1. Ouvre le **SQL Editor** du projet Supabase → **New query**.
2. Colle le contenu du fichier, **un fichier à la fois, dans l'ordre des
   numéros**. Nomme la requête comme le fichier (`015_note_du_coach`) : la liste
   des requêtes enregistrées devient l'historique de ce qui a été posé.
3. **Run**, et lis la réponse.

| Réponse | Ce que ça veut dire |
|---|---|
| `Success` | C'est posé, passe à la suivante |
| `... already exists` | Déjà posée. Passe à la suivante, il n'y a rien à réparer |
| Autre erreur | Arrête-toi. Une migration à moitié passée est pire qu'une migration non passée |

Une migration en `create or replace function` se rejoue sans risque, même
plusieurs fois. Une migration qui crée une table, non.

**Pour savoir où en est la production**, sans rien écrire : interroge l'API REST
sans être connecté. `anon` n'a de droit sur aucune table, donc la réponse
distingue les deux cas qui nous intéressent.

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "$SUPABASE_URL/rest/v1/nom_de_la_table?select=*&limit=1" \
  -H "apikey: $SUPABASE_PUBLISHABLE_KEY"
```

- **401** → la table existe et elle est bien verrouillée.
- **404** → la table est absente : la migration n'a pas été posée.

---

## Revenir en arrière après un mauvais déploiement

**À lire avant d'en avoir besoin.** Le point qui compte tient en une phrase :

> Revenir en arrière sur le code **ne défait pas une migration**.

Vercel repromeut un déploiement précédent en quelques secondes ; Postgres, lui,
garde le schéma que tu lui as donné. Les deux ne reculent pas ensemble.

**Si le code seul est en cause :**

1. Vercel → projet → onglet **Deployments**.
2. Repère le dernier déploiement sain (celui d'avant la PR fautive).
3. Menu `···` → **Promote to Production** (ou **Instant Rollback**). La
   production repasse dessus sans rebuild.
4. Ouvre le site et vérifie à l'œil : `npm run smoke` puis `npm run test:prod`.
5. Ouvre une issue **avec l'heure et le déploiement fautif**, tant que c'est
   frais. Le retour arrière n'est pas le correctif.

**Si une migration est en cause**, le retour arrière du code ne suffit pas et
peut aggraver : l'ancien code rencontrera un schéma qu'il ne connaît pas. Deux
issues seulement :

- **La migration est additive** (nouvelle table, nouvelle colonne nullable) —
  c'est le cas de toutes celles du projet à ce jour. L'ancien code l'ignore :
  repromeus le code, laisse le schéma, corrige à froid.
- **La migration retire ou renomme quelque chose.** Il n'y a pas de bouton.
  Il faut écrire la migration inverse, la tester sur une base neuve, et la
  poser. C'est la raison pour laquelle aucune migration de ce projet ne
  supprime de colonne — garde-le ainsi.

---

## Diagnostiquer une page qui répond sans rien afficher

Le mode de panne de l'incident #44 : la route renvoie 200, le HTML contient les
données, et l'écran reste vide ou figé sur un squelette. Les tests locaux sont
trop rapides pour le reproduire.

Dans l'ordre, parce que chaque étape élimine une famille de causes :

1. **Reproduis-le contre la production**, pas en local :
   `npm run test:prod`. Si le test passe et que toi tu vois la page vide, c'est
   ton cache navigateur ou ton réseau — recharge en forçant.
2. **Ouvre la console.** Une erreur CSP y apparaît en clair. Toute origine
   nouvelle appelée par le navigateur doit figurer dans
   `src/lib/security-headers.ts`, sinon elle est bloquée en production
   seulement.
3. **Cherche une frontière de suspension.** `loading.tsx` sur une route entière
   est interdit dans ce projet, et c'est précisément à cause de cette panne :
   l'échange de fin de flux ne se produisait pas et la page restait sur son
   squelette. Si un `loading.tsx` ou un `<Suspense>` de route est réapparu,
   c'est la piste.
4. **Regarde `x-vercel-id` dans la réponse.** Attendu : `cdg1::cdg1::…`. Une
   autre région veut dire que `vercel.json` a été perdu, et chaque requête
   traverse l'Atlantique — ce n'est pas cette panne, mais ça y ressemble sous
   une mauvaise connexion.

---

## Ajouter une table

Le contenu change, la charpente non.

1. **Un nouveau fichier numéroté** dans `supabase/migrations/`. Jamais modifier
   un fichier existant : les anciens sont déjà posés en production, les rejouer
   est impossible.
2. **Écris les deux verrous.** Les politiques RLS *et* les droits SQL à la
   manière de `006` — dont le `revoke all ... from anon`, sans lequel un
   visiteur non connecté obtient un accès que seule la RLS retiendrait.
3. **Choisis un précédent et dis lequel** dans un commentaire. `activities` pour
   « l'athlète seul écrit », `objectives` pour « l'athlète et son coach »,
   `workout_blocks` pour « qui prescrit écrit, tant que c'est planifié ». Une
   règle inventée de zéro est une règle que personne ne saura relire.
4. **Double les limites de longueur** : contrainte SQL dans la migration, et
   `LIMITS` dans `src/lib/types.ts`. Les deux doivent rester d'accord.
5. **Écris le test d'isolation** dans `e2e-auth/`, sur le modèle de
   `blocs-isolation.spec.ts` : il s'adresse à la base sans passer par les pages.
   C'est le seul endroit où se vérifie ce qu'une politique **refuse**.
6. **Mets à jour [donnees.md](donnees.md)** et le README (liste des migrations).

---

## Régénérer le jeu de démonstration en ligne

Deux scripts existent et **ne servent pas à la même chose**. Les confondre a déjà
coûté deux contrôles de production au rouge (#117).

| | `npm run seed` | `npm run demo` |
|---|---|---|
| Pour quoi | Faire tourner `e2e-auth` | Parcourir l'app comme un utilisateur |
| Contenu | 1 coach + 3 athlètes | 1 coach + 5 athlètes |
| Noms | **Lus en dur dans les tests** — les changer les casse | Libres, ils changent à chaque régénération |
| Cible | La base de `.env.local` (en CI, une base neuve) | La base de `.env.local` |

Pour repeupler la démo en ligne :

1. Vérifie que `.env.local` pointe la base **de production** et contient
   `SUPABASE_SECRET_KEY`. Le script affiche sa cible avant d'écrire — lis-la.
2. `npm run demo`.
3. Rejoue les contrôles : `npm run smoke` puis `npm run test:prod`.

Le script est relançable : il remplace les données des comptes de démo et ne
touche à aucun autre compte.

**Ne nomme jamais un athlète de démo dans un test.** Le jeu en ligne change
quand on le régénère, et un contrôle qui cherche un nom passe au rouge sans
qu'aucune page ne soit cassée. C'est arrivé deux fois.

---

## Débloquer une PR dont la CI ne démarre pas

Symptôme : la PR est ouverte, aucun check n'apparaît, l'onglet Actions reste
vide. Rien dans l'interface ne dit pourquoi.

La cause est presque toujours un **conflit de fusion**. Pour un événement
`pull_request`, GitHub doit d'abord fabriquer la référence de fusion
`refs/pull/N/merge` ; un conflit l'en empêche et le workflow ne démarre jamais —
silencieusement.

```bash
gh pr view <N> --json mergeable,mergeStateStatus
```

`"mergeable": "CONFLICTING"` ou `"mergeStateStatus": "DIRTY"` confirme. La
correction est de fusionner `master` dans la branche :

```bash
git checkout <branche> && git merge origin/master
# résoudre, puis
git push
```

Inutile d'essayer un commit vide, une fermeture/réouverture ou un renommage de
branche : aucun ne fabrique la référence manquante.
