"use client";

import { Karte } from "./Bausteine";
import { Liniendiagramm } from "./Liniendiagramm";
import { ueberGrenze, type SchmerzUebung } from "@/lib/reha";
import { datum } from "@/lib/texte";

function Wert({ wert, grenze }: { wert: number; grenze: number | null }) {
  const zuViel = ueberGrenze(wert, grenze);
  return (
    <span className={zuViel ? "font-semibold text-amber-600 dark:text-amber-400" : ""}>
      {zuViel && <span aria-hidden>⚠ </span>}
      {wert}/10{zuViel && <span className="sr-only"> (über der Grenze)</span>}
    </span>
  );
}

/** Alle Übungen mit Schmerzangaben auf einen Blick */
export function SchmerzUeberblick({ uebungen, waehlen }: { uebungen: SchmerzUebung[]; waehlen: (id: string) => void }) {
  if (uebungen.length === 0) return null;
  return (
    <Karte titel="Schmerz bei Reha-Übungen">
      <ul className="flex flex-col divide-y divide-rand">
        {uebungen.map((u) => (
          <li key={u.uebungId}>
            <button type="button" onClick={() => waehlen(u.uebungId)} className="flex w-full flex-col gap-0.5 py-2 text-left">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{u.name}</span>
                <Wert wert={u.letzter.wert} grenze={u.letzter.grenze} />
              </span>
              <span className="flex flex-wrap justify-between gap-x-3 text-xs text-leise">
                <span>
                  zuletzt {datum(u.letzter.datum)}
                  {u.letzter.grenze != null && ` · Grenze ${u.letzter.grenze}`}
                </span>
                <span>{u.ueber > 0 ? `${u.ueber}× über der Grenze` : "nie über der Grenze"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-leise">
        Eigene Angaben (0 = kein Schmerz, 10 = stärkster). Die App markiert nur – sie ändert keinen Plan und stellt keine
        Diagnose.
      </p>
    </Karte>
  );
}

/** Schmerzverlauf einer Übung mit Markierung über der Grenze */
export function SchmerzDetail({ uebung }: { uebung: SchmerzUebung }) {
  const e = uebung.eintraege;
  const ueber = e.filter((x) => ueberGrenze(x.wert, x.grenze));
  const grenze = uebung.letzter.grenze;
  return (
    <Karte>
      <Liniendiagramm
        titel="Schmerz"
        einheit="/10"
        hinweis={`Angabe nach der Übung${grenze != null ? ` · Grenze ${grenze}` : ""}. Eigene Einschätzung, keine Diagnose.`}
        punkte={e.map((x) => ({ datum: x.datum, wert: x.wert }))}
        markierungen={ueber.map((x) => ({ datum: x.datum, wert: x.wert, text: "über der Grenze" }))}
        linienName="Schmerz"
        markierungsName="über der Grenze"
      />
      {e.some((x) => x.notiz) && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {[...e]
            .reverse()
            .filter((x) => x.notiz)
            .slice(0, 8)
            .map((x) => (
              <li key={x.ausgefuehrte_uebung_id} className="flex gap-2">
                <span className="w-24 shrink-0 text-leise">{datum(x.datum)}</span>
                <Wert wert={x.wert} grenze={x.grenze} />
                <span className="min-w-0 flex-1 break-words">{x.notiz}</span>
              </li>
            ))}
        </ul>
      )}
    </Karte>
  );
}
