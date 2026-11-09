import { describe, expect, it } from "vitest";
import { auswerten, type AEinheit } from "./auswertung";

const satz = (wdh: number | null, kg: number | null, extra: Partial<AEinheit["uebungen"][0]["saetze"][0]> = {}) => ({
  satztyp: "arbeit",
  erledigt: true,
  wdh,
  last_kg: kg,
  vorgabe: { wdh_min: 8, wdh_max: 10, last_kg: 60 },
  ...extra,
});

const einheiten: AEinheit[] = [
  {
    id: "e2",
    gestartet_am: "2026-11-12T10:00:00Z",
    uebungen: [{ uebung_id: "kb", uebung_name: "Kniebeuge", saetze: [satz(8, 65), satz(7, 65)] }],
  },
  {
    id: "e1",
    gestartet_am: "2026-11-09T10:00:00Z",
    uebungen: [
      {
        uebung_id: "kb",
        uebung_name: "Kniebeuge",
        saetze: [
          satz(10, 40, { satztyp: "aufwaermen" }),
          satz(9, 60),
          satz(10, 60),
          satz(10, 60, { erledigt: false }),
        ],
      },
      { uebung_id: "plank", uebung_name: "Plank", saetze: [satz(null, null, { vorgabe: {} })] },
    ],
  },
];

describe("auswerten", () => {
  const ergebnis = auswerten(einheiten, (id) => id === "kb", "epley", 10);
  const kb = ergebnis.find((x) => x.uebungId === "kb")!;

  it("sortiert die Punkte zeitlich", () => {
    expect(kb.punkte.map((p) => p.einheitId)).toEqual(["e1", "e2"]);
  });

  it("zählt Aufwärmsätze und nicht abgehakte Sätze nicht", () => {
    expect(kb.punkte[0].saetze).toBe(2);
    expect(kb.punkte[0].volumen).toBe(9 * 60 + 10 * 60);
  });

  it("nimmt das höchste Gewicht und die beste Schätzung", () => {
    expect(kb.punkte[0].topKg).toBe(60);
    expect(kb.punkte[0].e1rm).toBe(80); // 60 × (1 + 10/30)
    expect(kb.punkte[1].e1rm).toBe(82.3); // 65 × (1 + 8/30)
  });

  it("zählt, wie oft die Vorgabe erreicht wurde", () => {
    expect(kb.punkte[0]).toMatchObject({ vorgabeErreicht: 2, vorgabeGesamt: 2 });
    expect(kb.punkte[1]).toMatchObject({ vorgabeErreicht: 1, vorgabeGesamt: 2 });
  });

  it("schätzt kein 1RM bei ungeeigneten Übungen", () => {
    const plank = ergebnis.find((x) => x.uebungId === "plank")!;
    expect(plank.e1rmGeeignet).toBe(false);
    expect(plank.punkte[0].e1rm).toBeNull();
    expect(plank.punkte[0].vorgabeGesamt).toBe(0);
  });
});
