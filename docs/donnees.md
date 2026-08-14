# Le modèle de données

Toutes les tables, qui les lit, qui les écrit, et d'où elles viennent. Document
de **référence** : il répond à « qu'est-ce qui existe et qui y a droit »,
sans argumenter — les raisons sont dans [CLAUDE.md](../CLAUDE.md) et dans les
commentaires des migrations, qui restent la source de vérité.

Le schéma vit dans [`supabase/migrations/`](../supabase/migrations/), un fichier
numéroté par évolution. Le mode d'emploi pour en ajouter une est dans
[guides.md](guides.md).

## Le principe : deux verrous, pas un

Chaque table est protégée deux fois, et les deux niveaux répondent à des
questions différentes :

| Verrou | Question | Où |
|---|---|---|
| **Droits SQL** (`grant` / `revoke`) | Quelles **tables** ce rôle peut-il ouvrir ? | Fin de chaque migration, modèle posé par `006` |
| **RLS** (politiques) | Quelles **lignes** y voit-il ? | Le corps de chaque migration |

Supabase accorde automatiquement des droits à `anon` et `authenticated` sur
toute table nouvellement créée. Sans le `revoke` explicite, un visiteur non
connecté obtient un accès que seule la RLS retient — un verrou au lieu de deux.

Sur `profiles`, le premier verrou descend **jusqu'à la colonne** :
`grant update (colonne)` liste précisément ce qu'un athlète peut réécrire. Une
colonne éditable oubliée dans ce grant produit une panne muette — la RLS laisse
passer, Postgres refuse, et l'utilisateur ne lit qu'« Impossible d'enregistrer ».

## Les tables

Abréviations : **A** = l'athlète concerné · **C** = son coach · **∅** = personne.

| Table | Migration | Ce qu'elle porte | Lecture | Écriture |
|---|---|---|---|---|
| `profiles` | 001, +010, +012, +017 | Rôle, nom, code d'invitation, FC max/repos, VMA, seuil, méthode de zones | A + C | A seul, **colonne par colonne** |
| `coach_athletes` | 001 | Le lien de coaching. Clé (coach, athlète), `unique (athlete_id)` → **un athlète a au plus un coach** | A + C | Créé par `link_to_coach` seulement ; supprimable par les deux |
| `objectives` | 001 | Une échéance nommée | A + C | A + C |
| `sessions` | 001 | La séance : prescription **et** compte rendu | A + C | C prescrit, A rapporte — arbitré par trigger |
| `messages` | 001, +004 | Le fil de discussion | Expéditeur + destinataire | Expéditeur ; le destinataire ne pose que `read_at` |
| `notifications` | 001, +008 | Ce qui s'est passé | Destinataire seul | Trigger ; le destinataire pose `read_at` |
| `session_templates` | 003 | Modèles de séances réutilisables | Le coach seul | Le coach seul |
| `activities` | 007 | Ce qu'une montre a enregistré | A + C | **A seul** |
| `activity_traces` | 009 | FC/allure/altitude d'une activité, une ligne par activité | A + C | A seul, à l'import — **pas d'update** |
| `activity_laps` | 016 | Les tours d'une activité : une ligne par tour | A + C | A seul, à l'import — **pas d'update** |
| `workout_blocks` | 011 | Structure d'une séance running | A + C | Qui prescrit, **tant que la séance est `planned`** |
| `personal_records` | 012 | Un record par distance standard | A + C | A + C |
| `exercises` | 013 | Musculation prescrite | A + C | Qui prescrit, **tant que la séance est `planned`** |
| `exercise_logs` | 013 | Musculation réalisée | A + C | **A seul**, à tout moment |
| `coach_notes` | 015 | Note libre du coach sur un athlète | **C seul** | **C seul** |

Trois nuances que le tableau ne peut pas porter :

- **`sessions` n'a pas de règle par personne mais par séance.** Le trigger
  `enforce_session_ownership` compare `old.athlete_id` à l'utilisateur : le même
  compte est l'athlète de ses propres séances et le coach de celles qu'il
  prescrit, avec des droits opposés sur les deux. C'est ce qui a rendu le
  coach-athlète possible sans toucher au schéma.
- **`coach_notes` n'a aucune politique pour l'athlète.** Ce n'est pas un oubli :
  une table protégée sans politique ne rend rien. L'invisibilité tient à une
  absence, ce qui ne se relit pas dans un diff — d'où un test d'isolation dédié.
- **`messages` exige un lien de coaching** à l'envoi : on n'écrit qu'à son coach
  ou à ses athlètes.

## Les fonctions et les triggers

| Nom | Migration | Ce qu'il fait |
|---|---|---|
| `handle_new_user` | 001 | Crée la ligne `profiles` à l'inscription |
| `is_my_athlete` / `is_my_coach` | 001 | Lecture à un seul niveau dans `coach_athletes`, `security definer` — elles ne s'appellent pas l'une l'autre, donc pas de récursion RLS |
| `enforce_session_ownership` | 002 | Sépare prescription et compte rendu, **par séance** |
| `delete_own_account` | 002 | Suppression du compte et de ses cascades |
| `generate_invite_code` | 004 | 10 caractères sans signes confondables |
| `enforce_message_rate_limit` | 004 | 20 messages par minute et par compte |
| `notify_session_planned` / `_completed` / `notify_new_message` | 001, 008 | Alimentent `notifications` |
| `notify_unplanned_week` | 005 | Rappel du dimanche, via `pg_cron` |
| `link_to_coach` | 001, réécrite en 014 | Rattache un compte à un coach par son code |

Deux détails qui se paient s'ils sont ignorés :

- **`pg_cron` tourne en UTC.** Une tâche à heure locale fixe se déclenche sur les
  deux heures UTC possibles et vérifie l'heure de Paris à l'intérieur.
- **`link_to_coach` interdit d'être son propre coach** (ça rendrait
  `is_my_athlete(soi)` vrai et élargirait toutes les politiques écrites en
  « moi **ou** mes athlètes »), mais **autorise deux coachs à se suivre
  mutuellement**.

## Ce qui n'est pas dans la base

- **Les fichiers de montre.** Un GPX ou un FIT est lu par le navigateur ; seules
  les valeurs affichées à l'athlète partent au serveur.
- **Le mode d'affichage** (« je coache » / « je m'entraîne ») vit dans un cookie.
  C'est une préférence, jamais un droit : il est ramené au rôle pour un compte
  qui n'est pas coach, et le rôle est relu en base avant écriture.
- **La clé secrète Supabase** ne sert qu'aux scripts locaux. Jamais côté client,
  jamais sur Vercel, jamais commitée.
