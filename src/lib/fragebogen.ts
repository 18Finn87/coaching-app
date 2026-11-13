/**
 * Anamnese-Fragebogen, den der Coach selbst bearbeitet.
 * Jede gespeicherte Änderung ist eine neue, unveränderliche Fassung. Ausgefüllte
 * Fragebögen merken sich ihre Fassung (fragenversion) und bleiben damit lesbar.
 * Ohne eigene Fassung gilt der eingebaute Standard-Fragebogen.
 */
import { FRAGEN, FRAGENVERSION, type Antworten } from "./anamnese";
import { supabase } from "./supabase";

export type FrageTyp = "janein" | "auswahl" | "text";

export type FrageDef = {
  id: string;
  typ: FrageTyp;
  text: string;
  /** Ja/Nein: bei „Ja“ ein Textfeld mit dieser Frage */
  mitText?: string;
  /** Ja/Nein: bei „Ja“ Hinweis zur ärztlichen Abklärung */
  aerztlich?: boolean;
  /** Auswahl: Antwortmöglichkeiten im Dropdown */
  optionen?: string[];
  /** Auswahl: bei diesen Antworten Hinweis zur ärztlichen Abklärung */
  aerztlichBei?: string[];
};

export type Fragebogen = { id: string; version: number; fragen: FrageDef[]; standard: boolean };

export const STANDARD_FRAGEBOGEN: Fragebogen = {
  id: FRAGENVERSION,
  version: 0,
  standard: true,
  fragen: FRAGEN.map((f) => ({ id: f.id, typ: "janein", text: f.text, mitText: f.mitText, aerztlich: f.aerztlich })),
};

export const TYP_TEXT: Record<FrageTyp, string> = {
  janein: "Ja / Nein / Keine Angabe",
  auswahl: "Auswahl (Dropdown)",
  text: "Freier Text",
};

/** Neueste Fassung (der Coach sieht seine, Kunden die ihres Coachs) */
export async function aktuellerFragebogen(): Promise<Fragebogen> {
  const { data } = await supabase()
    .from("anamnese_frageboegen")
    .select("id, version, fragen")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return STANDARD_FRAGEBOGEN;
  const d = data as { id: string; version: number; fragen: FrageDef[] };
  return { ...d, standard: false };
}

const cache = new Map<string, Fragebogen>();

/** Fragebogen, zu dem eine ausgefüllte Anamnese gehört */
export async function fragebogenFuer(fragenversion: string): Promise<Fragebogen> {
  if (!/^[0-9a-f-]{36}$/.test(fragenversion)) return STANDARD_FRAGEBOGEN;
  const schon = cache.get(fragenversion);
  if (schon) return schon;
  const { data } = await supabase().from("anamnese_frageboegen").select("id, version, fragen").eq("id", fragenversion).maybeSingle();
  const f = data ? { ...(data as { id: string; version: number; fragen: FrageDef[] }), standard: false } : STANDARD_FRAGEBOGEN;
  cache.set(fragenversion, f);
  return f;
}

export async function fragebogenSpeichern(fragen: FrageDef[]): Promise<number | null> {
  const { data, error } = await supabase().rpc("fragebogen_speichern", { p_fragen: bereinigen(fragen) });
  return error ? null : (data as number);
}

/** Nur die Felder speichern, die zur Art der Frage gehören */
export function bereinigen(fragen: FrageDef[]): FrageDef[] {
  return fragen.map((f) => {
    const basis = { id: f.id, typ: f.typ, text: f.text.trim() };
    if (f.typ === "janein")
      return { ...basis, ...(f.mitText?.trim() ? { mitText: f.mitText.trim() } : {}), ...(f.aerztlich ? { aerztlich: true } : {}) };
    if (f.typ === "auswahl") {
      const optionen = (f.optionen ?? []).map((o) => o.trim()).filter(Boolean);
      const bei = (f.aerztlichBei ?? []).filter((o) => optionen.includes(o));
      return { ...basis, optionen, ...(bei.length ? { aerztlichBei: bei } : {}) };
    }
    return basis;
  });
}

/** Prüft den Fragebogen vor dem Speichern; liefert verständliche Fehler */
export function pruefen(fragen: FrageDef[]): string[] {
  const fehler: string[] = [];
  if (fragen.length === 0) fehler.push("Der Fragebogen braucht mindestens eine Frage.");
  if (fragen.length > 60) fehler.push("Höchstens 60 Fragen.");
  const ids = new Set<string>();
  fragen.forEach((f, i) => {
    const nr = `Frage ${i + 1}`;
    if (!f.text.trim()) fehler.push(`${nr}: Bitte einen Fragetext eingeben.`);
    if (f.text.length > 500) fehler.push(`${nr}: Der Text ist zu lang (höchstens 500 Zeichen).`);
    if (ids.has(f.id)) fehler.push(`${nr}: doppelt vorhanden.`);
    ids.add(f.id);
    if (f.typ === "auswahl") {
      const o = (f.optionen ?? []).map((x) => x.trim()).filter(Boolean);
      if (o.length < 2) fehler.push(`${nr}: Ein Dropdown braucht mindestens 2 Antwortmöglichkeiten.`);
      if (new Set(o).size !== o.length) fehler.push(`${nr}: Antwortmöglichkeiten bitte nicht doppelt.`);
    }
  });
  return fehler;
}

export const neueFrageId = () => `f_${Math.random().toString(36).slice(2, 10)}`;

/** Muss diese Frage beantwortet werden? (Freier Text ist freiwillig) */
export const pflicht = (f: FrageDef) => f.typ !== "text";

export function offeneFragen(fragen: FrageDef[], antworten: Antworten): number {
  return fragen.filter((f) => pflicht(f) && !antworten[f.id]?.wert).length;
}

/** Steht bei einer Frage mit ärztlichem Hinweis die auslösende Antwort? */
export function aerztlichNoetig(fragen: FrageDef[], antworten: Antworten): boolean {
  return fragen.some((f) => {
    const w = antworten[f.id]?.wert;
    if (!w) return false;
    if (f.typ === "janein") return !!f.aerztlich && w === "ja";
    if (f.typ === "auswahl") return (f.aerztlichBei ?? []).includes(w);
    return false;
  });
}
