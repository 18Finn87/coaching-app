"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { AerztlicherHinweis, AntwortenListe } from "./AnamneseTeile";
import { BeschwerdenListe } from "./BeschwerdenListe";
import {
  anamneseListe,
  beschwerdenListe,
  type AnamneseVersion,
  type Beschwerde,
} from "@/lib/anamnese";
import { datum } from "@/lib/texte";
import { aerztlichNoetig, fragebogenFuer, type Fragebogen } from "@/lib/fragebogen";

/** Coach: Anamnese und Beschwerden einer betreuten Person (nur lesen). */
export function AnamneseAnsicht({ athletId, einwilligung }: { athletId: string; einwilligung: boolean }) {
  const [versionen, setVersionen] = useState<AnamneseVersion[] | null>(null);
  const [beschwerden, setBeschwerden] = useState<Beschwerde[]>([]);
  const [auswahl, setAuswahl] = useState(0);
  const [bogen, setBogen] = useState<Fragebogen | null>(null);
  const fassung = versionen?.[auswahl]?.fragenversion;
  useEffect(() => {
    if (fassung) fragebogenFuer(fassung).then(setBogen);
  }, [fassung]);

  useEffect(() => {
    if (!einwilligung) return;
    Promise.all([anamneseListe(athletId), beschwerdenListe(athletId)]).then(([a, b]) => {
      setVersionen(a.daten);
      setBeschwerden(b.daten);
    });
  }, [athletId, einwilligung]);

  if (!einwilligung) {
    return (
      <Karte titel="Anamnese">
        <p className="text-sm text-leise">
          Keine Einwilligung zu Gesundheitsdaten. Deshalb siehst du hier nichts.
        </p>
      </Karte>
    );
  }
  if (versionen === null) {
    return (
      <Karte titel="Anamnese">
        <p className="text-leise">Lädt …</p>
      </Karte>
    );
  }

  const v = versionen[auswahl];
  return (
    <>
      <Karte titel="Anamnese">
        {!v ? (
          <p className="text-sm text-leise">Noch nicht ausgefüllt.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-leise">Fassung</span>
              <select
                aria-label="Fassung wählen"
                value={auswahl}
                onChange={(e) => setAuswahl(Number(e.target.value))}
                className="h-10 rounded-xl border border-rand bg-background px-2"
              >
                {versionen.map((x, i) => (
                  <option key={x.id} value={i}>
                    {x.version} vom {datum(x.erstellt_am)}
                    {i === 0 ? " (aktuell)" : ""}
                  </option>
                ))}
              </select>
            </div>
            {bogen && aerztlichNoetig(bogen.fragen, v.antworten) && (
              <div className="mb-3">
                <AerztlicherHinweis fuerCoach />
              </div>
            )}
            {bogen ? <AntwortenListe antworten={v.antworten} fragen={bogen.fragen} /> : <p className="text-leise">Lädt …</p>}
            <p className="mt-3 text-xs text-leise">
              Selbstauskunft der Person. Die App bewertet diese Angaben nicht medizinisch.
            </p>
          </>
        )}
      </Karte>
      <BeschwerdenListe beschwerden={beschwerden} bearbeitbar={false} />
    </>
  );
}
