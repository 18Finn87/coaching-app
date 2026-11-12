/**
 * Ampel für Übungsvideos: Der Coach bewertet jede Ausführung von Hand.
 * grau = noch nicht gesendet bzw. noch nicht bewertet, grün = gut,
 * orange = verbesserungsbedürftig, rot = nicht korrekt. Orange/Rot: bitte neu aufnehmen.
 */
import { supabase } from "./supabase";

export type Bewertung = "grau" | "gruen" | "orange" | "rot";

export const AMPEL: Record<Bewertung, { text: string; symbol: string; klasse: string }> = {
  gruen: {
    text: "Gute Ausführung",
    symbol: "✓",
    klasse: "border-emerald-600/50 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  },
  orange: {
    text: "Verbesserungsbedürftig",
    symbol: "!",
    klasse: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  rot: {
    text: "Nicht korrekt",
    symbol: "✕",
    klasse: "border-red-600/50 bg-red-600/10 text-red-700 dark:text-red-400",
  },
  grau: {
    text: "Wartet auf Bewertung",
    symbol: "○",
    klasse: "border-rand text-leise",
  },
};

export const neuAufnehmen = (b: Bewertung) => b === "orange" || b === "rot";

export type AmpelEintrag = {
  analyseId: string;
  bewertung: Bewertung;
  kommentar: string;
  erstellt_am: string;
};

/** Je Übung das neueste Video und seine Bewertung */
export function ampelJeUebung(
  liste: { id: string; uebung_id: string | null; bewertung: Bewertung; bewertung_kommentar: string; erstellt_am: string }[],
): Map<string, AmpelEintrag> {
  const m = new Map<string, AmpelEintrag>();
  for (const a of [...liste].sort((x, y) => y.erstellt_am.localeCompare(x.erstellt_am))) {
    if (!a.uebung_id || m.has(a.uebung_id)) continue;
    m.set(a.uebung_id, { analyseId: a.id, bewertung: a.bewertung, kommentar: a.bewertung_kommentar, erstellt_am: a.erstellt_am });
  }
  return m;
}

export async function ampelLaden(athletId: string): Promise<Map<string, AmpelEintrag> | null> {
  const { data, error } = await supabase()
    .from("analysen")
    .select("id, uebung_id, bewertung, bewertung_kommentar, erstellt_am")
    .eq("athlet_id", athletId)
    .not("uebung_id", "is", null);
  if (error) return null;
  return ampelJeUebung((data as Parameters<typeof ampelJeUebung>[0] | null) ?? []);
}

export async function bewerten(analyseId: string, b: Bewertung, kommentar: string): Promise<boolean> {
  const { error } = await supabase().rpc("analyse_bewerten", { p_analyse: analyseId, p_bewertung: b, p_kommentar: kommentar });
  return !error;
}
