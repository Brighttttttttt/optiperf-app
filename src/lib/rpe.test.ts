import { describe, expect, it } from "vitest";
import { rpeBand } from "./rpe";
import { initials } from "./initials";

describe("rpeBand", () => {
  it("découpe la rampe d'effort aux bons seuils", () => {
    expect(rpeBand(1)).toBe("low");
    expect(rpeBand(3)).toBe("low");
    expect(rpeBand(4)).toBe("mid");
    expect(rpeBand(6)).toBe("mid");
    expect(rpeBand(7)).toBe("high");
    expect(rpeBand(8)).toBe("high");
    expect(rpeBand(9)).toBe("max");
    expect(rpeBand(10)).toBe("max");
  });
});

describe("initials", () => {
  it("prend les deux premières initiales", () => {
    expect(initials("Léa Martin")).toBe("LM");
    expect(initials("Jean de La Fontaine")).toBe("JD");
  });
  it("gère un nom simple", () => {
    expect(initials("camille")).toBe("C");
  });
});
