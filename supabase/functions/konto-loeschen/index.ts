// Supabase Edge Function "konto-loeschen"
//
// Eine Athletin / ein Athlet löscht das eigene Konto endgültig. Dabei werden
// über die Datenbank-Verknüpfungen ("on delete cascade") alle Daten mitgelöscht:
// Profil, Betreuung, Angaben zum Training, Einwilligungen, Anamnese,
// Beschwerden und Protokoll. Offene Einladungen an diese Adresse werden entfernt.
//
// Der Coach kann sich hiermit nicht löschen (Schutz vor Versehen).
// Einstellung im Dashboard: "Verify JWT" AUS (die Prüfung passiert hier im Code).

import { createClient } from "npm:@supabase/supabase-js@2";

const ERLAUBTE_HERKUNFT = ["https://18finn87.github.io", "http://localhost:3000"];

function antwort(req: Request, status: number, inhalt: unknown): Response {
  const herkunft = req.headers.get("Origin") ?? "";
  return new Response(inhalt === null ? null : JSON.stringify(inhalt), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ERLAUBTE_HERKUNFT.includes(herkunft) ? herkunft : ERLAUBTE_HERKUNFT[0],
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      Vary: "Origin",
    },
  });
}

function schluessel(alt: string, neu: string): string {
  const wert = Deno.env.get(alt);
  if (wert) return wert;
  const liste = Deno.env.get(neu);
  if (liste) {
    try {
      const objekt = JSON.parse(liste) as Record<string, string>;
      return objekt.default ?? Object.values(objekt)[0];
    } catch {
      // ignorieren
    }
  }
  throw new Error("Schlüssel fehlt: " + alt);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return antwort(req, 204, null);
  if (req.method !== "POST") return antwort(req, 405, { fehler: "nur_post" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return antwort(req, 401, { fehler: "nicht_angemeldet" });

    const admin = createClient(url, schluessel("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: nutzer, error: nutzerFehler } = await admin.auth.getUser(token);
    if (nutzerFehler || !nutzer.user) return antwort(req, 401, { fehler: "nicht_angemeldet" });
    const id = nutzer.user.id;

    // Sicherheitsabfrage aus der App
    let eingabe: { bestaetigung?: unknown } = {};
    try {
      eingabe = await req.json();
    } catch {
      // leer
    }
    if (eingabe.bestaetigung !== "LÖSCHEN") return antwort(req, 400, { fehler: "nicht_bestaetigt" });

    const { data: profil } = await admin.from("profile").select("rolle").eq("id", id).maybeSingle();
    if (profil?.rolle === "coach") return antwort(req, 403, { fehler: "coach_nicht_loeschbar" });

    if (nutzer.user.email) {
      await admin.from("einladungen").delete().eq("email", nutzer.user.email.toLowerCase());
    }
    const { error: loeschFehler } = await admin.auth.admin.deleteUser(id);
    if (loeschFehler) {
      console.error("Löschen fehlgeschlagen:", loeschFehler.message);
      return antwort(req, 500, { fehler: "loeschen_fehlgeschlagen" });
    }
    return antwort(req, 200, { ok: true });
  } catch (e) {
    console.error("Unerwarteter Fehler:", e instanceof Error ? e.message : e);
    return antwort(req, 500, { fehler: "unerwartet" });
  }
});
