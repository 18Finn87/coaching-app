"use client";

import { useEffect, useMemo, useState } from "react";
import { musterText, uebungenLaden, type Uebung } from "@/lib/uebungen";

function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
}

/** Übung aus der Bibliothek wählen (archivierte werden nicht angeboten). */
export function UebungAuswahl({
  waehlen,
  abbrechen,
}: {
  waehlen: (u: Uebung) => void;
  abbrechen: () => void;
}) {
  const [alle, setAlle] = useState<Uebung[] | null>(null);
  const [suche, setSuche] = useState("");

  useEffect(() => {
    uebungenLaden().then(({ daten }) => setAlle(daten.filter((u) => !u.archiviert)));
  }, []);

  const treffer = useMemo(() => {
    const s = normal(suche.trim());
    return (alle ?? []).filter((u) => !s || normal(u.name).includes(s)).slice(0, 40);
  }, [alle, suche]);

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-akzent/50 p-3">
      <div className="flex gap-2">
        <input
          type="search"
          autoFocus
          aria-label="Übung suchen"
          placeholder="Übung suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent"
        />
        <button type="button" onClick={abbrechen} className="h-11 rounded-xl border border-rand px-3 text-sm font-medium">
          Abbrechen
        </button>
      </div>
      {alle === null ? (
        <p className="text-sm text-leise">Lädt …</p>
      ) : (
        <ul className="flex max-h-72 flex-col divide-y divide-rand overflow-y-auto">
          {treffer.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => waehlen(u)} className="w-full py-2 text-left">
                <span className="block font-medium">{u.name}</span>
                <span className="block text-xs text-leise">{musterText[u.bewegungsmuster]}</span>
              </button>
            </li>
          ))}
          {treffer.length === 0 && <li className="py-2 text-sm text-leise">Nichts gefunden.</li>}
        </ul>
      )}
    </div>
  );
}
