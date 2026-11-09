"use client";

import { SUPABASE_URL } from "./konfiguration";
import { supabase } from "./supabase";
import type { Profil } from "./konto";

/**
 * Konto wechseln ohne Code – nur wenn man es selbst einschaltet
 * („Weiteres Konto hinzufügen“). Gemerkt wird je Konto die Anmeldung
 * (Refresh-Token) auf DIESEM Gerät, genau wie Supabase es für das aktive
 * Konto ohnehin tut. Wer das Gerät hat, kann damit wechseln.
 */

const SCHLUESSEL = "coaching.konten";

export type GemerktesKonto = {
  id: string;
  email: string;
  name: string;
  rolle: Profil["rolle"];
  refresh: string;
};

export function gemerkteKonten(): GemerktesKonto[] {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    return roh ? (JSON.parse(roh) as GemerktesKonto[]) : [];
  } catch {
    return [];
  }
}

function speichern(liste: GemerktesKonto[]) {
  try {
    if (liste.length) localStorage.setItem(SCHLUESSEL, JSON.stringify(liste));
    else localStorage.removeItem(SCHLUESSEL);
  } catch {
    // kein Speicher
  }
}

export function vergessen(id: string) {
  speichern(gemerkteKonten().filter((k) => k.id !== id));
}

export function alleVergessen() {
  speichern([]);
}

/** Das gerade aktive Konto mit seiner aktuellen Anmeldung merken. */
async function aktuellesMerken(profil: Profil): Promise<boolean> {
  const { data } = await supabase().auth.getSession();
  const s = data.session;
  if (!s || s.user.id !== profil.id) return false;
  const eintrag: GemerktesKonto = {
    id: profil.id,
    email: s.user.email ?? "",
    name: profil.anzeigename,
    rolle: profil.rolle,
    refresh: s.refresh_token,
  };
  speichern([eintrag, ...gemerkteKonten().filter((k) => k.id !== profil.id)]);
  return true;
}

/** Unter diesem Schlüssel speichert supabase-js die aktive Anmeldung (Standardname). */
function anmeldeSchluessel() {
  return `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
}

function startseiteNeuLaden() {
  window.location.href = (process.env.NEXT_PUBLIC_BASE_PATH ?? "") + "/";
}

/** Aktuelles Konto merken und abmelden (nur auf diesem Gerät), um ein weiteres anzumelden. */
export async function weiteresKontoHinzufuegen(profil: Profil): Promise<boolean> {
  if (!(await aktuellesMerken(profil))) return false;
  // NICHT signOut() aufrufen: Das würde die gemerkte Anmeldung auf dem Server
  // ungültig machen. Stattdessen nur die lokale Anmeldung entfernen.
  const auth = supabase().auth;
  await auth.stopAutoRefresh();
  try {
    localStorage.removeItem(anmeldeSchluessel());
  } catch {
    // kein Speicher
  }
  startseiteNeuLaden();
  return true;
}

/** Zu einem gemerkten Konto wechseln. false = Anmeldung abgelaufen (dann neu mit Code). */
export async function wechselnZu(zielId: string, aktuell: Profil | null): Promise<boolean> {
  const ziel = gemerkteKonten().find((k) => k.id === zielId);
  if (!ziel) return false;
  if (aktuell && !(await aktuellesMerken(aktuell))) return false;
  const { data, error } = await supabase().auth.refreshSession({ refresh_token: ziel.refresh });
  if (error || !data.session || data.session.user.id !== zielId) {
    vergessen(zielId);
    return false;
  }
  startseiteNeuLaden();
  return true;
}

/** Normales Abmelden: dieses Konto wird auf dem Gerät vergessen. */
export async function abmelden(id: string) {
  vergessen(id);
  await supabase().auth.signOut();
}
