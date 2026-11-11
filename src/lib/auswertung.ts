import { e1rm, type Formel } from "./e1rm";

/** Eingabe: abgeschlossene Einheiten mit Übungen und Sätzen (wie vom Server geladen) */
export type AEinheit = {
  id: string;
  gestartet_am: string;
  uebungen: {
    uebung_id: string;
    uebung_name: string;
    messart?: string;
    saetze: {
      satztyp: string;
      erledigt: boolean;
      wdh: number | null;
      last_kg: number | null;
      dauer_sek?: number | null;
      distanz_m?: number | null;
      messwert?: number | null;
      puls_schnitt?: number | null;
      anstrengung?: number | null;
      seite?: string | null;
      vorgabe: {
        wdh_min?: number | null;
        wdh_max?: number | null;
        last_kg?: number | null;
        dauer_sek?: number | null;
        distanz_m?: number | null;
      };
    }[];
  }[];
};

export type Seitenwerte = {
  bestZeit: number | null;
  meisteWdh: number | null;
  bestStrecke: number | null;
  messwert: number | null;
};

export type Punkt = {
  einheitId: string;
  datum: string;
  saetze: number;
  topKg: number | null;
  volumen: number;
  e1rm: number | null;
  /** Meiste Wdh. in einem Satz und Summe */
  meisteWdh: number | null;
  summeWdh: number;
  /** Längste Zeit (s) in einem Satz und Summe */
  bestZeit: number | null;
  summeZeit: number;
  /** Längste Strecke (m) in einem Satz und Summe */
  bestStrecke: number | null;
  summeStrecke: number;
  /** Bester Messwert (bei „kleiner ist besser“ der kleinste) */
  messwert: number | null;
  /** Pace (s/km) aus allen Abschnitten mit Zeit UND Strecke */
  paceSek: number | null;
  /** Ø-Puls (Mittel der eingetragenen Werte) */
  pulsSchnitt: number | null;
  /** Intervalle: je abgehakter Runde Zeit und Strecke, in Reihenfolge */
  runden: { zeit: number | null; strecke: number | null; nachStrecke: boolean }[];
  /** Bestwerte je Seite, wenn links und rechts getrennt eingetragen wurden */
  seiten: Record<"links" | "rechts", Seitenwerte | null> | null;
  /** Sätze mit Vorgabe, bei denen Wdh./Zeit/Strecke und Gewicht erreicht wurden */
  vorgabeErreicht: number;
  vorgabeGesamt: number;
};

export type UebungsVerlauf = {
  uebungId: string;
  name: string;
  e1rmGeeignet: boolean;
  /** Messart der Übung (neueste) */
  messart: string;
  punkte: Punkt[];
};

/**
 * Fasst die Trainings pro Übung zusammen. Aufwärmsätze und nicht abgehakte
 * Sätze zählen nicht. Das e1RM ist eine Schätzung und nur bei geeigneten Übungen.
 */
export function auswerten(
  einheiten: AEinheit[],
  e1rmGeeignet: (uebungId: string) => boolean,
  formel: Formel,
  maxWdh: number,
  kleinerBesser: (uebungId: string) => boolean = () => false,
): UebungsVerlauf[] {
  const nachUebung = new Map<string, UebungsVerlauf>();
  const sortiert = [...einheiten].sort((a, b) => a.gestartet_am.localeCompare(b.gestartet_am));

  for (const e of sortiert) {
    for (const u of e.uebungen) {
      const zaehlend = u.saetze.filter((s) => s.erledigt && s.satztyp !== "aufwaermen");
      if (zaehlend.length === 0) continue;
      const geeignet = e1rmGeeignet(u.uebung_id);
      let topKg: number | null = null;
      let volumen = 0;
      let bestes: number | null = null;
      let erreicht = 0;
      let mitVorgabe = 0;
      let meisteWdh: number | null = null;
      let summeWdh = 0;
      let bestZeit: number | null = null;
      let summeZeit = 0;
      let bestStrecke: number | null = null;
      let summeStrecke = 0;
      const kleiner = kleinerBesser(u.uebung_id);
      const besserMess = (a: number | null, b: number) => (a == null ? b : kleiner ? Math.min(a, b) : Math.max(a, b));
      let messwert: number | null = null;
      let paceZeit = 0;
      let paceStrecke = 0;
      const pulse: number[] = [];
      const seiten: Record<"links" | "rechts", Seitenwerte | null> = { links: null, rechts: null };
      for (const s of zaehlend) {
        if (s.dauer_sek && s.distanz_m) {
          paceZeit += s.dauer_sek;
          paceStrecke += s.distanz_m;
        }
        if (s.puls_schnitt != null) pulse.push(s.puls_schnitt);
        const mw = s.messwert == null ? null : Number(s.messwert);
        if (mw != null) messwert = besserMess(messwert, mw);
        if (s.seite === "links" || s.seite === "rechts") {
          const w = (seiten[s.seite] ??= { bestZeit: null, meisteWdh: null, bestStrecke: null, messwert: null });
          if (s.dauer_sek != null) w.bestZeit = Math.max(w.bestZeit ?? s.dauer_sek, s.dauer_sek);
          if (s.wdh != null) w.meisteWdh = Math.max(w.meisteWdh ?? s.wdh, s.wdh);
          if (s.distanz_m != null) w.bestStrecke = Math.max(w.bestStrecke ?? s.distanz_m, s.distanz_m);
          if (mw != null) w.messwert = besserMess(w.messwert, mw);
        }
        const kg = s.last_kg == null ? null : Number(s.last_kg);
        if (kg != null) topKg = topKg == null ? kg : Math.max(topKg, kg);
        if (kg != null && s.wdh != null) volumen += kg * s.wdh;
        if (s.wdh != null) {
          meisteWdh = meisteWdh == null ? s.wdh : Math.max(meisteWdh, s.wdh);
          summeWdh += s.wdh;
        }
        if (s.dauer_sek != null) {
          bestZeit = bestZeit == null ? s.dauer_sek : Math.max(bestZeit, s.dauer_sek);
          summeZeit += s.dauer_sek;
        }
        if (s.distanz_m != null) {
          bestStrecke = bestStrecke == null ? s.distanz_m : Math.max(bestStrecke, s.distanz_m);
          summeStrecke += s.distanz_m;
        }
        if (geeignet) {
          const schaetzung = e1rm(kg, s.wdh, formel, maxWdh);
          if (schaetzung != null) bestes = bestes == null ? schaetzung : Math.max(bestes, schaetzung);
        }
        const zielWdh = s.vorgabe?.wdh_min ?? s.vorgabe?.wdh_max ?? null;
        const zielKg = s.vorgabe?.last_kg ?? null;
        const zielZeit = s.vorgabe?.dauer_sek ?? null;
        const zielStrecke = s.vorgabe?.distanz_m ?? null;
        if (zielWdh != null || zielKg != null || zielZeit != null || zielStrecke != null) {
          mitVorgabe++;
          const wdhOk = zielWdh == null || (s.wdh != null && s.wdh >= zielWdh);
          const kgOk = zielKg == null || (kg != null && kg >= Number(zielKg));
          // Bei Zeit UND Strecke (z. B. 5 km in 30 min) zählt die Strecke – länger brauchen ist kein Erfolg
          const zeitOk = zielZeit == null || zielStrecke != null || (s.dauer_sek != null && s.dauer_sek >= zielZeit);
          const streckeOk = zielStrecke == null || (s.distanz_m != null && s.distanz_m >= zielStrecke);
          if (wdhOk && kgOk && zeitOk && streckeOk) erreicht++;
        }
      }
      const eintrag = nachUebung.get(u.uebung_id) ?? {
        uebungId: u.uebung_id,
        name: u.uebung_name,
        e1rmGeeignet: geeignet,
        messart: u.messart ?? "wdh_last",
        punkte: [],
      };
      eintrag.name = u.uebung_name; // neuester Name
      eintrag.messart = u.messart ?? eintrag.messart;
      eintrag.punkte.push({
        einheitId: e.id,
        datum: e.gestartet_am,
        saetze: zaehlend.length,
        topKg,
        volumen: Math.round(volumen * 10) / 10,
        e1rm: bestes,
        meisteWdh,
        summeWdh,
        bestZeit,
        summeZeit,
        bestStrecke,
        summeStrecke,
        messwert,
        paceSek: paceStrecke > 0 ? Math.round(paceZeit / (paceStrecke / 1000)) : null,
        runden: zaehlend.map((s) => ({
          zeit: s.dauer_sek ?? null,
          strecke: s.distanz_m ?? null,
          nachStrecke: s.vorgabe?.distanz_m != null,
        })),
        pulsSchnitt: pulse.length ? Math.round(pulse.reduce((x, y) => x + y, 0) / pulse.length) : null,
        seiten: seiten.links || seiten.rechts ? seiten : null,
        vorgabeErreicht: erreicht,
        vorgabeGesamt: mitVorgabe,
      });
      nachUebung.set(u.uebung_id, eintrag);
    }
  }
  // Häufigste Übungen zuerst
  return [...nachUebung.values()].sort((a, b) => b.punkte.length - a.punkte.length || a.name.localeCompare(b.name));
}
