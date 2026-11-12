"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { schwellenLaden, schwellenSpeichern, STANDARD_SCHWELLEN, type Schwellen } from "@/lib/offenePunkte";

const feld = "h-11 w-20 rounded-xl border border-rand bg-background px-2 text-center text-base outline-none focus:border-akzent";

/** Coach: Schwellenwerte für die Hinweise im Tagesbriefing */
export function BriefingEinstellung() {
  const [w, setW] = useState<Schwellen>(STANDARD_SCHWELLEN);
  const [stand, setStand] = useState<{ vorhanden: boolean; coachId: string | null } | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    schwellenLaden().then((r) => {
      setW(r.werte);
      setStand({ vorhanden: r.vorhanden, coachId: r.coachId });
    });
  }, []);

  if (!stand) return null;
  const zahl = (k: keyof Schwellen, min: number, max: number, schritt = 1) => (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={schritt}
      value={w[k]}
      onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })}
      className={feld}
    />
  );
  const gueltig =
    w.schwelle_energie >= 1 && w.schwelle_energie <= 5 &&
    w.schwelle_muskelkater >= 1 && w.schwelle_muskelkater <= 5 &&
    w.schwelle_schlaf_h >= 0 && w.schwelle_schlaf_h <= 12 &&
    Number.isInteger(w.tage_ohne_training) && w.tage_ohne_training >= 1 && w.tage_ohne_training <= 60;

  return (
    <Karte titel="Tagesbriefing">
      <p className="mb-3 text-sm text-leise">Ab wann ein Hinweis erscheint. Nur Hinweise zum Nachfragen – keine Diagnose.</p>
      <div className="flex flex-col gap-3 text-sm">
        <label className="flex items-center justify-between gap-3">
          <span>Energie an 2 Tagen hintereinander höchstens</span>
          {zahl("schwelle_energie", 1, 5)}
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Muskelkater an 2 Tagen hintereinander mindestens</span>
          {zahl("schwelle_muskelkater", 1, 5)}
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Schlaf (Stunden) an 3 von 4 Tagen unter</span>
          {zahl("schwelle_schlaf_h", 0, 12, 0.5)}
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Ohne Training seit (Tagen)</span>
          {zahl("tage_ohne_training", 1, 60)}
        </label>
        <button
          type="button"
          disabled={!gueltig || !stand.coachId}
          onClick={async () => {
            const ok = await schwellenSpeichern(stand.coachId!, stand.vorhanden, w);
            setMeldung(ok ? { ok: true, text: "Gespeichert." } : { ok: false, text: "Speichern hat nicht geklappt." });
            if (ok) setStand({ ...stand, vorhanden: true });
          }}
          className="h-11 self-start rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
        >
          Speichern
        </button>
        {meldung && (
          <p role={meldung.ok ? "status" : "alert"} className={meldung.ok ? "text-akzent" : "text-red-500"}>
            {meldung.text}
          </p>
        )}
      </div>
    </Karte>
  );
}
