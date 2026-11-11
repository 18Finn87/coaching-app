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
 * Liniendiagramm über die Zeit (eine Messgröße, eine Achse).
 * Optional eine zweite Linie derselben Größe (z. B. rechts neben links) in einer
 * zweiten, geprüften Farbe und mit eckigen Punkten, damit sie auch ohne Farbe
 * unterscheidbar ist. Punkte lassen sich antippen; darunter gibt es die Werte als Tabelle.
 * Optional: Markierungen (z. B. getestete Maximalwerte) als Raute.
 */
export function Liniendiagramm({
  titel,
  einheit,
  punkte,
  reihe2,
  markierungen = [],
  hinweis,
  linienName,
  markierungsName,
  format,
  bereich,
}: {
  titel: string;
  einheit: string;
  punkte: Datenpunkt[];
  reihe2?: { name: string; punkte: Datenpunkt[] };
  markierungen?: Markierung[];
  hinweis?: string;
  linienName?: string;
  markierungsName?: string;
  /** eigene Zahlen-Darstellung, z. B. Pace als 5:30 */
  format?: (n: number) => string;
  /** feste Achse, z. B. [0, 10] bei einer Skala */
  bereich?: [number, number];
}) {
  const f = format ?? zahl;
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [tabelle, setTabelle] = useState(false);
  const tabellenId = useId();

  const punkte2 = reihe2?.punkte ?? [];
  const alle = [...punkte.map((p) => p.wert), ...punkte2.map((p) => p.wert), ...markierungen.map((m) => m.wert)];
  if (alle.length === 0) return null;

  const zeiten = [...punkte, ...punkte2, ...markierungen].map((p) => Date.parse(p.datum));
  let tMin = Math.min(...zeiten);
  let tMax = Math.max(...zeiten);
  if (tMin === tMax) {
    tMin -= 86400000;
    tMax += 86400000;
  }
  const ticks = bereich
    ? schoeneSchritte(Math.min(bereich[0], ...alle), Math.max(bereich[1], ...alle))
    : schoeneSchritte(Math.min(...alle), Math.max(...alle));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const x = (d: string) => RAND.links + ((Date.parse(d) - tMin) / (tMax - tMin)) * (B - RAND.links - RAND.rechts);
  const y = (v: number) => RAND.oben + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - RAND.oben - RAND.unten);
  const pfad = (liste: Datenpunkt[]) =>
    liste.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.datum).toFixed(1)},${y(p.wert).toFixed(1)}`).join(" ");

  // Alle Zeitpunkte (für Antippen und Tabelle)
  const daten = [...new Set([...punkte, ...punkte2].map((p) => p.datum))].sort();
  const wertBei = (liste: Datenpunkt[], d: string) => liste.find((p) => p.datum === d)?.wert;
  const legende = (markierungen.length > 0 && punkte.length > 0) || !!reihe2;
  const letzter1 = punkte[punkte.length - 1];
  const letzter2 = punkte2[punkte2.length - 1];

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{titel}</span>
        {(letzter1 || letzter2) && (
          <span className="text-right text-sm text-leise">
            zuletzt{" "}
            {reihe2
              ? [letzter1 && `${linienName ?? ""} ${f(letzter1.wert)}`, letzter2 && `${reihe2.name} ${f(letzter2.wert)}`]
                  .filter(Boolean)
                  .join(" · ")
              : f(letzter1!.wert)}{" "}
            {einheit}
          </span>
        )}
      </figcaption>
      {hinweis && <p className="-mt-1 text-xs text-leise">{hinweis}</p>}

      {legende && (
        <ul className="flex flex-wrap gap-4 text-xs text-leise" aria-label="Legende">
          <li className="flex items-center gap-1.5">
            <svg width="18" height="10" aria-hidden>
              <line x1="0" y1="5" x2="18" y2="5" stroke="var(--diagramm)" strokeWidth="2" />
              <circle cx="9" cy="5" r="3.5" fill="var(--diagramm)" />
            </svg>
            {linienName}
          </li>
          {reihe2 && (
            <li className="flex items-center gap-1.5">
              <svg width="18" height="10" aria-hidden>
                <line x1="0" y1="5" x2="18" y2="5" stroke="var(--diagramm-2)" strokeWidth="2" />
                <rect x="5.5" y="1.5" width="7" height="7" fill="var(--diagramm-2)" />
              </svg>
              {reihe2.name}
            </li>
          )}
          {markierungen.length > 0 && (
            <li className="flex items-center gap-1.5">
              <svg width="12" height="12" aria-hidden>
                <rect x="2" y="2" width="8" height="8" transform="rotate(45 6 6)" fill="var(--foreground)" />
              </svg>
              {markierungsName}
            </li>
          )}
        </ul>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${B} ${H}`}
          className="h-auto w-full touch-pan-y"
          role="img"
          aria-label={`${titel}: ${daten.length} Werte von ${f(Math.min(...alle))} bis ${f(Math.max(...alle))} ${einheit}`}
          onMouseLeave={() => setAktiv(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={RAND.links} x2={B - RAND.rechts} y1={y(t)} y2={y(t)} stroke="var(--rand)" strokeWidth="1" />
              <text x={RAND.links - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--leise)">
                {f(t)}
              </text>
            </g>
          ))}
          <text x={RAND.links} y={H - 6} fontSize="11" fill="var(--leise)">
            {datum(new Date(tMin).toISOString())}
          </text>
          <text x={B - RAND.rechts} y={H - 6} fontSize="11" fill="var(--leise)" textAnchor="end">
            {datum(new Date(tMax).toISOString())}
          </text>

          {aktiv && (
            <line
              x1={x(aktiv)}
              x2={x(aktiv)}
              y1={RAND.oben}
              y2={H - RAND.unten}
              stroke="var(--leise)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
          )}
          {punkte.length > 1 && (
            <path d={pfad(punkte)} fill="none" stroke="var(--diagramm)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {punkte2.length > 1 && (
            <path d={pfad(punkte2)} fill="none" stroke="var(--diagramm-2)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}
          {punkte.map((p, i) => (
            <circle
              key={p.datum + i}
              cx={x(p.datum)}
              cy={y(p.wert)}
              r={aktiv === p.datum ? 6 : 4.5}
              fill="var(--diagramm)"
              stroke="var(--flaeche)"
              strokeWidth="2"
            />
          ))}
          {punkte2.map((p, i) => {
            const g = aktiv === p.datum ? 11 : 9;
            return (
              <rect
                key={"r" + p.datum + i}
                x={x(p.datum) - g / 2}
                y={y(p.wert) - g / 2}
                width={g}
                height={g}
                fill="var(--diagramm-2)"
                stroke="var(--flaeche)"
                strokeWidth="2"
              />
            );
          })}
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
              <title>{`${m.text}: ${f(m.wert)} ${einheit} am ${datum(m.datum)}`}</title>
            </rect>
          ))}
          {/* Große, unsichtbare Trefferflächen zum Antippen */}
          {daten.map((d) => (
            <rect
              key={"t" + d}
              x={x(d) - 18}
              y={RAND.oben}
              width="36"
              height={H - RAND.oben - RAND.unten}
              fill="transparent"
              onMouseEnter={() => setAktiv(d)}
              onClick={() => setAktiv(aktiv === d ? null : d)}
            />
          ))}
        </svg>
        {aktiv && (
          <div
            role="status"
            className="pointer-events-none absolute top-1 rounded-lg border border-rand bg-flaeche px-2.5 py-1.5 text-xs shadow"
            style={{
              left: `${(x(aktiv) / B) * 100}%`,
              transform: x(aktiv) > B * 0.6 ? "translateX(-105%)" : "translateX(8%)",
            }}
          >
            <span className="block text-leise">{datum(aktiv)}</span>
            {[
              { name: reihe2 ? linienName : undefined, wert: wertBei(punkte, aktiv) },
              ...(reihe2 ? [{ name: reihe2.name, wert: wertBei(punkte2, aktiv) }] : []),
            ]
              .filter((z) => z.wert !== undefined)
              .map((z) => (
                <span key={z.name ?? "w"} className="block font-semibold">
                  {z.name ? `${z.name}: ` : ""}
                  {f(z.wert!)} {einheit}
                </span>
              ))}
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
              <th className="py-1 text-right font-normal">{reihe2 ? linienName : titel}</th>
              {reihe2 && <th className="py-1 text-right font-normal">{reihe2.name}</th>}
            </tr>
          </thead>
          <tbody>
            {daten.map((d) => {
              const w1 = wertBei(punkte, d);
              const w2 = wertBei(punkte2, d);
              return (
                <tr key={d} className="border-t border-rand">
                  <td className="py-1">{datum(d)}</td>
                  <td className="py-1 text-right tabular-nums">{w1 !== undefined ? `${f(w1)} ${einheit}` : "–"}</td>
                  {reihe2 && (
                    <td className="py-1 text-right tabular-nums">{w2 !== undefined ? `${f(w2)} ${einheit}` : "–"}</td>
                  )}
                </tr>
              );
            })}
            {markierungen.map((m, i) => (
              <tr key={"m" + i} className="border-t border-rand">
                <td className="py-1">{datum(m.datum)}</td>
                <td className="py-1 text-right tabular-nums" colSpan={reihe2 ? 2 : 1}>
                  {f(m.wert)} {einheit} <span className="ml-1 text-xs text-leise">({m.text})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
