import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDayRelative,
  formatDayShort,
  formatDuration,
  formatTimestamp,
  toISODate,
} from "./dates";

describe("toISODate", () => {
  it("rend la date du fuseau Europe/Paris, pas celle du serveur", () => {
    // 00 h 30 à Paris = 22 h 30 la veille en UTC : le jour ne doit pas reculer
    // même quand le serveur (Vercel, CI) tourne en UTC.
    expect(toISODate(new Date("2026-08-05T00:30:00+02:00"))).toBe("2026-08-05");
  });
});

describe("addDays", () => {
  it("franchit les fins de mois", () => {
    expect(toISODate(addDays(new Date("2026-07-30T12:00:00+02:00"), 3))).toBe(
      "2026-08-02"
    );
  });
});

describe("formatDuration", () => {
  it("écrit les minutes seules sous l'heure", () => {
    expect(formatDuration(45)).toBe("45 min");
  });
  it("écrit les heures rondes sans minutes", () => {
    expect(formatDuration(120)).toBe("2 h");
  });
  it("écrit heures et minutes sur deux chiffres", () => {
    expect(formatDuration(95)).toBe("1 h 35");
    expect(formatDuration(125)).toBe("2 h 05");
  });
});

describe("formatDayShort", () => {
  it("rend JJ/MM", () => {
    expect(formatDayShort("2026-08-05")).toBe("05/08");
  });
});

describe("formatDayRelative", () => {
  const now = new Date("2026-08-05T10:00:00+02:00");
  it("nomme aujourd'hui, demain et hier", () => {
    expect(formatDayRelative("2026-08-05", now)).toBe("Aujourd'hui");
    expect(formatDayRelative("2026-08-06", now)).toBe("Demain");
    expect(formatDayRelative("2026-08-04", now)).toBe("Hier");
  });
  it("détaille les autres jours", () => {
    expect(formatDayRelative("2026-08-08", now)).toBe("samedi 8 août");
  });
});

describe("formatTimestamp", () => {
  const now = new Date("2026-08-05T18:00:00+02:00");
  it("rend l'heure de Paris pour aujourd'hui", () => {
    expect(formatTimestamp("2026-08-05T14:32:00+02:00", now)).toBe("14:32");
  });
  it("rend la date courte pour les autres jours", () => {
    expect(formatTimestamp("2026-08-01T09:00:00+02:00", now)).toBe("01/08");
  });
});
