"use client";

import { Karte } from "./Bausteine";
import { Liniendiagramm } from "./Liniendiagramm";
import type { UebungsVerlauf } from "@/lib/auswertung";
import { einheitKurz, testAuswerten, veraenderungText, wertText, type Veraenderung, type Wertung } from "@/lib/athletik";
import { datum } from "@/lib/texte";

export type TestInfo = { einheit: string | null; wertung: Wertung; kleinerBesser: boolean };

function Pfeil({ v }: { v: Veraenderung | null }) {
  if (!v) return <span className="text-leise">–</span>;
  const farbe = v.besser === null ? "text-leise" : v.besser ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  const zeichen = v.besser === null ? "=" : v.besser ? "▲" : "▼";
  return (
    <span className={farbe}>
      <span aria-hidden>{zeichen} </span>
      {veraenderungText(v)}
    </span>
  );
}

const wertungText = (w: Wertung) => (w === "schnitt" ? "Durchschnitt der Versuche" : "bester Versuch");

/** Verlauf eines Leistungstests: Versuche vom letzten Mal, Veränderung, Diagramm */
export function TestAuswertung({ verlauf, info }: { verlauf: UebungsVerlauf; info: TestInfo }) {
  const tage = verlauf.punkte.map((p) => ({ datum: p.datum, versuche: p.messwerte }));
  const a = testAuswerten(tage, info.wertung, info.kleinerBesser);
  if (!a.letzter) return null;
  const letzteVersuche = tage[tage.length - 1]?.versuche ?? [];
  const e = info.einheit;
  const richtung = info.kleinerBesser ? "kleiner ist besser" : "größer ist besser";

  return (
    <>
      <Karte titel={`Test am ${datum(a.letzter.datum)}`}>
        <p className="text-3xl font-semibold tabular-nums">{wertText(a.letzter.wert, e)}</p>
        <p className="text-sm text-leise">
          Gewertet: {wertungText(info.wertung)} · {richtung}
        </p>
        {letzteVersuche.length > 1 && (
          <p className="mt-2 text-sm">
            Versuche: {letzteVersuche.map((v) => wertText(v, e, false)).join(" · ")} {e ? einheitKurz[e] : ""}
          </p>
        )}
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-leise">zum letzten Test</dt>
          <dd>
            <Pfeil v={a.zumLetzten} />
          </dd>
          <dt className="text-leise">zum ersten Test</dt>
          <dd>
            <Pfeil v={a.zumErsten} />
          </dd>
          {a.bestwert != null && a.tage.length > 1 && (
            <>
              <dt className="text-leise">Bestwert</dt>
              <dd>{wertText(a.bestwert, e)}</dd>
            </>
          )}
        </dl>
      </Karte>
      <Karte>
        <Liniendiagramm
          titel="Verlauf"
          einheit={e === "s" ? "" : e ? einheitKurz[e] : ""}
          format={e === "s" ? (n) => wertText(n, "s") : undefined}
          hinweis={`Ein Punkt pro Testtag (${wertungText(info.wertung)}) · ${richtung}. Kein Vergleich mit Normwerten.`}
          punkte={a.tage}
        />
      </Karte>
    </>
  );
}

/** Alle Leistungstests einer Person auf einen Blick (z. B. nach einem Testtag) */
export function TestUeberblick({
  verlaeufe,
  infos,
  waehlen,
}: {
  verlaeufe: UebungsVerlauf[];
  infos: Map<string, TestInfo>;
  waehlen: (uebungId: string) => void;
}) {
  const zeilen = verlaeufe
    .filter((v) => infos.has(v.uebungId))
    .map((v) => {
      const info = infos.get(v.uebungId)!;
      const a = testAuswerten(
        v.punkte.map((p) => ({ datum: p.datum, versuche: p.messwerte })),
        info.wertung,
        info.kleinerBesser,
      );
      return { v, info, a };
    })
    .filter((z) => z.a.letzter)
    .sort((x, y) => y.a.letzter!.datum.localeCompare(x.a.letzter!.datum) || x.v.name.localeCompare(y.v.name));
  if (zeilen.length === 0) return null;

  return (
    <Karte titel="Leistungstests">
      <ul className="flex flex-col divide-y divide-rand">
        {zeilen.map(({ v, info, a }) => (
          <li key={v.uebungId}>
            <button type="button" onClick={() => waehlen(v.uebungId)} className="flex w-full flex-col gap-0.5 py-2 text-left">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{v.name.replace(/^Test:\s*/, "")}</span>
                <span className="tabular-nums">{wertText(a.letzter!.wert, info.einheit)}</span>
              </span>
              <span className="flex flex-wrap justify-between gap-x-3 text-xs">
                <span className="text-leise">{datum(a.letzter!.datum)}</span>
                <span>
                  <Pfeil v={a.zumLetzten} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-leise">Veränderung zum vorherigen Test. Antippen für den Verlauf.</p>
    </Karte>
  );
}
