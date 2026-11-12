/**
 * Offene Punkte (9b) und Tagesbriefing (Abschnitt 10).
 * Jede Eingabe einer Person bleibt offen, bis der Coach antwortet, bewertet oder
 * „gesehen“ markiert. Die Auffälligkeiten sind nur Hinweise – keine Diagnose,
 * die App ändert keinen Plan.
 */
import { supabase } from "./supabase";
import type { TagesCheckin } from "./tagesabfrage";

export type PunktArt = "ziele" | "nachricht" | "checkin" | "video" | "tagesabfrage" | "reha";

export type OffenerPunkt = {
  art: PunktArt;
  athlet_id: string;
  name: string;
  bezug_id: string | null;
  titel: string;
  seit: string;
  basis: number;
  dringlichkeit: 1 | 2 | 3;
};

export const ART_TEXT: Record<PunktArt, string> = {
  ziele: "Ziele geändert",
  nachricht: "Nachricht",
  checkin: "Wochenabfrage",
  video: "Video",
  tagesabfrage: "Tagesabfrage",
  reha: "Reha",
};

export const DRINGLICHKEIT: Record<1 | 2 | 3, { text: string; symbol: string; klasse: string }> = {
  3: { text: "Dringend", symbol: "▲", klasse: "border-red-600/50 bg-red-600/10 text-red-700 dark:text-red-400" },
  2: { text: "Mittel", symbol: "■", klasse: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  1: { text: "Niedrig", symbol: "▽", klasse: "border-rand text-leise" },
};

/** Wohin „Öffnen“ führt */
export function punktZiel(p: Pick<OffenerPunkt, "art" | "athlet_id" | "bezug_id">): string {
  switch (p.art) {
    case "video":
      return `/video/?id=${p.bezug_id}`;
    case "ziele":
    case "nachricht":
      return `/athlet/?id=${p.athlet_id}#nachrichten`;
    case "checkin":
      return `/athlet/?id=${p.athlet_id}#checkins`;
    case "tagesabfrage":
      return `/athlet/?id=${p.athlet_id}#tagesabfrage`;
    case "reha":
      return `/athlet/?id=${p.athlet_id}`;
  }
}

/** Videos werden durch die Bewertung erledigt, alles andere auch mit „gesehen“ */
export const mitGesehen = (art: PunktArt) => art !== "video";

export function seitText(seit: string, jetzt = Date.now()): string {
  const tage = Math.floor((jetzt - Date.parse(seit)) / 86400000);
  if (tage <= 0) return "heute";
  if (tage === 1) return "seit gestern";
  return `seit ${tage} Tagen`;
}

export async function offenePunkteLaden(athletId?: string): Promise<OffenerPunkt[] | null> {
  const { data, error } = await supabase().rpc("offene_punkte", athletId ? { p_athlet: athletId } : {});
  return error ? null : ((data as OffenerPunkt[] | null) ?? []);
}

export async function punktGesehen(p: Pick<OffenerPunkt, "art" | "bezug_id" | "athlet_id">): Promise<boolean> {
  const { error } = await supabase().rpc("punkt_gesehen", { p_art: p.art, p_bezug: p.bezug_id, p_athlet: p.athlet_id });
  return !error;
}

// ---------------------------------------------------------------------
// Tagesbriefing
// ---------------------------------------------------------------------
export type Schwellen = {
  schwelle_energie: number;
  schwelle_muskelkater: number;
  schwelle_schlaf_h: number;
  tage_ohne_training: number;
};

export const STANDARD_SCHWELLEN: Schwellen = {
  schwelle_energie: 2,
  schwelle_muskelkater: 4,
  schwelle_schlaf_h: 6,
  tage_ohne_training: 7,
};

/**
 * Auffälligkeiten aus den Tagesabfragen einer Person (nur Hinweise):
 * Energie ≤ Schwelle oder Muskelkater ≥ Schwelle an 2 Tagen hintereinander,
 * Schlaf unter der Schwelle an 3 der letzten 4 Tage.
 */
export function auffaelligkeiten(tage: Pick<TagesCheckin, "datum" | "energie" | "muskelkater" | "schlaf_stunden">[], s: Schwellen): string[] {
  const t = [...tage].sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, 4);
  const hinweise: string[] = [];
  const zweiInFolge = (pruef: (x: (typeof t)[number]) => boolean) => {
    for (let i = 0; i + 1 < t.length; i++) {
      const tagAbstand = (Date.parse(t[i].datum) - Date.parse(t[i + 1].datum)) / 86400000;
      if (tagAbstand === 1 && pruef(t[i]) && pruef(t[i + 1])) return true;
    }
    return false;
  };
  if (zweiInFolge((x) => x.energie != null && x.energie <= s.schwelle_energie))
    hinweise.push(`Energie ≤ ${s.schwelle_energie} an 2 Tagen hintereinander`);
  if (zweiInFolge((x) => x.muskelkater != null && x.muskelkater >= s.schwelle_muskelkater))
    hinweise.push(`Muskelkater ≥ ${s.schwelle_muskelkater} an 2 Tagen hintereinander`);
  const wenigSchlaf = t.filter((x) => x.schlaf_stunden != null && x.schlaf_stunden < s.schwelle_schlaf_h).length;
  if (wenigSchlaf >= 3) hinweise.push(`Schlaf unter ${String(s.schwelle_schlaf_h).replace(".", ",")} h an ${wenigSchlaf} der letzten 4 Tage`);
  return hinweise;
}

/** Wer hat seit mindestens `tage` Tagen kein abgeschlossenes Training? */
export function ohneTraining(
  personen: { id: string; name: string; seit: string }[],
  letztes: Map<string, string>,
  tage: number,
  jetzt = Date.now(),
): { id: string; name: string; tage: number | null }[] {
  const grenze = tage * 86400000;
  return personen
    .map((p) => {
      const l = letztes.get(p.id);
      const bezug = l ?? p.seit;
      const abstand = jetzt - Date.parse(bezug);
      return { id: p.id, name: p.name, tage: l ? Math.floor(abstand / 86400000) : null, zuLang: abstand >= grenze };
    })
    .filter((x) => x.zuLang)
    .map(({ id, name, tage: t }) => ({ id, name, tage: t }))
    .sort((a, b) => (b.tage ?? 9999) - (a.tage ?? 9999));
}

export async function schwellenLaden(): Promise<{ werte: Schwellen; vorhanden: boolean; coachId: string | null }> {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  const id = u.user?.id ?? null;
  if (!id) return { werte: STANDARD_SCHWELLEN, vorhanden: false, coachId: null };
  const { data } = await sb
    .from("coach_einstellungen")
    .select("schwelle_energie, schwelle_muskelkater, schwelle_schlaf_h, tage_ohne_training")
    .eq("coach_id", id)
    .maybeSingle();
  if (!data) return { werte: STANDARD_SCHWELLEN, vorhanden: false, coachId: id };
  const d = data as Schwellen;
  return { werte: { ...d, schwelle_schlaf_h: Number(d.schwelle_schlaf_h) }, vorhanden: true, coachId: id };
}

export async function schwellenSpeichern(coachId: string, vorhanden: boolean, w: Schwellen): Promise<boolean> {
  const sb = supabase();
  const { error } = vorhanden
    ? await sb.from("coach_einstellungen").update(w).eq("coach_id", coachId)
    : await sb.from("coach_einstellungen").insert(w);
  return !error;
}
