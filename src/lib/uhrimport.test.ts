import { describe, expect, it } from "vitest";
import { fitLesen, gpxLesen } from "./uhrimport";

// 0,001° Breite ≈ 111,2 m. 20 Punkte im Abstand von 0,001° nach Norden, alle 30 s.
function gpxBeispiel(mitPause = false) {
  const pkt: string[] = [];
  let t = Date.parse("2026-11-10T07:00:00Z");
  for (let i = 0; i < 20; i++) {
    if (mitPause && i === 10) t += 600_000; // 10 Minuten Pause in der Aufzeichnung
    const zeit = new Date(t).toISOString();
    pkt.push(
      `<trkpt lat="${(48 + i * 0.001).toFixed(3)}" lon="9.000"><ele>${200 + (i % 5 === 4 ? 10 : 0)}</ele><time>${zeit}</time>` +
        `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + (i % 2) * 10}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`,
    );
    t += 30_000;
  }
  return `<?xml version="1.0"?><gpx version="1.1"><trk><trkseg>${pkt.join("\n")}</trkseg></trk></gpx>`;
}

describe("GPX lesen", () => {
  it("Strecke, Dauer, Ø-Puls, Höhenmeter und Kilometer-Zeiten", () => {
    const e = gpxLesen(gpxBeispiel());
    expect(e.quelle).toBe("gpx");
    expect(e.distanz_m).toBeGreaterThan(2100);
    expect(e.distanz_m).toBeLessThan(2125); // 19 × 111,2 m
    expect(e.dauer_sek).toBe(19 * 30);
    expect(e.puls_schnitt).toBe(145);
    expect(e.hoehenmeter).toBe(40); // vier Anstiege um 10 m (Punkte 4, 9, 14, 19), Abstiege zählen nicht
    expect(e.splits).toHaveLength(2);
    expect(e.splits[0]).toBeGreaterThan(265);
    expect(e.splits[0]).toBeLessThan(275); // ~1000 m / 111,2 m × 30 s ≈ 270 s
    expect(e.start).toBe("2026-11-10T07:00:00.000Z");
  });
  it("Pausen in der Aufzeichnung zählen nicht zur Dauer", () => {
    expect(gpxLesen(gpxBeispiel(true)).dauer_sek).toBe(18 * 30);
  });
  it("leere oder fremde Datei gibt eine verständliche Meldung", () => {
    expect(() => gpxLesen("<gpx></gpx>")).toThrow(/keine Trackpunkte/);
  });
});

/** Baut eine minimale FIT-Datei: Records (Zeit, Strecke, Puls) und eine Session. */
function fitBeispiel(mitSession = true) {
  const bytes: number[] = [];
  const u8 = (x: number) => bytes.push(x & 0xff);
  const u16 = (x: number) => (u8(x), u8(x >> 8));
  const u32 = (x: number) => (u16(x & 0xffff), u16(x >>> 16));
  // Definition lokal 0 → record (20): 253 u32, 5 u32, 3 u8
  u8(0x40); u8(0); u8(0); u16(20); u8(3);
  u8(253); u8(4); u8(0x86);
  u8(5); u8(4); u8(0x86);
  u8(3); u8(1); u8(0x02);
  const start = 1100000000;
  for (let i = 0; i <= 25; i++) {
    u8(0x00); u32(start + i * 12); u32(i * 10000); u8(150); // alle 12 s 100 m → 2,5 km
  }
  if (mitSession) {
    // Definition lokal 1 → session (18): 2 u32, 7 u32, 8 u32, 9 u32, 16 u8, 22 u16
    u8(0x41); u8(0); u8(0); u16(18); u8(6);
    for (const [nr, gr, typ] of [[2, 4, 0x86], [7, 4, 0x86], [8, 4, 0x86], [9, 4, 0x86], [16, 1, 0x02], [22, 2, 0x84]]) {
      u8(nr); u8(gr); u8(typ);
    }
    u8(0x01); u32(start); u32(330000); u32(300000); u32(250000); u8(148); u16(42);
  }
  const kopf = [14, 0x20, 0, 0, 0, 0, 0, 0, 0x2e, 0x46, 0x49, 0x54, 0, 0];
  const len = bytes.length;
  kopf[4] = len & 0xff; kopf[5] = (len >> 8) & 0xff; kopf[6] = (len >> 16) & 0xff; kopf[7] = (len >> 24) & 0xff;
  return new Uint8Array([...kopf, ...bytes, 0, 0]).buffer;
}

describe("FIT lesen", () => {
  it("nimmt die Gesamtwerte der Session (Bewegungszeit, Strecke, Puls, Höhenmeter)", () => {
    const e = fitLesen(fitBeispiel());
    expect(e.quelle).toBe("fit");
    expect(e.dauer_sek).toBe(300);
    expect(e.distanz_m).toBe(2500);
    expect(e.puls_schnitt).toBe(148);
    expect(e.hoehenmeter).toBe(42);
    expect(e.splits).toEqual([120, 120]);
    expect(e.start).toBe(new Date((1100000000 + 631065600) * 1000).toISOString());
  });
  it("ohne Session rechnet es aus den Einzelpunkten", () => {
    const e = fitLesen(fitBeispiel(false));
    expect(e.distanz_m).toBe(2500);
    expect(e.dauer_sek).toBe(300);
    expect(e.puls_schnitt).toBe(150);
  });
  it("erkennt Dateien, die keine FIT-Dateien sind", () => {
    expect(() => fitLesen(new Uint8Array(20).buffer)).toThrow(/keine FIT-Datei/);
  });
});
