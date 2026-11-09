"use client";

import { useEffect } from "react";
import { allesHochladen, aufraeumen } from "@/lib/training";

/**
 * Läuft im Hintergrund (nur für Athletinnen und Athleten): lädt eingetragene
 * Sätze hoch – sofort nach Änderungen, alle 20 Sekunden und sobald wieder
 * Internet da ist.
 */
export function TrainingSync({ athletId }: { athletId: string }) {
  useEffect(() => {
    let zeitgeber: ReturnType<typeof setTimeout> | null = null;
    const bald = () => {
      if (zeitgeber) clearTimeout(zeitgeber);
      zeitgeber = setTimeout(() => allesHochladen(athletId), 1200);
    };
    aufraeumen(athletId);
    allesHochladen(athletId);
    const intervall = setInterval(() => allesHochladen(athletId), 20000);
    window.addEventListener("online", bald);
    window.addEventListener("training-geaendert", bald);
    return () => {
      clearInterval(intervall);
      if (zeitgeber) clearTimeout(zeitgeber);
      window.removeEventListener("online", bald);
      window.removeEventListener("training-geaendert", bald);
    };
  }, [athletId]);
  return null;
}
