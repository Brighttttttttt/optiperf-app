/**
 * Reconnaître deux enregistrements de la **même sortie** (#107).
 *
 * L'anti-doublon SQL de la migration 007, `unique (athlete_id, source,
 * external_id)`, ne couvre qu'un cas : le même fichier redéposé. Le `source`
 * fait partie de la clé **exprès**, pour que deux sources puissent coexister —
 * il ne peut donc pas y avoir de contrainte SQL de plus, et le rapprochement
 * est forcément souple.
 *
 * Le cas se produit **déjà**, sans attendre la moindre synchronisation : un
 * même footing exporté en GPX depuis une application puis en FIT depuis la
 * montre donne deux fichiers aux contenus différents, donc deux empreintes,
 * donc deux activités. C'est même la manœuvre naturelle de qui découvre qu'un
 * GPX ne porte jamais de tours et redépose la sortie en FIT pour en obtenir
 * l'analyse.
 *
 * Ce que ça coûte de ne rien faire : les courbes de charge et l'état ACWR
 * (`src/lib/metrics.ts`) comptent deux fois la même sortie, et le coach lit un
 * pic de charge qui n'a pas eu lieu. Un chiffre faux et parfaitement
 * plausible.
 */

/** Le minimum pour rapprocher deux enregistrements. */
export type SortieComparable = {
  /** Instant de départ, en ISO. */
  startedAt: string;
  durationMin: number;
};

/**
 * Écart de départ toléré, en minutes.
 *
 * C'est ce critère qui fait tout le travail : on ne commence pas deux sorties
 * distinctes à cinq minutes d'intervalle. Le même instant exporté par deux
 * outils diffère pourtant — l'un date du premier point GPS, l'autre du
 * démarrage du chronomètre, et l'attente du signal satellite les sépare.
 */
export const ECART_DEPART_MIN = 5;

/**
 * Rapport minimal entre la plus courte et la plus longue des deux durées.
 *
 * Volontairement large : les outils ne mesurent pas la même chose. Certains
 * comptent le **temps en mouvement**, d'autres le **temps écoulé** — sur un
 * trail avec ravitaillements, 1 h 20 de mouvement pour 2 h écoulées font déjà
 * un rapport de 0,67. Ce seuil n'est donc pas là pour départager des sorties
 * voisines, mais pour écarter l'aberration : dix minutes contre trois heures
 * ne sont pas la même chose, même en partant ensemble.
 */
export const RAPPORT_DUREE_MIN = 0.5;

/** Deux enregistrements de la même sortie, quelle qu'en soit la provenance. */
export function memeSortie(a: SortieComparable, b: SortieComparable): boolean {
  const debutA = Date.parse(a.startedAt);
  const debutB = Date.parse(b.startedAt);
  // Une date illisible ne rapproche rien : mieux vaut un doublon qu'un refus
  // fondé sur une comparaison qui n'a pas eu lieu.
  if (Number.isNaN(debutA) || Number.isNaN(debutB)) return false;

  const ecartMin = Math.abs(debutA - debutB) / 60_000;
  if (ecartMin > ECART_DEPART_MIN) return false;

  const courte = Math.min(a.durationMin, b.durationMin);
  const longue = Math.max(a.durationMin, b.durationMin);
  if (longue <= 0) return false;
  return courte / longue >= RAPPORT_DUREE_MIN;
}

/** La première activité existante qui décrit la même sortie, s'il y en a une. */
export function trouverDoublon<T extends SortieComparable>(
  candidate: SortieComparable,
  existantes: T[]
): T | null {
  return existantes.find((e) => memeSortie(candidate, e)) ?? null;
}
