"use client";

import { useEffect, useState } from "react";
import { satzText, versionInhaltLaden, type Einheit } from "@/lib/plaene";

type Zeile = { art: "neu" | "weg" | "geaendert"; ort: string; alt?: string; neu?: string };

/** Beschreibt eine Übung in einer Zeile, um zwei Versionen vergleichen zu können */
function uebungZeilen(einheiten: Einheit[]): Map<string, string> {
  const karte = new Map<string, string>();
  for (const e of einheiten) {
    const zaehler = new Map<string, number>();
    for (const u of e.plan_uebungen) {
      const name = u.uebung?.name ?? "Übung";
      const n = (zaehler.get(name) ?? 0) + 1;
      zaehler.set(name, n);
      const schluessel = `${e.name} › ${name}${n > 1 ? ` (${n})` : ""}`;
      const saetze = u.plan_saetze.map((s) => satzText(s, u.uebung?.messart)).join(" | ");
      karte.set(schluessel, `${u.plan_saetze.length} Sätze: ${saetze}${u.hinweis ? ` – ${u.hinweis}` : ""}`);
    }
    if (e.plan_uebungen.length === 0) karte.set(`${e.name}`, "(ohne Übungen)");
  }
  return karte;
}

/** Zeigt, was sich zwischen zwei Versionen geändert hat. */
export function VersionsVergleich({ altId, neuId }: { altId: string; neuId: string }) {
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);

  useEffect(() => {
    Promise.all([versionInhaltLaden(altId), versionInhaltLaden(neuId)]).then(([a, n]) => {
      const alt = uebungZeilen(a.daten);
      const neu = uebungZeilen(n.daten);
      const liste: Zeile[] = [];
      for (const [ort, text] of neu) {
        if (!alt.has(ort)) liste.push({ art: "neu", ort, neu: text });
        else if (alt.get(ort) !== text) liste.push({ art: "geaendert", ort, alt: alt.get(ort), neu: text });
      }
      for (const [ort, text] of alt) if (!neu.has(ort)) liste.push({ art: "weg", ort, alt: text });
      setZeilen(liste);
    });
  }, [altId, neuId]);

  if (zeilen === null) return <p className="text-leise">Vergleicht …</p>;
  if (zeilen.length === 0) return <p className="text-sm text-leise">Keine Unterschiede.</p>;

  const farbe = { neu: "text-akzent", weg: "text-red-500", geaendert: "text-amber-500" };
  const wort = { neu: "Neu", weg: "Entfernt", geaendert: "Geändert" };

  return (
    <ul className="flex flex-col gap-3 text-sm">
      {zeilen.map((z) => (
        <li key={z.art + z.ort}>
          <p>
            <span className={`font-medium ${farbe[z.art]}`}>{wort[z.art]}:</span> {z.ort}
          </p>
          {z.alt && <p className="text-leise line-through decoration-red-400/60">{z.alt}</p>}
          {z.neu && <p>{z.neu}</p>}
        </li>
      ))}
    </ul>
  );
}
