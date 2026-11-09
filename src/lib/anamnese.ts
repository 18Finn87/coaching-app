import { supabase } from "./supabase";

/** Fassung des Fragebogens. Bei inhaltlichen Änderungen erhöhen. */
export const FRAGENVERSION = "2026-11-v1";

export type Wert = "ja" | "nein" | "keine_angabe";

export type Frage = {
  id: string;
  text: string;
  /** Bei "ja" ein Feld für eigene Worte anzeigen */
  mitText?: string;
  /** Bei "ja" den Hinweis zur ärztlichen Abklärung zeigen */
  aerztlich?: boolean;
};

export const FRAGEN: Frage[] = [
  {
    id: "aerztliche_aufsicht",
    text: "Hat dir eine Ärztin oder ein Arzt schon einmal gesagt, dass du nur unter ärztlicher Aufsicht Sport treiben solltest?",
    aerztlich: true,
  },
  {
    id: "brustschmerz",
    text: "Hast du bei körperlicher Belastung Schmerzen oder Druck in der Brust?",
    aerztlich: true,
  },
  {
    id: "schwindel",
    text: "Ist dir in den letzten 12 Monaten beim Sport schwindelig geworden oder bist du ohnmächtig geworden?",
    aerztlich: true,
  },
  {
    id: "herz_kreislauf",
    text: "Ist bei dir eine Herz-Kreislauf-Erkrankung oder Bluthochdruck bekannt?",
    aerztlich: true,
    mitText: "Möchtest du etwas dazu sagen? (freiwillig)",
  },
  {
    id: "aktuelle_beschwerden",
    text: "Hast du aktuell Beschwerden am Bewegungsapparat, zum Beispiel an Rücken, Knie oder Schulter?",
    mitText: "Wo und wobei merkst du sie?",
  },
  {
    id: "fruehere_verletzungen",
    text: "Hattest du Verletzungen oder Operationen, die für dein Training wichtig sein könnten?",
    mitText: "Welche, und wann ungefähr?",
  },
  {
    id: "medikamente",
    text: "Nimmst du regelmäßig Medikamente, die beim Training eine Rolle spielen könnten?",
    mitText: "Möchtest du etwas dazu sagen? (freiwillig)",
  },
  {
    id: "schwangerschaft",
    text: "Bist du schwanger oder hast du in den letzten 12 Monaten ein Kind bekommen?",
  },
];

export const SONSTIGES_ID = "sonstiges";

export type Antwort = { wert?: Wert; text?: string };
export type Antworten = Record<string, Antwort>;

export type AnamneseVersion = {
  id: string;
  version: number;
  fragenversion: string;
  antworten: Antworten;
  erstellt_am: string;
};

export type Beschwerde = {
  id: string;
  koerperregion: string;
  beschreibung: string;
  seit: string | null;
  bis: string | null;
  aktualisiert_am: string;
};

export type ProtokollEintrag = {
  zeitpunkt: string;
  aktion: string;
  tabelle: string;
  durch_selbst: boolean;
};

export const regionText: Record<string, string> = {
  nacken: "Nacken",
  schulter: "Schulter",
  ellbogen: "Ellbogen",
  hand: "Hand / Handgelenk",
  oberer_ruecken: "Oberer Rücken",
  unterer_ruecken: "Unterer Rücken",
  huefte: "Hüfte",
  knie: "Knie",
  sprunggelenk: "Sprunggelenk",
  fuss: "Fuß",
  sonstiges: "Sonstiges",
};

export const wertText: Record<Wert, string> = {
  ja: "Ja",
  nein: "Nein",
  keine_angabe: "Keine Angabe",
};

/** Hat jemand bei einer Frage mit ärztlichem Hinweis "ja" angekreuzt? */
export function aerztlicherHinweis(antworten: Antworten): boolean {
  return FRAGEN.some((f) => f.aerztlich && antworten[f.id]?.wert === "ja");
}

export async function anamneseListe(athletId: string) {
  const { data, error } = await supabase().rpc("anamnese_liste", { p_athlet: athletId });
  return { daten: (data as AnamneseVersion[] | null) ?? [], fehler: !!error };
}

export async function anamneseSpeichern(antworten: Antworten): Promise<number | null> {
  const { data, error } = await supabase().rpc("anamnese_speichern", {
    p_fragenversion: FRAGENVERSION,
    p_antworten: antworten,
  });
  return error ? null : (data as number);
}

export async function anamneseLoeschen(): Promise<boolean> {
  const { error } = await supabase().rpc("anamnese_loeschen");
  return !error;
}

export async function beschwerdenListe(athletId: string) {
  const { data, error } = await supabase().rpc("beschwerden_liste", { p_athlet: athletId });
  return { daten: (data as Beschwerde[] | null) ?? [], fehler: !!error };
}

export async function beschwerdeSpeichern(b: {
  id: string | null;
  koerperregion: string;
  beschreibung: string;
  seit: string | null;
  bis: string | null;
}): Promise<boolean> {
  const { error } = await supabase().rpc("beschwerde_speichern", {
    p_id: b.id,
    p_koerperregion: b.koerperregion,
    p_beschreibung: b.beschreibung,
    p_seit: b.seit,
    p_bis: b.bis,
  });
  return !error;
}

export async function beschwerdeLoeschen(id: string): Promise<boolean> {
  const { error } = await supabase().rpc("beschwerde_loeschen", { p_id: id });
  return !error;
}

export async function gesundheitProtokoll(athletId: string) {
  const { data, error } = await supabase().rpc("gesundheit_protokoll", { p_athlet: athletId });
  return { daten: (data as ProtokollEintrag[] | null) ?? [], fehler: !!error };
}
