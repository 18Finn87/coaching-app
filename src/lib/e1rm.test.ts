import { describe, expect, it } from "vitest";
import { e1rm } from "./e1rm";

describe("e1rm", () => {
  it("rechnet Epley richtig", () => {
    expect(e1rm(100, 10, "epley")).toBe(133.3);
    expect(e1rm(60, 8, "epley")).toBe(76);
    expect(e1rm(100, 5, "epley")).toBe(116.7);
  });

  it("rechnet Brzycki richtig", () => {
    expect(e1rm(100, 10, "brzycki")).toBe(133.3);
    expect(e1rm(100, 5, "brzycki")).toBe(112.5);
    expect(e1rm(60, 8, "brzycki")).toBe(74.5);
  });

  it("gibt bei 1 Wiederholung das Gewicht zurück", () => {
    expect(e1rm(140, 1, "epley")).toBe(140);
    expect(e1rm(140, 1, "brzycki")).toBe(140);
  });

  it("schätzt nicht über der Wiederholungsgrenze", () => {
    expect(e1rm(50, 11, "epley")).toBeNull();
    expect(e1rm(50, 12, "epley", 12)).not.toBeNull();
    expect(e1rm(50, 6, "epley", 5)).toBeNull();
  });

  it("schätzt nicht ohne sinnvolle Werte", () => {
    expect(e1rm(null, 5)).toBeNull();
    expect(e1rm(80, null)).toBeNull();
    expect(e1rm(0, 5)).toBeNull();
    expect(e1rm(80, 0)).toBeNull();
    expect(e1rm(80, 2.5)).toBeNull();
    expect(e1rm(-10, 5)).toBeNull();
  });
});
