import { supabase } from "./supabase";

export type Uebung = {
  id: string;
  name: string;
  modul: string;
  bewegungsmuster: string;
  muskelgruppen: string[];
  ausstattung: string[];
  einseitig: boolean;
  messart: string;
  e1rm_geeignet: boolean;
  beschreibung: string;
  video_link: string | null;
  archiviert: boolean;
};

export type UebungEingabe = Omit<Uebung, "id" | "archiviert">;

const SPALTEN =
  "id, name, modul, bewegungsmuster, muskelgruppen, ausstattung, einseitig, messart, e1rm_geeignet, beschreibung, video_link, archiviert";

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
  sonstiges: "Sonstiges",
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
  sonstiges: "Sonstiges",
};

export const messartText: Record<string, string> = {
  wdh_last: "Wiederholungen × Gewicht",
  wdh: "Nur Wiederholungen",
  zeit: "Zeit",
  zeit_last: "Zeit × Gewicht",
  distanz: "Strecke",
  distanz_last: "Strecke × Gewicht",
};

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

export async function uebungArchivieren(id: string, archiviert: boolean): Promise<boolean> {
  const { error } = await supabase().from("uebungen").update({ archiviert }).eq("id", id);
  return !error;
}
