import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lireFichierActivite } from "./activites";
import {
  allureSecParKm,
  analyserSeance,
  arrondirDistance,
  coefficientVariation,
  estDistanceStandard,
  formatAllure,
  formatDureeLibelle,
  libelleRecuperation,
  tendanceAllure,
  vitesseKmh,
  type TourBrut,
} from "./analyse-seance";

/**
 * Le moteur repris de Bright Dashboard, sur nos données.
 *
 * Les séances sont construites ici plutôt que lues d'un fichier : on teste le
 * classement et le nommage, pas la lecture d'un FIT (c'est `activites.test.ts`
 * qui s'en charge). Les allures sont choisies pour être réalistes — une
 * répétition à 3:30/km, une récupération au trot.
 */

let position = 0;
const tour = (durationS: number, distanceM: number | null, fc = 160): TourBrut => ({
  position: position++,
  durationS,
  distanceM,
  avgHeartRate: fc,
});
const nouvelleSeance = () => {
  position = 0;
};

/** Un effort de 1 km à ~3:30/km, et son trot de récupération. */
const km = (secondes = 210) => tour(secondes, 1000);
/** Un trot de récupération : nettement plus lent qu'une répétition. */
const recup = (secondes = 90, metres = 200) => tour(secondes, metres);
const footing = (secondes: number, metres: number) => tour(secondes, metres);

describe("outils de calcul", () => {
  it("dérive la vitesse de la distance et de la durée", () => {
    expect(vitesseKmh(1000, 360)).toBe(10);
    expect(vitesseKmh(null, 360)).toBe(0);
    expect(vitesseKmh(1000, 0)).toBe(0);
  });

  it("convertit une vitesse en allure", () => {
    expect(allureSecParKm(10)).toBe(360);
    expect(allureSecParKm(0)).toBe(0);
  });

  it("affiche une allure, et signale l'absence plutôt qu'un zéro", () => {
    expect(formatAllure(206)).toBe("3:26");
    expect(formatAllure(360)).toBe("6:00");
    expect(formatAllure(0)).toBe("--:--");
  });

  it("mesure la régularité d'une série", () => {
    expect(coefficientVariation([100, 100, 100])).toBe(0);
    expect(coefficientVariation([100])).toBe(0);
    expect(coefficientVariation([90, 110])).toBeGreaterThan(0);
  });

  it("arrondit une durée au multiple de 5 s", () => {
    // Une montre ne coupe pas à la seconde : 88 s était un 1'30".
    expect(formatDureeLibelle(88)).toBe("1'30\"");
    expect(formatDureeLibelle(90)).toBe("1'30\"");
    expect(formatDureeLibelle(120)).toBe("2'");
    expect(formatDureeLibelle(45)).toBe('45"');
  });

  it("arrondit une distance vers une valeur reconnaissable", () => {
    expect(arrondirDistance(1012)).toBe("1km");
    expect(arrondirDistance(412)).toBe("400m");
    expect(arrondirDistance(880)).toBe("800m");
  });

  it("laisse une distance non standard telle quelle", () => {
    // 700 m est à 16 % de 600 et à 12,5 % de 800 : aucun arrondi honnête.
    expect(estDistanceStandard(700)).toBe(false);
    expect(arrondirDistance(700)).toBe("700m");
  });
});

describe("libellé de récupération", () => {
  it("préfère le temps quand la distance ne dit rien", () => {
    expect(libelleRecuperation(90, 350, 0.02, 0.3)).toBe("1'30\"");
  });

  it("préfère la distance quand elle tombe sur une valeur standard", () => {
    expect(libelleRecuperation(95, 200, 0.2, 0.2)).toBe("200m");
  });

  it("préfère la distance quand elle est nettement plus régulière", () => {
    expect(libelleRecuperation(95, 350, 0.5, 0.05)).toBe("350m");
  });
});

describe("tendance d'allure", () => {
  const effort = (vitesse: number) =>
    ({ vitesseKmh: vitesse }) as Parameters<typeof tendanceAllure>[0][number];

  it("voit une accélération sur la seconde moitié", () => {
    expect(tendanceAllure([effort(16), effort(16), effort(17), effort(17)])).toBe(
      "progressive"
    );
  });

  it("voit un effondrement", () => {
    expect(tendanceAllure([effort(17), effort(17), effort(16), effort(16)])).toBe(
      "declin"
    );
  });

  it("ignore un écart sous le bruit de chronométrage", () => {
    expect(tendanceAllure([effort(16), effort(16), effort(16.1), effort(16.1)])).toBe(
      "reguliere"
    );
  });

  it("ne conclut rien d'une seule répétition", () => {
    expect(tendanceAllure([effort(16)])).toBe("reguliere");
  });
});

describe("analyse d'une séance", () => {
  it("ne rend rien d'une séance sans tour", () => {
    expect(analyserSeance([]).type).toBe("inconnue");
    expect(analyserSeance([]).structure).toBe("");
  });

  it("reconnaît un 7×1km avec échauffement et retour au calme", () => {
    nouvelleSeance();
    const seance = [
      footing(900, 2500),
      ...Array.from({ length: 7 }, (_, i) => [km(208 + i), recup(90)]).flat(),
      footing(600, 1600),
    ];
    const a = analyserSeance(seance, 162);

    expect(a.type).toBe("intervalles");
    expect(a.series).toHaveLength(1);
    expect(a.series[0].repetitions).toBe(7);
    expect(a.series[0].libelleEffort).toBe("1km");
    expect(a.structure).toMatch(/^7×1km/);
    expect(a.tours[0].type).toBe("echauffement");
    expect(a.tours[a.tours.length - 1].type).toBe("retour_calme");
  });

  it("écrit la phrase de résumé avec la FC et la tendance", () => {
    nouvelleSeance();
    const a = analyserSeance(
      Array.from({ length: 5 }, () => [km(), recup()]).flat(),
      162
    );
    expect(a.resume).toContain("5 réps");
    expect(a.resume).toContain("/km");
    expect(a.resume).toContain("FC 162 bpm");
    expect(a.resume).toContain("allure régulière");
  });

  it("tait la fréquence cardiaque quand la montre n'en donne pas", () => {
    nouvelleSeance();
    const a = analyserSeance(Array.from({ length: 4 }, () => [km(), recup()]).flat());
    expect(a.resume).not.toContain("FC");
  });

  it("détecte une séance réglée au chrono plutôt qu'au mètre", () => {
    // Des côtes de 1'30" : la durée ne bouge pas, la distance s'effondre à
    // mesure que le coureur fatigue. C'est précisément le cas où la distance
    // ment et où seul le chrono dit ce qui était visé — et la moyenne (270 m)
    // ne tombe sur aucune distance standard, ce qui laisse le temps trancher.
    nouvelleSeance();
    const seance = [
      tour(90, 290),
      recup(60, 130),
      tour(90, 275),
      recup(60, 130),
      tour(90, 260),
      recup(60, 130),
      tour(90, 255),
    ];
    const a = analyserSeance(seance);
    expect(a.series[0].parTemps).toBe(true);
    expect(a.series[0].libelleEffort).toBe("1'30\"");
  });

  it("garde la distance quand elle tombe sur une valeur standard", () => {
    // Durées régulières elles aussi, mais 400 m est reconnaissable : le
    // coureur visait la distance.
    nouvelleSeance();
    const seance = [
      tour(84, 403),
      recup(60, 130),
      tour(85, 398),
      recup(60, 130),
      tour(84, 401),
    ];
    const a = analyserSeance(seance);
    expect(a.series[0].parTemps).toBe(false);
    expect(a.series[0].libelleEffort).toBe("400m");
  });

  it("sépare deux séries sur une récupération beaucoup plus longue", () => {
    nouvelleSeance();
    const seance = [
      tour(84, 400),
      recup(60, 130),
      tour(84, 400),
      recup(60, 130),
      tour(84, 400),
      recup(60, 130),
      tour(84, 400),
      recup(300, 600), // grande récupération : changement de série
      tour(84, 400),
      recup(60, 130),
      tour(84, 400),
      recup(60, 130),
      tour(84, 400),
      recup(60, 130),
      tour(84, 400),
    ];
    const a = analyserSeance(seance);
    expect(a.series).toHaveLength(2);
    expect(a.structure).toMatch(/^2×\(4×400m\)/);
  });

  it("énumère les séries quand elles diffèrent", () => {
    nouvelleSeance();
    const seance = [
      tour(210, 1000),
      recup(90),
      tour(210, 1000),
      recup(600, 1200),
      tour(84, 400),
      recup(90),
      tour(84, 400),
      recup(90),
      tour(84, 400),
    ];
    const a = analyserSeance(seance);
    expect(a.series).toHaveLength(2);
    expect(a.structure).toContain(" + ");
  });

  it("reconnaît une sortie continue, sans inventer de structure", () => {
    nouvelleSeance();
    const a = analyserSeance([tour(1800, 5000), tour(1800, 5000)], 145);
    expect(a.type).toBe("continue");
    expect(a.structure).toBe("");
    expect(a.resume).toContain("Sortie de");
    expect(a.resume).toContain("FC 145 bpm");
  });

  it("mesure l'écart de chaque répétition à l'allure moyenne", () => {
    nouvelleSeance();
    // Quatre répétitions dont une nettement plus lente : elle doit ressortir.
    const a = analyserSeance([
      tour(200, 1000),
      recup(),
      tour(200, 1000),
      recup(),
      tour(200, 1000),
      recup(),
      tour(240, 1000),
    ]);
    const ecarts = a.tours.filter((t) => t.type === "effort").map((t) => t.ecartAllurePct);
    expect(ecarts.every((e) => e !== null)).toBe(true);
    expect(ecarts[3]!).toBeGreaterThan(10);
    expect(ecarts[0]!).toBeLessThan(0);
  });

  it("ne compare pas une récupération à une allure d'effort", () => {
    nouvelleSeance();
    const a = analyserSeance([km(), recup(), km()]);
    const recuperations = a.tours.filter((t) => t.type === "recuperation");
    expect(recuperations.length).toBeGreaterThan(0);
    expect(recuperations.every((t) => t.ecartAllurePct === null)).toBe(true);
  });

  it("classe un tour à l'arrêt en récupération plutôt qu'en effort", () => {
    nouvelleSeance();
    const a = analyserSeance([km(), tour(120, 20), km()]);
    expect(a.tours[1].type).toBe("recuperation");
  });

  it("lit les tours dans l'ordre des positions, pas celui du tableau", () => {
    const desordre: TourBrut[] = [
      { position: 2, durationS: 600, distanceM: 1600, avgHeartRate: 140 },
      { position: 0, durationS: 900, distanceM: 2500, avgHeartRate: 130 },
      { position: 1, durationS: 210, distanceM: 1000, avgHeartRate: 175 },
    ];
    const a = analyserSeance(desordre);
    expect(a.tours.map((t) => t.position)).toEqual([0, 1, 2]);
    expect(a.tours[0].type).toBe("echauffement");
  });

  it("survit à des tours sans distance", () => {
    // Un tapis sans capteur : durée seule. Rien ne doit exploser.
    nouvelleSeance();
    const a = analyserSeance([tour(600, null), tour(600, null)]);
    expect(a.type).toBe("continue");
    expect(a.tours.every((t) => t.vitesseKmh === 0)).toBe(true);
  });
});

describe("sur des séances réellement exportées", () => {
  const lire = (nom: string) => {
    const lecture = lireFichierActivite(
      readFileSync(new URL(`./__exemples__/${nom}`, import.meta.url), "utf8"),
      nom
    );
    if (!lecture.ok) throw new Error(lecture.erreur);
    return lecture.activite;
  };

  it("ne prend pas une sortie en tour automatique pour du fractionné", () => {
    // 21 tours d'un kilomètre sur un trail vallonné. Avant la détection du
    // tour automatique, les kilomètres descendants passaient pour des efforts
    // et les montants pour des récupérations : la séance se lisait
    // « 13×1km (1km) » — un libellé impossible, effort et récupération de
    // même longueur, qui a servi à trouver le défaut.
    const activite = lire("LaTour-en-JarezTrail20260516110831.tcx");
    const a = analyserSeance(activite.tours, activite.avgHeartRate);

    expect(activite.tours.length).toBeGreaterThan(15);
    expect(a.type).toBe("continue");
    expect(a.structure).toBe("");
    expect(a.resume).toMatch(/^Sortie de 20,\d\d km/);
  });

  it("résume une sortie régulière par sa distance et son allure", () => {
    const activite = lire("LeCoteauCourse20260529210037.tcx");
    const a = analyserSeance(activite.tours, activite.avgHeartRate);

    expect(a.type).toBe("continue");
    expect(a.resume).toContain("10,02 km");
    expect(a.resume).toContain("FC 189 bpm");
  });

  it("ne trouve aucun tour à analyser dans un GPX", () => {
    const activite = lire("strava-footing.gpx");
    expect(activite.tours).toEqual([]);
    expect(analyserSeance(activite.tours).type).toBe("inconnue");
  });
});
