import { describe, expect, it } from "vitest";
import { auffaelligkeiten, mitGesehen, ohneTraining, punktZiel, seitText, STANDARD_SCHWELLEN } from "./offenePunkte";

const tag = (datum: string, w: { energie?: number; muskelkater?: number; schlaf?: number }) => ({
  datum,
  energie: w.energie ?? null,
  muskelkater: w.muskelkater ?? null,
  schlaf_stunden: w.schlaf ?? null,
});

describe("Tagesbriefing", () => {
  it("meldet wenig Energie an 2 Tagen hintereinander", () => {
    expect(auffaelligkeiten([tag("2026-11-12", { energie: 2 }), tag("2026-11-11", { energie: 1 })], STANDARD_SCHWELLEN)).toEqual([
      "Energie ≤ 2 an 2 Tagen hintereinander",
    ]);
  });

  it("zählt Tage mit Lücke nicht als hintereinander", () => {
    expect(auffaelligkeiten([tag("2026-11-12", { energie: 1 }), tag("2026-11-10", { energie: 1 })], STANDARD_SCHWELLEN)).toEqual([]);
  });

  it("meldet starken Muskelkater und wenig Schlaf", () => {
    const h = auffaelligkeiten(
      [
        tag("2026-11-12", { muskelkater: 4, schlaf: 5 }),
        tag("2026-11-11", { muskelkater: 5, schlaf: 5.5 }),
        tag("2026-11-10", { schlaf: 7 }),
        tag("2026-11-09", { schlaf: 4 }),
      ],
      STANDARD_SCHWELLEN,
    );
    expect(h).toContain("Muskelkater ≥ 4 an 2 Tagen hintereinander");
    expect(h).toContain("Schlaf unter 6 h an 3 der letzten 4 Tage");
  });

  it("findet Personen ohne Training", () => {
    const jetzt = Date.parse("2026-11-12T12:00:00Z");
    const leute = [
      { id: "a", name: "Anna", seit: "2026-01-01" },
      { id: "b", name: "Ben", seit: "2026-01-01" },
      { id: "c", name: "Neu", seit: "2026-11-10" },
    ];
    const r = ohneTraining(leute, new Map([["a", "2026-11-11T08:00:00Z"]]), 7, jetzt);
    expect(r.map((x) => x.name)).toEqual(["Ben"]); // Anna hat trainiert, „Neu“ ist erst 2 Tage dabei
    expect(r[0].tage).toBeNull();
  });

  it("verlinkt und erledigt je nach Art", () => {
    expect(punktZiel({ art: "video", athlet_id: "a", bezug_id: "v" })).toBe("/video/?id=v");
    expect(punktZiel({ art: "ziele", athlet_id: "a", bezug_id: "n" })).toBe("/athlet/?id=a#nachrichten");
    expect(mitGesehen("video")).toBe(false);
    expect(mitGesehen("reha")).toBe(true);
    const jetzt = Date.parse("2026-11-12T12:00:00Z");
    expect(seitText("2026-11-12T08:00:00Z", jetzt)).toBe("heute");
    expect(seitText("2026-11-09T08:00:00Z", jetzt)).toBe("seit 3 Tagen");
  });
});
