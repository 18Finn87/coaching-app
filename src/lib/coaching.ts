import { supabase } from "./supabase";
import type { Regel, Stufe } from "./evaluation";

// ---------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------

export type SkalaFeld = "schlaf" | "stress" | "energie" | "muskelkater" | "motivation";

/** Beschriftung der Skalen 1–5 (links = 1, rechts = 5). */
export const SKALEN: { feld: SkalaFeld; frage: string; links: string; rechts: string }[] = [
  { feld: "schlaf", frage: "Wie hast du geschlafen?", links: "sehr schlecht", rechts: "sehr gut" },
  { feld: "stress", frage: "Wie gestresst warst du?", links: "gar nicht", rechts: "sehr" },
  { feld: "energie", frage: "Wie viel Energie hattest du?", links: "sehr wenig", rechts: "sehr viel" },
  { feld: "muskelkater", frage: "Wie stark war dein Muskelkater?", links: "keiner", rechts: "sehr stark" },
  { feld: "motivation", frage: "Wie motiviert warst du?", links: "gar nicht", rechts: "sehr" },
];

export const SKALA_KURZ: Record<SkalaFeld, string> = {
  schlaf: "Schlaf",
  stress: "Stress",
  energie: "Energie",
  muskelkater: "Muskelkater",
  motivation: "Motivation",
};

export type Checkin = {
  id: string;
  athlet_id: string;
  woche: string;
  schlaf: number;
  stress: number;
  energie: number;
  muskelkater: number;
  motivation: number;
  notiz: string;
  coach_antwort: string;
  coach_antwort_am: string | null;
  erstellt_am: string;
};

export type CheckinGesundheit = {
  checkin_id: string;
  schmerz_vorhanden: boolean;
  koerperregion: string | null;
  skala_0_10: number | null;
  notiz: string;
};

/** Montag der laufenden Woche als JJJJ-MM-TT (deutsche Zeit). */
export function wochenbeginn(d = new Date()): string {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const tag = new Date(teile + "T12:00:00Z");
  const wt = (tag.getUTCDay() + 6) % 7; // Montag = 0
  tag.setUTCDate(tag.getUTCDate() - wt);
  return tag.toISOString().slice(0, 10);
}

export function wocheText(woche: string): string {
  const von = new Date(woche + "T12:00:00Z");
  const bis = new Date(von.getTime() + 6 * 24 * 60 * 60 * 1000);
  const f = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  return `Woche ${f(von)}–${f(bis)}`;
}

const CHECKIN_SPALTEN =
  "id, athlet_id, woche, schlaf, stress, energie, muskelkater, motivation, notiz, coach_antwort, coach_antwort_am, erstellt_am";

export async function checkinsLaden(athletId: string, grenze = 26) {
  const { data, error } = await supabase()
    .from("checkins")
    .select(CHECKIN_SPALTEN)
    .eq("athlet_id", athletId)
    .order("woche", { ascending: false })
    .limit(grenze);
  return { daten: (data as Checkin[] | null) ?? [], fehler: !!error };
}

export async function checkinGesundheitLaden(athletId: string) {
  const { data, error } = await supabase().rpc("checkin_gesundheit_liste", { p_athlet: athletId });
  const liste = (data as CheckinGesundheit[] | null) ?? [];
  return { daten: Object.fromEntries(liste.map((g) => [g.checkin_id, g])) as Record<string, CheckinGesundheit>, fehler: !!error };
}

export type CheckinEingabe = Pick<Checkin, SkalaFeld | "notiz">;

/** Legt den Check-in der laufenden Woche an oder ändert ihn. Gibt die ID zurück. */
export async function checkinSpeichern(vorhandenId: string | null, werte: CheckinEingabe): Promise<string | null> {
  const sb = supabase();
  if (vorhandenId) {
    const { error } = await sb.from("checkins").update(werte).eq("id", vorhandenId);
    return error ? null : vorhandenId;
  }
  const { data, error } = await sb.from("checkins").insert(werte).select("id").single();
  return error ? null : (data as { id: string }).id;
}

export async function checkinGesundheitSpeichern(
  checkinId: string,
  w: { schmerz: boolean; region: string | null; skala: number | null; notiz: string },
) {
  const { error } = await supabase().rpc("checkin_gesundheit_speichern", {
    p_checkin: checkinId,
    p_schmerz: w.schmerz,
    p_region: w.schmerz ? w.region : null,
    p_skala: w.schmerz ? w.skala : null,
    p_notiz: w.notiz,
  });
  return !error;
}

export async function checkinGesundheitLoeschen(checkinId: string) {
  const { error } = await supabase().rpc("checkin_gesundheit_loeschen", { p_checkin: checkinId });
  return !error;
}

export async function checkinAntworten(checkinId: string, antwort: string) {
  const { error } = await supabase().rpc("checkin_antworten", { p_checkin: checkinId, p_antwort: antwort });
  return !error;
}

// ---------------------------------------------------------------------
// Benachrichtigungen (Glocke)
// ---------------------------------------------------------------------

export type Benachrichtigung = {
  id: string;
  art: "checkin_neu" | "checkin_antwort" | "checkin_erinnerung" | "evaluation_faellig" | "zusammenfassung";
  athlet_id: string | null;
  bezug_id: string | null;
  text_kurz: string;
  erstellt_am: string;
  gelesen_am: string | null;
};

export async function benachrichtigungenLaden(grenze = 50) {
  const { data, error } = await supabase()
    .from("benachrichtigungen")
    .select("id, art, athlet_id, bezug_id, text_kurz, erstellt_am, gelesen_am")
    .order("erstellt_am", { ascending: false })
    .limit(grenze);
  return { daten: (data as Benachrichtigung[] | null) ?? [], fehler: !!error };
}

export async function ungeleseneZaehlen(): Promise<number> {
  const { count } = await supabase()
    .from("benachrichtigungen")
    .select("id", { count: "exact", head: true })
    .is("gelesen_am", null);
  return count ?? 0;
}

export async function alleGelesen() {
  await supabase().from("benachrichtigungen").update({ gelesen_am: new Date().toISOString() }).is("gelesen_am", null);
}

/** Wohin führt ein Hinweis? */
export function hinweisZiel(b: Benachrichtigung, rolle: "coach" | "athlet"): string {
  switch (b.art) {
    case "checkin_neu":
      return b.athlet_id ? `/athlet/?id=${b.athlet_id}#checkins` : "/athleten/";
    case "evaluation_faellig":
      return b.bezug_id ? `/evaluation/?id=${b.bezug_id}` : "/";
    case "zusammenfassung":
      return "/";
    case "checkin_antwort":
    case "checkin_erinnerung":
      return rolle === "athlet" ? "/checkin/" : "/";
  }
}

// ---------------------------------------------------------------------
// Evaluationen
// ---------------------------------------------------------------------

export type Evaluation = {
  id: string;
  athlet_id: string;
  plan_id: string;
  planversion_id: string;
  zeitraum_von: string;
  faellig_seit: string;
  ausloeser: "wochen" | "einheiten";
  regel_wochen: number;
  regel_einheiten: number;
  status: "faellig" | "verschoben" | "erledigt";
  verschoben_bis: string | null;
  entscheidung: "beibehalten" | "anpassen" | null;
  coach_notiz: string;
  erledigt_am: string | null;
  athlet?: { anzeigename: string } | null;
  plan?: { titel: string } | null;
};

export const EVAL_SPALTEN =
  "id, athlet_id, plan_id, planversion_id, zeitraum_von, faellig_seit, ausloeser, regel_wochen, regel_einheiten, status, verschoben_bis, entscheidung, coach_notiz, erledigt_am, athlet:profile!athlet_id(anzeigename), plan:plaene!plan_id(titel)";

export const ENTSCHEIDUNG_TEXT: Record<string, string> = {
  beibehalten: "Plan beibehalten",
  anpassen: "Plan anpassen",
};

export function ausloeserText(e: Pick<Evaluation, "ausloeser" | "regel_wochen" | "regel_einheiten">): string {
  return e.ausloeser === "einheiten"
    ? `${e.regel_einheiten} Einheiten erreicht`
    : `${e.regel_wochen} Wochen vergangen`;
}

/** Löst die Prüfung für den Coach sofort aus (sonst einmal täglich am Morgen). */
export async function evaluationenPruefen() {
  await supabase().rpc("evaluationen_jetzt_pruefen");
}

export async function offeneEvaluationen() {
  const { data, error } = await supabase()
    .from("evaluationen")
    .select(EVAL_SPALTEN)
    .neq("status", "erledigt")
    .order("faellig_seit");
  return { daten: (data as unknown as Evaluation[] | null) ?? [], fehler: !!error };
}

export async function evaluationenVon(athletId: string) {
  const { data, error } = await supabase()
    .from("evaluationen")
    .select(EVAL_SPALTEN)
    .eq("athlet_id", athletId)
    .order("faellig_seit", { ascending: false });
  return { daten: (data as unknown as Evaluation[] | null) ?? [], fehler: !!error };
}

// ---------------------------------------------------------------------
// Evaluationsregeln
// ---------------------------------------------------------------------

export async function regelnLaden(): Promise<Partial<Record<Stufe, Regel>>> {
  const { data } = await supabase().from("evaluationsregeln").select("erfahrungsstufe, nach_wochen, nach_einheiten");
  const r: Partial<Record<Stufe, Regel>> = {};
  for (const x of (data as { erfahrungsstufe: Stufe; nach_wochen: number; nach_einheiten: number }[] | null) ?? []) {
    r[x.erfahrungsstufe] = { wochen: x.nach_wochen, einheiten: x.nach_einheiten };
  }
  return r;
}

export async function regelSpeichern(stufe: Exclude<Stufe, "anfaenger">, regel: Regel): Promise<boolean> {
  const sb = supabase();
  const werte = { nach_wochen: regel.wochen, nach_einheiten: regel.einheiten };
  const { data, error } = await sb.from("evaluationsregeln").update(werte).eq("erfahrungsstufe", stufe).select("erfahrungsstufe");
  if (error) return false;
  if (data && data.length > 0) return true;
  const neu = await sb.from("evaluationsregeln").insert({ erfahrungsstufe: stufe, ...werte });
  return !neu.error;
}
