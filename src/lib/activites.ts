import { toISODate } from "./dates";

/**
 * Lecture des fichiers exportés par les montres (GPX, TCX).
 *
 * On n'en tire que ce dont le suivi se sert : quand, combien de temps, quelle
 * distance, à quelle fréquence cardiaque moyenne. Ni trace GPS ni détail
 * seconde par seconde — l'app n'en fait aujourd'hui aucun usage, et ne pas
 * les stocker évite d'avoir à décider qui peut les voir.
 *
 * Analyse sans dépendance : ces formats sont du XML, et on n'y cherche qu'une
 * poignée de balises. Le prix à payer est d'être explicite sur la structure —
 * en TCX notamment, `DistanceMeters` apparaît à la fois dans le tour et dans
 * chacun de ses points, et `Value` sert aussi bien à la moyenne qu'au maximum.
 */

export type ActiviteLue = {
  /** Début déclaré par la montre, tel quel. */
  startedAt: string;
  /** Jour vécu par l'athlète (Europe/Paris) : une sortie de 23 h 30
   *  appartient à sa soirée, pas au lendemain UTC. */
  date: string;
  durationMin: number;
  distanceM: number | null;
  avgHeartRate: number | null;
};

export type LectureActivite =
  | { ok: true; activite: ActiviteLue }
  | { ok: false; erreur: string };

/**
 * Au-delà, le fichier contient autre chose qu'une séance. Un trail de 2 h
 * enregistré à la seconde pèse déjà 3 Mo en TCX : la marge doit tenir les
 * sorties longues.
 */
export const TAILLE_MAX_OCTETS = 12_000_000;

const echec = (erreur: string): LectureActivite => ({ ok: false, erreur });

/**
 * Contenu textuel de chaque `<nom>`, quel que soit le préfixe d'espace de
 * noms — les exports Garmin écrivent `<ns3:TotalTimeSeconds>`.
 */
function balises(xml: string, nom: string): string[] {
  const motif = new RegExp(`<(?:\\w+:)?${nom}\\b[^>]*>([^<]*)</(?:\\w+:)?${nom}>`, "g");
  return [...xml.matchAll(motif)].map((m) => m[1].trim());
}

/** Blocs `<nom …>…</nom>` complets, contenu compris. */
function blocs(xml: string, nom: string): string[] {
  const motif = new RegExp(
    `<(?:\\w+:)?${nom}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${nom}>`,
    "g"
  );
  return [...xml.matchAll(motif)].map((m) => m[1]);
}

function nombres(valeurs: string[]): number[] {
  return valeurs.map(Number).filter((n) => Number.isFinite(n));
}

function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return Math.round(valeurs.reduce((s, v) => s + v, 0) / valeurs.length);
}

/**
 * Durée d'une trace GPX, pauses déduites.
 *
 * L'écart entre le premier et le dernier point compte les arrêts. Mesuré sur
 * un trail réel de 2 h : trois interruptions (160, 130 et 67 s) le gonflaient
 * de 5 minutes, là où le TCX de la même sortie en déclarait 115. En écartant
 * les intervalles anormalement longs on retombe à 114 — 1 % d'écart au lieu
 * de 4. Sur une course sans arrêt, le calcul ne change rien : c'est ce que
 * confirme la seconde paire d'exemples.
 *
 * Le seuil suit l'échantillonnage du fichier plutôt que d'être fixe : une
 * montre en enregistrement « intelligent » espace ses points de plusieurs
 * secondes, et 10 s fixes y verraient une pause à chaque intervalle.
 */
function dureeSecondes(horodatages: Date[]): number {
  const t = horodatages.map((d) => d.getTime());
  const ecoule = (t[t.length - 1] - t[0]) / 1000;
  if (t.length < 3) return ecoule;

  const ecarts: number[] = [];
  for (let i = 1; i < t.length; i++) ecarts.push((t[i] - t[i - 1]) / 1000);

  const median = [...ecarts].sort((a, b) => a - b)[Math.floor(ecarts.length / 2)];
  const seuil = Math.max(10, median * 10);
  const actif = ecarts.filter((e) => e <= seuil).reduce((s, v) => s + v, 0);

  // Garde-fou : si l'écart retiré dépasse la moitié de la sortie, ce n'est
  // pas une pause qu'on a détectée mais un fichier qu'on a mal lu.
  return actif >= ecoule / 2 ? actif : ecoule;
}

/** Distance entre deux points, en mètres (formule de haversine). */
function distanceEntre(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Assemble le résultat commun aux deux formats, et refuse ce qui ne peut pas
 * exister en base : la contrainte SQL impose une durée strictement positive.
 */
function assembler(
  debut: Date,
  secondes: number,
  distanceM: number | null,
  avgHeartRate: number | null
): LectureActivite {
  if (Number.isNaN(debut.getTime())) {
    return echec("La date de début du fichier est illisible.");
  }
  if (!Number.isFinite(secondes) || secondes <= 0) {
    return echec("La durée de l'activité est introuvable dans le fichier.");
  }
  return {
    ok: true,
    activite: {
      startedAt: debut.toISOString(),
      date: toISODate(debut),
      durationMin: Math.max(1, Math.round(secondes / 60)),
      distanceM: distanceM === null ? null : Math.round(distanceM),
      avgHeartRate,
    },
  };
}

/**
 * GPX : une suite de points. Durée et distance se déduisent, rien n'est
 * totalisé par la montre.
 */
export function lireGpx(xml: string): LectureActivite {
  const points = [...xml.matchAll(/<(?:\w+:)?trkpt\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?trkpt>/g)]
    .map((m) => {
      const lat = Number(/\blat="([^"]+)"/.exec(m[1])?.[1]);
      const lon = Number(/\blon="([^"]+)"/.exec(m[1])?.[1]);
      const time = balises(m[2], "time")[0];
      const hr = nombres(balises(m[2], "hr"))[0];
      return { lat, lon, time, hr };
    });

  if (points.length === 0) {
    return echec("Aucun point de trace trouvé : ce fichier n'est pas un GPX exploitable.");
  }

  const horodatages = points
    .map((p) => (p.time ? new Date(p.time) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

  if (horodatages.length < 2) {
    return echec("Le fichier ne contient pas assez d'horodatages pour calculer une durée.");
  }

  const debut = horodatages[0];
  const secondes = dureeSecondes(horodatages);

  // Les points sans coordonnées valides sont ignorés plutôt que de fausser la
  // distance : une pause sous tunnel en produit régulièrement.
  const situes = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  let distance = 0;
  for (let i = 1; i < situes.length; i++) {
    distance += distanceEntre(situes[i - 1], situes[i]);
  }

  return assembler(
    debut,
    secondes,
    situes.length >= 2 ? distance : null,
    moyenne(points.map((p) => p.hr).filter((h): h is number => Number.isFinite(h)))
  );
}

/**
 * TCX : la montre a déjà totalisé chaque tour. On additionne les tours plutôt
 * que de recalculer — c'est le chiffre que l'athlète voit sur son écran.
 */
export function lireTcx(xml: string): LectureActivite {
  const tours = blocs(xml, "Lap");
  if (tours.length === 0) {
    return echec("Aucun tour trouvé : ce fichier n'est pas un TCX exploitable.");
  }

  // La trace d'un tour contient ses propres `DistanceMeters` et `Value` : on
  // la retire avant de lire les totaux, sans quoi chaque point compterait.
  const entetes = tours.map((tour) =>
    tour.replace(/<(?:\w+:)?Track\b[^>]*>[\s\S]*?<\/(?:\w+:)?Track>/g, "")
  );

  const secondes = nombres(entetes.flatMap((t) => balises(t, "TotalTimeSeconds"))).reduce(
    (s, v) => s + v,
    0
  );
  const distances = nombres(entetes.flatMap((t) => balises(t, "DistanceMeters")));

  // `Value` sert aussi au maximum : on descend d'abord dans le bloc moyenne.
  const fc = nombres(
    entetes.flatMap((t) => blocs(t, "AverageHeartRateBpm").flatMap((b) => balises(b, "Value")))
  );

  // `Id` porte le début de l'activité ; à défaut, le premier tour.
  const declare =
    balises(xml, "Id")[0] ?? /<(?:\w+:)?Lap\b[^>]*\bStartTime="([^"]+)"/.exec(xml)?.[1];
  if (!declare) {
    return echec("La date de début du fichier est illisible.");
  }

  return assembler(
    new Date(declare),
    secondes,
    distances.length > 0 ? distances.reduce((s, v) => s + v, 0) : null,
    moyenne(fc)
  );
}

/**
 * Point d'entrée : choisit l'analyseur d'après le contenu, l'extension ne
 * servant que de repli. Un fichier renommé reste lisible.
 */
export function lireFichierActivite(contenu: string, nomFichier = ""): LectureActivite {
  if (contenu.length > TAILLE_MAX_OCTETS) {
    return echec("Fichier trop volumineux : 5 Mo au maximum.");
  }
  const texte = contenu.trim();
  if (texte === "") {
    return echec("Le fichier est vide.");
  }

  if (/<(?:\w+:)?TrainingCenterDatabase\b/.test(texte)) return lireTcx(texte);
  if (/<(?:\w+:)?gpx\b/.test(texte)) return lireGpx(texte);

  const extension = nomFichier.toLowerCase().split(".").pop();
  if (extension === "tcx") return lireTcx(texte);
  if (extension === "gpx") return lireGpx(texte);

  if (/\.fit$/i.test(nomFichier)) {
    return echec(
      "Les fichiers FIT ne sont pas encore acceptés. Exporte ta séance en TCX ou en GPX."
    );
  }
  return echec("Format non reconnu : dépose un fichier GPX ou TCX.");
}
