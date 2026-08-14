import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  Encoder,
  Profile,
  type Encodable,
  type FileIdMesg,
  type LapMesg,
  type RecordMesg,
  type SessionMesg,
} from "@garmin/fitsdk";
import {
  formatDistance,
  lireFichierActivite,
  lireGpx,
  lireTcx,
  MAX_POINTS_TRACE,
  TAILLE_MAX_OCTETS,
  validerTrace,
  validerTours,
  MAX_TOURS,
  type LectureActivite,
} from "./activites";

const exemple = (nom: string) =>
  readFileSync(new URL(`./__exemples__/${nom}`, import.meta.url), "utf8");

/** Les tests portent sur le cas lisible : un échec doit le dire clairement. */
function reussite(lecture: LectureActivite) {
  if (!lecture.ok) throw new Error(`lecture en échec : ${lecture.erreur}`);
  return lecture.activite;
}

describe("TCX", () => {
  const activite = reussite(lireTcx(exemple("garmin-sortie-longue.tcx")));

  it("additionne les tours, sans compter leurs points de trace", () => {
    // 1800 s + 2880 s. Les Trackpoints portent leurs propres DistanceMeters :
    // les additionner donnerait 15 230 m de trop.
    expect(activite.durationMin).toBe(78);
    expect(activite.distanceM).toBe(15230);
  });

  it("prend la fréquence moyenne et non la maximale", () => {
    // Chaque tour déclare les deux dans un <Value> : 142/154 en moyenne,
    // 165/178 en maximum. Une lecture naïve donnerait 159.
    expect(activite.avgHeartRate).toBe(148);
  });

  it("date l'activité au jour vécu à Paris", () => {
    // 09 h 12 UTC = 11 h 12 à Paris.
    expect(activite.date).toBe("2026-08-01");
    expect(activite.startedAt).toBe("2026-08-01T09:12:00.000Z");
  });

  it("accepte les préfixes d'espace de noms des exports Garmin", () => {
    const prefixe = exemple("garmin-sortie-longue.tcx")
      .replace(/<(\/?)(TotalTimeSeconds|DistanceMeters|Lap|Track|Trackpoint)/g, "<$1ns3:$2");
    expect(reussite(lireTcx(prefixe)).durationMin).toBe(78);
  });

  it("laisse la fréquence vide quand la montre n'en donne pas", () => {
    const sansFc = exemple("garmin-sortie-longue.tcx").replace(
      /<AverageHeartRateBpm>[\s\S]*?<\/AverageHeartRateBpm>/g,
      ""
    );
    expect(reussite(lireTcx(sansFc)).avgHeartRate).toBeNull();
  });
});

describe("GPX", () => {
  const activite = reussite(lireGpx(exemple("strava-footing.gpx")));

  it("déduit la durée des horodatages, la montre ne la totalisant pas", () => {
    expect(activite.durationMin).toBe(34);
  });

  it("calcule la distance depuis les points", () => {
    // Deux fois 0,005° de latitude ≈ 1 111 m. La formule de haversine ne
    // donne pas un compte rond : on vérifie l'ordre de grandeur.
    expect(activite.distanceM).toBeGreaterThan(1080);
    expect(activite.distanceM).toBeLessThan(1140);
  });

  it("moyenne la fréquence cardiaque des points", () => {
    expect(activite.avgHeartRate).toBe(132);
  });

  it("range une sortie de nuit dans le jour où elle a commencé", () => {
    const nuit = reussite(lireGpx(exemple("sortie-a-cheval-sur-minuit.gpx")));
    // 21 h 40 UTC = 23 h 40 à Paris ; l'arrivée est le lendemain.
    expect(nuit.date).toBe("2026-08-04");
    expect(nuit.durationMin).toBe(40);
  });

  it("ignore les points sans coordonnées plutôt que de fausser la distance", () => {
    const troue = exemple("strava-footing.gpx").replace(
      '<trkpt lat="48.8616000" lon="2.3522000">',
      "<trkpt>"
    );
    const lu = reussite(lireGpx(troue));
    expect(lu.durationMin).toBe(34);
    expect(lu.distanceM).toBeGreaterThan(1080);
  });

  it("laisse la fréquence vide quand le fichier n'en contient pas", () => {
    expect(
      reussite(lireGpx(exemple("sortie-a-cheval-sur-minuit.gpx"))).avgHeartRate
    ).toBeNull();
  });
});

/**
 * Le dossier d'exemples ne contient pas de FIT réel (contrairement aux paires
 * GPX/TCX, issues d'un export COROS) : on en construit un avec l'encodeur du
 * même SDK que celui qui le lit — une session, sa fréquence cardiaque étant
 * optionnelle comme sur une vraie montre sans ceinture.
 */
function fitDeSeance({
  debut = new Date("2026-08-05T17:30:00Z"),
  secondes = 1500,
  distanceM = 5000,
  avgHeartRate,
  avecSession = true,
  avecLap = true,
}: {
  debut?: Date;
  secondes?: number;
  distanceM?: number;
  avgHeartRate?: number;
  avecSession?: boolean;
  avecLap?: boolean;
} = {}): ArrayBuffer {
  const encoder = new Encoder();
  encoder.writeMesg({
    mesgNum: Profile.MesgNum.FILE_ID,
    type: "activity",
    manufacturer: "garmin",
    product: 1,
    timeCreated: debut,
  } as Encodable<FileIdMesg>);
  if (avecLap) {
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.LAP,
      startTime: debut,
      totalElapsedTime: secondes,
      totalTimerTime: secondes,
      totalDistance: distanceM,
      ...(avgHeartRate !== undefined ? { avgHeartRate } : {}),
    } as Encodable<LapMesg>);
  }
  if (avecSession) {
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.SESSION,
      startTime: debut,
      totalElapsedTime: secondes,
      totalTimerTime: secondes,
      totalDistance: distanceM,
      ...(avgHeartRate !== undefined ? { avgHeartRate } : {}),
    } as Encodable<SessionMesg>);
  }
  const bytes = encoder.close();
  return new Uint8Array(bytes).buffer;
}

describe("FIT", () => {
  it("lit les totaux du message session (durée, distance, FC moyenne)", () => {
    const activite = reussite(
      lireFichierActivite(
        fitDeSeance({
          debut: new Date("2026-08-05T17:30:00Z"),
          secondes: 1500,
          distanceM: 5000,
          avgHeartRate: 150,
        })
      )
    );
    expect(activite.durationMin).toBe(25);
    expect(activite.distanceM).toBe(5000);
    expect(activite.avgHeartRate).toBe(150);
    expect(activite.date).toBe("2026-08-05");
  });

  it("se rabat sur les tours quand il n'y a pas de message session", () => {
    const activite = reussite(
      lireFichierActivite(
        fitDeSeance({ secondes: 900, distanceM: 3000, avgHeartRate: 140, avecSession: false })
      )
    );
    expect(activite.durationMin).toBe(15);
    expect(activite.distanceM).toBe(3000);
    expect(activite.avgHeartRate).toBe(140);
  });

  it("laisse la fréquence vide quand la montre n'en donne pas", () => {
    expect(reussite(lireFichierActivite(fitDeSeance())).avgHeartRate).toBeNull();
  });

  it("refuse un fichier sans séance ni tour", () => {
    const lecture = lireFichierActivite(fitDeSeance({ avecSession: false, avecLap: false }));
    expect(lecture.ok).toBe(false);
    expect(lecture.ok ? "" : lecture.erreur).toMatch(/Aucune séance trouvée/);
  });

  it("refuse un fichier FIT dont le CRC ne correspond pas", () => {
    const corrompu = new Uint8Array(fitDeSeance());
    corrompu[corrompu.length - 1] ^= 0xff; // dernier octet du CRC de fin de fichier
    const lecture = lireFichierActivite(corrompu.buffer);
    expect(lecture.ok).toBe(false);
    expect(lecture.ok ? "" : lecture.erreur).toMatch(/corrompu/);
  });

  it("reconnaît le format au contenu, même renommé en .gpx", () => {
    const activite = reussite(
      lireFichierActivite(fitDeSeance({ secondes: 1500, distanceM: 5000 }), "seance.gpx")
    );
    expect(activite.durationMin).toBe(25);
  });
});

describe("fichiers refusés", () => {
  const refus = (contenu: string, nom = "") => {
    const lecture = lireFichierActivite(contenu, nom);
    expect(lecture.ok).toBe(false);
    return lecture.ok ? "" : lecture.erreur;
  };

  it("le fichier vide", () => {
    expect(refus("   ")).toMatch(/vide/i);
  });

  it("un contenu qui n'est pas une activité", () => {
    expect(refus("<html><body>Erreur 404</body></html>", "seance.gpx")).toMatch(
      /GPX exploitable/
    );
  });

  it("un format inconnu", () => {
    expect(refus("données binaires", "seance.csv")).toMatch(/GPX, TCX ou FIT/);
  });

  it("un .fit qui n'est pas vraiment un FIT", () => {
    expect(refus("  binaire", "seance.fit")).toMatch(/n'a pas pu être lu/);
  });

  it("un GPX sans assez d'horodatages", () => {
    const unSeulPoint = `<gpx><trk><trkseg>
      <trkpt lat="48.85" lon="2.35"><time>2026-08-04T18:00:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    expect(refus(unSeulPoint)).toMatch(/durée/i);
  });

  it("un TCX sans tour", () => {
    expect(refus("<TrainingCenterDatabase></TrainingCenterDatabase>")).toMatch(
      /TCX exploitable/
    );
  });

  it("un fichier trop volumineux, avant même de l'analyser", () => {
    expect(refus("<gpx>" + "x".repeat(TAILLE_MAX_OCTETS))).toMatch(/volumineux/i);
  });
});

/**
 * Exports réels d'une montre COROS, la même sortie enregistrée dans les deux
 * formats. C'est le contrôle le plus sévère dont on dispose : les deux
 * chemins de lecture n'ont presque rien en commun — en TCX la montre a
 * totalisé ses tours, en GPX tout se déduit des points — et doivent pourtant
 * aboutir au même effort.
 *
 * Les paires sont découvertes dans le dossier : y déposer un nouvel export
 * suffit à le couvrir, sans toucher à ce fichier.
 */
describe("cohérence GPX ↔ TCX sur des exports réels", () => {
  const dossier = fileURLToPath(new URL("./__exemples__/", import.meta.url));
  const paires = readdirSync(dossier)
    .filter((n) => n.toLowerCase().endsWith(".gpx"))
    .map((n) => n.slice(0, -4))
    .filter((base) => existsSync(join(dossier, `${base}.tcx`)));

  it("trouve des paires à comparer", () => {
    // Sans cette garde, la suppression des exemples rendrait les tests
    // ci-dessous silencieusement vides.
    expect(paires.length).toBeGreaterThan(0);
  });

  describe.each(paires)("%s", (base) => {
    const lire = (ext: string) =>
      reussite(
        lireFichierActivite(readFileSync(join(dossier, `${base}.${ext}`), "utf8"), base)
      );
    const gpx = lire("gpx");
    const tcx = lire("tcx");

    it("s'accorde sur le jour de la sortie", () => {
      expect(gpx.date).toBe(tcx.date);
    });

    it("s'accorde sur l'heure de départ à deux minutes près", () => {
      // Le GPX démarre au premier point relevé, le TCX à l'instant déclaré
      // par la montre : quelques secondes séparent les deux.
      const ecart = Math.abs(
        new Date(gpx.startedAt).getTime() - new Date(tcx.startedAt).getTime()
      );
      expect(ecart).toBeLessThanOrEqual(120_000);
    });

    it("s'accorde sur la durée", () => {
      // Le GPX ignore les pauses par déduction, le TCX parce que la montre ne
      // les compte pas. Sur le trail à trois arrêts, l'écart est de 1 min ;
      // sans déduction des pauses il atteignait 5 min, soit 4,3 % — d'où un
      // seuil à 2 %, sans quoi ce test laisserait revenir le défaut.
      // Le minimum d'une minute garde les sorties courtes hors du bruit
      // d'arrondi.
      const ecart = Math.abs(gpx.durationMin - tcx.durationMin);
      expect(ecart).toBeLessThanOrEqual(Math.max(1, tcx.durationMin * 0.02));
    });

    it("s'accorde sur la distance à 3 % près", () => {
      // La montre tient son propre compteur ; nous refaisons le calcul point
      // par point. Les deux ne peuvent pas coïncider exactement.
      expect(gpx.distanceM).not.toBeNull();
      expect(tcx.distanceM).not.toBeNull();
      const ecart = Math.abs(gpx.distanceM! - tcx.distanceM!);
      expect(ecart / tcx.distanceM!).toBeLessThan(0.03);
    });

    it("s'accorde sur la fréquence cardiaque à 3 battements près", () => {
      // En GPX chaque point porte sa valeur, en TCX la montre a moyenné par
      // tour : les deux moyennes ne pondèrent pas de la même façon.
      expect(gpx.avgHeartRate).not.toBeNull();
      expect(tcx.avgHeartRate).not.toBeNull();
      expect(Math.abs(gpx.avgHeartRate! - tcx.avgHeartRate!)).toBeLessThanOrEqual(3);
    });

    it("reste plausible pour une séance d'entraînement", () => {
      // Un contrôle grossier, mais qui attraperait une unité confondue —
      // des secondes prises pour des minutes, des mètres pour des kilomètres.
      for (const lu of [gpx, tcx]) {
        expect(lu.durationMin).toBeGreaterThan(0);
        expect(lu.durationMin).toBeLessThan(24 * 60);
        expect(lu.distanceM!).toBeGreaterThan(100);
        expect(lu.distanceM!).toBeLessThan(500_000);
        expect(lu.avgHeartRate!).toBeGreaterThan(40);
        expect(lu.avgHeartRate!).toBeLessThan(230);
      }
    });
  });
});

describe("trace (FC/allure/altitude)", () => {
  it("extrait FC et altitude d'un GPX réel", () => {
    const trace = reussite(lireGpx(exemple("strava-footing.gpx"))).trace;
    expect(trace).not.toBeNull();
    expect(trace![0].tOffsetS).toBe(0);
    expect(trace!.some((p) => p.heartRate !== null)).toBe(true);
    expect(trace!.some((p) => p.altitudeM !== null)).toBe(true);
  });

  it("extrait FC et altitude d'un TCX réel", () => {
    const trace = reussite(
      lireTcx(exemple("LaTour-en-JarezTrail20260516110831.tcx"))
    ).trace;
    expect(trace).not.toBeNull();
    expect(trace!.some((p) => p.heartRate !== null)).toBe(true);
    expect(trace!.some((p) => p.altitudeM !== null)).toBe(true);
  });

  it("sous-échantillonne une trace longue à 400 points, sans perdre les extrémités", () => {
    // Export réel de 6871 points GPX (trail).
    const trace = reussite(
      lireGpx(exemple("LaTour-en-JarezTrail20260516110831.gpx"))
    ).trace!;
    expect(trace.length).toBeLessThanOrEqual(400);
    expect(trace[0].tOffsetS).toBe(0);
    expect(trace[trace.length - 1].tOffsetS).toBeGreaterThan(0);
  });

  it("calcule une allure plausible à partir de la position (GPX)", () => {
    const trace = reussite(lireGpx(exemple("strava-footing.gpx"))).trace!;
    const allures = trace.map((p) => p.paceSecPerKm).filter((p): p is number => p !== null);
    expect(allures.length).toBeGreaterThan(0);
    for (const a of allures) {
      expect(a).toBeGreaterThanOrEqual(60);
      expect(a).toBeLessThanOrEqual(7200);
    }
  });

  it("vaut null sans FC, position ni altitude à en tirer", () => {
    const xml = `<gpx><trk><trkseg>
      <trkpt><time>2026-08-04T18:00:00Z</time></trkpt>
      <trkpt><time>2026-08-04T18:05:00Z</time></trkpt>
    </trkseg></trk></gpx>`;
    expect(reussite(lireGpx(xml)).trace).toBeNull();
  });

  it("préfère la vitesse instantanée d'un FIT au calcul par position", () => {
    const debut = new Date("2026-08-05T17:30:00Z");
    const encoder = new Encoder();
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.FILE_ID,
      type: "activity",
      manufacturer: "garmin",
      product: 1,
      timeCreated: debut,
    } as Encodable<FileIdMesg>);
    encoder.writeMesg({
      mesgNum: Profile.MesgNum.SESSION,
      startTime: debut,
      totalElapsedTime: 600,
      totalTimerTime: 600,
      totalDistance: 2000,
    } as Encodable<SessionMesg>);
    // 3 m/s ≈ 333 s/km.
    for (let i = 0; i < 3; i++) {
      encoder.writeMesg({
        mesgNum: Profile.MesgNum.RECORD,
        timestamp: new Date(debut.getTime() + i * 60_000),
        heartRate: 140 + i,
        enhancedAltitude: 100 + i,
        enhancedSpeed: 3,
      } as Encodable<RecordMesg>);
    }
    const activite = reussite(
      lireFichierActivite(new Uint8Array(encoder.close()).buffer)
    );
    const trace = activite.trace!;
    expect(trace).toHaveLength(3);
    expect(trace[0].tOffsetS).toBe(0);
    expect(trace[1].tOffsetS).toBe(60);
    expect(trace.map((p) => p.heartRate)).toEqual([140, 141, 142]);
    expect(trace.map((p) => p.altitudeM)).toEqual([100, 101, 102]);
    for (const p of trace) {
      expect(p.paceSecPerKm).toBeCloseTo(333.3, 0);
    }
  });
});

describe("validerTrace", () => {
  it("accepte une trace bien formée", () => {
    const brut = JSON.stringify([
      { tOffsetS: 0, heartRate: 140, paceSecPerKm: 300, altitudeM: 100 },
      { tOffsetS: 60, heartRate: 145, paceSecPerKm: null, altitudeM: 102 },
    ]);
    expect(validerTrace(brut)).toEqual([
      { tOffsetS: 0, heartRate: 140, paceSecPerKm: 300, altitudeM: 100 },
      { tOffsetS: 60, heartRate: 145, paceSecPerKm: null, altitudeM: 102 },
    ]);
  });

  it("vaut un tableau vide pour une entrée absente ou illisible", () => {
    expect(validerTrace("")).toEqual([]);
    expect(validerTrace("pas du json")).toEqual([]);
    expect(validerTrace("{}")).toEqual([]);
    expect(validerTrace("null")).toEqual([]);
  });

  it("écarte les points sans horodatage plutôt que la trace entière", () => {
    const brut = JSON.stringify([
      { tOffsetS: 0, heartRate: 140, paceSecPerKm: null, altitudeM: null },
      { heartRate: 999 },
      "pas un point",
      { tOffsetS: 30, heartRate: 141, paceSecPerKm: null, altitudeM: null },
    ]);
    expect(validerTrace(brut)).toHaveLength(2);
  });

  it("remplace une valeur hors bornes par null plutôt que de la garder telle quelle", () => {
    // Un formulaire se manipule : une FC de 999 bpm ne doit pas atteindre la base.
    const brut = JSON.stringify([
      { tOffsetS: 0, heartRate: 999, paceSecPerKm: 1, altitudeM: 50_000 },
    ]);
    expect(validerTrace(brut)).toEqual([
      { tOffsetS: 0, heartRate: null, paceSecPerKm: null, altitudeM: null },
    ]);
  });

  it("plafonne le nombre de points, sans dépasser ce que la lecture produit elle-même", () => {
    const trop = Array.from({ length: MAX_POINTS_TRACE + 200 }, (_, i) => ({
      tOffsetS: i,
      heartRate: null,
      paceSecPerKm: null,
      altitudeM: 100,
    }));
    expect(validerTrace(JSON.stringify(trop))).toHaveLength(MAX_POINTS_TRACE);
  });
});

describe("formatDistance", () => {
  it("passe au kilomètre au-delà de mille mètres", () => {
    expect(formatDistance(850)).toBe("850 m");
    expect(formatDistance(9984)).toBe("10,0 km");
    expect(formatDistance(1000)).toBe("1,0 km");
  });

  it("écrit la virgule décimale du français", () => {
    expect(formatDistance(15230)).toBe("15,2 km");
  });
});

describe("choix de l'analyseur", () => {
  it("reconnaît le format au contenu, pas à l'extension", () => {
    // Un TCX renommé en .gpx reste lisible : l'athlète renomme, la montre non.
    const lecture = lireFichierActivite(exemple("garmin-sortie-longue.tcx"), "seance.gpx");
    expect(reussite(lecture).durationMin).toBe(78);
  });

  it("se rabat sur l'extension quand la racine est absente", () => {
    const sansRacine = exemple("strava-footing.gpx").replace(/<\/?gpx[^>]*>/g, "");
    expect(reussite(lireFichierActivite(sansRacine, "seance.gpx")).durationMin).toBe(34);
  });
});

describe("tours", () => {
  it("garde les tours d'un TCX réel, dans l'ordre", () => {
    // 11 `<Lap>` dans le fichier — vérifié en les comptant à la main.
    const activite = reussite(
      lireFichierActivite(exemple("LeCoteauCourse20260529210037.tcx"), "seance.tcx")
    );
    expect(activite.tours).toHaveLength(11);
    expect(activite.tours.map((t) => t.position)).toEqual([...Array(11).keys()]);
    expect(activite.tours.every((t) => t.durationS > 0)).toBe(true);
  });

  it("ne prend pas la cadence des points pour celle du tour", () => {
    // Ce fichier porte 2202 balises `<Cadence>` — une par point de trace.
    // Sans retirer les blocs `<Track>` avant lecture, le premier point
    // passerait pour la cadence du tour entier.
    const activite = reussite(
      lireFichierActivite(exemple("LeCoteauCourse20260529210037.tcx"), "seance.tcx")
    );
    const cadences = activite.tours.map((t) => t.avgCadence);
    expect(cadences.every((c) => c === null || (c >= 0 && c <= 300))).toBe(true);
  });

  it("additionne les tours pour retrouver la durée totale", () => {
    // Cohérence interne : la somme des tours ne peut pas s'éloigner du total
    // déclaré, sinon c'est qu'on en a raté ou compté deux fois.
    const activite = reussite(
      lireFichierActivite(exemple("LaTour-en-JarezTrail20260516110831.tcx"), "t.tcx")
    );
    const somme = activite.tours.reduce((s, t) => s + t.durationS, 0);
    expect(Math.abs(somme / 60 - activite.durationMin)).toBeLessThan(1);
  });

  it("rend un tableau vide pour un GPX, qui n'a pas de tours", () => {
    const activite = reussite(
      lireFichierActivite(exemple("strava-footing.gpx"), "footing.gpx")
    );
    expect(activite.tours).toEqual([]);
  });

  it("garde les tours d'un FIT", () => {
    const activite = reussite(
      lireFichierActivite(fitDeSeance({ secondes: 900, distanceM: 3000, avgHeartRate: 140 }))
    );
    expect(activite.tours.length).toBeGreaterThan(0);
    expect(activite.tours[0].position).toBe(0);
    expect(activite.tours[0].durationS).toBeGreaterThan(0);
  });
});

describe("validerTours", () => {
  const tour = (durationS: number) => ({
    durationS,
    distanceM: 1000,
    avgHeartRate: 160,
    avgCadence: 170,
  });

  it("accepte des tours bien formés et les renumérote", () => {
    const tours = validerTours(JSON.stringify([tour(300), tour(90), tour(300)]));
    expect(tours.map((t) => t.position)).toEqual([0, 1, 2]);
    expect(tours[1].durationS).toBe(90);
  });

  it("écarte un tour sans durée sans faire échouer les autres", () => {
    // Une montre écrit parfois un tour de zéro seconde à l'arrêt : le garder
    // le ferait compter comme une répétition.
    const tours = validerTours(
      JSON.stringify([tour(300), { ...tour(0) }, { durationS: "beaucoup" }, tour(280)])
    );
    expect(tours).toHaveLength(2);
    expect(tours.map((t) => t.position)).toEqual([0, 1]);
  });

  it("écarte une valeur hors bornes sans écarter le tour", () => {
    const tours = validerTours(
      JSON.stringify([{ durationS: 300, distanceM: 1000, avgHeartRate: 900, avgCadence: -5 }])
    );
    expect(tours[0].avgHeartRate).toBeNull();
    expect(tours[0].avgCadence).toBeNull();
    expect(tours[0].durationS).toBe(300);
  });

  it("borne le nombre de tours", () => {
    const trop = Array.from({ length: MAX_TOURS + 50 }, () => tour(60));
    expect(validerTours(JSON.stringify(trop))).toHaveLength(MAX_TOURS);
  });

  it("ne rend rien d'une saisie qui n'est pas un tableau", () => {
    expect(validerTours("")).toEqual([]);
    expect(validerTours("{oups")).toEqual([]);
    expect(validerTours('{"tours":[]}')).toEqual([]);
  });
});
