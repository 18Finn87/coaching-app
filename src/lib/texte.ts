/** Deutsche Bezeichnungen für Werte aus der Datenbank. */

export const statusText: Record<string, string> = {
  eingeladen: "Eingeladen",
  aktiv: "Aktiv",
  pausiert: "Pausiert",
  beendet: "Beendet",
};

export const stufeText: Record<string, string> = {
  anfaenger: "Anfänger",
  fortgeschritten: "Fortgeschritten",
  sehr_erfahren: "Sehr erfahren",
};

export function datum(wert: string | null | undefined): string {
  if (!wert) return "";
  return new Date(wert).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
