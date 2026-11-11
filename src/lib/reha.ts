/**
 * Reha: Schmerzangaben 0–10 pro ausgeführter Übung (Gesundheitsdaten, geschützt).
 * Die Ampel ist nur eine Anzeige – die App ändert nichts und stellt keine Diagnose.
 */
import { supabase } from "./supabase";

export type SchmerzEintrag = {
  ausgefuehrte_uebung_id: string;
  uebung_id: string;
  uebung_name: string;
  datum: string;
  wert: number;
  grenze: number | null;
  notiz: string;
};

/** Soll im Training nach dem Schmerz gefragt werden? */
export const schmerzAbfragen = (modul: string | null | undefined, grenze: number | null | undefined) =>
  modul === "reha" || grenze != null;

export const ueberGrenze = (wert: number | null | undefined, grenze: number | null | undefined) =>
  wert != null && grenze != null && wert > grenze;

export async function schmerzListeLaden(athletId: string): Promise<{ daten: SchmerzEintrag[]; fehler: boolean }> {
  const { data, error } = await supabase().rpc("reha_schmerz_liste", { p_athlet: athletId });
  return { daten: (data as SchmerzEintrag[] | null) ?? [], fehler: !!error };
}

export type SchmerzUebung = {
  uebungId: string;
  name: string;
  eintraege: SchmerzEintrag[];
  letzter: SchmerzEintrag;
  ueber: number;
};

/** Nach Übung gruppiert, die zuletzt geübte zuerst */
export function schmerzNachUebung(liste: SchmerzEintrag[]): SchmerzUebung[] {
  const m = new Map<string, SchmerzEintrag[]>();
  for (const e of [...liste].sort((a, b) => a.datum.localeCompare(b.datum))) {
    const l = m.get(e.uebung_id) ?? [];
    l.push(e);
    m.set(e.uebung_id, l);
  }
  return [...m.entries()]
    .map(([uebungId, eintraege]) => {
      const letzter = eintraege[eintraege.length - 1];
      return {
        uebungId,
        name: letzter.uebung_name,
        eintraege,
        letzter,
        ueber: eintraege.filter((e) => ueberGrenze(e.wert, e.grenze)).length,
      };
    })
    .sort((a, b) => b.letzter.datum.localeCompare(a.letzter.datum) || a.name.localeCompare(b.name));
}
