"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { regelSpeichern, regelnLaden } from "@/lib/coaching";
import { STANDARD_REGELN, regelFuer, type Regel, type Stufe } from "@/lib/evaluation";

type Einstellbar = Exclude<Stufe, "anfaenger">;
const STUFEN: { stufe: Einstellbar; name: string }[] = [
  { stufe: "fortgeschritten", name: "Fortgeschrittene" },
  { stufe: "sehr_erfahren", name: "Sehr Erfahrene" },
];

/** Coach: wann eine Evaluation fällig wird. Anfänger fest, die anderen einstellbar. */
export function RegelEinstellung() {
  const [regeln, setRegeln] = useState<Record<Einstellbar, Regel>>({
    fortgeschritten: STANDARD_REGELN.fortgeschritten,
    sehr_erfahren: STANDARD_REGELN.sehr_erfahren,
  });
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    regelnLaden().then((r) =>
      setRegeln({ fortgeschritten: regelFuer("fortgeschritten", r), sehr_erfahren: regelFuer("sehr_erfahren", r) }),
    );
  }, []);

  async function speichern(stufe: Einstellbar, neu: Regel) {
    if (!Number.isInteger(neu.wochen) || neu.wochen < 1 || neu.wochen > 52 || !Number.isInteger(neu.einheiten) || neu.einheiten < 1 || neu.einheiten > 200) {
      setMeldung({ ok: false, text: "Bitte 1–52 Wochen und 1–200 Einheiten eingeben." });
      return;
    }
    const ok = await regelSpeichern(stufe, neu);
    setMeldung(ok ? { ok: true, text: "Gespeichert." } : { ok: false, text: "Speichern hat nicht geklappt." });
  }

  const feld = "h-11 w-20 rounded-xl border border-rand bg-background px-2 text-center text-base outline-none focus:border-akzent";

  return (
    <Karte titel="Evaluationen">
      <p className="mb-3 text-sm text-leise">
        Die App erinnert dich, wenn eine Evaluation fällig ist: nach so vielen Wochen oder Einheiten – je nachdem, was
        zuerst eintritt. Sie ändert nie selbst einen Plan.
      </p>
      <ul className="flex flex-col gap-3">
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">Anfänger</span>
          <span className="text-sm">
            4 Wochen oder 10 Einheiten <span className="text-leise">(fest)</span>
          </span>
        </li>
        {STUFEN.map(({ stufe, name }) => (
          <li key={stufe} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{name}</span>
            <span className="flex items-center gap-2 text-sm">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={52}
                aria-label={`${name}: Wochen`}
                value={regeln[stufe].wochen}
                onChange={(e) => setRegeln({ ...regeln, [stufe]: { ...regeln[stufe], wochen: Number(e.target.value) } })}
                onBlur={() => speichern(stufe, regeln[stufe])}
                className={feld}
              />
              Wochen oder
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={200}
                aria-label={`${name}: Einheiten`}
                value={regeln[stufe].einheiten}
                onChange={(e) => setRegeln({ ...regeln, [stufe]: { ...regeln[stufe], einheiten: Number(e.target.value) } })}
                onBlur={() => speichern(stufe, regeln[stufe])}
                className={feld}
              />
              Einheiten
            </span>
          </li>
        ))}
      </ul>
      {meldung && (
        <p role={meldung.ok ? "status" : "alert"} className={`mt-2 text-sm ${meldung.ok ? "text-akzent" : "text-red-500"}`}>
          {meldung.text}
        </p>
      )}
    </Karte>
  );
}
