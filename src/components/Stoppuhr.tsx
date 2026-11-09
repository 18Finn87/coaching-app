"use client";

import { useEffect, useRef, useState } from "react";
import { zeitText } from "@/lib/plaene";

/**
 * Stoppuhr für Zeitsätze. Mit Vorgabe läuft ein Countdown (danach zählt sie weiter,
 * falls jemand länger hält). Ohne Vorgabe zählt sie einfach hoch.
 * "Übernehmen" trägt die gemessenen Sekunden in den Satz ein.
 */
export function Stoppuhr({
  titel,
  ziel,
  fertig,
}: {
  titel: string;
  ziel: number | null;
  fertig: (sekunden: number | null) => void;
}) {
  const [start, setStart] = useState<number | null>(null);
  const [angehalten, setAngehalten] = useState<number | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const gemeldet = useRef(false);

  useEffect(() => {
    if (start === null || angehalten !== null) return;
    const i = setInterval(() => setJetzt(Date.now()), 200);
    return () => clearInterval(i);
  }, [start, angehalten]);

  const vergangen = start === null ? 0 : Math.floor(((angehalten ?? jetzt) - start) / 1000);
  const rest = ziel ? ziel - vergangen : null;
  const zielErreicht = rest !== null && rest <= 0;

  // Am Ende der Vorgabe: Vibration und kurzer Ton (einmal)
  useEffect(() => {
    if (!zielErreicht || gemeldet.current) return;
    gemeldet.current = true;
    try {
      navigator.vibrate?.([300, 100, 300]);
    } catch {
      // keine Vibration
    }
    try {
      const Kontext = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Kontext();
      const ton = ctx.createOscillator();
      const laut = ctx.createGain();
      ton.frequency.value = 880;
      laut.gain.value = 0.15;
      ton.connect(laut).connect(ctx.destination);
      ton.start();
      ton.stop(ctx.currentTime + 0.4);
      ton.onended = () => ctx.close();
    } catch {
      // kein Ton möglich
    }
  }, [zielErreicht]);

  const anzeige = rest !== null && rest > 0 ? zeitText(rest) : zeitText(vergangen);
  const knopf = "h-14 flex-1 rounded-xl text-lg font-semibold";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Stoppuhr: ${titel}`}
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="w-full max-w-md rounded-t-2xl bg-flaeche p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-xl sm:rounded-2xl">
        <p className="text-sm text-leise">{titel}</p>
        <p className="text-xs text-leise">
          {ziel ? `Vorgabe ${zeitText(ziel)} – ${rest !== null && rest > 0 ? "läuft rückwärts" : "geschafft, zählt weiter"}` : "zählt hoch"}
        </p>
        <p
          role="timer"
          aria-live="off"
          className={`my-4 text-center text-6xl font-semibold tabular-nums ${zielErreicht ? "text-akzent" : ""}`}
        >
          {anzeige}
        </p>
        <div className="flex gap-2">
          {start === null ? (
            <button type="button" onClick={() => setStart(Date.now())} className={`${knopf} bg-akzent text-akzent-text`}>
              Start
            </button>
          ) : angehalten === null ? (
            <button type="button" onClick={() => setAngehalten(Date.now())} className={`${knopf} bg-akzent text-akzent-text`}>
              Stopp
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  // weiterlaufen lassen: Startzeit um die Haltezeit verschieben
                  setStart(start + (Date.now() - angehalten));
                  setAngehalten(null);
                }}
                className={`${knopf} border border-rand`}
              >
                Weiter
              </button>
              <button type="button" onClick={() => fertig(vergangen)} className={`${knopf} bg-akzent text-akzent-text`}>
                {vergangen} s übernehmen
              </button>
            </>
          )}
        </div>
        <button type="button" onClick={() => fertig(null)} className="mt-3 h-11 w-full rounded-xl text-sm text-leise">
          Abbrechen
        </button>
      </div>
    </div>
  );
}
