/**
 * Leistungstests (Athletik): Einheiten, Tageswert aus mehreren Versuchen,
 * Veränderung zum letzten und zum ersten Test. Bewusst ohne Normwerte.
 */

export type Wertung = "bester" | "schnitt";

export const einheitText: Record<string, string> = {
  s: "Sekunden (s)",
  cm: "Zentimeter (cm)",
  m: "Meter (m)",
  kg: "Kilogramm (kg)",
  wdh: "Wiederholungen",
  stufe: "Stufe / Level",
  punkte: "Punkte",
};

/** Kurzform für Eingabefelder und Achsen */
export const einheitKurz: Record<string, string> = {
  s: "s",
  cm: "cm",
  m: "m",
  kg: "kg",
  wdh: "Wdh.",
  stufe: "Stufe",
  punkte: "Pkt.",
};

const nachkommastellen: Record<string, number> = { s: 2, cm: 1, m: 2, kg: 1, wdh: 0, stufe: 1, punkte: 1 };

/** Zahl mit passender Genauigkeit, z. B. „1,85 s“, „245 cm“, „2,4 m“ */
export function wertText(n: number, einheit: string | null | undefined, mitEinheit = true): string {
  const e = einheit ?? "";
  const stellen = nachkommastellen[e] ?? 2;
  const z = n.toLocaleString("de-DE", { maximumFractionDigits: stellen, minimumFractionDigits: e === "s" ? 2 : 0 });
  if (!mitEinheit || !e) return z;
  if (e === "stufe") return `Stufe ${z}`;
  return `${z} ${einheitKurz[e] ?? e}`;
}

/** Wert eines Testtags: bester Versuch (je nach Richtung) oder Durchschnitt */
export function tageswert(versuche: number[], wertung: Wertung, kleinerBesser: boolean): number | null {
  const w = versuche.filter((x) => Number.isFinite(x));
  if (w.length === 0) return null;
  if (wertung === "schnitt") return Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 1000) / 1000;
  return kleinerBesser ? Math.min(...w) : Math.max(...w);
}

export type Veraenderung = {
  /** Änderung des Werts in %, mit Vorzeichen (z. B. -2,1 = Wert ist kleiner geworden) */
  prozent: number;
  /** Ist das eine Verbesserung (bei Sprintzeiten: kleiner)? null = praktisch gleich */
  besser: boolean | null;
};

/** Veränderung von alt zu neu. Unter 0,5 % gilt als „gleich“. */
export function veraenderung(alt: number | null, neu: number | null, kleinerBesser: boolean): Veraenderung | null {
  if (alt == null || neu == null || alt === 0) return null;
  const prozent = Math.round(((neu - alt) / Math.abs(alt)) * 1000) / 10;
  if (Math.abs(prozent) < 0.5) return { prozent, besser: null };
  return { prozent, besser: kleinerBesser ? neu < alt : neu > alt };
}

export function veraenderungText(v: Veraenderung | null): string {
  if (!v) return "–";
  const zahl = `${v.prozent > 0 ? "+" : v.prozent < 0 ? "−" : "±"}${Math.abs(v.prozent).toLocaleString("de-DE")} %`;
  if (v.besser === null) return `${zahl} (gleich)`;
  return `${zahl} (${v.besser ? "besser" : "schlechter"})`;
}

export type TestTag = { datum: string; versuche: number[] };

export type TestUebersicht = {
  tage: { datum: string; wert: number }[];
  letzter: { datum: string; wert: number } | null;
  zumLetzten: Veraenderung | null;
  zumErsten: Veraenderung | null;
  bestwert: number | null;
};

/** Verlauf eines Tests über alle Testtage */
export function testAuswerten(tage: TestTag[], wertung: Wertung, kleinerBesser: boolean): TestUebersicht {
  const werte = tage
    .map((t) => ({ datum: t.datum, wert: tageswert(t.versuche, wertung, kleinerBesser) }))
    .filter((t): t is { datum: string; wert: number } => t.wert != null);
  const n = werte.length;
  const letzter = n ? werte[n - 1] : null;
  return {
    tage: werte,
    letzter,
    zumLetzten: n >= 2 ? veraenderung(werte[n - 2].wert, werte[n - 1].wert, kleinerBesser) : null,
    zumErsten: n >= 3 ? veraenderung(werte[0].wert, werte[n - 1].wert, kleinerBesser) : null,
    bestwert: n ? (kleinerBesser ? Math.min(...werte.map((w) => w.wert)) : Math.max(...werte.map((w) => w.wert))) : null,
  };
}
