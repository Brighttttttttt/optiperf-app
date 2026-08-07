/**
 * Zones de fréquence cardiaque, dérivées de la FC max de l'athlète.
 *
 * Modèle à 5 zones (Z1 50–60 %, Z2 60–70 %, Z3 70–80 %, Z4 80–90 %,
 * Z5 90–100 % et au-delà) : le découpage usuel des montres de course,
 * repris tel quel plutôt que réinventé.
 */

export type NumeroZone = 1 | 2 | 3 | 4 | 5;

export type RepartitionZones = {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
};

const ZONES_VIDES: RepartitionZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

/** En dessous de 60 % de FC max, tout tombe en Z1 : pas de zone 0. */
export function zoneDeFc(fc: number, fcMax: number): NumeroZone {
  const pct = fc / fcMax;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
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
  fcMax: number
): RepartitionZones {
  const zones = { ...ZONES_VIDES };
  for (let i = 1; i < tS.length; i++) {
    const fc = heartRate[i];
    const dt = tS[i] - tS[i - 1];
    if (fc === null || fc === undefined || !Number.isFinite(dt) || dt <= 0) continue;
    const cle = `z${zoneDeFc(fc, fcMax)}` as keyof RepartitionZones;
    zones[cle] += dt;
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
