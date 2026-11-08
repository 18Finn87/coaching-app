"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./konfiguration";

let client: SupabaseClient | null = null;

/** true, sobald der öffentliche Schlüssel eingetragen ist. */
export const istEingerichtet = SUPABASE_PUBLISHABLE_KEY.trim().length > 0;

/** Die eine Verbindung zu Supabase für die ganze App. */
export function supabase(): SupabaseClient {
  if (!istEingerichtet) {
    throw new Error("Supabase ist noch nicht eingerichtet (Schlüssel fehlt).");
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Anmeldung läuft über Codes, nicht über Links in der Adresszeile.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
