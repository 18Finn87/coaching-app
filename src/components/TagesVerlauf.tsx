"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { heute, quelleText, SKALEN, tagesLaden, type Feld, type TagesCheckin } from "@/lib/tagesabfrage";

const wochentag = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { weekday: "short" }).replace(".", "");
const tagMonat = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });

/** Coach: Tagesabfrage der letzten 14 Tage als kompakte Tabelle (nur Anzeige, keine Bewertung) */
export function TagesVerlauf({ athletId }: { athletId: string }) {
  const [liste, setListe] = useState<TagesCheckin[] | null>(null);
  const [tage, setTage] = useState<string[]>([]);
  useEffect(() => {
    tagesLaden(athletId, 14).then((l) => {
      const jetzt = Date.now();
      setTage(Array.from({ length: 14 }, (_, i) => heute(new Date(jetzt - i * 86400000))));
      setListe(l);
    });
  }, [athletId]);

  if (liste === null) return null;
  const nachTag = new Map(liste.map((t) => [t.datum, t]));
  const auto = (t: TagesCheckin | undefined, f: Feld) => t?.quellen[f] && t.quellen[f] !== "manuell";
  const zelle = (t: TagesCheckin | undefined, f: Feld) => {
    const w = t?.[f];
    if (w == null) return <span className="text-leise">–</span>;
    const text = f === "schlaf_stunden" ? `${String(w).replace(".", ",")} h` : String(w);
    return (
      <span title={auto(t, f) ? `aus ${quelleText[t!.quellen[f]!]}` : undefined}>
        {text}
        {auto(t, f) && <sup className="text-[10px] text-leise">A</sup>}
      </span>
    );
  };

  return (
    <Karte titel="Tagesabfrage (14 Tage)">
      {liste.length === 0 ? (
        <p className="text-sm text-leise">In den letzten 14 Tagen nichts eingetragen.</p>
      ) : (
        <>
          <p className="mb-2 text-sm">
            An <strong>{liste.length}</strong> von 14 Tagen ausgefüllt.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[22rem] text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-leise">
                  <th className="py-1 pr-2 font-normal">Tag</th>
                  <th className="px-1 font-normal">Schlaf</th>
                  {SKALEN.map((s) => (
                    <th key={s.feld} className="px-1 font-normal">
                      {s.feld === "schlaf_qualitaet" ? "Qual." : s.kurz}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tage.map((d) => {
                  const t = nachTag.get(d);
                  return (
                    <tr key={d} className="border-t border-rand">
                      <td className="py-1 pr-2 text-leise">
                        {wochentag(d)} {tagMonat(d)}
                      </td>
                      <td className="px-1">{zelle(t, "schlaf_stunden")}</td>
                      {SKALEN.map((s) => (
                        <td key={s.feld} className="px-1">
                          {zelle(t, s.feld)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-leise">
            Skalen 1–5: Qualität, Energie, Stimmung – höher ist besser; Muskelkater – höher ist stärker. „A“ = automatisch
            übernommen (z. B. Apple Health). Eigene Angaben, keine Diagnose.
          </p>
        </>
      )}
    </Karte>
  );
}
