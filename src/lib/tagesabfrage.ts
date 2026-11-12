/**
 * Tägliche Abfrage: Schlaf (Stunden + Qualität), Energie, Muskelkater, Stimmung.
 * Jeder Wert merkt sich seine Quelle – zum Start „manuell“, später z. B. Apple Health
 * oder WHOOP. Ändern nur am selben Tag. Keine Diagnose, keine Planänderung.
 */
import { supabase } from "./supabase";

export type Quelle = "manuell" | "apple_health" | "whoop" | "sonstige";
export type Feld = "schlaf_stunden" | "schlaf_qualitaet" | "energie" | "muskelkater" | "stimmung";

export type TagesCheckin = {
  id: string;
  athlet_id: string;
  datum: string;
  schlaf_stunden: number | null;
  schlaf_qualitaet: number | null;
  energie: number | null;
  muskelkater: number | null;
  stimmung: number | null;
  quellen: Partial<Record<Feld, Quelle>>;
  aktualisiert_am: string;
};

export type Werte = Pick<TagesCheckin, Feld>;

export const FELDER: Feld[] = ["schlaf_stunden", "schlaf_qualitaet", "energie", "muskelkater", "stimmung"];

/** Skalen 1–5 mit Beschriftung der Enden */
export const SKALEN: { feld: Exclude<Feld, "schlaf_stunden">; frage: string; kurz: string; links: string; rechts: string }[] = [
  { feld: "schlaf_qualitaet", frage: "Wie gut hast du geschlafen?", kurz: "Schlaf", links: "schlecht", rechts: "sehr gut" },
  { feld: "energie", frage: "Wie viel Energie hast du heute?", kurz: "Energie", links: "leer", rechts: "voller Energie" },
  { feld: "muskelkater", frage: "Wie stark ist dein Muskelkater?", kurz: "Muskelkater", links: "keiner", rechts: "stark" },
  { feld: "stimmung", frage: "Wie ist deine Stimmung?", kurz: "Stimmung", links: "schlecht", rechts: "sehr gut" },
];

export const quelleText: Record<Quelle, string> = {
  manuell: "selbst eingetragen",
  apple_health: "Apple Health",
  whoop: "WHOOP",
  sonstige: "andere Quelle",
};

/** Heutiges Datum in Berliner Zeit als JJJJ-MM-TT (wie in der Datenbank) */
export function heute(jetzt = new Date()): string {
  return jetzt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}

/** Quellen: geänderte bzw. gesetzte Werte gelten als „manuell“, unveränderte behalten ihre Quelle */
export function quellenNachEingabe(alt: TagesCheckin | null, neu: Werte): Partial<Record<Feld, Quelle>> {
  const q: Partial<Record<Feld, Quelle>> = {};
  for (const f of FELDER) {
    if (neu[f] == null) continue;
    const unveraendert = alt && alt[f] != null && Number(alt[f]) === Number(neu[f]);
    q[f] = unveraendert ? (alt!.quellen[f] ?? "manuell") : "manuell";
  }
  return q;
}

/** Schlafstunden aus der Eingabe (Komma oder Punkt, halbe Stunden), sonst null */
export function stundenLesen(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 24) return NaN;
  return Math.round(n * 2) / 2;
}

const SPALTEN =
  "id, athlet_id, datum, schlaf_stunden, schlaf_qualitaet, energie, muskelkater, stimmung, quellen, aktualisiert_am";

const zahlen = (t: TagesCheckin): TagesCheckin => ({
  ...t,
  schlaf_stunden: t.schlaf_stunden == null ? null : Number(t.schlaf_stunden),
  quellen: t.quellen ?? {},
});

export async function tagesLaden(athletId: string, tage = 14): Promise<TagesCheckin[] | null> {
  const ab = new Date(Date.now() - (tage - 1) * 86400000);
  const { data, error } = await supabase()
    .from("tages_checkins")
    .select(SPALTEN)
    .eq("athlet_id", athletId)
    .gte("datum", heute(ab))
    .order("datum", { ascending: false });
  return error ? null : ((data as TagesCheckin[] | null) ?? []).map(zahlen);
}

export async function tagesSpeichern(alt: TagesCheckin | null, werte: Werte): Promise<boolean> {
  const sb = supabase();
  const zeile = { ...werte, quellen: quellenNachEingabe(alt, werte) };
  const { error } = alt
    ? await sb.from("tages_checkins").update(zeile).eq("id", alt.id)
    : await sb.from("tages_checkins").insert(zeile);
  return !error;
}

/** „Später“ gilt nur für heute und nur auf diesem Gerät */
const SPAETER = "coaching.tagesabfrage.spaeter";
export function spaeterGewaehlt(): boolean {
  try {
    return localStorage.getItem(SPAETER) === heute();
  } catch {
    return false;
  }
}
export function spaeterMerken() {
  try {
    localStorage.setItem(SPAETER, heute());
  } catch {
    // egal
  }
}
