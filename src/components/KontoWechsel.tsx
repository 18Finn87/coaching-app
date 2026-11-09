"use client";

import { useState } from "react";
import { Karte } from "./Bausteine";
import type { Profil } from "@/lib/konto";
import {
  alleVergessen,
  gemerkteKonten,
  vergessen,
  wechselnZu,
  weiteresKontoHinzufuegen,
  type GemerktesKonto,
} from "@/lib/kontowechsel";

function beschriftung(k: GemerktesKonto) {
  return `${k.name || k.email}${k.rolle === "coach" ? " · Coach" : ""}`;
}

/** Liste gemerkter Konten zum Wechseln ohne Code (auch auf der Anmeldeseite). */
export function GemerkteKontenListe({ aktuell }: { aktuell: Profil | null }) {
  const [konten, setKonten] = useState(() => gemerkteKonten().filter((k) => k.id !== aktuell?.id));
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState("");

  async function wechseln(k: GemerktesKonto) {
    setLaeuft(k.id);
    setFehler("");
    const ok = await wechselnZu(k.id, aktuell);
    if (!ok) {
      setLaeuft(null);
      setKonten(gemerkteKonten().filter((x) => x.id !== aktuell?.id));
      setFehler(`Die Anmeldung von ${k.name || k.email} ist abgelaufen. Bitte melde dich dort einmal neu mit Code an.`);
    }
  }

  if (konten.length === 0 && !fehler) return null;
  return (
    <div className="flex flex-col gap-2">
      {konten.map((k) => (
        <div key={k.id} className="flex items-center gap-2">
          <button
            type="button"
            disabled={laeuft !== null}
            onClick={() => wechseln(k)}
            className="flex h-12 flex-1 items-center justify-between rounded-xl border border-rand px-3 text-left disabled:opacity-50"
          >
            <span className="truncate font-medium">{beschriftung(k)}</span>
            <span className="text-sm text-akzent">{laeuft === k.id ? "Wechselt …" : "Wechseln"}</span>
          </button>
          <button
            type="button"
            aria-label={`${beschriftung(k)} auf diesem Gerät vergessen`}
            title="Auf diesem Gerät vergessen"
            onClick={() => {
              vergessen(k.id);
              setKonten(gemerkteKonten().filter((x) => x.id !== aktuell?.id));
            }}
            className="h-12 w-12 shrink-0 rounded-xl border border-rand text-leise"
          >
            ✕
          </button>
        </div>
      ))}
      {fehler && (
        <p role="alert" className="text-sm text-red-500">
          {fehler}
        </p>
      )}
    </div>
  );
}

/** Profil: Konto wechseln / weiteres Konto hinzufügen. */
export function KontoWechsel({ profil }: { profil: Profil }) {
  const [laeuft, setLaeuft] = useState(false);
  const andere = gemerkteKonten().filter((k) => k.id !== profil.id);

  return (
    <Karte titel="Konto wechseln">
      <div className="flex flex-col gap-3">
        <GemerkteKontenListe aktuell={profil} />
        <button
          type="button"
          disabled={laeuft}
          onClick={async () => {
            setLaeuft(true);
            if (!(await weiteresKontoHinzufuegen(profil))) setLaeuft(false);
          }}
          className="h-11 rounded-xl border border-rand px-4 font-medium disabled:opacity-50"
        >
          Weiteres Konto hinzufügen
        </button>
        <p className="text-xs text-leise">
          Die App merkt sich dann beide Anmeldungen auf diesem Gerät. Du wechselst mit einem Tipp, ohne Code. Achtung:
          Wer dieses Gerät benutzt, kann das auch. Nutze das nur auf deinem eigenen, gesperrten Gerät.
        </p>
        {andere.length > 0 && (
          <button
            type="button"
            onClick={() => {
              alleVergessen();
              window.location.reload();
            }}
            className="self-start text-sm text-red-500 underline"
          >
            Alle gemerkten Konten vergessen
          </button>
        )}
      </div>
    </Karte>
  );
}
