import { supabase } from "./supabase";

export type Stammdaten = {
  athlet_id: string;
  geburtsjahr: number | null;
  training_seit: number | null;
  ziele: string[];
  ziel_text: string;
  trainingstage: number[];
  einheit_minuten: number | null;
  ausstattung: string[];
  aktualisiert_am: string;
};

const SPALTEN =
  "athlet_id, geburtsjahr, training_seit, ziele, ziel_text, trainingstage, einheit_minuten, ausstattung, aktualisiert_am";

export async function stammdatenLaden(athletId: string): Promise<{ daten: Stammdaten | null; fehler: boolean }> {
  const { data, error } = await supabase()
    .from("athlet_stammdaten")
    .select(SPALTEN)
    .eq("athlet_id", athletId)
    .maybeSingle();
  return { daten: (data as Stammdaten | null) ?? null, fehler: !!error };
}

export async function stammdatenSpeichern(
  athletId: string,
  werte: Omit<Stammdaten, "athlet_id" | "aktualisiert_am">,
): Promise<boolean> {
  // Erst ändern; gibt es noch keine Zeile, neu anlegen.
  const sb = supabase();
  const geaendert = await sb
    .from("athlet_stammdaten")
    .update(werte)
    .eq("athlet_id", athletId)
    .select("athlet_id");
  if (geaendert.error) return false;
  if (geaendert.data.length > 0) return true;
  const { error } = await sb.from("athlet_stammdaten").insert({ athlet_id: athletId, ...werte });
  return !error;
}
