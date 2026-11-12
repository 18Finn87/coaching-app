import { describe, expect, it } from "vitest";
import { heute, quellenNachEingabe, stundenLesen, type TagesCheckin } from "./tagesabfrage";

describe("Tägliche Abfrage", () => {
  it("nimmt das Datum in Berliner Zeit", () => {
    // 23:30 UTC am 11.11. ist in Berlin schon der 12.11.
    expect(heute(new Date("2026-11-11T23:30:00Z"))).toBe("2026-11-12");
    expect(heute(new Date("2026-11-11T10:00:00Z"))).toBe("2026-11-11");
  });

  it("liest Schlafstunden mit Komma und rundet auf halbe Stunden", () => {
    expect(stundenLesen("7,5")).toBe(7.5);
    expect(stundenLesen("6.8")).toBe(7);
    expect(stundenLesen("")).toBeNull();
    expect(stundenLesen("25")).toBeNaN();
    expect(stundenLesen("abc")).toBeNaN();
  });

  it("markiert eingetragene Werte als manuell", () => {
    const q = quellenNachEingabe(null, { schlaf_stunden: 7, schlaf_qualitaet: null, energie: 3, muskelkater: null, stimmung: 4 });
    expect(q).toEqual({ schlaf_stunden: "manuell", energie: "manuell", stimmung: "manuell" });
  });

  it("behält automatische Quellen, solange der Wert gleich bleibt", () => {
    const alt = {
      schlaf_stunden: 7.5,
      schlaf_qualitaet: null,
      energie: 3,
      muskelkater: null,
      stimmung: null,
      quellen: { schlaf_stunden: "apple_health", energie: "manuell" },
    } as unknown as TagesCheckin;
    expect(quellenNachEingabe(alt, { schlaf_stunden: 7.5, schlaf_qualitaet: null, energie: 4, muskelkater: null, stimmung: null })).toEqual({
      schlaf_stunden: "apple_health",
      energie: "manuell",
    });
    // Überschrieben → wieder manuell
    expect(quellenNachEingabe(alt, { schlaf_stunden: 6, schlaf_qualitaet: null, energie: 3, muskelkater: null, stimmung: null }).schlaf_stunden).toBe("manuell");
  });
});
