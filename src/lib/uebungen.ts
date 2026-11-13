import { supabase } from "./supabase";

export type Uebung = {
  id: string;
  name: string;
  modul: string;
  bewegungsmuster: string;
  muskelgruppen: string[];
  ausstattung: string[];
  einseitig: boolean;
  seiten_getrennt: boolean;
  kleiner_besser: boolean;
  messart: string;
  /** Nur bei Leistungstests: Einheit und Wertung mehrerer Versuche */
  einheit: string | null;
  wertung: string;
  e1rm_geeignet: boolean;
  beschreibung: string;
  video_link: string | null;
  archiviert: boolean;
  /** Eigene Übung einer Kundin/eines Kunden (nur für diese Person und den Coach sichtbar) */
  privat_fuer: string | null;
};

export type UebungEingabe = Omit<Uebung, "id" | "archiviert" | "privat_fuer">;

const SPALTEN =
  "id, name, modul, bewegungsmuster, muskelgruppen, ausstattung, einseitig, seiten_getrennt, kleiner_besser, messart, einheit, wertung, e1rm_geeignet, beschreibung, video_link, archiviert, privat_fuer";

export const musterText: Record<string, string> = {
  kniebeuge: "Kniebeuge",
  hueftstreckung: "Hüftstreckung",
  ausfallschritt: "Ausfallschritt / einbeinig",
  druecken_horizontal: "Drücken horizontal",
  druecken_vertikal: "Drücken vertikal",
  ziehen_horizontal: "Ziehen horizontal",
  ziehen_vertikal: "Ziehen vertikal",
  rumpf: "Rumpf",
  tragen: "Tragen",
  isolation: "Isolation",
  laufen: "Laufen",
  gehen: "Gehen",
  radfahren: "Radfahren",
  rudern: "Rudern",
  schwimmen: "Schwimmen",
  ausdauer_sonstiges: "Ausdauer (sonstiges)",
  sprinten: "Sprinten",
  springen: "Springen",
  werfen: "Werfen",
  richtungswechsel: "Richtungswechsel",
  dehnen: "Dehnen",
  mobilisieren: "Mobilisieren",
  halten: "Halten (isometrisch)",
  sonstiges: "Sonstiges",
};

/** Welche Bewegungsmuster zu welchem Modul passen (für die Auswahl im Formular). */
export const musterJeModul: Record<string, string[]> = {
  kraft: ["kniebeuge", "hueftstreckung", "ausfallschritt", "druecken_horizontal", "druecken_vertikal",
    "ziehen_horizontal", "ziehen_vertikal", "rumpf", "tragen", "isolation", "halten", "sonstiges"],
  ausdauer: ["laufen", "gehen", "radfahren", "rudern", "schwimmen", "ausdauer_sonstiges", "sonstiges"],
  intervall: ["laufen", "radfahren", "rudern", "schwimmen", "sprinten", "ausdauer_sonstiges", "sonstiges"],
  athletik: ["sprinten", "springen", "werfen", "richtungswechsel", "laufen", "sonstiges"],
  mobilitaet: ["dehnen", "mobilisieren", "halten", "sonstiges"],
  reha: Object.keys(musterText),
};

export const modulText: Record<string, string> = {
  kraft: "Kraft",
  ausdauer: "Ausdauer",
  intervall: "Intervalle",
  athletik: "Athletik",
  mobilitaet: "Mobilität",
  reha: "Reha",
};

/** Standard-Messart beim Wechsel des Moduls */
export const messartJeModul: Record<string, string> = {
  kraft: "wdh_last",
  ausdauer: "ausdauer",
  intervall: "zeit",
  athletik: "test",
  mobilitaet: "zeit",
  reha: "wdh",
};

export const muskelText: Record<string, string> = {
  brust: "Brust",
  ruecken_oben: "Oberer Rücken",
  latissimus: "Latissimus",
  schultern: "Schultern",
  bizeps: "Bizeps",
  trizeps: "Trizeps",
  unterarme: "Unterarme",
  bauch: "Bauch / Rumpf",
  unterer_ruecken: "Unterer Rücken",
  gesaess: "Gesäß",
  quadrizeps: "Quadrizeps",
  beinbeuger: "Beinbeuger",
  adduktoren: "Adduktoren",
  waden: "Waden",
};

export const geraetText: Record<string, string> = {
  langhantel: "Langhantel",
  kurzhantel: "Kurzhantel",
  kettlebell: "Kettlebell",
  maschine: "Maschine",
  kabelzug: "Kabelzug",
  koerpergewicht: "Körpergewicht",
  baender: "Bänder",
  ausdauergeraet: "Ausdauergerät",
  medizinball: "Medizinball",
  box: "Box / Kasten",
  matte: "Matte",
  faszienrolle: "Faszienrolle",
  sonstiges: "Sonstiges",
};

export const messartText: Record<string, string> = {
  wdh_last: "Wiederholungen × Gewicht",
  wdh: "Nur Wiederholungen",
  zeit: "Zeit",
  zeit_last: "Zeit × Gewicht",
  distanz: "Strecke",
  distanz_last: "Strecke × Gewicht",
  umfang: "Messwert in cm (Messtest)",
  ausdauer: "Zeit und Strecke (Ausdauer)",
  intervall: "Intervalle (Runden)",
  test: "Leistungstest (Versuche)",
};

/** Wird bei dieser Messart ein Gewicht eingetragen? */
export const hatLast = (messart: string) =>
  messart === "wdh_last" || messart === "zeit_last" || messart === "distanz_last";

export async function uebungenLaden(): Promise<{ daten: Uebung[]; fehler: boolean }> {
  const { data, error } = await supabase().from("uebungen").select(SPALTEN).order("name");
  return { daten: (data as Uebung[] | null) ?? [], fehler: !!error };
}

/** Legt eine Übung an (id leer) oder ändert sie. Gibt einen Fehlertext zurück oder null. */
export async function uebungSpeichern(id: string | null, werte: UebungEingabe): Promise<string | null> {
  const sb = supabase();
  const { error } = id
    ? await sb.from("uebungen").update(werte).eq("id", id)
    : await sb.from("uebungen").insert(werte);
  if (!error) return null;
  if (error.code === "23505") return "Eine Übung mit diesem Namen gibt es schon.";
  if (error.code === "23514") return "Bitte prüfe die Eingaben (zum Beispiel muss ein Video-Link mit https:// beginnen).";
  return "Speichern hat nicht geklappt. Bitte versuche es erneut.";
}

/** Arten für eigene Übungen der Kunden: einfach statt Fachbegriffe */
export const EIGENE_ARTEN = [
  { wert: "kraft_last", text: "Kraft mit Gewicht", modul: "kraft", messart: "wdh_last" },
  { wert: "kraft_wdh", text: "Kraft ohne Gewicht (nur Wiederholungen)", modul: "kraft", messart: "wdh" },
  { wert: "halten", text: "Halten auf Zeit (z. B. Unterarmstütz)", modul: "kraft", messart: "zeit" },
  { wert: "mobilitaet", text: "Dehnen / Mobilität (Zeit)", modul: "mobilitaet", messart: "zeit" },
  { wert: "ausdauer", text: "Ausdauer (Zeit und Strecke)", modul: "ausdauer", messart: "ausdauer" },
] as const;

export function eigeneArt(u: { modul: string; messart: string }): string {
  return EIGENE_ARTEN.find((a) => a.modul === u.modul && a.messart === u.messart)?.wert ?? "kraft_last";
}

export type EigeneEingabe = { name: string; art: string; einseitig: boolean; beschreibung: string; video_link: string | null };

/** Kunde: eigene Übung anlegen (id leer) oder ändern. Liefert die Übung oder einen Fehlertext. */
export async function eigeneUebungSpeichern(
  id: string | null,
  athletId: string,
  e: EigeneEingabe,
  vorhandene: { id: string; name: string }[] = [],
): Promise<{ uebung: Uebung | null; fehler: string | null }> {
  const name = e.name.trim().replace(/s+/g, " ").slice(0, 80);
  if (!name) return { uebung: null, fehler: "Bitte gib einen Namen ein." };
  if (vorhandene.some((u) => u.id !== id && u.name.toLowerCase() === name.toLowerCase()))
    return { uebung: null, fehler: "Eine Übung mit diesem Namen gibt es schon – du kannst sie direkt auswählen." };
  if (e.video_link && !e.video_link.startsWith("https://"))
    return { uebung: null, fehler: "Der Video-Link muss mit https:// beginnen." };
  const art = EIGENE_ARTEN.find((a) => a.wert === e.art) ?? EIGENE_ARTEN[0];
  const werte = {
    name,
    modul: art.modul,
    messart: art.messart,
    einseitig: e.einseitig,
    beschreibung: e.beschreibung.trim().slice(0, 2000),
    video_link: e.video_link?.trim() || null,
  };
  const sb = supabase();
  const { data, error } = id
    ? await sb.from("uebungen").update(werte).eq("id", id).select(SPALTEN).single()
    : await sb.from("uebungen").insert({ ...werte, privat_fuer: athletId }).select(SPALTEN).single();
  if (!error) return { uebung: data as Uebung, fehler: null };
  if (error.code === "23505") return { uebung: null, fehler: "Eine Übung mit diesem Namen hast du schon." };
  return { uebung: null, fehler: "Speichern hat nicht geklappt. Bitte versuche es erneut." };
}

/** Coach: eigene Übung einer Person für alle Kunden freigeben */
export async function uebungFreigeben(id: string): Promise<string | null> {
  const { error } = await supabase().from("uebungen").update({ privat_fuer: null }).eq("id", id);
  if (!error) return null;
  if (error.code === "23505") return "In deiner Sammlung gibt es schon eine Übung mit diesem Namen. Benenne sie vorher um.";
  return "Freigeben hat nicht geklappt. Bitte versuche es erneut.";
}

export async function uebungArchivieren(id: string, archiviert: boolean): Promise<boolean> {
  const { error } = await supabase().from("uebungen").update({ archiviert }).eq("id", id);
  return !error;
}
