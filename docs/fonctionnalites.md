# Ce que fait Optiperf

Le catalogue des fonctionnalités livrées, ce que chacune permet et où elle vit
dans le code. Document de **référence** : il répond à « est-ce que ça existe, et
où ? », pas à « comment on s'en sert » (ça, c'est le [README](../README.md)) ni
à « pourquoi c'est fait comme ça » (c'est [CLAUDE.md](../CLAUDE.md)).

La carte des pages est dans [parcours.md](parcours.md), le modèle de données
dans [donnees.md](donnees.md). Index de la documentation : [docs/](README.md).

**À tenir à jour dans la même PR que la fonctionnalité**, comme les tests et
`CLAUDE.md`.

## Les comptes

| Fonctionnalité | Ce qu'elle permet | Où |
|---|---|---|
| Inscription et rôle | Créer un compte coach ou athlète. Le rôle est choisi à l'inscription et ne change plus. | `src/app/(auth)/signup` |
| Confirmation par email | Lien de confirmation qui ouvre la session, y compris quand les jetons arrivent dans le fragment d'URL. | `src/app/auth/` |
| Code d'invitation | 10 caractères sans signes confondables, que l'athlète retape à la main pour rejoindre un coach. | `generate_invite_code` (004), `LinkCoachForm` |
| Suppression du compte | Efface profil, séances, objectifs, messages, notifications et liaisons, en cascade. | `deleteOwnAccount`, migration 002 |
| Installation sur l'écran d'accueil | L'app s'ajoute au téléphone et s'ouvre en plein écran. | `manifest.ts`, `icon.tsx`, `apple-icon.tsx` |

## Prescrire — côté coach

| Fonctionnalité | Ce qu'elle permet | Où |
|---|---|---|
| Tableau de bord | Une carte par athlète : volume 7 jours, adhérence, RPE moyen, charge, état de forme. | `home/CoachDashboard` |
| Planification groupée | Décrire la séance une fois, cocher plusieurs athlètes et plusieurs dates, tout créer en un envoi. Écran unique. | `/planifier`, `BatchPlanner` |
| Modèles de séances | Garder une séance récurrente et la rappeler d'un tap. | `session_templates` (003), `TemplateList` |
| Séance running structurée | Découper en blocs : échauffement, intervalle (avec répétitions), récupération, retour au calme. | `workout_blocks` (011), `WorkoutBlocksEditor` |
| Séance de musculation | Prescrire des exercices : séries, répétitions, charge, repos. | `exercises` (013), `ExercisesEditor` |
| Analyse affichée | Trois onglets sur la fiche de séance — Analyse, Graphique, Tours — et la structure lisible dans les listes sans ouvrir la séance. Coach et athlète voient la même chose. | `AnalyseTours`, `TourChart`, `TourTable` |
| Analyse de séance | Lit la structure réelle d'une sortie depuis ses tours : `7×1km`, `2×(4×400m)`, `6×1'30"`, avec l'allure de chaque répétition, la récupération et la tendance. Pur calcul, rien n'est stocké. | `src/lib/analyse-seance.ts` |
| Déplacer une séance | Glisser une séance d'un jour à l'autre dans la vue semaine, au doigt, à la souris ou aux flèches. Une séance faite ne bouge pas. | `WeekPlanner`, `moveSession` |
| Objectifs | Une échéance nommée, visible de l'athlète. | `objectives` (001), `ObjectiveForm` |
| Records personnels | Consigner un record par distance standard. Saisissable par le coach **et** par l'athlète. | `personal_records` (012), `RecordsForm` |
| Note privée sur un athlète | Un carnet libre : blessure passée, contrainte d'emploi du temps, préférence. **L'athlète ne la voit pas.** | `coach_notes` (015), `CoachNoteForm` |
| Rappel de planification | Le dimanche soir, le coach est prévenu des athlètes sans rien de prévu. Tâche `pg_cron`, pas de cron d'hébergeur. | Migration 005 |
| Supprimer une séance | Le coach retire une prescription encore à venir ; l'athlète retire ses séances libres. Une prescription ne s'efface pas côté athlète — elle se déclare manquée. Le geste vit **en pied de page de la séance**, dans sa propre zone. | `peutSupprimer`, `DeleteSessionButton`, migration 018 |
| Retirer un athlète | Rompre le lien de coaching. Emporte la note privée. | `removeAthlete` |

## S'entraîner — côté athlète

| Fonctionnalité | Ce qu'elle permet | Où |
|---|---|---|
| Accueil | Les séances à venir, et le geste pour les déclarer faites ou manquées. | `home/AthleteHome` |
| S'entraîner sans coach | Tout fonctionne seul : séances libres, import, courbes, zones, historique. L'app n'en fait pas un compte incomplet — l'invitation à rejoindre un coach n'apparaît sur l'accueil qu'avant la toute première séance, puis vit dans les réglages. Un athlète ne se prescrit pas de séance à venir : le carnet se remplit après coup. | `home/AthleteHome`, `LinkCoachForm` |
| Compte rendu | RPE sur une rampe 1–10, durée réelle, commentaire. | `SessionActions`, `RpeScale` |
| Compte rendu de musculation | Ce qui a réellement été fait, exercice par exercice. | `exercise_logs` (013), `ExerciseLogsEditor` |
| Séance libre | Déclarer une sortie qui n'avait pas été prescrite. | `FreeSessionForm` |
| Import d'un fichier de montre | Déposer un GPX, TCX ou FIT. **Le fichier est lu par le navigateur**, jamais envoyé au serveur ; l'athlète voit ce qui en a été tiré avant de valider. | `ImportActivityForm`, `src/lib/activites.ts` |
| Doublon d'une même sortie | Deux formats de la même sortie (un GPX puis le FIT, pour avoir les tours) portent deux empreintes : la contrainte SQL ne les voit pas. Le rapprochement se fait sur l'heure de départ et la durée, et **se franchit** — l'athlète seul sait s'il a couru deux fois. | `src/lib/doublons.ts`, `importActivity` |
| Fichiers importés | La liste des relevés déposés, **pour eux-mêmes** : ceux que plus aucune séance ne porte s'y voient, et s'y suppriment. Supprimer un relevé rend le fichier déposable à nouveau ; la séance qu'il documentait reste. | `/activites`, `DeleteActivityButton` |
| Trace de l'activité | Fréquence cardiaque, allure et altitude au fil de la sortie, sous-échantillonnées à 400 points. | `activity_traces` (009), `ActivityTraceChart` |
| Zones de fréquence cardiaque | Répartition du temps par zone, selon **trois méthodes** au choix de l'athlète : % FC max, % seuil (LTHR), ou réserve (Karvonen). La méthode s'affiche à côté des zones. | `zones.ts`, `ZoneBar`, migrations 010 et 017 |
| VMA | Saisie par l'athlète seul ; le coach la consulte. | Migration 012, `VmaForm` |
| Vue semaine | Sa propre semaine, en lecture : état et contenu de chaque séance. Les semaines au-delà des ±8 chargées d'emblée sont **allées chercher** à la navigation — un jour hors fenêtre n'est jamais annoncé vide. | `/planning`, `WeekPlanner`, `chargerPlanning` |
| Historique | Séances passées, courbes de charge et de volume. | `/history`, `TrendCharts` |

## Les deux à la fois

| Fonctionnalité | Ce qu'elle permet | Où |
|---|---|---|
| Un coach qui s'entraîne | Une bascule « Je coache / Je m'entraîne » ouvre son propre entraînement, sans changer de compte. Il peut rejoindre un autre coach. | `view-mode.ts`, `ViewModeSwitch`, migration 014 |
| Messagerie temps réel | Un fil par binôme, les messages arrivent sans rechargement. Maximum 20 messages par minute. | `messages` (001), `MessageThread`, trigger de débit (004) |
| Notifications | Séance planifiée, séance faite, message reçu. Marquées lues en bloc. | `notifications` (001), triggers 001 et 008 |
| Métriques de charge | Charge session-RPE de Foster, ratio aigu/chronique, agrégation hebdomadaire. Fonctions pures, testées. | `src/lib/metrics.ts` |
| Vues ordinateur | Au-delà de `md`, barre latérale et grilles à deux colonnes. L'espace gagné sert aux grilles, jamais à étaler du texte. | `Nav`, layout `(app)` |

## Ce qui n'existe pas encore

Utile à savoir avant de chercher : ces manques sont documentés, pas oubliés.

| Manque | Issue |
|---|---|
| Connexion Strava, puis Garmin et Coros — import sans dépôt de fichier | [#87](https://github.com/Brighttttttttt/optiperf-app/issues/87), découpée en [#105](https://github.com/Brighttttttttt/optiperf-app/issues/105) → [#108](https://github.com/Brighttttttttt/optiperf-app/issues/108) |
| Plusieurs coachs par organisation | [#88](https://github.com/Brighttttttttt/optiperf-app/issues/88) |
| Journal des changements automatique | [#61](https://github.com/Brighttttttttt/optiperf-app/issues/61), reportée |
| Amitiés et messagerie ouverte à tous | [#63](https://github.com/Brighttttttttt/optiperf-app/issues/63), [#64](https://github.com/Brighttttttttt/optiperf-app/issues/64), reportées |
| Vérifier la préversion avant la mise en ligne | [#50](https://github.com/Brighttttttttt/optiperf-app/issues/50) |

## Deux règles qui traversent tout

**La prescription et le compte rendu ne se mélangent pas.** Le coach ne modifie
ni RPE, ni durée réelle, ni commentaire, ni statut ; l'athlète ne modifie pas la
consigne d'une séance prescrite. C'est un trigger Postgres qui le tient, pas
l'interface — et il tranche **par séance**, ce qui est exactement ce qui a rendu
le coach-athlète possible.

**La sécurité vit dans la base.** Chaque table déclare qui peut lire et écrire
quelles lignes. Une page qui oublierait un filtre ne peut pas faire fuiter les
données d'un autre compte.
