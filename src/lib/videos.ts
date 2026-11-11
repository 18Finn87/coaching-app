/**
 * Video-Analysen (Biomechanik): Hochladen, Abrufen, Anmerkungen, Löschen, Aufräumen.
 * Videos liegen privat im Supabase-Speicher "videos" und sind nur mit der
 * Einwilligung „Videos“ der Person abrufbar. Nach 12 Monaten werden sie gelöscht,
 * die Anmerkungen bleiben. Keine automatische Erkennung oder Bewertung.
 */
import { supabase } from "./supabase";
import { endung, type VideoMime } from "./videoverkleinern";

export const SPEICHER_GRENZE = 1024 * 1024 * 1024; // Gratis-Tarif: 1 GB

export type Analyse = {
  id: string;
  athlet_id: string;
  hochgeladen_von: string;
  uebung_id: string | null;
  titel: string;
  pfad: string;
  mime: VideoMime;
  groesse_bytes: number;
  dauer_sek: number | null;
  breite: number | null;
  hoehe: number | null;
  erstellt_am: string;
  loeschen_am: string;
  video_geloescht_am: string | null;
  uebung?: { name: string } | null;
};

export type Punkt = [number, number];
export type Zeichnung = { art: "linie" | "winkel"; punkte: Punkt[]; grad?: number };

export type Anmerkung = {
  id: string;
  analyse_id: string;
  autor_id: string;
  zeit_sek: number;
  text: string;
  zeichnung: Zeichnung | null;
  erstellt_am: string;
};

const SPALTEN =
  "id, athlet_id, hochgeladen_von, uebung_id, titel, pfad, mime, groesse_bytes, dauer_sek, breite, hoehe, erstellt_am, loeschen_am, video_geloescht_am, uebung:uebungen (name)";

export async function analysenLaden(athletId: string): Promise<{ daten: Analyse[]; fehler: boolean }> {
  const { data, error } = await supabase()
    .from("analysen")
    .select(SPALTEN)
    .eq("athlet_id", athletId)
    .order("erstellt_am", { ascending: false });
  return { daten: ((data as unknown as Analyse[] | null) ?? []).map(zahlen), fehler: !!error };
}

export async function analyseLaden(id: string): Promise<Analyse | null> {
  const { data } = await supabase().from("analysen").select(SPALTEN).eq("id", id).maybeSingle();
  return data ? zahlen(data as unknown as Analyse) : null;
}

const zahlen = (a: Analyse): Analyse => ({ ...a, dauer_sek: a.dauer_sek == null ? null : Number(a.dauer_sek) });

/** Zeitlich begrenzter Link zum Ansehen (1 Stunde) */
export async function videoLink(pfad: string): Promise<string | null> {
  const { data } = await supabase().storage.from("videos").createSignedUrl(pfad, 3600);
  return data?.signedUrl ?? null;
}

export type NeuesVideo = {
  athletId: string;
  blob: Blob;
  mime: VideoMime;
  dauer: number;
  breite: number;
  hoehe: number;
  titel: string;
  uebungId: string | null;
};

/** Erst die Analyse anlegen (prüft die Einwilligung), dann die Datei hochladen. */
export async function videoHochladen(v: NeuesVideo): Promise<{ id: string | null; fehler: string | null }> {
  const sb = supabase();
  const id = crypto.randomUUID();
  const pfad = `${v.athletId}/${id}.${endung(v.mime)}`;
  const zeile = await sb.from("analysen").insert({
    id,
    athlet_id: v.athletId,
    uebung_id: v.uebungId,
    titel: v.titel.trim().slice(0, 120),
    pfad,
    mime: v.mime,
    groesse_bytes: v.blob.size,
    dauer_sek: Math.round(v.dauer * 100) / 100,
    breite: v.breite,
    hoehe: v.hoehe,
  });
  if (zeile.error) {
    return {
      id: null,
      fehler:
        zeile.error.code === "42501"
          ? "Hochladen ist nur mit der Einwilligung „Videos“ möglich."
          : "Das Video konnte nicht gespeichert werden. Bitte versuche es erneut.",
    };
  }
  const datei = await sb.storage.from("videos").upload(pfad, v.blob, { contentType: v.mime, upsert: false });
  if (datei.error) {
    await sb.from("analysen").delete().eq("id", id);
    return { id: null, fehler: "Das Hochladen hat nicht geklappt (Internet?). Bitte versuche es erneut." };
  }
  return { id, fehler: null };
}

/** Nur das Video entfernen, Anmerkungen bleiben */
export async function videoEntfernen(a: Pick<Analyse, "id" | "pfad">): Promise<boolean> {
  const sb = supabase();
  const r = await sb.storage.from("videos").remove([a.pfad]);
  if (r.error) return false;
  const m = await sb.rpc("analyse_video_entfernt", { p_analyse: a.id });
  return !m.error && m.data === true;
}

/** Analyse ganz löschen: Video und alle Anmerkungen */
export async function analyseLoeschen(a: Analyse): Promise<boolean> {
  const sb = supabase();
  if (!a.video_geloescht_am) {
    const r = await sb.storage.from("videos").remove([a.pfad]);
    if (r.error) return false;
  }
  const { error } = await sb.from("analysen").delete().eq("id", a.id);
  return !error;
}

const AUFRAEUMEN = "coaching.videos.aufgeraeumt";

/**
 * Abgelaufene Videos (12 Monate) und Videos nach Widerruf entfernen.
 * Supabase löscht Dateien nur über die Storage-Schnittstelle, deshalb erledigt
 * das die App beim Öffnen (höchstens einmal am Tag, sofort mit `jetzt`).
 */
export async function videosAufraeumen(jetzt = false): Promise<number> {
  try {
    const heute = new Date().toISOString().slice(0, 10);
    if (!jetzt && localStorage.getItem(AUFRAEUMEN) === heute) return 0;
    const sb = supabase();
    const { data, error } = await sb.rpc("videos_zum_aufraeumen");
    if (error) return 0;
    let n = 0;
    for (const v of (data as { analyse_id: string; pfad: string }[] | null) ?? []) {
      if (await videoEntfernen({ id: v.analyse_id, pfad: v.pfad })) n++;
    }
    localStorage.setItem(AUFRAEUMEN, heute);
    return n;
  } catch {
    return 0;
  }
}

/** Alle eigenen Videodateien löschen (vor dem Löschen des Kontos) */
export async function eigeneVideosLoeschen(nutzerId: string): Promise<boolean> {
  const sb = supabase();
  const { data, error } = await sb.storage.from("videos").list(nutzerId, { limit: 1000 });
  if (error) return false;
  const pfade = (data ?? []).map((d) => `${nutzerId}/${d.name}`);
  if (pfade.length === 0) return true;
  const r = await sb.storage.from("videos").remove(pfade);
  return !r.error;
}

export async function speicherLaden(): Promise<{ anzahl: number; bytes: number } | null> {
  const { data, error } = await supabase().rpc("video_speicher");
  const z = (data as { anzahl: number; bytes: number }[] | null)?.[0];
  return error || !z ? null : { anzahl: Number(z.anzahl), bytes: Number(z.bytes) };
}

// ---------------------------------------------------------------------
// Anmerkungen
// ---------------------------------------------------------------------
export async function anmerkungenLaden(analyseId: string): Promise<Anmerkung[]> {
  const { data } = await supabase()
    .from("analyse_anmerkungen")
    .select("id, analyse_id, autor_id, zeit_sek, text, zeichnung, erstellt_am")
    .eq("analyse_id", analyseId)
    .order("zeit_sek");
  return ((data as Anmerkung[] | null) ?? []).map((a) => ({ ...a, zeit_sek: Number(a.zeit_sek) }));
}

export async function anmerkungSpeichern(analyseId: string, zeit: number, text: string, zeichnung: Zeichnung | null) {
  return supabase()
    .from("analyse_anmerkungen")
    .insert({ analyse_id: analyseId, zeit_sek: Math.round(zeit * 1000) / 1000, text: text.trim().slice(0, 1000), zeichnung });
}

export async function anmerkungLoeschen(id: string) {
  return supabase().from("analyse_anmerkungen").delete().eq("id", id);
}

// ---------------------------------------------------------------------
// Rechnen
// ---------------------------------------------------------------------
/** Zeit als 0:03,4 (oder mit 2 Stellen 0:03,47 – für das Bild-für-Bild-Springen) */
export function zeitpunktText(sek: number, stellen: 1 | 2 = 1): string {
  const s = Math.max(0, sek);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const ganz = Math.floor(rest);
  const faktor = stellen === 2 ? 100 : 10;
  const bruch = Math.floor((rest - ganz) * faktor + 1e-6);
  return `${m}:${String(ganz).padStart(2, "0")},${String(bruch).padStart(stellen, "0")}`;
}

/** Winkel am mittleren Punkt (Grad, 0–180), Punkte relativ 0–1 und Bildseitenverhältnis */
export function winkel(a: Punkt, b: Punkt, c: Punkt, seitenverhaeltnis = 1): number {
  const v1 = [(a[0] - b[0]) * seitenverhaeltnis, a[1] - b[1]];
  const v2 = [(c[0] - b[0]) * seitenverhaeltnis, c[1] - b[1]];
  const l = Math.hypot(v1[0], v1[1]) * Math.hypot(v2[0], v2[1]);
  if (l === 0) return 0;
  const cos = Math.min(1, Math.max(-1, (v1[0] * v2[0] + v1[1] * v2[1]) / l));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

/** Neigung einer Linie gegenüber der Senkrechten (Grad, 0–90), z. B. Rumpfneigung */
export function neigung(a: Punkt, b: Punkt, seitenverhaeltnis = 1): number {
  const dx = Math.abs((b[0] - a[0]) * seitenverhaeltnis);
  const dy = Math.abs(b[1] - a[1]);
  if (dx === 0 && dy === 0) return 0;
  return Math.round((Math.atan2(dx, dy) * 180) / Math.PI);
}

export const mb = (bytes: number) => (bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 });
