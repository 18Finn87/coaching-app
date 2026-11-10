import { describe, expect, it } from "vitest";
import { auswerten } from "./auswertung";
import {
  dauerText,
  intensitaetText,
  intensitaetsStufe,
  kmh,
  pace,
  paceLesen,
  paceText,
  pulszonen,
  wochenUmfang,
  zoneVon,
} from "./ausdauer";

describe("Pace und Tempo", () => {
  it("30 min auf 5 km = 6:00 /km und 10 km/h", () => {
    expect(pace(1800, 5000)).toBe(360);
    expect(paceText(360)).toBe("6:00 /km");
    expect(kmh(1800, 5000)).toBe(10);
  });
  it("ohne Strecke oder Zeit keine Pace", () => {
    expect(pace(1800, null)).toBeNull();
    expect(pace(0, 5000)).toBeNull();
    expect(kmh(null, 5000)).toBeNull();
  });
  it("Pace lesen: 5:30 und 5.30, ungültig wird abgelehnt", () => {
    expect(paceLesen("5:30")).toBe(330);
    expect(paceLesen("5.30")).toBe(330);
    expect(paceLesen("5:75")).toBeNull();
    expect(paceLesen("schnell")).toBeNull();
  });
  it("Dauer-Anzeige", () => {
    expect(dauerText(2700)).toBe("45:00");
    expect(dauerText(3930)).toBe("1:05:30");
  });
});

describe("Pulszonen (Schätzung)", () => {
  it("nur Maximalpuls 200: Z2 = 120–139", () => {
    const z = pulszonen({ hf_max: 200, hf_schwelle: null })!;
    expect(z.methode).toBe("maximal");
    expect(z.zonen[1]).toEqual({ zone: 2, von: 120, bis: 139 });
    expect(zoneVon(150, z.zonen)).toBe(3);
    expect(zoneVon(90, z.zonen)).toBe(1);
    expect(zoneVon(210, z.zonen)).toBe(5);
  });
  it("Schwellenpuls hat Vorrang: 170 → Z4 ab 162, Z5 ab 170", () => {
    const z = pulszonen({ hf_max: 195, hf_schwelle: 170 })!;
    expect(z.methode).toBe("schwelle");
    expect(z.zonen[3].von).toBe(162);
    expect(z.zonen[4]).toEqual({ zone: 5, von: 170, bis: 195 });
  });
  it("ohne Werte keine Zonen", () => {
    expect(pulszonen({ hf_max: null, hf_schwelle: null })).toBeNull();
    expect(zoneVon(150, undefined)).toBeNull();
  });
});

describe("Intensität und Wochenumfang", () => {
  it("Vorgabe-Texte", () => {
    expect(intensitaetText({ art: "zone", von: 2, bis: 2 })).toBe("Zone 2");
    expect(intensitaetText({ art: "pace", von: 330, bis: 360 })).toBe("Pace 5:30–6:00 /km");
    expect(intensitaetText({ art: "rpe", von: 7, bis: null })).toBe("Anstrengung 7");
    expect(intensitaetText(null)).toBe("");
  });
  it("Puls geht vor Anstrengung, sonst Anstrengung, sonst offen", () => {
    const zonen = pulszonen({ hf_max: 200, hf_schwelle: null })!.zonen;
    const basis = { datum: "2026-11-10T08:00:00Z", dauer_sek: 1800, distanz_m: 5000 };
    expect(intensitaetsStufe({ ...basis, puls_schnitt: 130, anstrengung: 8 }, zonen)).toBe("locker");
    expect(intensitaetsStufe({ ...basis, puls_schnitt: null, anstrengung: 8 }, zonen)).toBe("hart");
    expect(intensitaetsStufe({ ...basis, puls_schnitt: null, anstrengung: null }, zonen)).toBe("offen");
  });
  it("Wochen werden ab Montag zusammengefasst", () => {
    const w = wochenUmfang([
      { datum: "2026-11-10T08:00:00Z", dauer_sek: 1800, distanz_m: 5000, puls_schnitt: null, anstrengung: 3 },
      { datum: "2026-11-15T08:00:00Z", dauer_sek: 3600, distanz_m: 10000, puls_schnitt: null, anstrengung: 8 },
      { datum: "2026-11-17T08:00:00Z", dauer_sek: 1200, distanz_m: null, puls_schnitt: null, anstrengung: null },
    ]);
    expect(w).toHaveLength(2);
    expect(w[0]).toMatchObject({ woche: "2026-11-09", minuten: 90, meter: 15000, locker: 30, hart: 60 });
    expect(w[1]).toMatchObject({ woche: "2026-11-16", minuten: 20, offen: 20 });
  });
});


describe("Auswertung Ausdauer", () => {
  it("Pace aus Abschnitten mit Zeit und Strecke, Ø-Puls, Vorgabe zählt die Strecke", () => {
    const p = auswerten(
      [
        {
          id: "l1",
          gestartet_am: "2026-11-10T08:00:00Z",
          uebungen: [
            {
              uebung_id: "lauf",
              uebung_name: "Lauf",
              messart: "ausdauer",
              saetze: [
                { satztyp: "arbeit", erledigt: true, wdh: null, last_kg: null, dauer_sek: 1500, distanz_m: 5000, puls_schnitt: 150, vorgabe: { dauer_sek: 1800, distanz_m: 5000 } },
                { satztyp: "arbeit", erledigt: true, wdh: null, last_kg: null, dauer_sek: 600, distanz_m: null, puls_schnitt: 130, vorgabe: {} },
              ],
            },
          ],
        },
      ],
      () => false,
      "epley",
      10,
    )[0].punkte[0];
    expect(p.paceSek).toBe(300);
    expect(p.pulsSchnitt).toBe(140);
    expect(p.vorgabeErreicht).toBe(1);
  });
});
