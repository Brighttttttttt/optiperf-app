import { describe, expect, it } from "vitest";
import { formatBlockDuration, formatPaceInput, parsePaceInput, validerBlocs } from "./blocks";

describe("formatBlockDuration", () => {
  it("passe en secondes sous la minute", () => {
    expect(formatBlockDuration(30)).toBe("30 s");
  });

  it("omet les secondes quand elles sont nulles", () => {
    expect(formatBlockDuration(180)).toBe("3 min");
  });

  it("combine minutes et secondes", () => {
    expect(formatBlockDuration(90)).toBe("1 min 30");
  });
});

describe("parsePaceInput / formatPaceInput", () => {
  it("lit une allure mm:ss", () => {
    expect(parsePaceInput("4:30")).toBe(270);
    expect(parsePaceInput("12:05")).toBe(725);
  });

  it("refuse ce qui n'est pas au format mm:ss", () => {
    expect(parsePaceInput("4h30")).toBeNull();
    expect(parsePaceInput("4:75")).toBeNull(); // secondes hors bornes
    expect(parsePaceInput("")).toBeNull();
    expect(parsePaceInput("0:00")).toBeNull(); // pas d'allure nulle
  });

  it("formate l'aller-retour", () => {
    expect(formatPaceInput(270)).toBe("4:30");
    expect(parsePaceInput(formatPaceInput(725))).toBe(725);
  });
});

describe("validerBlocs", () => {
  it("accepte une liste bien formée", () => {
    const brut = JSON.stringify([
      { block_type: "echauffement", duration_sec: 900, distance_m: null, target_pace_sec_per_km: null, repetitions: null },
      { block_type: "intervalle", duration_sec: 180, distance_m: null, target_pace_sec_per_km: 270, repetitions: 6 },
    ]);
    expect(validerBlocs(brut)).toEqual([
      { block_type: "echauffement", duration_sec: 900, distance_m: null, target_pace_sec_per_km: null, repetitions: null },
      { block_type: "intervalle", duration_sec: 180, distance_m: null, target_pace_sec_per_km: 270, repetitions: 6 },
    ]);
  });

  it("vaut un tableau vide pour une entrée absente ou illisible", () => {
    expect(validerBlocs("")).toEqual([]);
    expect(validerBlocs("pas du json")).toEqual([]);
    expect(validerBlocs("{}")).toEqual([]);
  });

  it("écarte un bloc sans durée ni distance plutôt que la liste entière", () => {
    const brut = JSON.stringify([
      { block_type: "echauffement", duration_sec: null, distance_m: null },
      { block_type: "intervalle", duration_sec: 180, distance_m: null },
    ]);
    expect(validerBlocs(brut)).toHaveLength(1);
  });

  it("écarte un bloc de type inconnu", () => {
    const brut = JSON.stringify([{ block_type: "sprint", duration_sec: 30 }]);
    expect(validerBlocs(brut)).toEqual([]);
  });

  it("remplace une allure ou des répétitions hors bornes par null", () => {
    const brut = JSON.stringify([
      { block_type: "intervalle", duration_sec: 180, target_pace_sec_per_km: 5, repetitions: 999 },
    ]);
    expect(validerBlocs(brut)).toEqual([
      {
        block_type: "intervalle",
        duration_sec: 180,
        distance_m: null,
        target_pace_sec_per_km: null,
        repetitions: null,
      },
    ]);
  });

  it("plafonne le nombre de blocs", () => {
    const trop = Array.from({ length: 40 }, () => ({
      block_type: "recuperation",
      duration_sec: 60,
    }));
    expect(validerBlocs(JSON.stringify(trop))).toHaveLength(30);
  });
});
