"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { gruendeText, schwierigeWochenLaden, wocheText, type Checkin } from "@/lib/coaching";

/**
 * Coach-Startseite: wer im Wochen-Check-in eine schwierige nächste Woche angekündigt hat.
 * „Krankheit“ erscheint hier bewusst nicht (geschützt) – sie steht auf der Personenseite.
 */
export function SchwierigeWochen() {
  const [liste, setListe] = useState<(Checkin & { athlet: { anzeigename: string } | null })[] | null>(null);
  useEffect(() => {
    schwierigeWochenLaden().then(setListe);
  }, []);
  if (!liste || liste.length === 0) return null;
  return (
    <Karte titel="Schwierige Woche angekündigt">
      <ul className="flex flex-col gap-2">
        {liste.map((c) => (
          <li key={c.id}>
            <Link
              href={`/athlet/?id=${c.athlet_id}#checkins`}
              className="flex flex-col gap-0.5 rounded-xl border border-amber-500/50 px-3 py-2 hover:border-akzent"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">
                  <span aria-hidden>⚠ </span>
                  {c.athlet?.anzeigename || "Ohne Namen"}
                </span>
                <span className="text-xs text-leise">Check-in {wocheText(c.woche)}</span>
              </span>
              <span className="text-sm text-leise">
                {c.ausblick_gruende.length > 0 ? gruendeText(c) : "ohne Grund"}
                {c.ausblick_text && ` – „${c.ausblick_text}“`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-leise">Die App ändert nichts am Plan – du entscheidest, ob du ihn anpasst.</p>
    </Karte>
  );
}
