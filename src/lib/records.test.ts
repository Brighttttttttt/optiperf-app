import { describe, expect, it } from "vitest";
import {
  estimerVma,
  formatDurationInput,
  parseDurationInput,
  recordDistanceLabel,
} from "./records";

describe("parseDurationInput / formatDurationInput", () => {
  it("lit un chrono mm:ss", () => {
    expect(parseDurationInput("22:30")).toBe(1350);
  });

  it("lit un chrono h:mm:ss", () => {
    expect(parseDurationInput("1:32:10")).toBe(5530);
  });

  it("refuse ce qui n'est ni l'un ni l'autre", () => {
    expect(parseDurationInput("22h30")).toBeNull();
    expect(parseDurationInput("22:75")).toBeNull();
    expect(parseDurationInput("")).toBeNull();
    expect(parseDurationInput("0:00")).toBeNull();
  });

  it("formate sans heure sous 60 minutes, avec heure au-delà", () => {
    expect(formatDurationInput(1350)).toBe("22:30");
    expect(formatDurationInput(5530)).toBe("1:32:10");
  });

  it("fait l'aller-retour", () => {
    expect(parseDurationInput(formatDurationInput(5530))).toBe(5530);
    expect(parseDurationInput(formatDurationInput(1350))).toBe(1350);
  });
});

describe("recordDistanceLabel", () => {
  it("connaît les quatre distances standard", () => {
    expect(recordDistanceLabel("5km")).toBe("5 km");
    expect(recordDistanceLabel("semi")).toBe("Semi-marathon");
  });

  it("se rabat sur la valeur brute pour une distance inconnue", () => {
    expect(recordDistanceLabel("10 miles")).toBe("10 miles");
  });
});

describe("estimerVma", () => {
  it("suggère une VMA plausible à partir d'un chrono sur 5 km", () => {
    // 5 km en 20 min = 15 km/h, à 93 % de VMA usuellement.
    const vma = estimerVma("5km", 1200);
    expect(vma).not.toBeNull();
    expect(vma!).toBeCloseTo(16.1, 1);
  });

  it("vaut null pour une distance inconnue", () => {
    expect(estimerVma("10 miles", 3000)).toBeNull();
  });
});
