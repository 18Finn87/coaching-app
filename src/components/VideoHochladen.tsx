"use client";

import { useRef, useState } from "react";
import { fehlerText, MAX_SEK, verkleinern, VideoFehler } from "@/lib/videoverkleinern";
import { mb, videoHochladen } from "@/lib/videos";

const feld = "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

/**
 * Video aufnehmen oder auswählen, auf dem Handy verkleinern und hochladen.
 * Ohne Ton, max. 30 Sekunden. Nur mit der Einwilligung „Videos“ der Person.
 */
export function VideoHochladen({
  athletId,
  uebungen,
  vorauswahl,
  fertig,
}: {
  athletId: string;
  uebungen: { id: string; name: string }[];
  vorauswahl?: string | null;
  fertig: (id: string) => void;
}) {
  const [datei, setDatei] = useState<File | null>(null);
  const [titel, setTitel] = useState("");
  const [uebung, setUebung] = useState(vorauswahl ?? "");
  const [schritt, setSchritt] = useState<null | "verkleinern" | "hochladen">(null);
  const [anteil, setAnteil] = useState(0);
  const [fehler, setFehler] = useState("");
  const aufnehmen = useRef<HTMLInputElement>(null);
  const galerie = useRef<HTMLInputElement>(null);

  async function los() {
    if (!datei) return;
    setFehler("");
    try {
      setSchritt("verkleinern");
      setAnteil(0);
      const v = await verkleinern(datei, setAnteil);
      setSchritt("hochladen");
      const r = await videoHochladen({
        athletId,
        blob: v.blob,
        mime: v.mime,
        dauer: v.dauer,
        breite: v.breite,
        hoehe: v.hoehe,
        titel,
        uebungId: uebung || null,
      });
      setSchritt(null);
      if (r.fehler || !r.id) {
        setFehler(r.fehler ?? "Das hat nicht geklappt.");
        return;
      }
      fertig(r.id);
    } catch (e) {
      setSchritt(null);
      setFehler(e instanceof VideoFehler ? fehlerText[e.grund] : "Das Video konnte nicht verarbeitet werden.");
    }
  }

  const auswahl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setDatei(f);
    setFehler("");
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={aufnehmen} type="file" accept="video/*" capture="environment" className="hidden" onChange={auswahl} />
      <input ref={galerie} type="file" accept="video/*" className="hidden" onChange={auswahl} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!!schritt} onClick={() => aufnehmen.current?.click()} className="h-12 rounded-xl border border-rand font-medium disabled:opacity-50">
          🎥 Aufnehmen
        </button>
        <button type="button" disabled={!!schritt} onClick={() => galerie.current?.click()} className="h-12 rounded-xl border border-rand font-medium disabled:opacity-50">
          Aus der Galerie
        </button>
      </div>
      <p className="text-xs text-leise">
        Höchstens {MAX_SEK} Sekunden. Die App verkleinert das Video vor dem Hochladen und entfernt den Ton.
      </p>

      {datei && (
        <>
          <p className="text-sm">
            Ausgewählt: {datei.name || "Video"} ({mb(datei.size)} MB)
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Titel (freiwillig)
            <input value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={120} placeholder="z. B. Kniebeuge von der Seite" className={feld} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Übung (für den Vergleich)
            <select value={uebung} onChange={(e) => setUebung(e.target.value)} className={feld}>
              <option value="">ohne Übung</option>
              {uebungen.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={!!schritt} onClick={los} className="h-12 rounded-xl bg-akzent font-semibold text-akzent-text disabled:opacity-60">
            {schritt === "verkleinern"
              ? `Wird verkleinert … ${Math.round(anteil * 100)} %`
              : schritt === "hochladen"
                ? "Wird hochgeladen …"
                : "Video hochladen"}
          </button>
          {schritt === "verkleinern" && (
            <p className="text-xs text-leise">Bitte die App offen lassen – das dauert etwa so lange wie das Video.</p>
          )}
        </>
      )}
      {fehler && (
        <p role="alert" className="text-sm text-red-500">
          {fehler}
        </p>
      )}
    </div>
  );
}
