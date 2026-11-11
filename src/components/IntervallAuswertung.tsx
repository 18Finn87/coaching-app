"use client";

import { Karte } from "./Bausteine";
import { Liniendiagramm } from "./Liniendiagramm";
import type { Punkt } from "@/lib/auswertung";
import { rundenAuswerten } from "@/lib/intervall";
import { zeitText } from "@/lib/plaene";
import { datum } from "@/lib/texte";

/**
 * Intervalle: Bei Strecken-Intervallen zählt die Zeit je Runde (kleiner = schneller),
 * bei Zeit-Intervallen die Strecke je Runde (größer = besser).
 */
export function IntervallAuswertung({ punkte }: { punkte: Punkt[] }) {
  const mitRunden = punkte.filter((p) => p.runden.length > 0);
  if (mitRunden.length === 0) return null;
  const letzte = mitRunden[mitRunden.length - 1];
  const nachStrecke = letzte.runden.filter((r) => r.nachStrecke).length >= letzte.runden.length / 2;
  const wert = (r: Punkt["runden"][number]) => (nachStrecke ? r.zeit : r.strecke);
  const werte = letzte.runden.map(wert).filter((x): x is number => x != null && x > 0);
  const a = rundenAuswerten(werte, nachStrecke);
  const format = (n: number) => (nachStrecke ? zeitText(Math.round(n)) : `${Math.round(n)} m`);

  const verlauf = mitRunden
    .map((p) => {
      const w = p.runden.map(wert).filter((x): x is number => x != null && x > 0);
      return w.length ? { datum: p.datum, wert: Math.round((w.reduce((x, y) => x + y, 0) / w.length) * 10) / 10 } : null;
    })
    .filter((x): x is { datum: string; wert: number } => x != null);

  const max = Math.max(...werte, 1);
  const besteIndex = werte.indexOf(a?.schnellste ?? -1);

  return (
    <>
      {a && (
        <Karte titel={`Runden am ${datum(letzte.datum)}`}>
          <p className="mb-2 text-sm text-leise">
            {nachStrecke ? "Zeit je Runde – kürzer ist schneller." : "Strecke je Runde – mehr ist besser."}
          </p>
          <ul className="flex flex-col gap-1.5">
            {werte.map((w, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="w-16 shrink-0 text-leise">Runde {i + 1}</span>
                <span className="h-3 flex-1 rounded-sm bg-rand" aria-hidden>
                  <span className="block h-3 rounded-sm bg-diagramm" style={{ width: `${(w / max) * 100}%` }} />
                </span>
                <span className="w-20 shrink-0 text-right tabular-nums">
                  {format(w)}
                  {i === besteIndex && werte.length > 1 && <span className="ml-1 text-xs text-leise">beste</span>}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm">
            Ø {format(a.schnitt)} · beste {format(a.schnellste)} · schwächste {format(a.langsamste)}
          </p>
          {a.veraenderungProzent != null && (
            <p className="text-sm text-leise">
              {Math.abs(a.veraenderungProzent) < 3
                ? "Sehr gleichmäßig über alle Runden."
                : a.veraenderungProzent > 0
                  ? `Letzte Runde ${a.veraenderungProzent.toLocaleString("de-DE")} % ${nachStrecke ? "langsamer" : "weniger"} als die erste.`
                  : `Letzte Runde ${Math.abs(a.veraenderungProzent).toLocaleString("de-DE")} % ${nachStrecke ? "schneller" : "mehr"} als die erste.`}
            </p>
          )}
        </Karte>
      )}
      {verlauf.length > 0 && (
        <Karte>
          <Liniendiagramm
            titel={nachStrecke ? "Ø Zeit je Runde" : "Ø Strecke je Runde"}
            einheit={nachStrecke ? "" : "m"}
            format={nachStrecke ? (n) => zeitText(Math.round(n)) : undefined}
            hinweis={nachStrecke ? "Mittel aller abgehakten Runden pro Training – kleiner ist schneller." : "Mittel aller abgehakten Runden pro Training."}
            punkte={verlauf}
          />
        </Karte>
      )}
    </>
  );
}
