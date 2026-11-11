"use client";

import { useRef, useState } from "react";
import { dauerText, kmText, pace, paceText } from "@/lib/ausdauer";
import { uhrDateiLesen, type UhrErgebnis } from "@/lib/uhrimport";

/**
 * Knopf „Datei von der Uhr“: liest eine GPX- oder FIT-Datei NUR auf dem Gerät,
 * zeigt die Werte zur Kontrolle und übernimmt sie erst nach Bestätigung.
 * Die Datei und die GPS-Punkte werden nicht gespeichert und nicht hochgeladen.
 */
export function UhrImport({ uebernehmen }: { uebernehmen: (e: UhrErgebnis) => void }) {
  const eingabe = useRef<HTMLInputElement>(null);
  const [ergebnis, setErgebnis] = useState<UhrErgebnis | null>(null);
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function gewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFehler("");
    setLaeuft(true);
    try {
      setErgebnis(await uhrDateiLesen(datei));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Die Datei konnte nicht gelesen werden.");
    } finally {
      setLaeuft(false);
      if (eingabe.current) eingabe.current.value = "";
    }
  }

  const p = ergebnis ? pace(ergebnis.dauer_sek, ergebnis.distanz_m) : null;

  return (
    <>
      <input
        ref={eingabe}
        type="file"
        accept=".gpx,.fit,application/gpx+xml,application/octet-stream"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => gewaehlt(e.target.files?.[0])}
      />
      <button
        type="button"
        aria-label="Datei von der Uhr einlesen (GPX oder FIT)"
        title="Datei von der Uhr (GPX/FIT)"
        disabled={laeuft}
        onClick={() => eingabe.current?.click()}
        className="h-12 shrink-0 rounded-xl border border-rand px-2 text-xs font-medium leading-tight disabled:opacity-50"
      >
        {laeuft ? "liest …" : (
          <>
            Uhr-
            <br />
            Datei
          </>
        )}
      </button>

      {(ergebnis || fehler) && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Werte aus der Uhr-Datei"
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
        >
          <div className="w-full max-w-md rounded-t-2xl bg-flaeche p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-xl sm:rounded-2xl">
            {fehler ? (
              <>
                <p role="alert" className="font-medium text-red-500">
                  {fehler}
                </p>
                <p className="mt-2 text-sm text-leise">
                  Tipp: In Garmin Connect, Polar Flow, Suunto, Coros oder Strava kannst du eine Aktivität als GPX- oder
                  FIT-Datei exportieren.
                </p>
                <button
                  type="button"
                  onClick={() => setFehler("")}
                  className="mt-4 h-12 w-full rounded-xl border border-rand font-medium"
                >
                  Schließen
                </button>
              </>
            ) : (
              ergebnis && (
                <>
                  <p className="text-lg font-semibold">Werte aus der {ergebnis.quelle.toUpperCase()}-Datei</p>
                  {ergebnis.start && (
                    <p className="text-sm text-leise">
                      aufgezeichnet am{" "}
                      {new Date(ergebnis.start).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {[
                      ["Dauer (in Bewegung)", ergebnis.dauer_sek != null ? `${dauerText(ergebnis.dauer_sek)} min` : "–"],
                      ["Strecke", kmText(ergebnis.distanz_m)],
                      ["Pace", paceText(p)],
                      ["Ø-Puls", ergebnis.puls_schnitt != null ? `${ergebnis.puls_schnitt} /min` : "nicht in der Datei"],
                      ["Höhenmeter", ergebnis.hoehenmeter != null ? `${ergebnis.hoehenmeter} m` : "–"],
                      ["volle km", String(ergebnis.splits.length)],
                    ].map(([titel, wert]) => (
                      <div key={titel} className="rounded-xl bg-background p-2">
                        <dt className="text-xs text-leise">{titel}</dt>
                        <dd className="font-semibold tabular-nums">{wert}</dd>
                      </div>
                    ))}
                  </dl>
                  {ergebnis.splits.length > 0 && (
                    <p className="mt-2 text-xs text-leise">
                      km-Zeiten: {ergebnis.splits.slice(0, 30).map((x) => dauerText(x)).join(" · ")}
                      {ergebnis.splits.length > 30 && " …"}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-leise">
                    Die Datei wurde nur auf diesem Gerät gelesen. Gespeichert werden nur diese Werte – keine GPS-Strecke und
                    keine Orte.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        uebernehmen(ergebnis);
                        setErgebnis(null);
                      }}
                      className="h-12 flex-1 rounded-xl bg-akzent font-semibold text-akzent-text"
                    >
                      Übernehmen
                    </button>
                    <button
                      type="button"
                      onClick={() => setErgebnis(null)}
                      className="h-12 flex-1 rounded-xl border border-rand font-medium"
                    >
                      Abbrechen
                    </button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}
    </>
  );
}
