"use client";

import { kmh, pace, paceText } from "@/lib/ausdauer";
import type { TSatz } from "@/lib/training";

const feld =
  "h-12 w-full min-w-0 rounded-xl border border-rand bg-background px-2 text-center text-lg outline-none focus:border-akzent disabled:opacity-70";

/** Eingabe einer Ausdauer-Einheit: Minuten, km, Ø-Puls, Anstrengung. Pace wird berechnet. */
export function AusdauerFelder({
  satz,
  aus,
  setzen,
  stoppuhr,
  abhaken,
  bearbeitbar,
}: {
  satz: TSatz;
  aus: boolean;
  setzen: (werte: Partial<TSatz>) => void;
  stoppuhr?: () => void;
  abhaken: () => void;
  bearbeitbar: boolean;
}) {
  const p = pace(satz.dauer_sek, satz.distanz_m);
  const v = kmh(satz.dauer_sek, satz.distanz_m);

  function zahl(
    label: string,
    wert: number | null | undefined,
    umrechnen: number,
    grenzen: { min: number; max: number; ganz?: boolean },
    platzhalter: string,
    schreiben: (w: number | null) => void,
  ) {
    const anzeige = wert == null ? "" : String(Math.round((wert / umrechnen) * 100) / 100).replace(".", ",");
    return (
      <label className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] text-leise">{label}</span>
        <input
          key={`${label}-${wert}`}
          inputMode={grenzen.ganz ? "numeric" : "decimal"}
          defaultValue={anzeige}
          placeholder={platzhalter}
          disabled={aus}
          onBlur={(ev) => {
            const text = ev.target.value.trim().replace(",", ".");
            const n = text === "" ? null : Number(text);
            if (n !== null && (Number.isNaN(n) || n < grenzen.min || n > grenzen.max || (grenzen.ganz && !Number.isInteger(n)))) {
              ev.target.value = anzeige;
              return;
            }
            const neu = n === null ? null : Math.round(n * umrechnen);
            if (neu !== (wert ?? null)) schreiben(neu);
          }}
          className={feld}
        />
      </label>
    );
  }

  const v0 = satz.vorgabe;
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {zahl("Min.", satz.dauer_sek, 60, { min: 0.1, max: 1440 }, v0.dauer_sek ? String(Math.round(v0.dauer_sek / 6) / 10) : "", (w) =>
          setzen({ dauer_sek: w }),
        )}
        {zahl("km", satz.distanz_m, 1000, { min: 0.01, max: 100 }, v0.distanz_m ? String(v0.distanz_m / 1000) : "", (w) =>
          setzen({ distanz_m: w }),
        )}
        {zahl("Puls Ø", satz.puls_schnitt, 1, { min: 30, max: 250, ganz: true }, "", (w) => setzen({ puls_schnitt: w }))}
        {zahl("Anstr.", satz.anstrengung, 1, { min: 1, max: 10, ganz: true }, "1–10", (w) => setzen({ anstrengung: w }))}
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-leise">
          {p ? (
            <>
              Pace <strong className="text-foreground">{paceText(p)}</strong> · {v?.toLocaleString("de-DE")} km/h
            </>
          ) : (
            "Pace erscheint, sobald Zeit und Strecke eingetragen sind."
          )}
        </span>
        {stoppuhr && (
          <button
            type="button"
            aria-label="Stoppuhr"
            onClick={stoppuhr}
            className="h-12 w-12 shrink-0 rounded-xl border border-rand text-lg"
          >
            ⏱
          </button>
        )}
        <button
          type="button"
          disabled={!bearbeitbar}
          aria-pressed={satz.erledigt}
          aria-label={satz.erledigt ? `Abschnitt ${satz.satznummer} erledigt – zurücknehmen` : `Abschnitt ${satz.satznummer} abhaken`}
          onClick={abhaken}
          className={`h-12 w-12 shrink-0 rounded-xl text-xl font-bold ${
            satz.erledigt ? "bg-akzent text-akzent-text" : "border-2 border-rand text-leise"
          } disabled:opacity-60`}
        >
          ✓
        </button>
      </div>
    </div>
  );
}
