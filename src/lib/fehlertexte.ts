import type { AuthError } from "@supabase/supabase-js";

/** Übersetzt Fehlermeldungen von Supabase in verständliches Deutsch. */
export function fehlertext(fehler: AuthError | Error | null | undefined): string {
  if (!fehler) return "";
  const code = "code" in fehler ? (fehler.code as string | undefined) : undefined;

  switch (code) {
    case "otp_expired":
      return "Der Code ist abgelaufen oder falsch. Bitte prüfe ihn oder fordere einen neuen an.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Zu viele Versuche in kurzer Zeit. Bitte warte eine Minute und versuche es dann erneut.";
    case "email_address_invalid":
    case "validation_failed":
      return "Diese E-Mail-Adresse sieht nicht gültig aus. Bitte prüfe die Schreibweise.";
    case "user_banned":
      return "Dieser Zugang ist gesperrt. Bitte wende dich an deinen Coach.";
    case "email_provider_disabled":
    case "otp_disabled":
      return "Die Anmeldung per E-Mail ist gerade ausgeschaltet. Bitte wende dich an deinen Coach.";
  }

  if (fehler.message?.toLowerCase().includes("fetch")) {
    return "Keine Verbindung. Bitte prüfe dein Internet und versuche es erneut.";
  }
  return "Das hat leider nicht geklappt. Bitte versuche es erneut.";
}

/**
 * Fehler, die nur bedeuten „diese Adresse ist nicht freigeschaltet“.
 * Aus Datenschutzgründen verraten wir das nicht: Die Seite verhält sich so,
 * als wäre ein Code unterwegs. So kann niemand ausprobieren, wer die App nutzt.
 */
export function istNichtFreigeschaltet(fehler: AuthError | null): boolean {
  if (!fehler) return false;
  return (
    fehler.code === "signup_disabled" ||
    fehler.code === "user_not_found" ||
    fehler.code === "email_address_not_authorized" ||
    /signups? not allowed/i.test(fehler.message ?? "")
  );
}
