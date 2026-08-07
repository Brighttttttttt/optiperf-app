import { describe, expect, it } from "vitest";
import {
  formatCharge,
  formatExercise,
  validerExerciseLogs,
  validerExercices,
} from "./exercises";

describe("formatExercise / formatCharge", () => {
  it("affiche séries × répétitions et la charge", () => {
    expect(formatExercise(4, 8, 40)).toBe("4 × 8 @ 40 kg");
  });

  it("omet la charge au poids du corps", () => {
    expect(formatExercise(3, 12, null)).toBe("3 × 12");
  });

  it("écrit la virgule décimale du français", () => {
    expect(formatCharge(42.5)).toBe("42,5 kg");
    expect(formatCharge(40)).toBe("40 kg");
  });
});

describe("validerExercices", () => {
  it("accepte une liste bien formée", () => {
    const brut = JSON.stringify([
      { name: "Squat", sets: 4, reps: 8, charge_kg: 60, rest_sec: 90 },
      { name: "Pompes", sets: 3, reps: 15, charge_kg: null, rest_sec: null },
    ]);
    expect(validerExercices(brut)).toEqual([
      { name: "Squat", sets: 4, reps: 8, charge_kg: 60, rest_sec: 90 },
      { name: "Pompes", sets: 3, reps: 15, charge_kg: null, rest_sec: null },
    ]);
  });

  it("vaut un tableau vide pour une entrée absente ou illisible", () => {
    expect(validerExercices("")).toEqual([]);
    expect(validerExercices("pas du json")).toEqual([]);
  });

  it("écarte un exercice sans nom, sans séries ou sans répétitions", () => {
    const brut = JSON.stringify([
      { name: "", sets: 4, reps: 8 },
      { name: "Squat", sets: null, reps: 8 },
      { name: "Fentes", sets: 3, reps: 10 },
    ]);
    expect(validerExercices(brut)).toHaveLength(1);
  });

  it("plafonne le nombre d'exercices", () => {
    const trop = Array.from({ length: 40 }, (_, i) => ({
      name: `Exercice ${i}`,
      sets: 3,
      reps: 10,
    }));
    expect(validerExercices(JSON.stringify(trop))).toHaveLength(30);
  });
});

describe("validerExerciseLogs", () => {
  it("accepte un compte rendu bien formé", () => {
    const brut = JSON.stringify([
      { exercise_id: "abc", sets_done: 4, reps_done: 8, charge_kg_done: 60, done: true },
    ]);
    expect(validerExerciseLogs(brut)).toEqual([
      { exercise_id: "abc", sets_done: 4, reps_done: 8, charge_kg_done: 60, done: true },
    ]);
  });

  it("écarte un log sans exercise_id", () => {
    const brut = JSON.stringify([{ sets_done: 4, done: true }]);
    expect(validerExerciseLogs(brut)).toEqual([]);
  });

  it("remplace une valeur hors bornes par null", () => {
    const brut = JSON.stringify([
      { exercise_id: "abc", sets_done: 999, reps_done: 8, charge_kg_done: 60, done: false },
    ]);
    expect(validerExerciseLogs(brut)).toEqual([
      { exercise_id: "abc", sets_done: null, reps_done: 8, charge_kg_done: 60, done: false },
    ]);
  });
});
