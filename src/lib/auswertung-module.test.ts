import { describe, expect, it } from "vitest";
import { auswerten, type AEinheit } from "./auswertung";

type S = AEinheit["uebungen"][0]["saetze"][0];
const satz = (werte: Partial<S>): S => ({
  satztyp: "arbeit",
  erledigt: true,
  wdh: null,
  last_kg: null,
  dauer_sek: null,
  distanz_m: null,
  vorgabe: {},
  ...werte,
});

const einheiten: AEinheit[] = [
  {
    id: "e1",
    gestartet_am: "2026-11-10T10:00:00Z",
    uebungen: [
      {
        uebung_id: "stretch",
        uebung_name: "Couch-Stretch",
        messart: "zeit",
        // getrennte Seiten: links 60 s, rechts 45 s, Vorgabe 60 s
        saetze: [
          satz({ dauer_sek: 60, vorgabe: { dauer_sek: 60 } }),
          satz({ dauer_sek: 45, vorgabe: { dauer_sek: 60 } }),
          satz({ dauer_sek: 30, satztyp: "aufwaermen" }),
        ],
      },
      {
        uebung_id: "lauf",
        uebung_name: "Lauf",
        messart: "distanz",
        saetze: [satz({ distanz_m: 5000, vorgabe: { distanz_m: 5000 } })],
      },
      {
        uebung_id: "lieg",
        uebung_name: "Liegestütz",
        messart: "wdh",
        saetze: [satz({ wdh: 20, vorgabe: { wdh_min: 15 } }), satz({ wdh: 12, vorgabe: { wdh_min: 15 } })],
      },
    ],
  },
];

describe("auswerten für Zeit, Strecke und Wiederholungen", () => {
  const ergebnis = auswerten(einheiten, () => false, "epley", 10);
  const finde = (id: string) => ergebnis.find((x) => x.uebungId === id)!.punkte[0];

  it("Zeit: längster Satz, Summe ohne Aufwärmen, Vorgabe je Seite", () => {
    const p = finde("stretch");
    expect(p.bestZeit).toBe(60);
    expect(p.summeZeit).toBe(105);
    expect(p.vorgabeGesamt).toBe(2);
    expect(p.vorgabeErreicht).toBe(1);
    expect(ergebnis.find((x) => x.uebungId === "stretch")!.messart).toBe("zeit");
  });

  it("Strecke: längste und gesamte Strecke, Vorgabe erreicht", () => {
    const p = finde("lauf");
    expect(p.bestStrecke).toBe(5000);
    expect(p.summeStrecke).toBe(5000);
    expect(p.vorgabeErreicht).toBe(1);
  });

  it("Getrennte Seiten: Bestwert je Seite", () => {
    const mit = auswerten(
      [
        {
          id: "e9",
          gestartet_am: "2026-11-10T10:00:00Z",
          uebungen: [
            {
              uebung_id: "stretch2",
              uebung_name: "Couch-Stretch",
              messart: "zeit",
              saetze: [
                satz({ dauer_sek: 60, seite: "links" }),
                satz({ dauer_sek: 45, seite: "rechts" }),
                satz({ dauer_sek: 50, seite: "rechts" }),
              ],
            },
          ],
        },
      ],
      () => false,
      "epley",
      10,
    )[0].punkte[0];
    expect(mit.seiten?.links?.bestZeit).toBe(60);
    expect(mit.seiten?.rechts?.bestZeit).toBe(50);
  });

  it("Messwert: kleiner ist besser (z. B. Finger-Boden-Abstand), Minuswerte erlaubt", () => {
    const e: AEinheit[] = [
      {
        id: "m1",
        gestartet_am: "2026-11-10T10:00:00Z",
        uebungen: [
          {
            uebung_id: "fba",
            uebung_name: "Finger-Boden-Abstand",
            messart: "umfang",
            saetze: [satz({ messwert: 4 }), satz({ messwert: -2.5 })],
          },
          {
            uebung_id: "kzw",
            uebung_name: "Knie-zur-Wand",
            messart: "umfang",
            saetze: [satz({ messwert: 9.5, seite: "links" }), satz({ messwert: 12, seite: "rechts" }), satz({ messwert: 11, seite: "rechts" })],
          },
        ],
      },
    ];
    const erg = auswerten(e, () => false, "epley", 10, (id) => id === "fba");
    const fba = erg.find((x) => x.uebungId === "fba")!.punkte[0];
    const kzw = erg.find((x) => x.uebungId === "kzw")!.punkte[0];
    expect(fba.messwert).toBe(-2.5);
    expect(kzw.messwert).toBe(12);
    expect(kzw.seiten?.links?.messwert).toBe(9.5);
    expect(kzw.seiten?.rechts?.messwert).toBe(12);
    expect(fba.seiten).toBeNull();
  });

  it("Nur Wiederholungen: meiste Wdh. und Summe", () => {
    const p = finde("lieg");
    expect(p.meisteWdh).toBe(20);
    expect(p.summeWdh).toBe(32);
    expect(p.vorgabeErreicht).toBe(1);
    expect(p.vorgabeGesamt).toBe(2);
    expect(p.e1rm).toBeNull();
    expect(p.volumen).toBe(0);
  });
});
