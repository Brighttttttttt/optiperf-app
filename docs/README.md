# La documentation d'Optiperf

Cinq documents, rangés selon [Diátaxis](https://diataxis.fr/) : quatre types
d'écrits qui répondent à quatre besoins différents. Le but de ce classement
n'est pas l'élégance, c'est le diagnostic — **un document qui mélange deux types
sert mal les deux**. Une référence qui argumente devient lente à consulter ; un
tutoriel qui s'arrête pour expliquer perd le débutant.

|  | Pratique | Théorie |
|---|---|---|
| **On apprend** | **Tutoriel**<br>[README § Mise en route](../README.md#mise-en-route) | **Explication**<br>[architecture.md](architecture.md) · [CLAUDE.md](../CLAUDE.md) |
| **On travaille** | **Guide pratique**<br>[guides.md](guides.md) · [CONTRIBUTING.md](../CONTRIBUTING.md) | **Référence**<br>[fonctionnalites.md](fonctionnalites.md) · [parcours.md](parcours.md) · [donnees.md](donnees.md) |

## Par où entrer, selon ce que tu cherches

| Ta question | Le document |
|---|---|
| « Je veux faire tourner ce projet chez moi » | [README](../README.md) |
| « Est-ce que telle fonctionnalité existe, et où est son code ? » | [fonctionnalites.md](fonctionnalites.md) |
| « Quelles pages existent, qui y a accès, et par où on y arrive ? » | [parcours.md](parcours.md) |
| « Quelles tables existent, qui les lit, qui les écrit ? » | [donnees.md](donnees.md) |
| « Comment je pose une migration / reviens en arrière / ajoute une table ? » | [guides.md](guides.md) |
| « Comment j'ouvre une PR ici ? » | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| « Pourquoi c'est fait comme ça ? » | [architecture.md](architecture.md), puis [CLAUDE.md](../CLAUDE.md) |

## Deux choses à savoir avant de contribuer à ces pages

**Les trois références doivent être exactes ou disparaître.** Un catalogue faux
coûte plus cher que pas de catalogue : on lui fait confiance, donc on ne vérifie
plus. La liste de contrôle de [CONTRIBUTING.md](../CONTRIBUTING.md) et le modèle
de PR rappellent de les mettre à jour dans la même PR que le code.

Un seul de ces documents est tenu par un test :
`src/lib/docs-parcours.test.ts` échoue si une route de `src/app/` n'apparaît pas
dans [parcours.md](parcours.md). Les deux autres références reposent sur la
relecture — c'est une faiblesse connue, pas un oubli.

**`CLAUDE.md` mélange délibérément référence et explication**, et s'adresse à un
agent plutôt qu'à un humain qui arrive. C'est le seul écart assumé au classement
ci-dessus : il est optimisé pour être chargé en entier au début d'une session,
pas pour être parcouru. Un lecteur humain a intérêt à passer par
[architecture.md](architecture.md) d'abord.
