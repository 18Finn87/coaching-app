/**
 * Geschätztes 1RM (e1RM) – IMMER eine Schätzung, kein gemessener Wert.
 * Die Formel ist austauschbar (Einstellung des Coaches). Neue Formeln hier
 * ergänzen und in der Datenbank-Prüfung (coach_einstellungen) zulassen.
 */

export type Formel = "epley" | "brzycki";

export const FORMELN: Record<Formel, { name: string; beschreibung: string; rechnen: (kg: number, wdh: number) => number }> = {
  epley: {
    name: "Epley",
    beschreibung: "Gewicht × (1 + Wiederholungen / 30)",
    rechnen: (kg, wdh) => (wdh === 1 ? kg : kg * (1 + wdh / 30)),
  },
  brzycki: {
    name: "Brzycki",
    beschreibung: "Gewicht × 36 / (37 − Wiederholungen)",
    rechnen: (kg, wdh) => (kg * 36) / (37 - wdh),
  },
};

export const STANDARD_FORMEL: Formel = "epley";
export const STANDARD_MAX_WDH = 10;

/**
 * Schätzt das 1RM aus einem Satz. Gibt null zurück, wenn keine sinnvolle
 * Schätzung möglich ist (kein Gewicht, 0 Wiederholungen oder mehr als maxWdh).
 */
export function e1rm(
  kg: number | null | undefined,
  wdh: number | null | undefined,
  formel: Formel = STANDARD_FORMEL,
  maxWdh: number = STANDARD_MAX_WDH,
): number | null {
  if (kg == null || wdh == null) return null;
  if (!Number.isFinite(kg) || !Number.isFinite(wdh)) return null;
  if (kg <= 0 || wdh < 1 || wdh > maxWdh || !Number.isInteger(wdh)) return null;
  const f = FORMELN[formel] ?? FORMELN[STANDARD_FORMEL];
  return Math.round(f.rechnen(kg, wdh) * 10) / 10;
}
