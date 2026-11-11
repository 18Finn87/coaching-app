import { describe, expect, it } from "vitest";
import { ablauf, blockSaetze, blockText, rundenAuswerten } from "./intervall";

const zeit = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

describe("Intervall-Block", () => {
  it("2 Serien × 3 × 400 m: Pausen, Serienpause, keine Pause nach der letzten Runde", () => {
    const b = blockSaetze({ runden: 3, serien: 2, art: "strecke", wert: 400, pauseSek: 90, serienpauseSek: 180 });
    expect(b).toHaveLength(6);
    expect(b.map((x) => x.pause_sek)).toEqual([90, 90, 180, 90, 90, null]);
    expect(b.every((x) => x.distanz_m === 400 && x.dauer_sek === null)).toBe(true);
    expect(b[2].zusatz.serienende).toBe(true);
    expect(b.map((x) => x.satznummer)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(blockText(b, zeit)).toBe("2 × 3 × 400 m · Pause 1:30 · Serienpause 3:00");
  });

  it("Tabata 8 × 20 s / 10 s, Nummern ab vorhandenen Sätzen", () => {
    const b = blockSaetze({ runden: 8, serien: 1, art: "zeit", wert: 20, pauseSek: 10, serienpauseSek: 0 }, 3);
    expect(b[0].satznummer).toBe(3);
    expect(b.every((x) => x.dauer_sek === 20)).toBe(true);
    expect(blockText(b, zeit)).toBe("8 × 0:20 · Pause 0:10");
  });

  it("Timer-Ablauf: Vorbereitung, Belastung (Strecke offen), Pause, keine Pause am Ende", () => {
    const s = ablauf([
      { distanz_m: 400, pause_sek: 90 },
      { distanz_m: 400, pause_sek: 90 },
    ]);
    expect(s.map((x) => x.typ)).toEqual(["vorbereitung", "belastung", "pause", "belastung"]);
    expect(s[1].dauer).toBeNull();
    expect(s[2].dauer).toBe(90);
    const z = ablauf([{ dauer_sek: 20, pause_sek: 10 }], 0);
    expect(z).toEqual([{ typ: "belastung", runde: 0, dauer: 20 }]);
  });
});

describe("Rundenauswertung", () => {
  it("Zeiten: schnellste, langsamste, Abfall in %", () => {
    const a = rundenAuswerten([80, 82, 84, 88], true)!;
    expect(a.schnellste).toBe(80);
    expect(a.langsamste).toBe(88);
    expect(a.schnitt).toBe(83.5);
    expect(a.veraenderungProzent).toBe(10);
  });
  it("Strecken bei Zeit-Intervallen: weniger am Ende = positiv", () => {
    expect(rundenAuswerten([500, 480, 450], false)!.veraenderungProzent).toBe(10);
    expect(rundenAuswerten([], true)).toBeNull();
  });
});
