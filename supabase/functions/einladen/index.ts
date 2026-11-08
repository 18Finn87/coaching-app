// Supabase Edge Function "einladen"
//
// Der Coach ruft sie aus der App auf (Name + E-Mail). Sie
//   1. prüft, wer anruft (nur angemeldete Personen),
//   2. trägt die Einladung MIT DEN RECHTEN DES ANRUFERS ein – die Zugriffsregeln
//      der Datenbank lassen das nur einem Coach zu,
//   3. lässt Supabase die Einladungs-Mail schicken (dafür braucht es den
//      Server-Schlüssel, den Supabase hier automatisch bereitstellt – er steht
//      nirgends im Code).
//
// Einstellung im Dashboard: "Verify JWT" AUS (die Prüfung passiert hier im Code).

import { createClient } from "npm:@supabase/supabase-js@2";

const ERLAUBTE_HERKUNFT = ["https://18finn87.github.io", "http://localhost:3000"];
const APP_ADRESSE = "https://18finn87.github.io/coaching-app/";

function kopfzeilen(req: Request): HeadersInit {
  const herkunft = req.headers.get("Origin") ?? "";
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ERLAUBTE_HERKUNFT.includes(herkunft) ? herkunft : ERLAUBTE_HERKUNFT[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function antwort(req: Request, status: number, inhalt: unknown): Response {
  return new Response(inhalt === null ? null : JSON.stringify(inhalt), {
    status,
    headers: kopfzeilen(req),
  });
}

/** Liest einen Schlüssel aus den von Supabase bereitgestellten Umgebungsvariablen. */
function schluessel(alt: string, neu: string): string {
  const wert = Deno.env.get(alt);
  if (wert) return wert;
  const liste = Deno.env.get(neu);
  if (liste) {
    try {
      const objekt = JSON.parse(liste) as Record<string, string>;
      return objekt.default ?? Object.values(objekt)[0];
    } catch {
      // ignorieren, unten kommt die Fehlermeldung
    }
  }
  throw new Error(`Schlüssel ${alt} / ${neu} fehlt`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return antwort(req, 204, null);
  if (req.method !== "POST") return antwort(req, 405, { fehler: "nur_post" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return antwort(req, 401, { fehler: "nicht_angemeldet" });

    // Verbindung mit den Rechten der anrufenden Person
    const alsAnrufer = createClient(url, schluessel("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS"), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: nutzer, error: nutzerFehler } = await alsAnrufer.auth.getUser(token);
    if (nutzerFehler || !nutzer.user) return antwort(req, 401, { fehler: "nicht_angemeldet" });

    let eingabe: { email?: unknown; name?: unknown };
    try {
      eingabe = await req.json();
    } catch {
      return antwort(req, 400, { fehler: "ungueltige_anfrage" });
    }
    const email = String(eingabe.email ?? "").trim().toLowerCase();
    const name = String(eingabe.name ?? "").trim().replace(/\s+/g, " ").slice(0, 80) || null;
    if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return antwort(req, 400, { fehler: "email_ungueltig" });
    }

    // Einladung eintragen – die Zugriffsregeln erlauben das nur dem Coach
    const { data: einladung, error: eintragFehler } = await alsAnrufer
      .from("einladungen")
      .insert({ email, name })
      .select("id")
      .single();
    if (eintragFehler) {
      if (eintragFehler.code === "23505") return antwort(req, 409, { fehler: "schon_eingeladen" });
      return antwort(req, 403, { fehler: "nicht_erlaubt" });
    }

    // Einladungs-Mail über Supabase schicken (legt das Konto an)
    const admin = createClient(url, schluessel("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: eingeladen, error: einladeFehler } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: APP_ADRESSE,
    });
    if (einladeFehler) {
      // Einladung wieder entfernen, damit es keine Leiche gibt
      await admin.from("einladungen").delete().eq("id", einladung.id);
      const text = einladeFehler.message ?? "";
      if (einladeFehler.code === "email_exists" || /already been registered/i.test(text)) {
        return antwort(req, 409, { fehler: "hat_schon_zugang" });
      }
      if (einladeFehler.status === 429 || /rate limit/i.test(text)) {
        return antwort(req, 429, { fehler: "zu_viele_mails" });
      }
      console.error("Einladung fehlgeschlagen:", einladeFehler.code, text);
      return antwort(req, 502, { fehler: "versand_fehlgeschlagen" });
    }

    // Konto gleich als bestätigt markieren. Sonst verweigert Supabase später den
    // Anmeldecode, weil die öffentliche Registrierung ausgeschaltet ist. Dass die
    // Adresse der Person gehört, beweist sie bei der Anmeldung mit dem Code aus der Mail.
    if (eingeladen?.user) {
      const { error: bestaetigFehler } = await admin.auth.admin.updateUserById(eingeladen.user.id, {
        email_confirm: true,
      });
      if (bestaetigFehler) console.error("Bestätigen fehlgeschlagen:", bestaetigFehler.message);
    }

    return antwort(req, 200, { ok: true });
  } catch (e) {
    console.error("Unerwarteter Fehler:", e instanceof Error ? e.message : e);
    return antwort(req, 500, { fehler: "unerwartet" });
  }
});
