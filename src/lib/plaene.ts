import { supabase } from "./supabase";
import { hatLast } from "./uebungen";
import { dauerText, intensitaetText, kmText, type Intensitaet } from "./ausdauer";

export type Plan = {
  id: string;
  athlet_id: string;
  titel: string;
  ziel: string;
  status: string;
  erstellt_am: string;
};

export type Version = {
  id: string;
  plan_id: string;
  versionsnummer: number;
  status: "entwurf" | "veroeffentlicht" | "abgeloest";
  gueltig_ab: string | null;
  aenderungsgrund: string;
  erstellt_am: string;
  veroeffentlicht_am: string | null;
};

export type Satz = {
  id: string;
  satznummer: number;
  satztyp: string;
  wdh_min: number | null;
  wdh_max: number | null;
  last_kg: number | null;
  last_prozent: number | null;
  rir_ziel: number | null;
  tempo: string | null;
  pause_sek: number | null;
  dauer_sek: number | null;
  distanz_m: number | null;
  zusatz?: { intensitaet?: Intensitaet; serienende?: boolean } & Record<string, unknown>;
};

export type PlanUebung = {
  id: string;
  reihenfolge: number;
  gruppe: string | null;
  hinweis: string;
  /** Schmerzgrenze 0–10 (Reha), null = keine */
  schmerzgrenze?: number | null;
  uebung_id: string;
  uebung: { name: string; messart: string; einseitig: boolean; seiten_getrennt?: boolean; einheit?: string | null; modul?: string } | null;
  plan_saetze: Satz[];
};

export type Einheit = {
  id: string;
  name: string;
  reihenfolge: number;
  notiz: string;
  plan_uebungen: PlanUebung[];
};

export const versionStatusText: Record<string, string> = {
  entwurf: "Entwurf",
  veroeffentlicht: "Gültig",
  abgeloest: "Abgelöst",
};

export const satztypText: Record<string, string> = {
  aufwaermen: "Aufwärmen",
  arbeit: "Arbeitssatz",
  backoff: "Back-off",
  drop: "Drop-Satz",
  amrap: "So viele wie möglich",
};

const SATZ_SPALTEN =
  "id, satznummer, satztyp, wdh_min, wdh_max, last_kg, last_prozent, rir_ziel, tempo, pause_sek, dauer_sek, distanz_m, zusatz";

export async function versionInhaltLaden(versionId: string): Promise<{ daten: Einheit[]; fehler: boolean }> {
  const { data, error } = await supabase()
    .from("plan_einheiten")
    .select(
      `id, name, reihenfolge, notiz,
       plan_uebungen (id, reihenfolge, gruppe, hinweis, schmerzgrenze, uebung_id,
         uebung:uebungen (name, messart, einseitig, seiten_getrennt, einheit, modul),
         plan_saetze (${SATZ_SPALTEN}))`,
    )
    .eq("planversion_id", versionId)
    .order("reihenfolge");
  const daten = ((data as unknown as Einheit[] | null) ?? []).map((e) => ({
    ...e,
    plan_uebungen: [...e.plan_uebungen]
      .sort((a, b) => a.reihenfolge - b.reihenfolge)
      .map((u) => ({ ...u, plan_saetze: [...u.plan_saetze].sort((a, b) => a.satznummer - b.satznummer) })),
  }));
  return { daten, fehler: !!error };
}

/** Kurze Beschreibung eines Satzes, z. B. „6–8 Wdh. · 60 kg · RIR 2 · Pause 2:00“ */
export function satzText(s: Satz, messart = "wdh_last"): string {
  const teile: string[] = [];
  if (messart === "ausdauer") {
    if (s.dauer_sek) teile.push(`${dauerText(s.dauer_sek)} min`);
    if (s.distanz_m) teile.push(kmText(s.distanz_m));
    const i = intensitaetText(s.zusatz?.intensitaet);
    if (i) teile.push(i);
    if (s.pause_sek) teile.push(`Pause ${zeitText(s.pause_sek)}`);
    return teile.join(" · ") || "ohne Vorgabe";
  }
  if (messart === "test") {
    teile.push("Versuch");
    if (s.pause_sek) teile.push(`Pause ${zeitText(s.pause_sek)}`);
    return teile.join(" · ");
  }
  if (s.satztyp === "amrap") teile.push("so viele Wdh. wie möglich");
  else if (s.wdh_min && s.wdh_max && s.wdh_min !== s.wdh_max) teile.push(`${s.wdh_min}–${s.wdh_max} Wdh.`);
  else if (s.wdh_min || s.wdh_max) teile.push(`${s.wdh_min ?? s.wdh_max} Wdh.`);
  if (s.dauer_sek) teile.push(zeitText(s.dauer_sek));
  if (s.distanz_m) teile.push(`${s.distanz_m} m`);
  if (s.last_kg !== null && hatLast(messart))
    teile.push(`${zahl(s.last_kg)} kg`);
  if (s.last_prozent) teile.push(`${zahl(s.last_prozent)} % 1RM`);
  if (s.rir_ziel !== null) teile.push(`RIR ${zahl(s.rir_ziel)}`);
  if (s.tempo) teile.push(`Tempo ${s.tempo}`);
  if (s.pause_sek) teile.push(`Pause ${zeitText(s.pause_sek)}`);
  return teile.join(" · ") || (messart === "umfang" ? "messen (cm)" : "ohne Vorgabe");
}

export function zeitText(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function zahl(n: number): string {
  return Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 });
}

/** Fehlermeldungen aus den Datenbank-Funktionen lesbar machen */
export function planFehler(error: { message?: string } | null): string {
  const m = error?.message ?? "";
  if (/Trainingstag|Übung|Satz|Entwurf|gehört dir nicht|kann nicht veröffentlicht/.test(m)) return m;
  return "Das hat nicht geklappt. Bitte versuche es erneut.";
}
