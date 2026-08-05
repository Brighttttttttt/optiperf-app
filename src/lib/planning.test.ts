import { describe, expect, it } from "vitest";
import { batchSummary, planningCalendar, pluralize } from "./planning";

// Mercredi 5 août 2026, 10 h à Paris.
const NOW = new Date("2026-08-05T10:00:00+02:00");

describe("planningCalendar", () => {
  const days = planningCalendar(3, NOW);

  it("ne propose jamais de date passée", () => {
    expect(days.every((d) => d.iso >= "2026-08-05")).toBe(true);
  });

  it("commence aujourd'hui", () => {
    expect(days[0].iso).toBe("2026-08-05");
    expect(days[0].isToday).toBe(true);
  });

  it("couvre les semaines demandées jusqu'au dimanche", () => {
    // Semaine en cours amputée (mer. → dim. = 5 jours) + 2 semaines pleines.
    expect(days).toHaveLength(5 + 14);
    expect(days[days.length - 1].iso).toBe("2026-08-23");
  });

  it("marque les lundis pour découper la grille", () => {
    const mondays = days.filter((d) => d.startsWeek).map((d) => d.iso);
    expect(mondays).toEqual(["2026-08-10", "2026-08-17"]);
  });
});

describe("pluralize", () => {
  it("accorde selon le nombre", () => {
    expect(pluralize(1, "séance")).toBe("1 séance");
    expect(pluralize(3, "séance")).toBe("3 séances");
    expect(pluralize(0, "séance")).toBe("0 séance");
  });
});

describe("batchSummary", () => {
  it("invite à choisir quand la sélection est vide", () => {
    expect(batchSummary(0, 3)).toMatch(/au moins un athlète/);
    expect(batchSummary(2, 0)).toMatch(/au moins un athlète/);
  });

  it("détaille le produit athlètes × dates", () => {
    expect(batchSummary(3, 4)).toBe("12 séances — 3 athlètes × 4 dates");
    expect(batchSummary(1, 1)).toBe("1 séance — 1 athlète × 1 date");
  });
});
