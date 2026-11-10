"use client";

import { useState } from "react";
import { Karte } from "./Bausteine";
import { kmText, wochenUmfang, type AusdauerAbschnitt, type Zone } from "@/lib/ausdauer";

const prozent = (teil: number, ganz: number) => (ganz > 0 ? Math.round((teil / ganz) * 100) : 0);

/** Ausdauer pro Woche: Minuten, km und Anteil locker / mittel / hart. */
export function WochenUmfang({ abschnitte, zonen }: { abschnitte: AusdauerAbschnitt[]; zonen?: Zone[] }) {
  const [alle, setAlle] = useState(false);
  const wochen = wochenUmfang(abschnitte, zonen);
  if (wochen.length === 0) return null;
  const zeigen = alle ? wochen : wochen.slice(-8);
  const max = Math.max(...zeigen.map((w) => w.minuten), 1);

  return (
    <Karte titel="Ausdauer pro Woche">
      <ul className="flex flex-col gap-3">
        {[...zeigen].reverse().map((w) => {
          const tag = new Date(w.woche + "T12:00:00Z").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
          const bewertet = w.minuten - w.offen;
          return (
            <li key={w.woche} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-leise">ab {tag}</span>
                <span className="tabular-nums">
                  <strong>{w.minuten} min</strong>
                  {w.meter > 0 && ` · ${kmText(w.meter)}`}
                </span>
              </div>
              <div className="h-3 rounded-sm bg-rand" aria-hidden>
                <div className="h-3 rounded-sm bg-diagramm" style={{ width: `${(w.minuten / max) * 100}%` }} />
              </div>
              <p className="text-xs text-leise">
                {bewertet > 0
                  ? `${prozent(w.locker, w.minuten)} % locker · ${prozent(w.mittel, w.minuten)} % mittel · ${prozent(w.hart, w.minuten)} % hart`
                  : "Intensität nicht angegeben"}
                {bewertet > 0 && w.offen > 0 && ` · ${prozent(w.offen, w.minuten)} % ohne Angabe`}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-leise">
        Locker = Zone 1–2 bzw. Anstrengung bis 4, mittel = Zone 3 bzw. 5–6, hart = Zone 4–5 bzw. ab 7. Mit Puls zählt die
        (geschätzte) Pulszone, sonst die eigene Einschätzung.
      </p>
      {wochen.length > 8 && (
        <button type="button" onClick={() => setAlle(!alle)} className="mt-2 text-xs text-akzent underline underline-offset-4">
          {alle ? "Nur die letzten 8 Wochen" : `Alle ${wochen.length} Wochen zeigen`}
        </button>
      )}
    </Karte>
  );
}
