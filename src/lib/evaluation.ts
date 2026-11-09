/**
 * Wann ist die nächste Evaluation fällig?
 * Dieselbe Regel wie in der Datenbank (intern.evaluationen_pruefen):
 * nach X Wochen ODER Y Einheiten – je nachdem, was zuerst eintritt.
 * Die App erinnert nur. Sie ändert nie einen Plan.
 */

export type Stufe = "anfaenger" | "fortgeschritten" | "sehr_erfahren";
export type Regel = { wochen: number; einheiten: number };

/** Anfänger sind fest, die anderen Stufen kann der Coach ändern. */
export const STANDARD_REGELN: Record<Stufe, Regel> = {
  anfaenger: { wochen: 4, einheiten: 10 },
  fortgeschritten: { wochen: 6, einheiten: 16 },
  sehr_erfahren: { wochen: 8, einheiten: 20 },
};

export function regelFuer(stufe: Stufe, eigene: Partial<Record<Stufe, Regel>> = {}): Regel {
  if (stufe === "anfaenger") return STANDARD_REGELN.anfaenger;
  return eigene[stufe] ?? STANDARD_REGELN[stufe];
}

export type Stand = {
  faellig: boolean;
  ausloeser: "wochen" | "einheiten" | null;
  /** Zeitpunkt, an dem sie fällig wurde (falls fällig) */
  faelligAm: Date | null;
  einheitenSeitBeginn: number;
  restEinheiten: number;
  restTage: number;
};

const TAG = 24 * 60 * 60 * 1000;

/**
 * @param beginn  Beginn des Zeitraums (Veröffentlichung der Planversion oder letzte Evaluation)
 * @param einheiten  Startzeitpunkte abgeschlossener Einheiten dieses Plans
 */
export function evaluationsStand(beginn: Date, einheiten: Date[], regel: Regel, jetzt = new Date()): Stand {
  const imZeitraum = einheiten
    .filter((d) => d.getTime() >= beginn.getTime() && d.getTime() <= jetzt.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const nTe = imZeitraum[regel.einheiten - 1] ?? null;
  const wochenTermin = new Date(beginn.getTime() + regel.wochen * 7 * TAG);

  let ausloeser: Stand["ausloeser"] = null;
  let faelligAm: Date | null = null;
  if (nTe && nTe.getTime() <= wochenTermin.getTime()) {
    ausloeser = "einheiten";
    faelligAm = nTe;
  } else if (wochenTermin.getTime() <= jetzt.getTime()) {
    ausloeser = "wochen";
    faelligAm = wochenTermin;
  }

  return {
    faellig: ausloeser !== null,
    ausloeser,
    faelligAm,
    einheitenSeitBeginn: imZeitraum.length,
    restEinheiten: Math.max(0, regel.einheiten - imZeitraum.length),
    restTage: Math.max(0, Math.ceil((wochenTermin.getTime() - jetzt.getTime()) / TAG)),
  };
}
