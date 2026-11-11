import { describe, expect, it } from "vitest";
import { tageswert, testAuswerten, veraenderung, veraenderungText, wertText } from "./athletik";

describe("Leistungstests", () => {
  it("wertet den besten Versuch je nach Richtung", () => {
    expect(tageswert([1.92, 1.85, 1.88], "bester", true)).toBe(1.85);
    expect(tageswert([238, 245, 241], "bester", false)).toBe(245);
  });

  it("wertet auf Wunsch den Durchschnitt", () => {
    expect(tageswert([31.5, 33.25, 32], "schnitt", false)).toBe(32.25);
    expect(tageswert([], "schnitt", false)).toBeNull();
  });

  it("erkennt Verbesserung bei kleiner-ist-besser", () => {
    const v = veraenderung(1.9, 1.85, true)!;
    expect(v.prozent).toBe(-2.6);
    expect(v.besser).toBe(true);
    expect(veraenderungText(v)).toBe("−2,6 % (besser)");
    expect(veraenderung(240, 230, false)!.besser).toBe(false);
    expect(veraenderung(240, 240.5, false)!.besser).toBeNull();
  });

  it("vergleicht mit dem letzten und dem ersten Test", () => {
    const a = testAuswerten(
      [
        { datum: "2026-09-01", versuche: [2.0, 1.98] },
        { datum: "2026-10-01", versuche: [1.95] },
        { datum: "2026-11-01", versuche: [1.9, 1.93] },
      ],
      "bester",
      true,
    );
    expect(a.letzter?.wert).toBe(1.9);
    expect(a.zumLetzten?.prozent).toBe(-2.6);
    expect(a.zumErsten?.prozent).toBe(-4);
    expect(a.bestwert).toBe(1.9);
  });

  it("zeigt Zahlen in passender Genauigkeit", () => {
    expect(wertText(1.8, "s")).toBe("1,80 s");
    expect(wertText(245, "cm")).toBe("245 cm");
    expect(wertText(2.4, "m")).toBe("2,4 m");
    expect(wertText(16.5, "stufe")).toBe("Stufe 16,5");
  });
});
