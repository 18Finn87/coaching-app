/**
 * Rechnen für Ausdauer: Pace, Tempo, Pulszonen, Wochenumfang.
 * Pulszonen sind eine SCHÄTZUNG aus Maximal- oder Schwellenpuls.
 */

/** Sekunden pro km aus Dauer (s) und Strecke (m). */
export function pace(dauerSek: number | null | undefined, distanzM: number | null | undefined): number | null {
  if (!dauerSek || !distanzM || dauerSek <= 0 || distanzM <= 0) return null;
  return Math.round(dauerSek / (distanzM / 1000));
}

/** km/h aus Dauer (s) und Strecke (m), eine Nachkommastelle. */
export function kmh(dauerSek: number | null | undefined, distanzM: number | null | undefined): number | null {
  if (!dauerSek || !distanzM || dauerSek <= 0 || distanzM <= 0) return null;
  return Math.round((distanzM / 1000 / (dauerSek / 3600)) * 10) / 10;
}

/** 330 → "5:30 /km" */
export function paceText(sekProKm: number | null): string {
  if (sekProKm == null) return "–";
  const m = Math.floor(sekProKm / 60);
  const s = Math.round(sekProKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

/** "5:30" oder "5.30" → 330 Sekunden; ungültig → null */
export function paceLesen(text: string): number | null {
  const m = text.trim().match(/^(\d{1,2})[:.,](\d{1,2})$/);
  if (!m) return null;
  const s = Number(m[2]);
  if (s >= 60) return null;
  return Number(m[1]) * 60 + s;
}

/** 1:05:30 bzw. 45:00 für Dauer-Anzeigen */
export function dauerText(sek: number | null | undefined): string {
  if (sek == null) return "–";
  const h = Math.floor(sek / 3600);
  const m = Math.floor((sek % 3600) / 60);
  const s = sek % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function kmText(m: number | null | undefined): string {
  if (m == null) return "–";
  return `${(m / 1000).toLocaleString("de-DE", { maximumFractionDigits: 2 })} km`;
}

// ---------------------------------------------------------------------
// Pulszonen (Schätzung)
// ---------------------------------------------------------------------

export type Zone = { zone: 1 | 2 | 3 | 4 | 5; von: number; bis: number };
export type Pulswerte = { hf_max: number | null; hf_schwelle: number | null };

export const ZONEN_NAME: Record<number, string> = {
  1: "Z1 sehr locker",
  2: "Z2 locker",
  3: "Z3 mittel",
  4: "Z4 hart",
  5: "Z5 sehr hart",
};

/**
 * Mit Schwellenpuls (genauer): Z1 < 85 %, Z2 85–89 %, Z3 90–94 %, Z4 95–99 %, Z5 ab 100 %.
 * Nur mit Maximalpuls: Z1 50–60 %, Z2 60–70 %, Z3 70–80 %, Z4 80–90 %, Z5 90–100 %.
 */
export function pulszonen(w: Pulswerte): { zonen: Zone[]; methode: "schwelle" | "maximal" } | null {
  const r = (x: number) => Math.round(x);
  if (w.hf_schwelle) {
    const s = w.hf_schwelle;
    const oben = w.hf_max ?? r(s * 1.1);
    return {
      methode: "schwelle",
      zonen: [
        { zone: 1, von: r(s * 0.6), bis: r(s * 0.85) - 1 },
        { zone: 2, von: r(s * 0.85), bis: r(s * 0.9) - 1 },
        { zone: 3, von: r(s * 0.9), bis: r(s * 0.95) - 1 },
        { zone: 4, von: r(s * 0.95), bis: s - 1 },
        { zone: 5, von: s, bis: oben },
      ],
    };
  }
  if (w.hf_max) {
    const m = w.hf_max;
    return {
      methode: "maximal",
      zonen: [
        { zone: 1, von: r(m * 0.5), bis: r(m * 0.6) - 1 },
        { zone: 2, von: r(m * 0.6), bis: r(m * 0.7) - 1 },
        { zone: 3, von: r(m * 0.7), bis: r(m * 0.8) - 1 },
        { zone: 4, von: r(m * 0.8), bis: r(m * 0.9) - 1 },
        { zone: 5, von: r(m * 0.9), bis: m },
      ],
    };
  }
  return null;
}

/** In welcher Zone liegt ein Puls? Unter Z1 → 1, über Z5 → 5. */
export function zoneVon(puls: number | null | undefined, zonen: Zone[] | undefined): number | null {
  if (puls == null || !zonen?.length) return null;
  if (puls < zonen[0].von) return 1;
  for (const z of zonen) if (puls <= z.bis) return z.zone;
  return 5;
}

// ---------------------------------------------------------------------
// Intensitäts-Vorgabe (liegt im Zusatzfeld des Plansatzes)
// ---------------------------------------------------------------------

export type Intensitaet = {
  art: "zone" | "pace" | "kmh" | "watt" | "rpe";
  von: number | null;
  bis: number | null;
};

export const INTENSITAET_ART: Record<Intensitaet["art"], string> = {
  zone: "Pulszone",
  pace: "Pace (min/km)",
  kmh: "Tempo (km/h)",
  watt: "Watt",
  rpe: "Anstrengung (1–10)",
};

export function intensitaetText(i: Intensitaet | null | undefined): string {
  if (!i || (i.von == null && i.bis == null)) return "";
  const bereich = (f: (n: number) => string) =>
    i.von != null && i.bis != null && i.von !== i.bis ? `${f(i.von)}–${f(i.bis)}` : f((i.von ?? i.bis)!);
  switch (i.art) {
    case "zone":
      return `Zone ${bereich((n) => String(n))}`;
    case "pace":
      return `Pace ${bereich((n) => paceText(n).replace(" /km", ""))} /km`;
    case "kmh":
      return `${bereich((n) => n.toLocaleString("de-DE"))} km/h`;
    case "watt":
      return `${bereich((n) => String(n))} W`;
    case "rpe":
      return `Anstrengung ${bereich((n) => String(n))}`;
  }
}

// ---------------------------------------------------------------------
// Wochenumfang
// ---------------------------------------------------------------------

export type AusdauerAbschnitt = {
  datum: string;
  dauer_sek: number | null;
  distanz_m: number | null;
  puls_schnitt: number | null;
  anstrengung: number | null;
};

export type Woche = {
  /** Montag der Woche (JJJJ-MM-TT) */
  woche: string;
  minuten: number;
  meter: number;
  /** Minuten nach Intensität; "offen" = weder Puls noch Anstrengung angegeben */
  locker: number;
  mittel: number;
  hart: number;
  offen: number;
};

/** Locker = Z1–2 bzw. Anstrengung bis 4, mittel = Z3 bzw. 5–6, hart = Z4–5 bzw. ab 7 (Puls hat Vorrang). */
export function intensitaetsStufe(a: AusdauerAbschnitt, zonen?: Zone[]): "locker" | "mittel" | "hart" | "offen" {
  const z = zoneVon(a.puls_schnitt, zonen);
  if (z != null) return z <= 2 ? "locker" : z === 3 ? "mittel" : "hart";
  if (a.anstrengung != null) return a.anstrengung <= 4 ? "locker" : a.anstrengung <= 6 ? "mittel" : "hart";
  return "offen";
}

function montag(iso: string): string {
  const d = new Date(iso);
  const tag = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12));
  tag.setUTCDate(tag.getUTCDate() - ((tag.getUTCDay() + 6) % 7));
  return tag.toISOString().slice(0, 10);
}

export function wochenUmfang(abschnitte: AusdauerAbschnitt[], zonen?: Zone[]): Woche[] {
  const karte = new Map<string, Woche>();
  for (const a of abschnitte) {
    const w = montag(a.datum);
    const e = karte.get(w) ?? { woche: w, minuten: 0, meter: 0, locker: 0, mittel: 0, hart: 0, offen: 0 };
    const min = (a.dauer_sek ?? 0) / 60;
    e.minuten += min;
    e.meter += a.distanz_m ?? 0;
    e[intensitaetsStufe(a, zonen)] += min;
    karte.set(w, e);
  }
  return [...karte.values()]
    .map((w) => ({
      ...w,
      minuten: Math.round(w.minuten),
      locker: Math.round(w.locker),
      mittel: Math.round(w.mittel),
      hart: Math.round(w.hart),
      offen: Math.round(w.offen),
    }))
    .sort((a, b) => a.woche.localeCompare(b.woche));
}
