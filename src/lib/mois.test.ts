import { describe, expect, it } from "vitest";
import {
  bornesMois,
  decalerMois,
  grilleMois,
  libelleMois,
  lundisDuMois,
  moisDe,
} from "./mois";

describe("moisDe", () => {
  it("garde l'année et le mois", () => {
    expect(moisDe("2026-08-14")).toBe("2026-08");
  });
});

describe("decalerMois", () => {
  it("avance et recule d'un mois", () => {
    expect(decalerMois("2026-08", 1)).toBe("2026-09");
    expect(decalerMois("2026-08", -1)).toBe("2026-07");
  });

  it("franchit l'année dans les deux sens", () => {
    expect(decalerMois("2026-12", 1)).toBe("2027-01");
    expect(decalerMois("2026-01", -1)).toBe("2025-12");
  });

  it("saute plusieurs mois d'un coup", () => {
    expect(decalerMois("2026-08", -14)).toBe("2025-06");
  });
});

describe("libelleMois", () => {
  it("nomme le mois en français", () => {
    expect(libelleMois("2026-08")).toBe("août 2026");
    expect(libelleMois("2026-01")).toBe("janvier 2026");
  });
});

describe("bornesMois", () => {
  it("trouve le dernier jour sans table de longueurs", () => {
    expect(bornesMois("2026-08")).toEqual({ debut: "2026-08-01", fin: "2026-08-31" });
    expect(bornesMois("2026-04").fin).toBe("2026-04-30");
  });

  it("gère février, bissextile ou non", () => {
    expect(bornesMois("2026-02").fin).toBe("2026-02-28");
    // 2028 est bissextile.
    expect(bornesMois("2028-02").fin).toBe("2028-02-29");
  });
});

describe("grilleMois", () => {
  // Août 2026 : le 1er est un samedi, le 31 un lundi. Le pire cas — il déborde
  // des deux côtés, et la dernière semaine ne contient qu'un seul jour du mois.
  const aout = grilleMois("2026-08", "2026-08-14");

  it("commence un lundi et finit un dimanche", () => {
    expect(aout[0].jours[0].iso).toBe("2026-07-27");
    const derniere = aout[aout.length - 1];
    expect(derniere.jours[6].iso).toBe("2026-09-06");
  });

  it("donne des lignes de sept jours, toujours", () => {
    // Couper les semaines à cheval désalignerait les colonnes des jours.
    expect(aout.every((s) => s.jours.length === 7)).toBe(true);
  });

  it("couvre le mois entier sans le déborder d'une semaine inutile", () => {
    const jours = aout.flatMap((s) => s.jours);
    const duMois = jours.filter((j) => j.dansLeMois);
    expect(duMois[0].iso).toBe("2026-08-01");
    expect(duMois[duMois.length - 1].iso).toBe("2026-08-31");
    expect(duMois).toHaveLength(31);
  });

  it("marque les jours de complément comme hors du mois", () => {
    expect(aout[0].jours[0].dansLeMois).toBe(false); // 27 juillet
    expect(aout[0].jours[5].dansLeMois).toBe(true); // 1er août, samedi
  });

  it("repère aujourd'hui et le passé", () => {
    const jours = aout.flatMap((s) => s.jours);
    expect(jours.filter((j) => j.isToday).map((j) => j.iso)).toEqual([
      "2026-08-14",
    ]);
    expect(jours.find((j) => j.iso === "2026-08-13")?.isPast).toBe(true);
    expect(jours.find((j) => j.iso === "2026-08-14")?.isPast).toBe(false);
    expect(jours.find((j) => j.iso === "2026-08-15")?.isPast).toBe(false);
  });

  it("cadre un mois qui commence un lundi sans ligne vide devant", () => {
    // Juin 2026 commence un lundi : la grille doit démarrer sur le 1er.
    expect(grilleMois("2026-06", "2026-06-15")[0].jours[0].iso).toBe("2026-06-01");
  });

  it("cadre février d'une année où il tient en quatre semaines", () => {
    // Février 2027 : le 1er est un lundi, le 28 un dimanche. Exactement quatre
    // lignes, sans aucun jour de complément.
    const fev = grilleMois("2027-02", "2027-02-10");
    expect(fev).toHaveLength(4);
    expect(fev.flatMap((s) => s.jours).every((j) => j.dansLeMois)).toBe(true);
  });

  it("ne rend jamais plus de six lignes", () => {
    // Six est le maximum arithmétique : 31 jours commençant un dimanche.
    for (const mois of ["2026-01", "2026-02", "2026-08", "2026-11", "2027-05"]) {
      expect(grilleMois(mois, "2026-08-14").length).toBeLessThanOrEqual(6);
    }
  });
});

describe("lundisDuMois", () => {
  it("donne un lundi par ligne de la grille", () => {
    expect(lundisDuMois("2026-08")).toEqual([
      "2026-07-27",
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });
});
