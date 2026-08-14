import { describe, expect, it } from "vitest";
import { memeSortie, trouverDoublon } from "./doublons";

const DEPART = "2026-08-14T08:00:00.000Z";
const decale = (minutes: number) =>
  new Date(Date.parse(DEPART) + minutes * 60_000).toISOString();

describe("memeSortie", () => {
  it("rapproche le même footing exporté sous deux formats", () => {
    // Le cas réel : un GPX sans tours, puis le FIT de la montre redéposé pour
    // obtenir l'analyse des répétitions. Deux contenus, deux empreintes, une
    // seule sortie.
    expect(
      memeSortie(
        { startedAt: DEPART, durationMin: 42 },
        { startedAt: decale(1), durationMin: 42 }
      )
    ).toBe(true);
  });

  it("tolère le décalage entre chronomètre et premier point GPS", () => {
    expect(
      memeSortie(
        { startedAt: DEPART, durationMin: 60 },
        { startedAt: decale(4), durationMin: 58 }
      )
    ).toBe(true);
  });

  it("sépare deux sorties de la même journée", () => {
    // Un doublé matin/soir : même jour, même durée, et surtout pas la même
    // sortie. C'est le faux positif qu'il ne faut jamais produire.
    expect(
      memeSortie(
        { startedAt: DEPART, durationMin: 45 },
        { startedAt: decale(600), durationMin: 45 }
      )
    ).toBe(false);
  });

  it("sépare deux sorties séparées de six minutes", () => {
    expect(
      memeSortie(
        { startedAt: DEPART, durationMin: 30 },
        { startedAt: decale(6), durationMin: 30 }
      )
    ).toBe(false);
  });

  it("accepte l'écart entre temps en mouvement et temps écoulé", () => {
    // 1 h 20 de mouvement pour 2 h écoulées sur un trail avec pauses : deux
    // mesures honnêtes de la même sortie, rapport 0,67.
    expect(
      memeSortie(
        { startedAt: DEPART, durationMin: 80 },
        { startedAt: decale(2), durationMin: 120 }
      )
    ).toBe(true);
  });

  it("refuse de rapprocher des durées sans commune mesure", () => {
    // Dix minutes contre trois heures : partir ensemble ne suffit pas.
    expect(
      memeSortie(
        { startedAt: DEPART, durationMin: 10 },
        { startedAt: DEPART, durationMin: 180 }
      )
    ).toBe(false);
  });

  it("ne rapproche rien sur une date illisible", () => {
    // Mieux vaut laisser passer un doublon qu'en refuser un sur une
    // comparaison qui n'a pas eu lieu.
    expect(
      memeSortie(
        { startedAt: "pas une date", durationMin: 42 },
        { startedAt: DEPART, durationMin: 42 }
      )
    ).toBe(false);
  });

  it("est symétrique", () => {
    const a = { startedAt: DEPART, durationMin: 80 };
    const b = { startedAt: decale(3), durationMin: 120 };
    expect(memeSortie(a, b)).toBe(memeSortie(b, a));
  });
});

describe("trouverDoublon", () => {
  const existantes = [
    { id: "matin", startedAt: DEPART, durationMin: 45 },
    { id: "soir", startedAt: decale(600), durationMin: 50 },
  ];

  it("rend l'activité concernée, pas seulement un booléen", () => {
    // L'appelant doit pouvoir la nommer : un refus qui ne dit pas laquelle
    // laisse l'athlète sans rien à faire.
    expect(
      trouverDoublon({ startedAt: decale(2), durationMin: 44 }, existantes)?.id
    ).toBe("matin");
  });

  it("reconnaît la sortie du soir sans confondre avec celle du matin", () => {
    expect(
      trouverDoublon({ startedAt: decale(601), durationMin: 50 }, existantes)?.id
    ).toBe("soir");
  });

  it("rend null quand rien ne correspond", () => {
    expect(
      trouverDoublon({ startedAt: decale(300), durationMin: 45 }, existantes)
    ).toBeNull();
  });

  it("rend null sur une liste vide", () => {
    expect(trouverDoublon({ startedAt: DEPART, durationMin: 45 }, [])).toBeNull();
  });
});
