#!/usr/bin/env bash
# Ouvre une issue quand le contrôle de production échoue (#50).
#
# Le rouge dans l'onglet Actions ne prévient personne : il faut y penser pour
# le voir. Une issue arrive par les canaux habituels de GitHub et laisse une
# trace dans laquelle écrire ce qu'on a fait.
#
# Une seule alerte à la fois : un déploiement cassé rejoue le contrôle à
# chaque tentative, et dix issues identiques n'apprendraient rien de plus.
#
# Attend dans l'environnement : GH_TOKEN, LIEN (URL du journal), SHA.
set -euo pipefail

if [ "$(gh issue list --label incident --state open --json number --jq 'length')" != "0" ]; then
  echo "Une alerte est déjà ouverte : rien à ajouter."
  exit 0
fi

# Le label peut déjà exister : ce n'est pas une erreur.
gh label create incident --color B60205 \
  --description "La production ne répond pas comme attendu" || true

corps=$(mktemp)
cat > "$corps" <<CORPS
Le contrôle joué après le déploiement de \`${SHA}\` a échoué.

**Journal :** ${LIEN}

Ce contrôle est le seul à voir qu'une page répond correctement tout en
n'affichant rien (incident #44), et le seul à comparer les tables déclarées
dans \`supabase/migrations/\` à celles réellement présentes en base. D'où deux
causes fréquentes :

- une migration ajoutée en PR mais **jamais posée** dans le SQL Editor Supabase ;
- une page qui répond 200 sans rien afficher.

**Retour arrière**, si la production est inutilisable : la procédure est dans
\`docs/architecture.md\`, section « Retour arrière ». Elle prend une minute et ne
demande aucun accès particulier.

Refermer cette issue une fois la cause traitée : tant qu'elle est ouverte,
aucune autre alerte ne sera créée.
CORPS

gh issue create --label incident \
  --title "[Incident] Le contrôle de production a échoué" \
  --body-file "$corps"
