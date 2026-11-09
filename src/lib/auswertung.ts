import { e1rm, type Formel } from "./e1rm";

/** Eingabe: abgeschlossene Einheiten mit Übungen und Sätzen (wie vom Server geladen) */
export type AEinheit = {
  id: string;
  gestartet_am: string;
  uebungen: {
    uebung_id: string;
    uebung_name: string;
    saetze: {
      satztyp: string;
      erledigt: boolean;
      wdh: number | null;
      last_kg: number | null;
      vorgabe: { wdh_min?: number | null; wdh_max?: number | null; last_kg?: number | null };
    }[];
  }[];
};

export type Punkt = {
  einheitId: string;
  datum: string;
  saetze: number;
  topKg: number | null;
  volumen: number;
  e1rm: number | null;
  /** Sätze mit Vorgabe, bei denen Wdh. und Gewicht erreicht wurden */
  vorgabeErreicht: number;
  vorgabeGesamt: number;
};

export type UebungsVerlauf = {
  uebungId: string;
  name: string;
  e1rmGeeignet: boolean;
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
      for (const s of zaehlend) {
        const kg = s.last_kg == null ? null : Number(s.last_kg);
        if (kg != null) topKg = topKg == null ? kg : Math.max(topKg, kg);
        if (kg != null && s.wdh != null) volumen += kg * s.wdh;
        if (geeignet) {
          const schaetzung = e1rm(kg, s.wdh, formel, maxWdh);
          if (schaetzung != null) bestes = bestes == null ? schaetzung : Math.max(bestes, schaetzung);
        }
        const zielWdh = s.vorgabe?.wdh_min ?? s.vorgabe?.wdh_max ?? null;
        const zielKg = s.vorgabe?.last_kg ?? null;
        if (zielWdh != null || zielKg != null) {
          mitVorgabe++;
          const wdhOk = zielWdh == null || (s.wdh != null && s.wdh >= zielWdh);
          const kgOk = zielKg == null || (kg != null && kg >= Number(zielKg));
          if (wdhOk && kgOk) erreicht++;
        }
      }
      const eintrag = nachUebung.get(u.uebung_id) ?? {
        uebungId: u.uebung_id,
        name: u.uebung_name,
        e1rmGeeignet: geeignet,
        punkte: [],
      };
      eintrag.name = u.uebung_name; // neuester Name
      eintrag.punkte.push({
        einheitId: e.id,
        datum: e.gestartet_am,
        saetze: zaehlend.length,
        topKg,
        volumen: Math.round(volumen * 10) / 10,
        e1rm: bestes,
        vorgabeErreicht: erreicht,
        vorgabeGesamt: mitVorgabe,
      });
      nachUebung.set(u.uebung_id, eintrag);
    }
  }
  // Häufigste Übungen zuerst
  return [...nachUebung.values()].sort((a, b) => b.punkte.length - a.punkte.length || a.name.localeCompare(b.name));
}
