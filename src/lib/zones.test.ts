import { describe, expect, it } from "vitest";
import {
  additionnerZones,
  pourcentagesZones,
  repartitionZones,
  totalZones,
  zoneDeFc,
  methodeCalculable,
} from "./zones";

describe("zoneDeFc", () => {
  const fcMax = 190;
  const refs = { fcMax, fcRepos: null, lthr: null };

  it("range en Z1 tout ce qui est sous 60 % de FC max", () => {
    expect(zoneDeFc(90, "fcmax", refs)).toBe(1); // 47 %
    expect(zoneDeFc(113, "fcmax", refs)).toBe(1); // 59 %
  });

  it("place les frontières dans la zone du haut", () => {
    // 60 %, 70 %, 80 %, 90 % pile.
    expect(zoneDeFc(114, "fcmax", refs)).toBe(2);
    expect(zoneDeFc(133, "fcmax", refs)).toBe(3);
    expect(zoneDeFc(152, "fcmax", refs)).toBe(4);
    expect(zoneDeFc(171, "fcmax", refs)).toBe(5);
  });

  it("garde Z5 au-delà de 100 % de FC max déclarée", () => {
    expect(zoneDeFc(200, "fcmax", refs)).toBe(5);
  });
});

describe("repartitionZones", () => {
  const fcMax = 190;
  const refs = { fcMax, fcRepos: null, lthr: null };

  it("attribue chaque intervalle à la zone du point qui le termine", () => {
    // 0→60s en Z1 (90 bpm), 60→120s en Z4 (155 bpm).
    const zones = repartitionZones([0, 60, 120], [90, 90, 155], "fcmax", refs);
    expect(zones).toEqual({ z1: 60, z2: 0, z3: 0, z4: 60, z5: 0 });
  });

  it("ignore les points sans FC plutôt que de fausser un intervalle", () => {
    const zones = repartitionZones([0, 60, 120], [90, null, 90], "fcmax", refs);
    expect(totalZones(zones)).toBe(60); // seul le deuxième intervalle compte
  });

  it("vaut zéro partout sans aucun point", () => {
    expect(repartitionZones([], [], "fcmax", refs)).toEqual({
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

describe("les trois méthodes", () => {
  // Un coureur ordinaire : max 190, repos 50, seuil 168.
  const complet = { fcMax: 190, fcRepos: 50, lthr: 168 };

  it("classe un même battement différemment selon la méthode", () => {
    // 140 bpm, et trois réponses différentes :
    //   FC max     140/190 = 74 %  → Z3
    //   Karvonen   (140−50)/140 = 64 % de la réserve → Z2, plus bas parce
    //              qu'un cœur qui repose à 50 part de plus loin
    //   LTHR       140/168 = 83 %, sous le premier palier du seuil → Z1
    // C'est tout l'enjeu du choix : la même sortie se lit facile ou soutenue.
    expect(zoneDeFc(140, "fcmax", complet)).toBe(3);
    expect(zoneDeFc(140, "karvonen", complet)).toBe(2);
    expect(zoneDeFc(140, "lthr", complet)).toBe(1);
  });

  it("Karvonen écarte deux coureurs de même FC max mais de repos différent", () => {
    // C'est toute sa raison d'être : la réserve, pas le maximum.
    const entraine = { fcMax: 190, fcRepos: 40, lthr: null };
    const sedentaire = { fcMax: 190, fcRepos: 70, lthr: null };
    expect(zoneDeFc(140, "karvonen", entraine)).not.toBe(
      zoneDeFc(140, "karvonen", sedentaire)
    );
  });

  it("place le seuil lui-même en haut de Z4, pas en Z5", () => {
    // Courir *au* seuil n'est pas le dépasser.
    expect(zoneDeFc(167, "lthr", complet)).toBe(4);
    expect(zoneDeFc(168, "lthr", complet)).toBe(5);
  });

  it("refuse de calculer sans la donnée qu'il lui faut", () => {
    const sansRien = { fcMax: null, fcRepos: null, lthr: null };
    expect(zoneDeFc(150, "fcmax", sansRien)).toBeNull();
    expect(zoneDeFc(150, "lthr", { fcMax: 190, fcRepos: 50, lthr: null })).toBeNull();
    // Karvonen a besoin des deux : la FC max seule ne suffit pas.
    expect(zoneDeFc(150, "karvonen", { fcMax: 190, fcRepos: null, lthr: null })).toBeNull();
  });

  it("dit ce qui est calculable avant qu'on essaie", () => {
    expect(methodeCalculable("fcmax", complet)).toBe(true);
    expect(methodeCalculable("karvonen", { fcMax: 190, fcRepos: null, lthr: null })).toBe(
      false
    );
    expect(methodeCalculable("lthr", { fcMax: null, fcRepos: null, lthr: 168 })).toBe(true);
  });

  it("ne compte aucun temps quand la méthode n'est pas calculable", () => {
    // Mieux vaut une répartition vide que des zones inventées : la page sait
    // alors qu'elle n'a rien à montrer.
    const zones = repartitionZones([0, 10, 20], [150, 150, 150], "lthr", {
      fcMax: 190,
      fcRepos: 50,
      lthr: null,
    });
    expect(totalZones(zones)).toBe(0);
  });

  it("garde une réserve nulle hors des zones plutôt que de diviser par zéro", () => {
    expect(zoneDeFc(150, "karvonen", { fcMax: 150, fcRepos: 150, lthr: null })).toBeNull();
  });
});
