import { describe, expect, it } from "vitest";
import {
  batchSummary,
  planningCalendar,
  planningState,
  pluralize,
  startOfWeek,
  weekDays,
  weekLabel,
} from "./planning";
import { toISODate } from "./dates";

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

describe("startOfWeek", () => {
  it("remonte au lundi, semaine française", () => {
    // 5 août 2026 est un mercredi.
    expect(toISODate(startOfWeek(NOW))).toBe("2026-08-03");
  });

  it("laisse un lundi en place", () => {
    expect(toISODate(startOfWeek(new Date("2026-08-03T09:00:00+02:00")))).toBe(
      "2026-08-03"
    );
  });

  it("ne fait pas basculer le dimanche à la semaine suivante", () => {
    // 9 août 2026 est un dimanche : il appartient à la semaine du 3.
    expect(toISODate(startOfWeek(new Date("2026-08-09T23:00:00+02:00")))).toBe(
      "2026-08-03"
    );
  });
});

describe("weekDays", () => {
  const days = weekDays(startOfWeek(NOW), NOW);

  it("rend sept jours, du lundi au dimanche", () => {
    expect(days).toHaveLength(7);
    expect(days[0].iso).toBe("2026-08-03");
    expect(days[6].iso).toBe("2026-08-09");
  });

  it("repère aujourd'hui et distingue le passé", () => {
    expect(days.filter((d) => d.isToday).map((d) => d.iso)).toEqual([
      "2026-08-05",
    ]);
    expect(days.filter((d) => d.isPast).map((d) => d.iso)).toEqual([
      "2026-08-03",
      "2026-08-04",
    ]);
  });

  it("abrège les jours sans point final", () => {
    expect(days[0].label).toBe("lun");
    expect(days[6].label).toBe("dim");
  });
});

describe("weekLabel", () => {
  it("ne répète pas le mois quand la semaine ne le franchit pas", () => {
    expect(weekLabel(new Date("2026-08-03T12:00:00+02:00"))).toBe(
      "Semaine du 3 au 9 août"
    );
  });

  it("précise les deux mois quand la semaine les franchit", () => {
    expect(weekLabel(new Date("2026-08-31T12:00:00+02:00"))).toBe(
      "Semaine du 31 août au 6 septembre"
    );
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

describe("planningState", () => {
  it("lit d'abord le compte rendu, quelle que soit la date", () => {
    // Une séance faite reste faite, même si son jour est passé — et une
    // séance manquée ne redevient pas « à rattraper ».
    expect(planningState({ status: "completed", date: "2026-08-01" }, NOW)).toBe("fait");
    expect(planningState({ status: "completed", date: "2026-08-20" }, NOW)).toBe("fait");
    expect(planningState({ status: "missed", date: "2026-08-01" }, NOW)).toBe("manquee");
  });

  it("distingue une séance à venir d'une séance en retard", () => {
    expect(planningState({ status: "planned", date: "2026-08-06" }, NOW)).toBe("a-venir");
    expect(planningState({ status: "planned", date: "2026-08-04" }, NOW)).toBe("a-rattraper");
  });

  it("compte le jour même comme à venir, pas comme en retard", () => {
    // Une séance du jour se fait encore le soir : la signaler en retard dès
    // le matin serait faux et culpabilisant.
    expect(planningState({ status: "planned", date: "2026-08-05" }, NOW)).toBe("a-venir");
  });
});
