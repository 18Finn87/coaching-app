/**
 * Nachrichten an den Coach („Kommentar“) und „Meine Ziele haben sich geändert“.
 * Offen, bis der Coach antwortet oder „gesehen“ markiert. Die App ändert nichts am Plan.
 */
import { supabase } from "./supabase";

export type NachrichtArt = "kommentar" | "ziele_geaendert";

export type Nachricht = {
  id: string;
  athlet_id: string;
  art: NachrichtArt;
  text: string;
  erstellt_am: string;
  coach_antwort: string;
  coach_antwort_am: string | null;
  gesehen_am: string | null;
  athlet?: { anzeigename: string } | null;
};

const SPALTEN = "id, athlet_id, art, text, erstellt_am, coach_antwort, coach_antwort_am, gesehen_am";

export const artText: Record<NachrichtArt, string> = {
  kommentar: "Nachricht",
  ziele_geaendert: "Ziele haben sich geändert",
};

export async function nachrichtenLaden(athletId: string, grenze = 20): Promise<Nachricht[] | null> {
  const { data, error } = await supabase()
    .from("kunden_nachrichten")
    .select(SPALTEN)
    .eq("athlet_id", athletId)
    .order("erstellt_am", { ascending: false })
    .limit(grenze);
  return error ? null : ((data as Nachricht[] | null) ?? []);
}

/** Coach: alle Nachrichten ohne Reaktion (weder Antwort noch „gesehen“) */
export async function offeneNachrichtenLaden(): Promise<Nachricht[]> {
  const { data } = await supabase()
    .from("kunden_nachrichten")
    .select(`${SPALTEN}, athlet:profile!athlet_id (anzeigename)`)
    .is("gesehen_am", null)
    .order("erstellt_am", { ascending: true })
    .limit(50);
  return (data as unknown as Nachricht[] | null) ?? [];
}

export async function nachrichtSenden(art: NachrichtArt, text: string): Promise<boolean> {
  const t = text.trim();
  if (!t) return false;
  const { error } = await supabase().from("kunden_nachrichten").insert({ art, text: t.slice(0, 2000) });
  return !error;
}

export async function nachrichtZurueckziehen(id: string): Promise<boolean> {
  const { error } = await supabase().from("kunden_nachrichten").delete().eq("id", id);
  return !error;
}

/** Coach: antworten; leerer Text = nur „gesehen“ */
export async function nachrichtBeantworten(id: string, antwort: string): Promise<boolean> {
  const { error } = await supabase().rpc("nachricht_beantworten", { p_nachricht: id, p_antwort: antwort });
  return !error;
}

/** Sind die wichtigsten Angaben zum Training ausgefüllt? */
export function angabenVollstaendig(d: { ziele: string[]; trainingstage: number[] } | null): boolean {
  return !!d && d.ziele.length > 0 && d.trainingstage.length > 0;
}
