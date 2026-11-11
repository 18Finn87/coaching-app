"use client";

import type { TSatz } from "@/lib/training";

const feld =
  "h-12 w-full min-w-0 rounded-xl border border-rand bg-background px-2 text-center text-lg outline-none focus:border-akzent disabled:opacity-70";

/** Eine Intervall-Runde: gemessene Zeit (s), Strecke (m), Ø-Puls (freiwillig), abhaken. */
export function IntervallRunde({
  satz,
  aus,
  setzen,
  abhaken,
  bearbeitbar,
}: {
  satz: TSatz;
  aus: boolean;
  setzen: (werte: Partial<TSatz>) => void;
  abhaken: () => void;
  bearbeitbar: boolean;
}) {
  const v = satz.vorgabe;
  function zahl(
    label: string,
    wert: number | null | undefined,
    grenzen: { min: number; max: number },
    platzhalter: string,
    schreiben: (w: number | null) => void,
  ) {
    return (
      <label className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[11px] text-leise">{label}</span>
        <input
          key={`${label}-${wert}`}
          inputMode="numeric"
          defaultValue={wert ?? ""}
          placeholder={platzhalter}
          disabled={aus}
          onBlur={(ev) => {
            const t = ev.target.value.trim();
            const n = t === "" ? null : Number(t.replace(",", "."));
            if (n !== null && (Number.isNaN(n) || !Number.isInteger(n) || n < grenzen.min || n > grenzen.max)) {
              ev.target.value = wert?.toString() ?? "";
              return;
            }
            if (n !== (wert ?? null)) schreiben(n);
          }}
          className={feld}
        />
      </label>
    );
  }
  return (
    <div className="flex items-end gap-2">
      {zahl("Zeit (s)", satz.dauer_sek, { min: 1, max: 86400 }, v.dauer_sek?.toString() ?? "", (w) => setzen({ dauer_sek: w }))}
      {zahl("Strecke (m)", satz.distanz_m, { min: 1, max: 100000 }, v.distanz_m?.toString() ?? "", (w) => setzen({ distanz_m: w }))}
      {zahl("Puls Ø", satz.puls_schnitt, { min: 30, max: 250 }, "", (w) => setzen({ puls_schnitt: w }))}
      <button
        type="button"
        disabled={!bearbeitbar}
        aria-pressed={satz.erledigt}
        aria-label={satz.erledigt ? `Runde ${satz.satznummer} erledigt – zurücknehmen` : `Runde ${satz.satznummer} abhaken`}
        onClick={abhaken}
        className={`h-12 w-12 shrink-0 rounded-xl text-xl font-bold ${
          satz.erledigt ? "bg-akzent text-akzent-text" : "border-2 border-rand text-leise"
        } disabled:opacity-60`}
      >
        ✓
      </button>
    </div>
  );
}
