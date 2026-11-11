"use client";

import Link from "next/link";
import { useId } from "react";
import { ueberGrenze } from "@/lib/reha";

/**
 * Schmerz 0–10 nach einer Reha-Übung (einmal pro Übung), freiwillig mit Anmerkung.
 * Nur mit Einwilligung zu Gesundheitsdaten. Über der Grenze erscheint ein Hinweis –
 * die App ändert nichts am Training.
 */
export function SchmerzAngabe({
  wert,
  notiz,
  grenze,
  einwilligung,
  aus,
  setzen,
}: {
  wert: number | null;
  notiz: string;
  grenze: number | null;
  einwilligung: boolean;
  aus: boolean;
  setzen: (wert: number | null, notiz: string) => void;
}) {
  const titelId = useId();
  if (!einwilligung) {
    return (
      <p className="mt-3 rounded-xl border border-rand p-3 text-xs text-leise">
        Hier kannst du angeben, ob die Übung schmerzt. Dafür brauchst du die Einwilligung zu Gesundheitsdaten – du findest
        sie im{" "}
        <Link href="/profil/" className="underline">
          Profil
        </Link>
        .
      </p>
    );
  }
  const zuViel = ueberGrenze(wert, grenze);
  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-rand p-3">
      <p id={titelId} className="text-sm font-medium">
        Schmerz bei dieser Übung (0 = keiner, 10 = stärkster)
        {grenze != null && <span className="ml-1 font-normal text-leise">· in Ordnung bis {grenze}</span>}
      </p>
      <div role="radiogroup" aria-labelledby={titelId} className="grid grid-cols-6 gap-1.5 sm:grid-cols-11">
        {Array.from({ length: 11 }, (_, n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={wert === n}
            disabled={aus}
            onClick={() => setzen(wert === n ? null : n, notiz)}
            className={`h-11 rounded-lg border text-base font-semibold disabled:opacity-60 ${
              wert === n
                ? ueberGrenze(n, grenze)
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-akzent bg-akzent text-akzent-text"
                : "border-rand"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {wert != null && (
        <input
          key={`notiz-${wert}`}
          aria-label="Anmerkung zum Schmerz (freiwillig)"
          placeholder="Anmerkung (freiwillig), z. B. wo es zieht"
          defaultValue={notiz}
          maxLength={500}
          disabled={aus}
          onBlur={(ev) => {
            const t = ev.target.value.trim();
            if (t !== notiz) setzen(wert, t);
          }}
          className="h-11 rounded-lg border border-rand bg-background px-3 text-sm outline-none focus:border-akzent"
        />
      )}
      {zuViel && (
        <p role="alert" className="rounded-lg border border-amber-500/60 bg-amber-500/10 p-2 text-sm">
          <span aria-hidden>⚠ </span>
          Über der Grenze, die dein Coach festgelegt hat. Bitte beende diese Übung und halte Rücksprache mit deinem Coach
          bzw. deiner Ärztin oder deinem Physiotherapeuten.
        </p>
      )}
      <p className="text-[11px] text-leise">
        Wird geschützt als Gesundheitsangabe gespeichert. Reha in der App ersetzt keine ärztliche oder
        physiotherapeutische Behandlung.
      </p>
    </div>
  );
}
