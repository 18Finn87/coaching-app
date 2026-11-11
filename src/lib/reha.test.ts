import { describe, expect, it } from "vitest";
import { schmerzAbfragen, schmerzNachUebung, ueberGrenze, type SchmerzEintrag } from "./reha";

const e = (uebung: string, datum: string, wert: number, grenze: number | null): SchmerzEintrag => ({
  ausgefuehrte_uebung_id: uebung + datum,
  uebung_id: uebung,
  uebung_name: uebung === "b" ? "Brücke" : "Wadenheben",
  datum,
  wert,
  grenze,
  notiz: "",
});

describe("Reha", () => {
  it("fragt bei Reha-Übungen und bei Übungen mit Grenze", () => {
    expect(schmerzAbfragen("reha", null)).toBe(true);
    expect(schmerzAbfragen("kraft", 3)).toBe(true);
    expect(schmerzAbfragen("kraft", 0)).toBe(true);
    expect(schmerzAbfragen("kraft", null)).toBe(false);
  });

  it("markiert nur Werte über der Grenze", () => {
    expect(ueberGrenze(4, 3)).toBe(true);
    expect(ueberGrenze(3, 3)).toBe(false);
    expect(ueberGrenze(8, null)).toBe(false);
    expect(ueberGrenze(null, 3)).toBe(false);
  });

  it("gruppiert nach Übung und zählt Überschreitungen", () => {
    const g = schmerzNachUebung([
      e("b", "2026-11-01", 2, 3),
      e("w", "2026-11-05", 1, null),
      e("b", "2026-11-08", 5, 3),
      e("b", "2026-11-04", 4, 3),
    ]);
    expect(g.map((x) => x.name)).toEqual(["Brücke", "Wadenheben"]);
    expect(g[0].letzter.wert).toBe(5);
    expect(g[0].ueber).toBe(2);
    expect(g[0].eintraege.map((x) => x.wert)).toEqual([2, 4, 5]);
  });
});
