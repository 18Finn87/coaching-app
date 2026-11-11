/**
 * Intervalle: Ein Block besteht aus Runden. Jede Runde ist ein Satz mit
 * Belastung (Zeit ODER Strecke) und anschließender Pause.
 */

export type BlockEingabe = {
  runden: number;
  serien: number;
  art: "zeit" | "strecke";
  /** Sekunden bzw. Meter */
  wert: number;
  pauseSek: number;
  serienpauseSek: number;
};

export type PlanRunde = {
  satznummer: number;
  dauer_sek: number | null;
  distanz_m: number | null;
  pause_sek: number | null;
  zusatz: { serienende?: true };
};

/** Erzeugt die Plansätze für einen Block, z. B. 2 Serien × 3 × 400 m. */
export function blockSaetze(b: BlockEingabe, startNummer = 1): PlanRunde[] {
  const liste: PlanRunde[] = [];
  let nr = startNummer;
  for (let s = 1; s <= b.serien; s++) {
    for (let r = 1; r <= b.runden; r++) {
      const letzteDerSerie = r === b.runden;
      const ganzLetzte = letzteDerSerie && s === b.serien;
      liste.push({
        satznummer: nr++,
        dauer_sek: b.art === "zeit" ? b.wert : null,
        distanz_m: b.art === "strecke" ? b.wert : null,
        pause_sek: ganzLetzte ? null : letzteDerSerie ? b.serienpauseSek : b.pauseSek,
        zusatz: letzteDerSerie ? { serienende: true } : {},
      });
    }
  }
  return liste;
}

export type Schritt = {
  typ: "vorbereitung" | "belastung" | "pause";
  /** Index der Runde (bei Pause: die Runde davor) */
  runde: number;
  /** Sekunden; null = offen, bis „Runde fertig“ getippt wird (Strecken-Intervall) */
  dauer: number | null;
};

/** Ablauf für den Timer: Vorbereitung, dann je Runde Belastung und (außer zuletzt) Pause. */
export function ablauf(
  runden: { dauer_sek?: number | null; distanz_m?: number | null; pause_sek?: number | null }[],
  vorbereitungSek = 10,
): Schritt[] {
  const s: Schritt[] = [];
  if (runden.length === 0) return s;
  if (vorbereitungSek > 0) s.push({ typ: "vorbereitung", runde: 0, dauer: vorbereitungSek });
  runden.forEach((r, i) => {
    // Zeit-Intervall: feste Dauer. Strecken-Intervall: offen (Zeit wird gemessen).
    s.push({ typ: "belastung", runde: i, dauer: r.distanz_m ? null : (r.dauer_sek ?? null) });
    if (i < runden.length - 1 && r.pause_sek) s.push({ typ: "pause", runde: i, dauer: r.pause_sek });
  });
  return s;
}

export type RundenAuswertung = {
  anzahl: number;
  schnitt: number;
  schnellste: number;
  langsamste: number;
  /** Letzte gegenüber erster Runde in % (positiv = langsamer / weniger) */
  veraenderungProzent: number | null;
};

/** Auswertung der Rundenwerte (Zeiten bei Strecken-Intervallen, Strecken bei Zeit-Intervallen). */
export function rundenAuswerten(werte: number[], kleinerBesser: boolean): RundenAuswertung | null {
  const w = werte.filter((x) => Number.isFinite(x) && x > 0);
  if (w.length === 0) return null;
  const schnitt = Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 10) / 10;
  const besser = kleinerBesser ? Math.min(...w) : Math.max(...w);
  const schlechter = kleinerBesser ? Math.max(...w) : Math.min(...w);
  const veraenderung =
    w.length >= 2 ? Math.round(((kleinerBesser ? w[w.length - 1] - w[0] : w[0] - w[w.length - 1]) / w[0]) * 1000) / 10 : null;
  return { anzahl: w.length, schnitt, schnellste: besser, langsamste: schlechter, veraenderungProzent: veraenderung };
}

/** Kurzer Text für einen Block aus Plansätzen, z. B. „2 × 3 × 400 m · Pause 1:30 · Serienpause 3:00“. */
export function blockText(
  runden: { dauer_sek?: number | null; distanz_m?: number | null; pause_sek?: number | null; zusatz?: { serienende?: boolean } | null }[],
  zeit: (s: number) => string,
): string {
  if (runden.length === 0) return "";
  const r0 = runden[0];
  const belastung = r0.distanz_m ? `${r0.distanz_m} m` : r0.dauer_sek ? zeit(r0.dauer_sek) : "?";
  const einheitlich = runden.every((r) => r.distanz_m === r0.distanz_m && r.dauer_sek === r0.dauer_sek);
  if (!einheitlich) return `${runden.length} Runden`;
  const serien = Math.max(1, runden.filter((r) => r.zusatz?.serienende).length);
  const proSerie = runden.length / serien;
  const teile = [Number.isInteger(proSerie) && serien > 1 ? `${serien} × ${proSerie} × ${belastung}` : `${runden.length} × ${belastung}`];
  const pause = runden.find((r) => !r.zusatz?.serienende && r.pause_sek)?.pause_sek;
  if (pause) teile.push(`Pause ${zeit(pause)}`);
  const sp = serien > 1 ? runden.find((r) => r.zusatz?.serienende && r.pause_sek)?.pause_sek : null;
  if (sp) teile.push(`Serienpause ${zeit(sp)}`);
  return teile.join(" · ");
}
