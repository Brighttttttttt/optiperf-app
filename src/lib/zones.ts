/**
 * Zones de fréquence cardiaque, selon trois méthodes.
 *
 * Modèle à 5 zones, découpage usuel des montres de course, repris tel quel
 * plutôt que réinventé. Ce qui change d'une méthode à l'autre, c'est la
 * **référence** à laquelle on compare un battement :
 *
 *   * `fcmax` — pourcentage de la fréquence maximale. Simple, et la moins
 *     juste : elle suppose que la fréquence de repos ne compte pas.
 *   * `lthr` — pourcentage de la fréquence au seuil lactique. Cale les zones
 *     là où se joue l'entraînement plutôt que sur un maximum qu'on n'atteint
 *     presque jamais. Les paliers diffèrent de ceux de la FC max : le seuil
 *     se situe vers 88 % de la FC max, donc les mêmes pourcentages appliqués
 *     à une référence plus basse donneraient des zones décalées.
 *   * `karvonen` — pourcentage de la *réserve* cardiaque (max moins repos),
 *     rapporté au-dessus du repos. Deux coureurs de même FC max mais de repos
 *     différents n'ont pas les mêmes zones, et c'est vrai.
 *
 * Une méthode dont la donnée manque n'est pas calculable : `zoneDeFc` le dit
 * en rendant null plutôt qu'en tombant sur une valeur par défaut, qui
 * afficherait des zones fausses sans le signaler.
 */

export type NumeroZone = 1 | 2 | 3 | 4 | 5;

export type MethodeZones = "fcmax" | "lthr" | "karvonen";

export const METHODES_ZONES: {
  valeur: MethodeZones;
  libelle: string;
  besoin: string;
}[] = [
  { valeur: "fcmax", libelle: "% FC max", besoin: "ta FC max" },
  { valeur: "lthr", libelle: "% seuil (LTHR)", besoin: "ta fréquence au seuil" },
  { valeur: "karvonen", libelle: "Réserve (Karvonen)", besoin: "ta FC max et ta FC de repos" },
];

/**
 * Le nom de la méthode, tel qu'il s'affiche à côté des zones.
 *
 * Le coach lit les zones d'un athlète sans avoir choisi l'échelle : sans ce
 * repère, il comparerait des Z3 qui ne veulent pas dire la même chose d'un
 * athlète à l'autre.
 */
export function libelleMethode(methode: MethodeZones): string {
  return METHODES_ZONES.find((m) => m.valeur === methode)?.libelle ?? methode;
}

/** Ce dont chaque méthode a besoin pour calculer quoi que ce soit. */
export type ReferencesFc = {
  fcMax: number | null;
  fcRepos: number | null;
  lthr: number | null;
};

/**
 * Paliers par méthode, en fraction de la référence.
 *
 * Ceux de la FC max et de Karvonen sont identiques (50/60/70/80/90 %), la
 * réserve ne changeant que la façon de rapporter un battement à l'échelle.
 * Ceux de la LTHR sont ceux des plans d'entraînement au seuil : la zone 5
 * commence *au-dessus* du seuil, pas à 90 % de lui.
 */
const PALIERS: Record<MethodeZones, [number, number, number, number]> = {
  fcmax: [0.6, 0.7, 0.8, 0.9],
  karvonen: [0.6, 0.7, 0.8, 0.9],
  lthr: [0.85, 0.89, 0.95, 1.0],
};

/**
 * Position d'un battement sur l'échelle de la méthode, entre 0 et 1 et
 * au-delà. Null quand la méthode n'a pas de quoi calculer.
 */
function fraction(
  fc: number,
  methode: MethodeZones,
  refs: ReferencesFc
): number | null {
  if (methode === "lthr") {
    return refs.lthr && refs.lthr > 0 ? fc / refs.lthr : null;
  }
  if (methode === "karvonen") {
    if (!refs.fcMax || !refs.fcRepos) return null;
    const reserve = refs.fcMax - refs.fcRepos;
    return reserve > 0 ? (fc - refs.fcRepos) / reserve : null;
  }
  return refs.fcMax && refs.fcMax > 0 ? fc / refs.fcMax : null;
}

/** Vrai si la méthode dispose de ce qu'il lui faut. */
export function methodeCalculable(methode: MethodeZones, refs: ReferencesFc): boolean {
  return fraction(150, methode, refs) !== null;
}

export type RepartitionZones = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

const ZONES_VIDES: RepartitionZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

/**
 * Zone d'un battement. Sous le premier palier, tout tombe en Z1 : il n'y a pas
 * de zone 0, un cœur qui bat lentement reste en récupération.
 *
 * Null quand la méthode manque de sa donnée — c'est à l'appelant de le dire à
 * l'athlète, pas à cette fonction de deviner.
 */
export function zoneDeFc(
  fc: number,
  methode: MethodeZones,
  refs: ReferencesFc
): NumeroZone | null {
  const part = fraction(fc, methode, refs);
  if (part === null) return null;
  const [a, b, c, d] = PALIERS[methode];
  if (part < a) return 1;
  if (part < b) return 2;
  if (part < c) return 3;
  if (part < d) return 4;
  return 5;
}

/**
 * Temps passé dans chaque zone sur une trace, en secondes.
 *
 * Chaque intervalle entre deux points est attribué à la zone du point qui le
 * termine — une approximation, comme toute lecture de FC échantillonnée, qui
 * suffit à la lisibilité visée (une répartition, pas une mesure de
 * laboratoire).
 */
export function repartitionZones(
  tS: number[],
  heartRate: (number | null)[],
  methode: MethodeZones,
  refs: ReferencesFc
): RepartitionZones {
  const zones = { ...ZONES_VIDES };
  for (let i = 1; i < tS.length; i++) {
    const fc = heartRate[i];
    const dt = tS[i] - tS[i - 1];
    if (fc === null || fc === undefined || !Number.isFinite(dt) || dt <= 0) continue;
    const zone = zoneDeFc(fc, methode, refs);
    if (zone === null) continue;
    zones[`z${zone}` as keyof RepartitionZones] += dt;
  }
  return zones;
}

export function additionnerZones(a: RepartitionZones, b: RepartitionZones): RepartitionZones {
  return {
    z1: a.z1 + b.z1,
    z2: a.z2 + b.z2,
    z3: a.z3 + b.z3,
    z4: a.z4 + b.z4,
    z5: a.z5 + b.z5,
  };
}

export function totalZones(z: RepartitionZones): number {
  return z.z1 + z.z2 + z.z3 + z.z4 + z.z5;
}

/**
 * Répartition en pourcentages (somme 100, ou toutes zones à 0 si le total
 * est nul — aucun temps à en tirer plutôt qu'une division par zéro).
 */
export function pourcentagesZones(z: RepartitionZones): RepartitionZones {
  const total = totalZones(z);
  if (total === 0) return { ...ZONES_VIDES };
  return {
    z1: (z.z1 / total) * 100,
    z2: (z.z2 / total) * 100,
    z3: (z.z3 / total) * 100,
    z4: (z.z4 / total) * 100,
    z5: (z.z5 / total) * 100,
  };
}
