/**
 * Uhr-Dateien (GPX, FIT) auf dem Gerät auslesen.
 * Datensparsam: Es werden nur Summen übernommen (Dauer, Strecke, Ø-Puls,
 * Höhenmeter, Kilometer-Zeiten). GPS-Punkte und die Datei selbst werden
 * nirgends gespeichert oder hochgeladen.
 */

export type UhrErgebnis = {
  quelle: "gpx" | "fit";
  /** Dauer in Bewegung (s); Pausen in der Aufzeichnung zählen nicht */
  dauer_sek: number | null;
  distanz_m: number | null;
  puls_schnitt: number | null;
  hoehenmeter: number | null;
  /** Sekunden je vollem Kilometer */
  splits: number[];
  start: string | null;
};

type Punkt = { t: number | null; dist: number | null; lat?: number; lon?: number; ele?: number | null; hr?: number | null };

// ---------------------------------------------------------------------
// Gemeinsame Rechnungen
// ---------------------------------------------------------------------

const ERDRADIUS = 6371000;
function abstand(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * ERDRADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Längere Lücken (z. B. Aufzeichnung pausiert) zählen nicht zur Dauer. */
const PAUSE_AB_SEK = 60;

/** Dauer in Bewegung und Kilometer-Zeiten aus Punkten mit Zeit und laufender Strecke. */
function auswerten(punkte: Punkt[]): { dauer: number | null; splits: number[] } {
  const p = punkte.filter((x) => x.t != null && x.dist != null) as { t: number; dist: number }[];
  if (p.length < 2) return { dauer: null, splits: [] };
  let bewegt = 0;
  const splits: number[] = [];
  let naechsterKm = 1000;
  let zeitBeiLetztemKm = 0;
  for (let i = 1; i < p.length; i++) {
    const dt = p[i].t - p[i - 1].t;
    if (dt <= 0) continue;
    const zaehlt = dt <= PAUSE_AB_SEK ? dt : 0;
    const davor = bewegt;
    bewegt += zaehlt;
    // Kilometer-Grenzen in diesem Abschnitt (linear dazwischen)
    while (p[i].dist >= naechsterKm && p[i].dist > p[i - 1].dist) {
      const anteil = (naechsterKm - p[i - 1].dist) / (p[i].dist - p[i - 1].dist);
      const zeit = davor + zaehlt * anteil;
      splits.push(Math.round(zeit - zeitBeiLetztemKm));
      zeitBeiLetztemKm = zeit;
      naechsterKm += 1000;
    }
  }
  return { dauer: Math.round(bewegt), splits };
}

function mittel(werte: (number | null | undefined)[]): number | null {
  const w = werte.filter((x): x is number => x != null && x > 0);
  return w.length ? Math.round(w.reduce((a, b) => a + b, 0) / w.length) : null;
}

/** Höhenmeter bergauf; kleine Schwankungen (unter 2 m) werden geglättet. */
function anstieg(hoehen: (number | null | undefined)[]): number | null {
  const h = hoehen.filter((x): x is number => x != null && Number.isFinite(x));
  if (h.length < 2) return null;
  let summe = 0;
  let basis = h[0];
  for (const x of h.slice(1)) {
    if (x - basis >= 2) {
      summe += x - basis;
      basis = x;
    } else if (basis - x >= 2) {
      basis = x;
    }
  }
  return Math.round(summe);
}

// ---------------------------------------------------------------------
// GPX (Text)
// ---------------------------------------------------------------------

export function gpxLesen(text: string): UhrErgebnis {
  const punkte: Punkt[] = [];
  const muster = /<trkpt\b([^>]*?)(\/>|>([\s\S]*?)<\/trkpt>)/g;
  let m: RegExpExecArray | null;
  let dist = 0;
  let vorher: { lat: number; lon: number } | null = null;
  while ((m = muster.exec(text))) {
    const attr = m[1];
    const inhalt = m[3] ?? "";
    const lat = Number(/lat\s*=\s*["']([-\d.]+)["']/.exec(attr)?.[1]);
    const lon = Number(/lon\s*=\s*["']([-\d.]+)["']/.exec(attr)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const zeit = /<time>([^<]+)<\/time>/.exec(inhalt)?.[1];
    const ele = /<ele>([^<]+)<\/ele>/.exec(inhalt)?.[1];
    const hr = /<(?:[\w]+:)?hr>(\d+)<\/(?:[\w]+:)?hr>/.exec(inhalt)?.[1];
    const hier = { lat, lon };
    if (vorher) dist += abstand(vorher, hier);
    vorher = hier;
    const t = zeit ? Date.parse(zeit) / 1000 : NaN;
    punkte.push({ t: Number.isFinite(t) ? t : null, dist, ele: ele != null ? Number(ele) : null, hr: hr ? Number(hr) : null });
  }
  if (punkte.length === 0) throw new Error("In der GPX-Datei wurden keine Trackpunkte gefunden.");
  const { dauer, splits } = auswerten(punkte);
  const erste = punkte.find((x) => x.t != null);
  return {
    quelle: "gpx",
    dauer_sek: dauer,
    distanz_m: Math.round(dist),
    puls_schnitt: mittel(punkte.map((x) => x.hr)),
    hoehenmeter: anstieg(punkte.map((x) => x.ele)),
    splits,
    start: erste?.t != null ? new Date(erste.t * 1000).toISOString() : null,
  };
}

// ---------------------------------------------------------------------
// FIT (binär, Garmin-Format) – nur die nötigen Felder
// ---------------------------------------------------------------------

const FIT_EPOCHE = 631065600; // 31.12.1989 in Unix-Sekunden

type FeldDef = { nr: number; groesse: number };
type Definition = { global: number; kleinEndian: boolean; felder: FeldDef[]; devGroesse: number };

function unsigned(v: DataView, pos: number, groesse: number, klein: boolean): number | null {
  if (groesse === 1) {
    const x = v.getUint8(pos);
    return x === 0xff ? null : x;
  }
  if (groesse === 2) {
    const x = v.getUint16(pos, klein);
    return x === 0xffff ? null : x;
  }
  if (groesse === 4) {
    const x = v.getUint32(pos, klein);
    return x === 0xffffffff ? null : x;
  }
  return null;
}

export function fitLesen(puffer: ArrayBuffer): UhrErgebnis {
  const v = new DataView(puffer);
  if (puffer.byteLength < 14) throw new Error("Die FIT-Datei ist zu kurz.");
  const kopf = v.getUint8(0);
  const kennung = String.fromCharCode(v.getUint8(8), v.getUint8(9), v.getUint8(10), v.getUint8(11));
  if (kennung !== ".FIT") throw new Error("Das ist keine FIT-Datei.");
  const ende = Math.min(puffer.byteLength, kopf + v.getUint32(4, true));

  const defs = new Map<number, Definition>();
  const punkte: Punkt[] = [];
  const hoehen: (number | null)[] = [];
  const pulse: (number | null)[] = [];
  type Sitzung = { zeit: number; bewegt: number; dist: number; hr: number | null; auf: number; start: number | null };
  let sitzung: Sitzung | null = null;
  let letzterZeitstempel = 0;
  let pos = kopf;

  while (pos < ende) {
    const h = v.getUint8(pos++);
    let lokal: number;
    let komprZeit: number | null = null;
    if (h & 0x80) {
      // Komprimierter Zeitstempel (nur Datensatz)
      lokal = (h >> 5) & 0x03;
      const versatz = h & 0x1f;
      const t = (letzterZeitstempel & ~0x1f) + versatz + (versatz < (letzterZeitstempel & 0x1f) ? 0x20 : 0);
      komprZeit = t;
      letzterZeitstempel = t;
    } else if (h & 0x40) {
      // Definition
      lokal = h & 0x0f;
      const mitDev = (h & 0x20) !== 0;
      const klein = v.getUint8(pos + 1) === 0;
      const global = v.getUint16(pos + 2, klein);
      const anzahl = v.getUint8(pos + 4);
      pos += 5;
      const felder: FeldDef[] = [];
      for (let i = 0; i < anzahl; i++) {
        felder.push({ nr: v.getUint8(pos), groesse: v.getUint8(pos + 1) });
        pos += 3;
      }
      let devGroesse = 0;
      if (mitDev) {
        const n = v.getUint8(pos++);
        for (let i = 0; i < n; i++) {
          devGroesse += v.getUint8(pos + 1);
          pos += 3;
        }
      }
      defs.set(lokal, { global, kleinEndian: klein, felder, devGroesse });
      continue;
    } else {
      lokal = h & 0x0f;
    }

    const d = defs.get(lokal);
    if (!d) throw new Error("Die FIT-Datei ist beschädigt (Daten ohne Definition).");
    const werte = new Map<number, number | null>();
    for (const f of d.felder) {
      werte.set(f.nr, unsigned(v, pos, f.groesse, d.kleinEndian));
      pos += f.groesse;
    }
    pos += d.devGroesse;

    const zeitstempel = werte.get(253) ?? komprZeit;
    if (werte.get(253) != null) letzterZeitstempel = werte.get(253)!;

    if (d.global === 20) {
      // record: Zeit, Strecke (cm), Puls, Höhe (Maßstab 5, Versatz 500)
      const dist = werte.get(5);
      const alt = werte.get(2);
      const hr = werte.get(3);
      punkte.push({ t: zeitstempel ?? null, dist: dist != null ? dist / 100 : null });
      hoehen.push(alt != null ? alt / 5 - 500 : null);
      pulse.push(hr ?? null);
    } else if (d.global === 18) {
      // session: Gesamtwerte (mehrere Sitzungen werden addiert)
      const zeit = werte.get(7);
      const bewegt = werte.get(8);
      const dist = werte.get(9);
      const s: Sitzung = sitzung ?? { zeit: 0, bewegt: 0, dist: 0, hr: null, auf: 0, start: werte.get(2) ?? null };
      s.zeit += zeit != null ? zeit / 1000 : 0;
      s.bewegt += bewegt != null ? bewegt / 1000 : 0;
      s.dist += dist != null ? dist / 100 : 0;
      s.hr = s.hr ?? werte.get(16) ?? null;
      s.auf += werte.get(22) ?? 0;
      sitzung = s;
    }
  }

  const ausPunkten = auswerten(punkte);
  const startFit = sitzung?.start ?? punkte.find((x) => x.t != null)?.t ?? null;
  const dauer = sitzung?.bewegt || sitzung?.zeit || ausPunkten.dauer;
  const strecke = sitzung?.dist || [...punkte].reverse().find((x) => x.dist != null)?.dist || null;
  if (!dauer && !strecke) throw new Error("In der FIT-Datei wurden keine Trainingsdaten gefunden.");
  return {
    quelle: "fit",
    dauer_sek: dauer ? Math.round(dauer) : null,
    distanz_m: strecke ? Math.round(strecke) : null,
    puls_schnitt: sitzung?.hr ?? mittel(pulse),
    hoehenmeter: sitzung?.auf || anstieg(hoehen),
    splits: ausPunkten.splits,
    start: startFit != null ? new Date((startFit + FIT_EPOCHE) * 1000).toISOString() : null,
  };
}

/** Datei je nach Endung lesen. */
export async function uhrDateiLesen(datei: File): Promise<UhrErgebnis> {
  if (datei.size > 30 * 1024 * 1024) throw new Error("Die Datei ist zu groß (über 30 MB).");
  const name = datei.name.toLowerCase();
  if (name.endsWith(".gpx")) return gpxLesen(await datei.text());
  if (name.endsWith(".fit")) return fitLesen(await datei.arrayBuffer());
  throw new Error("Bitte eine .gpx- oder .fit-Datei wählen.");
}
