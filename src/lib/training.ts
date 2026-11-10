"use client";

import { supabase } from "./supabase";
import type { Einheit } from "./plaene";
import type { Intensitaet } from "./ausdauer";

// ---------------------------------------------------------------------
// Datentypen eines Trainings (so, wie es auf dem Handy gespeichert wird)
// ---------------------------------------------------------------------

export type Vorgabe = {
  wdh_min?: number | null;
  wdh_max?: number | null;
  last_kg?: number | null;
  last_prozent?: number | null;
  rir_ziel?: number | null;
  tempo?: string | null;
  pause_sek?: number | null;
  dauer_sek?: number | null;
  distanz_m?: number | null;
  intensitaet?: Intensitaet | null;
};

export type TSatz = {
  id: string;
  plan_satz_id: string | null;
  satznummer: number;
  satztyp: string;
  vorgabe: Vorgabe;
  wdh: number | null;
  last_kg: number | null;
  rir: number | null;
  dauer_sek: number | null;
  distanz_m: number | null;
  /** Messtests (z. B. cm) */
  messwert?: number | null;
  puls_schnitt?: number | null;
  anstrengung?: number | null;
  erledigt: boolean;
  /** Nur bei Übungen mit getrennten Seiten */
  seite?: "links" | "rechts" | null;
  /** Weitere Werte späterer Module (z. B. Puls) */
  zusatz?: Record<string, unknown>;
};

export type TUebung = {
  id: string;
  uebung_id: string;
  plan_uebung_id: string | null;
  reihenfolge: number;
  uebung_name: string;
  messart: string;
  ersetzt: boolean;
  notiz: string;
  // nur auf dem Handy (für die Anzeige)
  hinweis?: string;
  einseitig?: boolean;
  seiten_getrennt?: boolean;
  saetze: TSatz[];
};

export type TEinheit = {
  id: string;
  athlet_id: string;
  planversion_id: string | null;
  plan_einheit_id: string | null;
  titel: string;
  status: "laeuft" | "abgeschlossen" | "abgebrochen";
  gestartet_am: string;
  beendet_am: string | null;
  session_rpe: number | null;
  notiz: string;
  uebungen: TUebung[];
};

export type LokalesTraining = {
  einheit: TEinheit;
  /** Ids, die beim nächsten Hochladen gelöscht werden müssen */
  geloescht: { uebungen: string[]; saetze: string[] };
  /** true = es gibt Änderungen, die noch nicht hochgeladen sind */
  ungespeichert: boolean;
  /** Status, den der Server zuletzt bestätigt hat (null = noch nie hochgeladen) */
  serverStatus: string | null;
};

// ---------------------------------------------------------------------
// Speicher auf dem Handy
// ---------------------------------------------------------------------

const PRAEFIX = "coaching.training.";
const PLAN_CACHE = "coaching.plancache.";

function lesen<T>(schluessel: string): T | null {
  try {
    const roh = localStorage.getItem(schluessel);
    return roh ? (JSON.parse(roh) as T) : null;
  } catch {
    return null;
  }
}

function schreiben(schluessel: string, wert: unknown) {
  try {
    localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    // Speicher voll oder gesperrt – dann geht es nur online weiter
  }
}

export function lokalLaden(id: string): LokalesTraining | null {
  return lesen<LokalesTraining>(PRAEFIX + id);
}

export function lokalSpeichern(t: LokalesTraining) {
  schreiben(PRAEFIX + t.einheit.id, t);
  window.dispatchEvent(new CustomEvent("training-geaendert", { detail: t.einheit.id }));
}

export function lokalEntfernen(id: string) {
  try {
    localStorage.removeItem(PRAEFIX + id);
  } catch {
    // egal
  }
}

/** Alle Trainings dieser Person, die auf dem Handy liegen */
export function lokaleTrainings(athletId: string): LokalesTraining[] {
  const liste: LokalesTraining[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(PRAEFIX)) continue;
      const t = lesen<LokalesTraining>(k);
      if (t && t.einheit.athlet_id === athletId) liste.push(t);
    }
  } catch {
    // kein Speicher
  }
  return liste.sort((a, b) => b.einheit.gestartet_am.localeCompare(a.einheit.gestartet_am));
}

/** Plan für das Training ohne Internet zwischenspeichern */
export type PlanCache = { titel: string; versionId: string; versionsnummer: number; einheiten: Einheit[] }[];

export function planCacheSpeichern(athletId: string, daten: PlanCache) {
  schreiben(PLAN_CACHE + athletId, daten);
}

export function planCacheLaden(athletId: string): PlanCache {
  return lesen<PlanCache>(PLAN_CACHE + athletId) ?? [];
}

// ---------------------------------------------------------------------
// Neues Training anlegen
// ---------------------------------------------------------------------

export function neueId(): string {
  return crypto.randomUUID();
}

export function trainingAusPlan(athletId: string, versionId: string, e: Einheit): LokalesTraining {
  return {
    einheit: {
      id: neueId(),
      athlet_id: athletId,
      planversion_id: versionId,
      plan_einheit_id: e.id,
      titel: e.name,
      status: "laeuft",
      gestartet_am: new Date().toISOString(),
      beendet_am: null,
      session_rpe: null,
      notiz: "",
      uebungen: e.plan_uebungen.map((u, i) => ({
        id: neueId(),
        uebung_id: u.uebung_id,
        plan_uebung_id: u.id,
        reihenfolge: i,
        uebung_name: u.uebung?.name ?? "Übung",
        messart: u.uebung?.messart ?? "wdh_last",
        ersetzt: false,
        notiz: "",
        hinweis: u.hinweis,
        einseitig: u.uebung?.einseitig ?? false,
        seiten_getrennt: u.uebung?.seiten_getrennt ?? false,
        saetze: seitenAufteilen(u.uebung?.seiten_getrennt ?? false, u.plan_saetze.map((s) => ({
          id: neueId(),
          plan_satz_id: s.id,
          satznummer: s.satznummer,
          satztyp: s.satztyp,
          vorgabe: {
            wdh_min: s.wdh_min,
            wdh_max: s.wdh_max,
            last_kg: s.last_kg,
            last_prozent: s.last_prozent,
            rir_ziel: s.rir_ziel,
            tempo: s.tempo,
            pause_sek: s.pause_sek,
            dauer_sek: s.dauer_sek,
            distanz_m: s.distanz_m,
            intensitaet: s.zusatz?.intensitaet ?? null,
          },
          wdh: null,
          last_kg: s.last_kg,
          rir: null,
          dauer_sek: null,
          distanz_m: null,
          erledigt: false,
        }))),
      })),
    },
    geloescht: { uebungen: [], saetze: [] },
    ungespeichert: true,
    serverStatus: null,
  };
}

/** Bei getrennten Seiten wird jeder Satz zu "links" + "rechts" (gleiche Satznummer). */
export function seitenAufteilen(getrennt: boolean, saetze: TSatz[]): TSatz[] {
  if (!getrennt) return saetze;
  return saetze.flatMap((s) => [
    { ...s, seite: "links" as const },
    { ...s, id: neueId(), seite: "rechts" as const },
  ]);
}

/** Satznummern neu vergeben; ein Paar links/rechts behält dieselbe Nummer. */
export function nummerieren(saetze: TSatz[]) {
  let nr = 0;
  for (const s of saetze) {
    if (s.seite !== "rechts" || nr === 0) nr++;
    s.satznummer = nr;
  }
}

export function freiesTraining(athletId: string): LokalesTraining {
  return {
    einheit: {
      id: neueId(),
      athlet_id: athletId,
      planversion_id: null,
      plan_einheit_id: null,
      titel: "Freies Training",
      status: "laeuft",
      gestartet_am: new Date().toISOString(),
      beendet_am: null,
      session_rpe: null,
      notiz: "",
      uebungen: [],
    },
    geloescht: { uebungen: [], saetze: [] },
    ungespeichert: true,
    serverStatus: null,
  };
}

// ---------------------------------------------------------------------
// Vom Server laden (z. B. auf einem anderen Gerät oder für den Coach)
// ---------------------------------------------------------------------

type ServerZeile = Omit<TEinheit, "uebungen"> & {
  ausgefuehrte_uebungen: (Omit<TUebung, "saetze"> & { ausgefuehrte_saetze: TSatz[] })[];
};

export async function vomServerLaden(id: string): Promise<{ daten: LokalesTraining | null; fehler: boolean }> {
  const { data, error } = await supabase()
    .from("trainingseinheiten")
    .select(
      `id, athlet_id, planversion_id, plan_einheit_id, titel, status, gestartet_am, beendet_am, session_rpe, notiz,
       ausgefuehrte_uebungen (id, uebung_id, plan_uebung_id, reihenfolge, uebung_name, messart, ersetzt, notiz,
         ausgefuehrte_saetze (id, plan_satz_id, satznummer, satztyp, vorgabe, wdh, last_kg, rir, dauer_sek, distanz_m, messwert, puls_schnitt, anstrengung, erledigt, seite, zusatz))`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return { daten: null, fehler: true };
  if (!data) return { daten: null, fehler: false };
  const z = data as unknown as ServerZeile;
  const { ausgefuehrte_uebungen, ...kopf } = z;
  return {
    fehler: false,
    daten: {
      einheit: {
        ...kopf,
        uebungen: [...ausgefuehrte_uebungen]
          .sort((a, b) => a.reihenfolge - b.reihenfolge)
          .map(({ ausgefuehrte_saetze, ...u }) => ({
            ...u,
            saetze: [...ausgefuehrte_saetze]
              .map((s) => ({
                ...s,
                last_kg: s.last_kg === null ? null : Number(s.last_kg),
                rir: s.rir === null ? null : Number(s.rir),
                messwert: s.messwert == null ? null : Number(s.messwert),
              }))
              .sort((a, b) => a.satznummer - b.satznummer || (a.seite === "rechts" ? 1 : 0) - (b.seite === "rechts" ? 1 : 0)),
            seiten_getrennt: ausgefuehrte_saetze.some((s) => s.seite),
          })),
      },
      geloescht: { uebungen: [], saetze: [] },
      ungespeichert: false,
      serverStatus: z.status,
    },
  };
}

// ---------------------------------------------------------------------
// Hochladen – beliebig oft wiederholbar, ohne Doppelungen
// ---------------------------------------------------------------------

const laufend = new Map<string, Promise<boolean>>();

/** Lädt ein Training hoch. Gibt true zurück, wenn danach alles auf dem Server ist. */
export function hochladen(id: string): Promise<boolean> {
  const vorher = laufend.get(id) ?? Promise.resolve(true);
  const neu = vorher.then(() => einmalHochladen(id));
  laufend.set(id, neu);
  return neu;
}

async function einmalHochladen(id: string): Promise<boolean> {
  const t = lokalLaden(id);
  if (!t || !t.ungespeichert) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  // Stand merken: Wird währenddessen weiter eingetragen, bleibt "ungespeichert" stehen
  const stand = JSON.stringify(t);
  const e = t.einheit;
  const sb = supabase();
  const kopf = {
    id: e.id,
    athlet_id: e.athlet_id,
    planversion_id: e.planversion_id,
    plan_einheit_id: e.plan_einheit_id,
    titel: e.titel,
    status: e.status,
    gestartet_am: e.gestartet_am,
    beendet_am: e.beendet_am,
    session_rpe: e.session_rpe,
    notiz: e.notiz,
  };
  // Wird erst beim Abschließen alles hochgeladen, zuerst als "läuft" speichern –
  // sonst würden die letzten Sätze fälschlich als spätere Korrektur protokolliert.
  const zweiSchritte = e.status === "abgeschlossen" && t.serverStatus !== "abgeschlossen";

  try {
    const r1 = await sb
      .from("trainingseinheiten")
      .upsert(zweiSchritte ? { ...kopf, status: "laeuft", beendet_am: null, session_rpe: null } : kopf);
    if (r1.error) throw r1.error;

    if (t.geloescht.saetze.length) {
      const r = await sb.from("ausgefuehrte_saetze").delete().in("id", t.geloescht.saetze);
      if (r.error) throw r.error;
    }
    if (t.geloescht.uebungen.length) {
      const r = await sb.from("ausgefuehrte_uebungen").delete().in("id", t.geloescht.uebungen);
      if (r.error) throw r.error;
    }

    if (e.uebungen.length) {
      const r2 = await sb.from("ausgefuehrte_uebungen").upsert(
        e.uebungen.map((u, i) => ({
          id: u.id,
          trainingseinheit_id: e.id,
          uebung_id: u.uebung_id,
          plan_uebung_id: u.plan_uebung_id,
          reihenfolge: i,
          uebung_name: u.uebung_name,
          messart: u.messart,
          ersetzt: u.ersetzt,
          notiz: u.notiz,
        })),
      );
      if (r2.error) throw r2.error;
      const saetze = e.uebungen.flatMap((u) =>
        u.saetze.map((s) => ({
          id: s.id,
          ausgefuehrte_uebung_id: u.id,
          plan_satz_id: s.plan_satz_id,
          satznummer: s.satznummer,
          satztyp: s.satztyp,
          vorgabe: s.vorgabe,
          wdh: s.wdh,
          last_kg: s.last_kg,
          rir: s.rir,
          dauer_sek: s.dauer_sek,
          distanz_m: s.distanz_m,
          messwert: s.messwert ?? null,
          puls_schnitt: s.puls_schnitt ?? null,
          anstrengung: s.anstrengung ?? null,
          erledigt: s.erledigt,
          seite: s.seite ?? null,
          zusatz: s.zusatz ?? {},
        })),
      );
      if (saetze.length) {
        const r3 = await sb.from("ausgefuehrte_saetze").upsert(saetze);
        if (r3.error) throw r3.error;
      }
    }

    if (zweiSchritte) {
      const r4 = await sb.from("trainingseinheiten").upsert(kopf);
      if (r4.error) throw r4.error;
    }
  } catch (fehler) {
    console.warn("Hochladen später erneut:", fehler);
    return false;
  }

  // Nur als gespeichert markieren, wenn sich zwischendurch nichts geändert hat
  const aktuell = lokalLaden(id);
  if (!aktuell) return true;
  if (JSON.stringify(aktuell) === stand) {
    lokalSpeichern({ ...aktuell, ungespeichert: false, geloescht: { uebungen: [], saetze: [] }, serverStatus: e.status });
    return true;
  }
  lokalSpeichern({
    ...aktuell,
    serverStatus: e.status,
    geloescht: {
      uebungen: aktuell.geloescht.uebungen.filter((x) => !t.geloescht.uebungen.includes(x)),
      saetze: aktuell.geloescht.saetze.filter((x) => !t.geloescht.saetze.includes(x)),
    },
  });
  return hochladen(id);
}

/** Alle noch nicht hochgeladenen Trainings nachladen (z. B. wenn das Netz zurück ist) */
export async function allesHochladen(athletId: string): Promise<void> {
  for (const t of lokaleTrainings(athletId)) {
    if (t.ungespeichert) await hochladen(t.einheit.id);
  }
}

/** Abgeschlossene und hochgeladene Trainings vom Handy entfernen (älter als 2 Tage) */
export function aufraeumen(athletId: string) {
  const grenze = Date.now() - 2 * 24 * 3600 * 1000;
  for (const t of lokaleTrainings(athletId)) {
    if (!t.ungespeichert && t.einheit.status !== "laeuft" && Date.parse(t.einheit.gestartet_am) < grenze) {
      lokalEntfernen(t.einheit.id);
    }
  }
}
