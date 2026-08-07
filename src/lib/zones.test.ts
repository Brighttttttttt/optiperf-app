import { describe, expect, it } from "vitest";
import {
  additionnerZones,
  pourcentagesZones,
  repartitionZones,
  totalZones,
  zoneDeFc,
} from "./zones";

describe("zoneDeFc", () => {
  const fcMax = 190;

  it("range en Z1 tout ce qui est sous 60 % de FC max", () => {
    expect(zoneDeFc(90, fcMax)).toBe(1); // 47 %
    expect(zoneDeFc(113, fcMax)).toBe(1); // 59 %
  });

  it("place les frontières dans la zone du haut", () => {
    // 60 %, 70 %, 80 %, 90 % pile.
    expect(zoneDeFc(114, fcMax)).toBe(2);
    expect(zoneDeFc(133, fcMax)).toBe(3);
    expect(zoneDeFc(152, fcMax)).toBe(4);
    expect(zoneDeFc(171, fcMax)).toBe(5);
  });

  it("garde Z5 au-delà de 100 % de FC max déclarée", () => {
    expect(zoneDeFc(200, fcMax)).toBe(5);
  });
});

describe("repartitionZones", () => {
  const fcMax = 190;

  it("attribue chaque intervalle à la zone du point qui le termine", () => {
    // 0→60s en Z1 (90 bpm), 60→120s en Z4 (155 bpm).
    const zones = repartitionZones([0, 60, 120], [90, 90, 155], fcMax);
    expect(zones).toEqual({ z1: 60, z2: 0, z3: 0, z4: 60, z5: 0 });
  });

  it("ignore les points sans FC plutôt que de fausser un intervalle", () => {
    const zones = repartitionZones([0, 60, 120], [90, null, 90], fcMax);
    expect(totalZones(zones)).toBe(60); // seul le deuxième intervalle compte
  });

  it("vaut zéro partout sans aucun point", () => {
    expect(repartitionZones([], [], fcMax)).toEqual({
      z1: 0,
      z2: 0,
      z3: 0,
      z4: 0,
      z5: 0,
    });
  });
});

describe("additionnerZones / totalZones", () => {
  it("additionne zone à zone", () => {
    const a = { z1: 10, z2: 0, z3: 0, z4: 0, z5: 0 };
    const b = { z1: 5, z2: 20, z3: 0, z4: 0, z5: 0 };
    expect(additionnerZones(a, b)).toEqual({ z1: 15, z2: 20, z3: 0, z4: 0, z5: 0 });
  });

  it("totalise les cinq zones", () => {
    expect(totalZones({ z1: 1, z2: 2, z3: 3, z4: 4, z5: 5 })).toBe(15);
  });
});

describe("pourcentagesZones", () => {
  it("somme à 100", () => {
    const pct = pourcentagesZones({ z1: 30, z2: 30, z3: 20, z4: 10, z5: 10 });
    expect(pct.z1 + pct.z2 + pct.z3 + pct.z4 + pct.z5).toBeCloseTo(100, 6);
    expect(pct.z1).toBeCloseTo(30, 6);
  });

  it("vaut zéro partout sans aucun temps enregistré, sans diviser par zéro", () => {
    expect(pourcentagesZones({ z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 })).toEqual({
      z1: 0,
      z2: 0,
      z3: 0,
      z4: 0,
      z5: 0,
    });
  });
});
