"use client";

import { useId, useState } from "react";
import { datum } from "@/lib/texte";

export type Datenpunkt = { datum: string; wert: number };
export type Markierung = { datum: string; wert: number; text: string };

const B = 600; // Breite der Zeichenfläche (skaliert mit)
const H = 200;
const RAND = { links: 44, rechts: 12, oben: 12, unten: 26 };

function schoeneSchritte(min: number, max: number): number[] {
  if (min === max) {
    const p = Math.max(1, Math.abs(min) * 0.1);
    min -= p;
    max += p;
  }
  const roh = (max - min) / 4;
  const g = Math.pow(10, Math.floor(Math.log10(roh)));
  const schritt = [1, 2, 2.5, 5, 10].map((f) => f * g).find((s) => s >= roh) ?? 10 * g;
  const start = Math.floor(min / schritt) * schritt;
  const werte: number[] = [];
  for (let v = start; v <= max + schritt * 0.001; v += schritt) werte.push(Math.round(v * 100) / 100);
  if (werte[werte.length - 1] < max) werte.push(werte[werte.length - 1] + schritt);
  return werte;
}

const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/**
 * Einfaches Liniendiagramm über die Zeit (eine Messgröße, eine Achse).
 * Punkte lassen sich antippen; darunter gibt es die Werte als Tabelle.
 * Optional: zusätzliche Markierungen (z. B. getestete Maximalwerte) als Raute.
 */
export function Liniendiagramm({
  titel,
  einheit,
  punkte,
  markierungen = [],
  hinweis,
  linienName,
  markierungsName,
}: {
  titel: string;
  einheit: string;
  punkte: Datenpunkt[];
  markierungen?: Markierung[];
  hinweis?: string;
  linienName?: string;
  markierungsName?: string;
}) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [tabelle, setTabelle] = useState(false);
  const tabellenId = useId();

  const alle = [...punkte.map((p) => p.wert), ...markierungen.map((m) => m.wert)];
  if (punkte.length === 0 && markierungen.length === 0) return null;

  const zeiten = [...punkte, ...markierungen].map((p) => Date.parse(p.datum));
  let tMin = Math.min(...zeiten);
  let tMax = Math.max(...zeiten);
  if (tMin === tMax) {
    tMin -= 86400000;
    tMax += 86400000;
  }
  const ticks = schoeneSchritte(Math.min(...alle), Math.max(...alle));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const x = (d: string) => RAND.links + ((Date.parse(d) - tMin) / (tMax - tMin)) * (B - RAND.links - RAND.rechts);
  const y = (v: number) => RAND.oben + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - RAND.oben - RAND.unten);
  const pfad = punkte.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.datum).toFixed(1)},${y(p.wert).toFixed(1)}`).join(" ");
  const zweiReihen = markierungen.length > 0 && punkte.length > 0;
  const a = aktiv !== null ? punkte[aktiv] : null;

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{titel}</span>
        {punkte.length > 0 && (
          <span className="text-sm text-leise">
            zuletzt {zahl(punkte[punkte.length - 1].wert)} {einheit}
          </span>
        )}
      </figcaption>
      {hinweis && <p className="-mt-1 text-xs text-leise">{hinweis}</p>}

      {zweiReihen && (
        <ul className="flex flex-wrap gap-4 text-xs text-leise" aria-label="Legende">
          <li className="flex items-center gap-1.5">
            <svg width="18" height="10" aria-hidden>
              <line x1="0" y1="5" x2="18" y2="5" stroke="var(--diagramm)" strokeWidth="2" />
              <circle cx="9" cy="5" r="3.5" fill="var(--diagramm)" />
            </svg>
            {linienName}
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden>
              <rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" fill="var(--foreground)" />
            </svg>
            {markierungsName}
          </li>
        </ul>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${B} ${H}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={`${titel}: ${punkte.length} Werte von ${zahl(Math.min(...alle))} bis ${zahl(Math.max(...alle))} ${einheit}`}
          onMouseLeave={() => setAktiv(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={RAND.links} x2={B - RAND.rechts} y1={y(t)} y2={y(t)} stroke="var(--rand)" strokeWidth="1" />
              <text x={RAND.links - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--leise)">
                {zahl(t)}
              </text>
            </g>
          ))}
          <text x={RAND.links} y={H - 6} fontSize="11" fill="var(--leise)">
            {datum(new Date(tMin).toISOString())}
          </text>
          <text x={B - RAND.rechts} y={H - 6} fontSize="11" fill="var(--leise)" textAnchor="end">
            {datum(new Date(tMax).toISOString())}
          </text>

          {a && (
            <line
              x1={x(a.datum)}
              x2={x(a.datum)}
              y1={RAND.oben}
              y2={H - RAND.unten}
              stroke="var(--leise)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}
          {punkte.length > 1 && (
            <path d={pfad} fill="none" stroke="var(--diagramm)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {punkte.map((p, i) => (
            <circle
              key={p.datum + i}
              cx={x(p.datum)}
              cy={y(p.wert)}
              r={aktiv === i ? 6 : 4.5}
              fill="var(--diagramm)"
              stroke="var(--flaeche)"
              strokeWidth="2"
            />
          ))}
          {markierungen.map((m, i) => (
            <rect
              key={m.datum + i}
              x={x(m.datum) - 5}
              y={y(m.wert) - 5}
              width="10"
              height="10"
              transform={`rotate(45 ${x(m.datum)} ${y(m.wert)})`}
              fill="var(--foreground)"
              stroke="var(--flaeche)"
              strokeWidth="2"
            >
              <title>{`${m.text}: ${zahl(m.wert)} ${einheit} am ${datum(m.datum)}`}</title>
            </rect>
          ))}
          {/* Große, unsichtbare Trefferflächen zum Antippen */}
          {punkte.map((p, i) => (
            <rect
              key={"t" + i}
              x={x(p.datum) - 18}
              y={RAND.oben}
              width="36"
              height={H - RAND.oben - RAND.unten}
              fill="transparent"
              onMouseEnter={() => setAktiv(i)}
              onClick={() => setAktiv(aktiv === i ? null : i)}
            />
          ))}
        </svg>
        {a && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-lg border border-rand bg-flaeche px-2.5 py-1.5 text-xs shadow"
            style={{
              left: `${(x(a.datum) / B) * 100}%`,
              transform: x(a.datum) > B * 0.6 ? "translateX(-105%)" : "translateX(8%)",
            }}
          >
            <span className="block text-leise">{datum(a.datum)}</span>
            <span className="font-semibold">
              {zahl(a.wert)} {einheit}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        aria-expanded={tabelle}
        aria-controls={tabellenId}
        onClick={() => setTabelle(!tabelle)}
        className="self-start text-xs text-akzent underline underline-offset-4"
      >
        {tabelle ? "Tabelle ausblenden" : "Werte als Tabelle"}
      </button>
      {tabelle && (
        <table id={tabellenId} className="w-full text-sm">
          <thead>
            <tr className="text-left text-leise">
              <th className="py-1 font-normal">Datum</th>
              <th className="py-1 text-right font-normal">{titel}</th>
            </tr>
          </thead>
          <tbody>
            {[...punkte.map((p) => ({ ...p, text: "" })), ...markierungen.map((m) => ({ datum: m.datum, wert: m.wert, text: m.text }))]
              .sort((p, q) => p.datum.localeCompare(q.datum))
              .map((p, i) => (
                <tr key={i} className="border-t border-rand">
                  <td className="py-1">{datum(p.datum)}</td>
                  <td className="py-1 text-right tabular-nums">
                    {zahl(p.wert)} {einheit}
                    {p.text && <span className="ml-1 text-xs text-leise">({p.text})</span>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
