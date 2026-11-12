"use client";

import { useCallback, useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { SkalaWahl } from "./SkalaWahl";
import { Klappkarte } from "./UeberDich";
import {
  heute,
  quelleText,
  SKALEN,
  spaeterGewaehlt,
  spaeterMerken,
  stundenLesen,
  tagesLaden,
  tagesSpeichern,
  type TagesCheckin,
  type Werte,
} from "@/lib/tagesabfrage";

const leer: Werte = { schlaf_stunden: null, schlaf_qualitaet: null, energie: null, muskelkater: null, stimmung: null };

/**
 * Tägliche Abfrage oben auf „Heute“. Erscheint offen, solange sie heute noch fehlt,
 * ist aber überspringbar („Später“). Danach eingeklappt mit „Erledigt ✓“, am selben
 * Tag änderbar.
 */
export function TagesAbfrage({ athletId }: { athletId: string }) {
  const [eintrag, setEintrag] = useState<TagesCheckin | null | undefined>(undefined);
  const [offen, setOffen] = useState(false);
  const [spaeter, setSpaeter] = useState(false);
  const [werte, setWerte] = useState<Werte>(leer);
  const [stunden, setStunden] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  const laden = useCallback(async () => {
    const liste = await tagesLaden(athletId, 1);
    if (liste === null) {
      setEintrag(null);
      setFehler("offline");
      return;
    }
    const e = liste.find((x) => x.datum === heute()) ?? null;
    setEintrag(e);
    if (e) {
      setWerte({ schlaf_stunden: e.schlaf_stunden, schlaf_qualitaet: e.schlaf_qualitaet, energie: e.energie, muskelkater: e.muskelkater, stimmung: e.stimmung });
      setStunden(e.schlaf_stunden == null ? "" : String(e.schlaf_stunden).replace(".", ","));
    } else {
      setSpaeter(spaeterGewaehlt());
      setOffen(!spaeterGewaehlt());
    }
  }, [athletId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  if (eintrag === undefined) return null;
  if (fehler === "offline")
    return null; // ohne Internet keine Abfrage – das Training geht trotzdem

  const h = stundenLesen(stunden);
  const stundenFehler = Number.isNaN(h);
  const etwas = h != null && !stundenFehler ? true : Object.values({ ...werte, schlaf_stunden: null }).some((x) => x != null);

  async function speichern() {
    if (stundenFehler) return;
    setLaeuft(true);
    setFehler("");
    const ok = await tagesSpeichern(eintrag ?? null, { ...werte, schlaf_stunden: h });
    setLaeuft(false);
    if (!ok) {
      setFehler("Speichern hat nicht geklappt. Bitte versuche es erneut.");
      return;
    }
    setOffen(false);
    laden();
  }

  const formular = (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Wie viele Stunden hast du geschlafen?</span>
        <input
          inputMode="decimal"
          value={stunden}
          onChange={(e) => setStunden(e.target.value)}
          placeholder="z. B. 7,5"
          aria-invalid={stundenFehler}
          className="h-12 w-32 rounded-xl border border-rand bg-background px-3 text-center text-lg outline-none focus:border-akzent"
        />
        {stundenFehler && <span className="text-xs text-red-500">Bitte eine Zahl zwischen 0 und 24.</span>}
        {eintrag?.quellen.schlaf_stunden && eintrag.quellen.schlaf_stunden !== "manuell" && (
          <span className="text-xs text-leise">aus {quelleText[eintrag.quellen.schlaf_stunden]} – du kannst den Wert überschreiben</span>
        )}
      </label>
      {SKALEN.map((s) => (
        <div key={s.feld}>
          <SkalaWahl
            name={`tag-${s.feld}`}
            frage={s.frage}
            links={s.links}
            rechts={s.rechts}
            wert={werte[s.feld]}
            beiWahl={(w) => setWerte({ ...werte, [s.feld]: werte[s.feld] === w ? null : w })}
          />
          {eintrag?.quellen[s.feld] && eintrag.quellen[s.feld] !== "manuell" && (
            <p className="mt-1 text-xs text-leise">aus {quelleText[eintrag.quellen[s.feld]!]}</p>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={laeuft || !etwas || stundenFehler}
          onClick={speichern}
          className="h-12 flex-1 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "…" : "Speichern"}
        </button>
        {!eintrag && (
          <button
            type="button"
            onClick={() => {
              spaeterMerken();
              setSpaeter(true);
              setOffen(false);
            }}
            className="h-12 rounded-xl border border-rand px-4 font-medium"
          >
            Später
          </button>
        )}
      </div>
      <p className="text-xs text-leise">Dauert 20 Sekunden. Nicht alles muss beantwortet werden. Ändern kannst du es heute noch.</p>
      {fehler && (
        <p role="alert" className="text-sm text-red-500">
          {fehler}
        </p>
      )}
    </div>
  );

  // Heute noch offen und nicht weggeklickt: gleich sichtbar
  if (!eintrag && !spaeter && offen) return <Karte titel="Wie geht's dir heute?">{formular}</Karte>;

  return (
    <Klappkarte
      id="tagesabfrage"
      titel="Tagesabfrage"
      status={eintrag ? "Erledigt ✓" : "Noch offen"}
      erledigt={!!eintrag}
      offen={offen}
      umschalten={() => setOffen(!offen)}
    >
      {formular}
    </Klappkarte>
  );
}
