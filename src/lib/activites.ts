import { Decoder, Stream } from "@garmin/fitsdk";
import { toISODate } from "./dates";

/**
 * Lecture des fichiers exportés par les montres (GPX, TCX, FIT).
 *
 * On n'en tire que ce dont le suivi se sert : quand, combien de temps, quelle
 * distance, à quelle fréquence cardiaque moyenne. Ni trace GPS ni détail
 * seconde par seconde — l'app n'en fait aujourd'hui aucun usage, et ne pas
 * les stocker évite d'avoir à décider qui peut les voir.
 *
 * GPX et TCX sont du XML : on y cherche une poignée de balises par expression
 * régulière, sans dépendance. Le prix à payer est d'être explicite sur la
 * structure — en TCX notamment, `DistanceMeters` apparaît à la fois dans le
 * tour et dans chacun de ses points, et `Value` sert aussi bien à la moyenne
 * qu'au maximum.
 *
 * FIT est binaire : refaire soi-même le décodage (définitions de champs,
 * échelles, types, CRC) introduirait des erreurs silencieuses bien plus
 * probables qu'avec du XML lu par expressions régulières. Le SDK officiel
 * Garmin (`@garmin/fitsdk`) fait ce travail.
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

/** 9984 → « 10,0 km », 850 → « 850 m ». */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * Empreinte des octets bruts, qui sert d'identifiant de source : c'est elle
 * qui rend un second dépôt du même fichier détectable, la contrainte SQL
 * faisant le reste. Calculée par le navigateur, comme la lecture — sur les
 * octets et non le texte décodé, pour valoir aussi pour un FIT binaire.
 */
export async function empreinteFichier(contenu: ArrayBuffer): Promise<string> {
  const condense = await crypto.subtle.digest("SHA-256", contenu);
  return [...new Uint8Array(condense)]
    .map((o) => o.toString(16).padStart(2, "0"))
    .join("");
}

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
 * FIT : contrairement au TCX, on préfère le message `session` (le total de
 * l'activité entière) au `lap` — à défaut, on additionne les tours, comme
 * pour le TCX : c'est le chiffre que l'athlète voit sur son écran, pas un
 * recalcul point par point.
 */
function lireFit(stream: Stream): LectureActivite {
  const decoder = new Decoder(stream);
  if (!decoder.checkIntegrity()) {
    return echec("Ce fichier FIT est corrompu ou incomplet.");
  }

  const { messages } = decoder.read();
  const sessions = messages.sessionMesgs ?? [];
  const laps = messages.lapMesgs ?? [];
  if (sessions.length === 0 && laps.length === 0) {
    return echec("Aucune séance trouvée : ce fichier FIT n'est pas exploitable.");
  }

  const debut = sessions[0]?.startTime ?? laps[0]?.startTime;
  if (!(debut instanceof Date)) {
    return echec("La date de début du fichier est illisible.");
  }

  const secondes =
    sessions[0]?.totalElapsedTime ??
    laps.reduce((s, l) => s + (l.totalElapsedTime ?? 0), 0);
  const distanceM =
    sessions[0]?.totalDistance ??
    (laps.length > 0 ? laps.reduce((s, l) => s + (l.totalDistance ?? 0), 0) : null);
  const avgHeartRate =
    sessions[0]?.avgHeartRate ??
    moyenne(laps.map((l) => l.avgHeartRate).filter((h): h is number => h !== undefined));

  return assembler(debut, secondes, distanceM, avgHeartRate);
}

/**
 * Point d'entrée : choisit l'analyseur d'après le contenu, l'extension ne
 * servant que de repli. Un fichier renommé reste lisible.
 *
 * Le FIT étant binaire, sa détection ne peut pas se faire sur du texte déjà
 * décodé : le navigateur doit fournir les octets bruts (`ArrayBuffer`) pour
 * qu'on la tente avant de se rabattre sur un décodage XML.
 */
export function lireFichierActivite(
  contenu: string | ArrayBuffer,
  nomFichier = ""
): LectureActivite {
  if (contenu instanceof ArrayBuffer) {
    if (contenu.byteLength > TAILLE_MAX_OCTETS) {
      return echec("Fichier trop volumineux : 12 Mo au maximum.");
    }
    if (contenu.byteLength === 0) {
      return echec("Le fichier est vide.");
    }
    const stream = Stream.fromArrayBuffer(contenu);
    if (Decoder.isFIT(stream)) {
      return lireFit(stream);
    }
    return lireFichierActivite(new TextDecoder().decode(contenu), nomFichier);
  }

  if (contenu.length > TAILLE_MAX_OCTETS) {
    return echec("Fichier trop volumineux : 12 Mo au maximum.");
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

  if (extension === "fit") {
    return echec(
      "Ce fichier .fit n'a pas pu être lu : il ne correspond pas au format attendu."
    );
  }
  return echec("Format non reconnu : dépose un fichier GPX, TCX ou FIT.");
}
