"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ablauf } from "@/lib/intervall";
import { zeitText } from "@/lib/plaene";
import { signal, wachHalten } from "@/lib/signal";
import type { TSatz } from "@/lib/training";

/**
 * Intervall-Timer im Vollbild: Vorbereitung, dann je Runde Belastung und Pause.
 * Zeit-Intervalle laufen automatisch; bei Strecken-Intervallen misst er die Zeit,
 * bis „Runde fertig“ getippt wird. Jede Runde wird sofort eingetragen und abgehakt.
 */
export function IntervallTimer({
  titel,
  runden,
  rundeFertig,
  schliessen,
}: {
  titel: string;
  runden: TSatz[];
  rundeFertig: (satzId: string, werte: Partial<TSatz>) => void;
  schliessen: () => void;
}) {
  // Nur Runden, die noch nicht abgehakt sind
  const offen = useMemo(() => runden.filter((r) => !r.erledigt), [runden.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const schritte = useMemo(() => ablauf(offen.map((r) => r.vorgabe)), [offen]);
  const [index, setIndex] = useState(0);
  const [beginn, setBeginn] = useState(() => Date.now());
  const [pausiert, setPausiert] = useState<number | null>(null);
  const [jetzt, setJetzt] = useState(() => Date.now());
  const piepte = useRef(-1);

  const schritt = schritte[index];
  const fertig = index >= schritte.length;

  useEffect(() => {
    let freigeben = () => {};
    wachHalten().then((f) => (freigeben = f));
    return () => freigeben();
  }, []);



  const vergangen = Math.max(0, ((pausiert ?? jetzt) - beginn) / 1000);
  const rest = schritt?.dauer != null ? Math.ceil(schritt.dauer - vergangen) : null;

  function weiter(gemessen?: number) {
    if (!schritt) return;
    if (schritt.typ === "belastung") {
      const r = offen[schritt.runde];
      const v = r.vorgabe;
      rundeFertig(r.id, {
        dauer_sek: gemessen != null ? Math.round(gemessen) : (v.dauer_sek ?? r.dauer_sek),
        distanz_m: v.distanz_m ?? r.distanz_m,
        erledigt: true,
      });
    }
    const naechster = index + 1;
    signal(naechster >= schritte.length ? "ende" : schritte[naechster].typ === "belastung" ? "lang" : "kurz");
    setIndex(naechster);
    setBeginn(Date.now());
    setJetzt(Date.now());
    piepte.current = -1;
  }

  // Takt: Anzeige erneuern, bei festen Zeiten automatisch weiter, die letzten 3 Sekunden kurz piepen
  const aktuell = useRef({ schritt, beginn, weiter });
  useEffect(() => {
    aktuell.current = { schritt, beginn, weiter };
  });
  useEffect(() => {
    if (fertig || pausiert !== null) return;
    const i = setInterval(() => {
      const z = aktuell.current;
      const nun = Date.now();
      setJetzt(nun);
      if (z.schritt?.dauer == null) return;
      const uebrig = Math.ceil(z.schritt.dauer - (nun - z.beginn) / 1000);
      if (uebrig <= 0) z.weiter();
      else if (uebrig <= 3 && piepte.current !== uebrig) {
        piepte.current = uebrig;
        signal("kurz");
      }
    }, 200);
    return () => clearInterval(i);
  }, [fertig, pausiert]);

  const farbe =
    schritt?.typ === "belastung" ? "bg-akzent text-akzent-text" : schritt?.typ === "pause" ? "bg-flaeche" : "bg-background";
  const ueberschrift = fertig
    ? "Geschafft!"
    : schritt.typ === "vorbereitung"
      ? "Gleich geht's los"
      : schritt.typ === "belastung"
        ? `Runde ${schritt.runde + 1} von ${offen.length}`
        : "Pause";
  const rundeInfo = schritt && schritt.typ !== "vorbereitung" ? offen[schritt.runde]?.vorgabe : null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Intervall-Timer: ${titel}`} className={`fixed inset-0 z-40 flex flex-col ${farbe}`}>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm opacity-80">{titel}</p>
        <p className="text-2xl font-semibold">{ueberschrift}</p>
        {!fertig && schritt.typ === "belastung" && rundeInfo && (
          <p className="opacity-80">
            {rundeInfo.distanz_m ? `${rundeInfo.distanz_m} m` : rundeInfo.dauer_sek ? zeitText(rundeInfo.dauer_sek) : ""}
          </p>
        )}
        {!fertig && schritt.typ === "pause" && schritte[index + 1] && (
          <p className="text-sm opacity-80">danach Runde {schritte[index + 1].runde + 1}</p>
        )}
        <p role="timer" aria-live="off" className="text-8xl font-semibold tabular-nums">
          {fertig ? "✓" : rest != null ? zeitText(Math.max(0, rest)) : zeitText(Math.floor(vergangen))}
        </p>
        {!fertig && schritt.typ === "belastung" && schritt.dauer == null && (
          <button
            type="button"
            onClick={() => weiter(vergangen)}
            className="h-20 w-full rounded-2xl bg-background text-2xl font-semibold text-foreground"
          >
            Runde fertig
          </button>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-md gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {fertig ? (
          <button type="button" onClick={schliessen} className="h-14 flex-1 rounded-xl bg-akzent text-lg font-semibold text-akzent-text">
            Schließen
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                if (pausiert === null) setPausiert(Date.now());
                else {
                  setBeginn(beginn + (Date.now() - pausiert));
                  setPausiert(null);
                }
              }}
              className="h-14 flex-1 rounded-xl border border-current/30 text-lg font-medium"
            >
              {pausiert === null ? "Anhalten" : "Weiter"}
            </button>
            {schritt.typ !== "belastung" && (
              <button type="button" onClick={() => weiter()} className="h-14 flex-1 rounded-xl border border-current/30 text-lg font-medium">
                Überspringen
              </button>
            )}
            <button type="button" onClick={schliessen} className="h-14 rounded-xl border border-current/30 px-4 text-lg">
              Ende
            </button>
          </>
        )}
      </div>
    </div>
  );
}
