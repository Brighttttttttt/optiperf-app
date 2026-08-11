import { describe, expect, it } from "vitest";
import { canSwitchView, resolveViewMode } from "./view-mode";

describe("resolveViewMode", () => {
  it("laisse le coach basculer, et retient son choix", () => {
    expect(resolveViewMode("coach", "athlete")).toBe("athlete");
    expect(resolveViewMode("coach", "coach")).toBe("coach");
  });

  it("ouvre le coach sur sa vue d'encadrement par défaut", () => {
    // Sans cookie, un coach arrive là où il travaille — pas dans une vue
    // d'athlète qu'il n'a jamais demandée.
    expect(resolveViewMode("coach", undefined)).toBe("coach");
    expect(resolveViewMode("coach", "")).toBe("coach");
    expect(resolveViewMode("coach", "n'importe quoi")).toBe("coach");
  });

  it("ignore le cookie d'un athlète, quelle que soit sa valeur", () => {
    // Le cookie est une préférence d'affichage, pas un droit : il se
    // fabrique à la main dans un navigateur.
    expect(resolveViewMode("athlete", "coach")).toBe("athlete");
    expect(resolveViewMode("athlete", "athlete")).toBe("athlete");
    expect(resolveViewMode("athlete", undefined)).toBe("athlete");
  });
});

describe("canSwitchView", () => {
  it("ne propose la bascule qu'au coach", () => {
    expect(canSwitchView({ role: "coach" })).toBe(true);
    expect(canSwitchView({ role: "athlete" })).toBe(false);
    expect(canSwitchView(null)).toBe(false);
  });
});
