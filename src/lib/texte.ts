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

export const zielText: Record<string, string> = {
  kraft: "Stärker werden",
  muskelaufbau: "Muskelaufbau",
  fettabbau: "Fett abbauen",
  gesundheit: "Gesundheit und Wohlbefinden",
  sportart: "Für eine Sportart",
  beweglichkeit: "Beweglichkeit",
  ausdauer: "Ausdauer",
  reha: "Nach einer Verletzung wieder fit werden",
};

export const ausstattungText: Record<string, string> = {
  studio: "Fitnessstudio",
  zuhause_basis: "Zuhause ohne Geräte",
  zuhause_hanteln: "Zuhause mit Hanteln",
  draussen: "Draußen",
  kurzhanteln: "Kurzhanteln",
  langhantel: "Langhantel",
  kabelzug: "Kabelzug",
  baender: "Widerstandsbänder",
};

export const tagText: Record<number, string> = {
  1: "Mo",
  2: "Di",
  3: "Mi",
  4: "Do",
  5: "Fr",
  6: "Sa",
  7: "So",
};

export function datum(wert: string | null | undefined): string {
  if (!wert) return "";
  return new Date(wert).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
