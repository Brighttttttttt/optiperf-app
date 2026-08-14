/**
 * Lecture de la structure réelle d'une séance, à partir de ses tours.
 *
 * Repris du projet Bright Dashboard (`workoutAnalyzer.ts`), dont c'était le
 * cœur : classer chaque tour, regrouper les répétitions, et nommer ce qu'on
 * voit — « 7×1km », « 2×(4×400m) », « 6×1'30" ».
 *
 * Trois adaptations à Optiperf :
 *
 *   1. **La vitesse se dérive.** Le projet d'origine lisait `avg_speed` du
 *      fichier FIT ; `activity_laps` (migration 016) ne stocke pas de vitesse,
 *      parce qu'une donnée dérivée en base peut contredire celles dont elle
 *      vient. Elle se recalcule ici, exactement, de la distance et de la durée.
 *   2. **Une seule durée.** Le FIT distingue temps écoulé et temps actif ; on
 *      ne garde que le premier. Une pause au milieu d'une récupération la fait
 *      donc paraître plus longue — sans effet sur le classement, qui repose
 *      sur la vitesse.
 *   3. **Rien n'est stocké.** Fonction pure sur des données stables : le
 *      résultat se recalcule à l'affichage. Le figer en base créerait une
 *      valeur périmée dès qu'un seuil s'affine.
 *
 * Les seuils (80 % de la vitesse maximale, récupération 2,5×, ±2 % de
 * tendance, 10 % d'arrondi) viennent de séances réelles analysées dans le
 * projet d'origine. Les changer demande de rejouer des cas, pas de raisonner.
 */

/**
 * Le vocabulaire de `workout_blocks` (migration 011) est repris là où il
 * correspond, pour qu'une séance prescrite et une séance mesurée se lisent
 * dans les mêmes mots. Deux valeurs lui sont propres : `effort`, parce qu'un
 * tour mesuré n'est pas forcément l'« intervalle » prescrit, et `footing`,
 * qui n'a pas d'équivalent dans une prescription structurée.
 */
export type TypeTour =
  | "echauffement"
  | "effort"
  | "recuperation"
  | "retour_calme"
  | "footing";

/** Un tour tel qu'il entre dans l'analyse — le strict nécessaire. */
export type TourBrut = {
  position: number;
  durationS: number;
  distanceM: number | null;
  avgHeartRate: number | null;
};

export type TourAnalyse = TourBrut & {
  type: TypeTour;
  /** Dérivée de la distance et de la durée. 0 si la distance est inconnue. */
  vitesseKmh: number;
  /** Secondes par kilomètre. 0 quand la vitesse l'est. */
  allureSecParKm: number;
  /**
   * Écart à l'allure moyenne des efforts, en pourcentage signé. Négatif = plus
   * rapide que la moyenne. Null hors des efforts : comparer une récupération à
   * une allure d'effort n'a pas de sens.
   */
  ecartAllurePct: number | null;
};

export type SerieIntervalles = {
  repetitions: number;
  /** Ce qu'on affiche : « 1km », « 400m » ou « 1'30" ». */
  libelleEffort: string;
  /** Vrai si la montre bippait au chrono plutôt qu'au mètre. */
  parTemps: boolean;
  dureeEffortMoyenneS: number;
  allureEffortMoyenneSecParKm: number;
  dureeRecuperationMoyenneS: number;
  /** Vide quand la série n'a aucune récupération identifiée. */
  libelleRecuperation: string;
  efforts: TourAnalyse[];
  recuperations: TourAnalyse[];
};

export type TendanceAllure = "progressive" | "declin" | "reguliere";

export type AnalyseSeance = {
  type: "intervalles" | "continue" | "inconnue";
  /** « 7×1km (1'30") », vide pour une sortie continue. */
  structure: string;
  /** « 7 reps à 3:26/km · FC 162 bpm · allure régulière ». */
  resume: string;
  tendance: TendanceAllure;
  tours: TourAnalyse[];
  series: SerieIntervalles[];
  distanceEffortM: number;
  dureeEffortS: number;
  allureEffortMoyenneSecParKm: number;
  distanceEchauffementM: number;
  distanceRetourCalmeM: number;
};

// ---------- Petits outils, tous testés ----------

/** Vitesse en km/h à partir d'une distance en mètres et d'une durée en secondes. */
export function vitesseKmh(distanceM: number | null, durationS: number): number {
  if (!distanceM || distanceM <= 0 || durationS <= 0) return 0;
  return distanceM / 1000 / (durationS / 3600);
}

export function allureSecParKm(kmh: number): number {
  return kmh > 0 ? 3600 / kmh : 0;
}

/** 206 → « 3:26 ». Le tiret double signale l'absence, pas un zéro. */
export function formatAllure(secParKm: number): string {
  if (!secParKm || secParKm <= 0) return "--:--";
  const min = Math.floor(secParKm / 60);
  const sec = Math.round(secParKm % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

/**
 * Coefficient de variation : l'écart-type rapporté à la moyenne.
 *
 * C'est lui qui répond à « la montre bippait-elle au temps ou à la distance »
 * — celui des deux qui varie le moins est celui que le coureur visait.
 */
export function coefficientVariation(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const moyenne = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
  if (moyenne === 0) return 0;
  const variance =
    valeurs.reduce((s, v) => s + (v - moyenne) ** 2, 0) / valeurs.length;
  return Math.sqrt(variance) / moyenne;
}

/** Les distances qu'un coureur reconnaît, et sur lesquelles on arrondit. */
const DISTANCES_STANDARD = [
  100, 200, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 3000, 5000, 10000,
];

/** Au-delà, ce n'est plus un arrondi mais une réécriture. */
const TOLERANCE_ARRONDI = 0.1;

function plusProcheStandard(metres: number): number {
  return DISTANCES_STANDARD.reduce((a, b) =>
    Math.abs(b - metres) < Math.abs(a - metres) ? b : a
  );
}

export function estDistanceStandard(metres: number): boolean {
  if (metres <= 0) return false;
  const proche = plusProcheStandard(metres);
  return Math.abs(proche - metres) / metres < TOLERANCE_ARRONDI;
}

/**
 * 880 m → « 800m », 1012 m → « 1km ».
 *
 * Une montre ne coupe jamais exactement au mètre : sans arrondi, une séance de
 * 400 m s'afficherait « 412m » et cesserait d'être reconnaissable.
 */
export function arrondirDistance(metres: number): string {
  if (metres <= 0) return "0m";
  const proche = plusProcheStandard(metres);
  if (Math.abs(proche - metres) / metres < TOLERANCE_ARRONDI) {
    return proche >= 1000 ? `${proche / 1000}km` : `${proche}m`;
  }
  return metres >= 1000 ? `${(metres / 1000).toFixed(2)}km` : `${Math.round(metres)}m`;
}

/** Au multiple de 5 s le plus proche : 88 s → « 1'30" », pas « 1'28" ». */
const PAS_ARRONDI_DUREE = 5;

export function formatDureeLibelle(secondes: number): string {
  const cale = Math.round(secondes / PAS_ARRONDI_DUREE) * PAS_ARRONDI_DUREE;
  const min = Math.floor(cale / 60);
  const sec = cale % 60;
  if (min === 0) return `${sec}"`;
  if (sec === 0) return `${min}'`;
  return `${min}'${String(sec).padStart(2, "0")}"`;
}

/**
 * Une récupération se dit en temps par défaut, en distance seulement si elle
 * tombe sur une valeur standard ou si les distances sont nettement plus
 * régulières que les temps. « 200m » quand le coureur trottait un demi-tour de
 * piste, « 1'30" » quand il regardait sa montre.
 */
export function libelleRecuperation(
  dureeMoyenneS: number,
  distanceMoyenneM: number,
  cvTemps = 0,
  cvDistances = 0
): string {
  if (estDistanceStandard(distanceMoyenneM)) return arrondirDistance(distanceMoyenneM);
  if (cvDistances < cvTemps * 0.7) return arrondirDistance(distanceMoyenneM);
  return formatDureeLibelle(Math.round(dureeMoyenneS));
}

/**
 * Compare la première et la seconde moitié des répétitions.
 *
 * Deux pour cent d'écart : en deçà, c'est du bruit de chronométrage, pas une
 * intention. Les deux moitiés se chevauchent d'un tour quand le nombre est
 * impair — celui du milieu n'appartient à aucune tendance.
 */
export function tendanceAllure(efforts: TourAnalyse[]): TendanceAllure {
  if (efforts.length < 2) return "reguliere";
  const moitie = Math.floor(efforts.length / 2);
  const debut = efforts.slice(0, moitie);
  const fin = efforts.slice(efforts.length - moitie);
  const moyenne = (t: TourAnalyse[]) =>
    t.reduce((s, l) => s + l.vitesseKmh, 0) / t.length;
  const v1 = moyenne(debut);
  if (v1 === 0) return "reguliere";
  const delta = (moyenne(fin) - v1) / v1;
  if (delta > 0.02) return "progressive";
  if (delta < -0.02) return "declin";
  return "reguliere";
}

// ---------- L'analyse ----------

/** En deçà, le tour est une marche ou un arrêt, pas un effort. */
const VITESSE_MARCHE_KMH = 5;

/**
 * Une montre réglée en tour automatique découpe la sortie en kilomètres
 * égaux. Sur un terrain vallonné, les kilomètres descendants passent alors le
 * seuil d'effort et les montants deviennent des « récupérations » : un trail
 * de 21 tours se lisait « 13×1km (1km) ».
 *
 * Le signe distinctif est là, dans ce libellé absurde — effort et récupération
 * de même longueur. Plutôt que de traquer ce symptôme, on détecte la cause :
 * des tours tous de la même distance.
 *
 * Assumé : une séance de 10×400m avec 400 m de récupération est indiscernable
 * d'un tour automatique de 400 m par la seule distance. Le tour automatique
 * étant infiniment plus répandu, c'est lui qu'on suppose.
 */
const CV_TOUR_AUTOMATIQUE = 0.05;

function estTourAutomatique(tours: TourBrut[]): boolean {
  // Le dernier tour est le reste du parcours, toujours plus court : le
  // compter ferait passer toute sortie en tour automatique pour irrégulière.
  if (tours.length < 3) return false;
  const distances = tours.slice(0, -1).map((t) => t.distanceM ?? 0);
  if (distances.some((d) => d <= 0)) return false;
  return coefficientVariation(distances) < CV_TOUR_AUTOMATIQUE;
}

/** Une récupération plus longue que ce multiple de la moyenne sépare deux séries. */
const FACTEUR_CHANGEMENT_SERIE = 2.5;

/** Un tour au-dessus de cette part de la vitesse maximale est un effort. */
const PART_VITESSE_EFFORT = 0.8;

const VIDE: AnalyseSeance = {
  type: "inconnue",
  structure: "",
  resume: "",
  tendance: "reguliere",
  tours: [],
  series: [],
  distanceEffortM: 0,
  dureeEffortS: 0,
  allureEffortMoyenneSecParKm: 0,
  distanceEchauffementM: 0,
  distanceRetourCalmeM: 0,
};

/**
 * Analyse une séance à partir de ses tours.
 *
 * `fcMoyenne` vient de l'activité, pas des tours : c'est le chiffre que
 * l'athlète a lu sur sa montre, et le recalculer depuis les tours donnerait
 * une moyenne de moyennes, pondérée à tort.
 */
export function analyserSeance(
  bruts: TourBrut[],
  fcMoyenne: number | null = null
): AnalyseSeance {
  if (bruts.length === 0) return VIDE;

  const avecVitesse = bruts
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((t) => {
      const kmh = vitesseKmh(t.distanceM, t.durationS);
      return { ...t, vitesseKmh: kmh, allureSecParKm: allureSecParKm(kmh) };
    });

  const vitesseMax = Math.max(...avecVitesse.map((t) => t.vitesseKmh));
  const seuilEffort = vitesseMax * PART_VITESSE_EFFORT;

  // Premier passage : effort, ou pas encore décidé.
  const tours: TourAnalyse[] = avecVitesse.map((t) => ({
    ...t,
    type: (vitesseMax > 0 &&
    t.vitesseKmh >= seuilEffort &&
    t.vitesseKmh >= VITESSE_MARCHE_KMH
      ? "effort"
      : "footing") as TypeTour,
    ecartAllurePct: null,
  }));

  // Second passage : **la place décide du reste**, pas la vitesse.
  //
  // C'est le point où l'on s'écarte du moteur d'origine, et c'est délibéré.
  // Lui ne reconnaissait une récupération qu'en dessous de 5 km/h ou de 150 m ;
  // un trot de récupération à 10 km/h lui échappait, se retrouvait classé en
  // footing, et la séance perdait d'un coup ses séries, son libellé de
  // récupération et sa structure. La position est à la fois plus simple et
  // plus proche de ce qu'un coach lit : entre la première et la dernière
  // répétition, tout ce qui n'est pas un effort est une récupération.
  const premierEffort = tours.findIndex((t) => t.type === "effort");
  const dernierEffort = tours.map((t) => t.type).lastIndexOf("effort");
  tours.forEach((tour, i) => {
    if (tour.type === "effort" || premierEffort === -1) return;
    if (i < premierEffort) tour.type = "echauffement";
    else if (i > dernierEffort) tour.type = "retour_calme";
    else tour.type = "recuperation";
  });

  const efforts = tours.filter((t) => t.type === "effort");
  const recuperations = tours.filter((t) => t.type === "recuperation");

  // Sans récupération, il n'y a pas de fractionné : une sortie régulière voit
  // tous ses tours dépasser 80 % de sa propre vitesse maximale, et se ferait
  // sinon passer pour une série de répétitions — avec une structure inventée
  // de toutes pièces. Le moteur d'origine avait ce défaut, masqué par le fait
  // qu'on ne lui donnait que du fractionné.
  const estIntervalles =
    efforts.length > 0 && recuperations.length > 0 && !estTourAutomatique(tours);

  const series: SerieIntervalles[] = [];
  let libelleEntreSeries = "";

  if (estIntervalles) {
    const recuperationMoyenne =
      recuperations.length > 0
        ? recuperations.reduce((s, t) => s + t.durationS, 0) / recuperations.length
        : 0;
    const seuilChangement = recuperationMoyenne * FACTEUR_CHANGEMENT_SERIE;

    let effortsCourants: TourAnalyse[] = [];
    let recuperationsCourantes: TourAnalyse[] = [];
    const brutes: Array<{ efforts: TourAnalyse[]; recuperations: TourAnalyse[] }> = [];
    const grandesRecuperations: TourAnalyse[] = [];

    for (const tour of tours.filter(
      (t) => t.type === "effort" || t.type === "recuperation"
    )) {
      if (tour.type === "effort") {
        effortsCourants.push(tour);
        continue;
      }
      const separe =
        seuilChangement > 0 &&
        tour.durationS > seuilChangement &&
        effortsCourants.length > 0;
      if (separe) {
        brutes.push({ efforts: effortsCourants, recuperations: recuperationsCourantes });
        effortsCourants = [];
        recuperationsCourantes = [];
        grandesRecuperations.push(tour);
      } else {
        recuperationsCourantes.push(tour);
      }
    }
    if (effortsCourants.length > 0) {
      brutes.push({ efforts: effortsCourants, recuperations: recuperationsCourantes });
    }

    if (grandesRecuperations.length > 0) {
      libelleEntreSeries = libelleRecuperation(
        grandesRecuperations.reduce((s, t) => s + t.durationS, 0) /
          grandesRecuperations.length,
        grandesRecuperations.reduce((s, t) => s + (t.distanceM ?? 0), 0) /
          grandesRecuperations.length,
        coefficientVariation(grandesRecuperations.map((t) => t.durationS)),
        coefficientVariation(grandesRecuperations.map((t) => t.distanceM ?? 0))
      );
    }

    for (const brute of brutes) {
      const moyenneDe = (t: TourAnalyse[], f: (x: TourAnalyse) => number) =>
        t.length > 0 ? t.reduce((s, x) => s + f(x), 0) / t.length : 0;

      const vitesseEffort = moyenneDe(brute.efforts, (t) => t.vitesseKmh);
      const distanceMoyenne = moyenneDe(brute.efforts, (t) => t.distanceM ?? 0);
      const dureeMoyenne = moyenneDe(brute.efforts, (t) => t.durationS);

      const cvTemps = coefficientVariation(brute.efforts.map((t) => t.durationS));
      const cvDistances = coefficientVariation(
        brute.efforts.map((t) => t.distanceM ?? 0)
      );

      // Une distance qui tombe sur une valeur standard tranche : le coureur
      // visait 400 m, même si ses temps sont eux aussi réguliers.
      const parTemps =
        !estDistanceStandard(distanceMoyenne) &&
        brute.efforts.length >= 2 &&
        cvTemps < cvDistances * 0.7;

      series.push({
        repetitions: brute.efforts.length,
        libelleEffort: parTemps
          ? formatDureeLibelle(Math.round(dureeMoyenne))
          : arrondirDistance(distanceMoyenne),
        parTemps,
        dureeEffortMoyenneS: dureeMoyenne,
        allureEffortMoyenneSecParKm: allureSecParKm(vitesseEffort),
        dureeRecuperationMoyenneS: moyenneDe(brute.recuperations, (t) => t.durationS),
        libelleRecuperation:
          brute.recuperations.length > 0
            ? libelleRecuperation(
                moyenneDe(brute.recuperations, (t) => t.durationS),
                moyenneDe(brute.recuperations, (t) => t.distanceM ?? 0),
                coefficientVariation(brute.recuperations.map((t) => t.durationS)),
                coefficientVariation(brute.recuperations.map((t) => t.distanceM ?? 0))
              )
            : "",
        efforts: brute.efforts,
        recuperations: brute.recuperations,
      });
    }
  }

  const somme = (t: TourAnalyse[], f: (x: TourAnalyse) => number) =>
    t.reduce((s, x) => s + f(x), 0);

  const vitesseEffortGlobale =
    efforts.length > 0 ? somme(efforts, (t) => t.vitesseKmh) / efforts.length : 0;
  const allureEffort = allureSecParKm(vitesseEffortGlobale);

  // L'écart à l'allure moyenne, qui donnera sa couleur à chaque répétition.
  // Posé après coup : il se compare à une moyenne qu'on ne connaît qu'à la fin.
  if (allureEffort > 0) {
    for (const tour of efforts) {
      tour.ecartAllurePct =
        Math.round(((tour.allureSecParKm - allureEffort) / allureEffort) * 1000) / 10;
    }
  }

  const type = estIntervalles ? "intervalles" : "continue";
  const tendance = tendanceAllure(efforts);

  return {
    type,
    structure: construireStructure(series, libelleEntreSeries),
    resume: construireResume(type, series, allureEffort, fcMoyenne, tendance, tours),
    tendance,
    tours,
    series,
    distanceEffortM: Math.round(somme(efforts, (t) => t.distanceM ?? 0)),
    dureeEffortS: Math.round(somme(efforts, (t) => t.durationS)),
    allureEffortMoyenneSecParKm: allureEffort,
    distanceEchauffementM: Math.round(
      somme(
        tours.filter((t) => t.type === "echauffement"),
        (t) => t.distanceM ?? 0
      )
    ),
    distanceRetourCalmeM: Math.round(
      somme(
        tours.filter((t) => t.type === "retour_calme"),
        (t) => t.distanceM ?? 0
      )
    ),
  };
}

/** « 7×1km (1'30") », « 2×(4×400m) », ou l'énumération quand les séries diffèrent. */
function construireStructure(
  series: SerieIntervalles[],
  libelleEntreSeries: string
): string {
  if (series.length === 0) return "";

  const avecRecup = (s: SerieIntervalles) =>
    `${s.repetitions}×${s.libelleEffort}${s.libelleRecuperation ? ` (${s.libelleRecuperation})` : ""}`;

  if (series.length === 1) return avecRecup(series[0]);

  const identiques =
    series.every((s) => s.libelleEffort === series[0].libelleEffort) &&
    series.every((s) => s.repetitions === series[0].repetitions);

  if (identiques) {
    const recups = [series[0].libelleRecuperation, libelleEntreSeries].filter(Boolean);
    const suffixe = recups.length > 0 ? ` (${recups.join("/")})` : "";
    return `${series.length}×(${series[0].repetitions}×${series[0].libelleEffort})${suffixe}`;
  }

  return series.map(avecRecup).join(" + ");
}

const LIBELLE_TENDANCE: Record<TendanceAllure, string> = {
  progressive: "en progression",
  declin: "en baisse",
  reguliere: "régulière",
};

function construireResume(
  type: "intervalles" | "continue" | "inconnue",
  series: SerieIntervalles[],
  allureEffort: number,
  fcMoyenne: number | null,
  tendance: TendanceAllure,
  tours: TourAnalyse[]
): string {
  const fc = fcMoyenne && fcMoyenne > 0 ? ` · FC ${fcMoyenne} bpm` : "";

  if (type === "intervalles" && series.length > 0) {
    const reps = series.reduce((s, x) => s + x.repetitions, 0);
    return `${reps} rép${reps > 1 ? "s" : ""} à ${formatAllure(allureEffort)}/km${fc} · allure ${LIBELLE_TENDANCE[tendance]}`;
  }

  const distance = tours.reduce((s, t) => s + (t.distanceM ?? 0), 0);
  if (distance <= 0) return "";
  const duree = tours.reduce((s, t) => s + t.durationS, 0);
  const allure = duree > 0 ? duree / (distance / 1000) : 0;
  const libelle =
    distance >= 1000
      ? `${(distance / 1000).toFixed(2).replace(".", ",")} km`
      : `${Math.round(distance)} m`;
  return `Sortie de ${libelle} à ${formatAllure(allure)}/km${fc}`;
}
