"use client";

import { useState, type FormEvent } from "react";
import { Karte } from "./Bausteine";
import { beschwerdeLoeschen, beschwerdeSpeichern, regionText, type Beschwerde } from "@/lib/anamnese";
import { datum } from "@/lib/texte";

const feld =
  "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

/** Beschwerden anzeigen; die Athletin / der Athlet kann sie auch pflegen. */
export function BeschwerdenListe({
  beschwerden,
  bearbeitbar,
  beiAenderung,
}: {
  beschwerden: Beschwerde[];
  bearbeitbar: boolean;
  beiAenderung?: () => void;
}) {
  const [bearbeiten, setBearbeiten] = useState<Beschwerde | "neu" | null>(null);
  const aktuell = beschwerden.filter((b) => !b.bis);
  const frueher = beschwerden.filter((b) => b.bis);

  return (
    <Karte titel="Beschwerden">
      {beschwerden.length === 0 && (
        <p className="text-sm text-leise">Keine Beschwerden eingetragen.</p>
      )}
      {aktuell.length > 0 && <Gruppe titel="Aktuell" liste={aktuell} bearbeitbar={bearbeitbar} waehlen={setBearbeiten} />}
      {frueher.length > 0 && <Gruppe titel="Abgeklungen" liste={frueher} bearbeitbar={bearbeitbar} waehlen={setBearbeiten} />}

      {bearbeitbar && bearbeiten === null && (
        <button
          type="button"
          onClick={() => setBearbeiten("neu")}
          className="mt-3 h-11 rounded-xl border border-rand px-4 font-medium"
        >
          + Beschwerde eintragen
        </button>
      )}
      {bearbeitbar && bearbeiten !== null && (
        <Formular
          key={bearbeiten === "neu" ? "neu" : bearbeiten.id}
          vorlage={bearbeiten === "neu" ? null : bearbeiten}
          fertig={() => {
            setBearbeiten(null);
            beiAenderung?.();
          }}
        />
      )}
    </Karte>
  );
}

function Gruppe({
  titel,
  liste,
  bearbeitbar,
  waehlen,
}: {
  titel: string;
  liste: Beschwerde[];
  bearbeitbar: boolean;
  waehlen: (b: Beschwerde) => void;
}) {
  return (
    <div className="mb-3">
      <h3 className="mb-1 text-sm font-medium text-leise">{titel}</h3>
      <ul className="flex flex-col divide-y divide-rand">
        {liste.map((b) => (
          <li key={b.id} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{regionText[b.koerperregion] ?? b.koerperregion}</p>
              {b.beschreibung && <p className="whitespace-pre-wrap">{b.beschreibung}</p>}
              <p className="text-leise">
                {b.seit ? `seit ${datum(b.seit)}` : "Beginn unbekannt"}
                {b.bis ? ` · bis ${datum(b.bis)}` : ""}
              </p>
            </div>
            {bearbeitbar && (
              <button
                type="button"
                onClick={() => waehlen(b)}
                className="shrink-0 text-sm text-akzent underline underline-offset-4"
              >
                Bearbeiten
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Formular({ vorlage, fertig }: { vorlage: Beschwerde | null; fertig: () => void }) {
  const [region, setRegion] = useState(vorlage?.koerperregion ?? "");
  const [text, setText] = useState(vorlage?.beschreibung ?? "");
  const [seit, setSeit] = useState(vorlage?.seit ?? "");
  const [bis, setBis] = useState(vorlage?.bis ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!region) {
      setFehler("Bitte wähle eine Körperregion.");
      return;
    }
    if (seit && bis && bis < seit) {
      setFehler("„Bis“ darf nicht vor „Seit“ liegen.");
      return;
    }
    setLaeuft(true);
    setFehler("");
    const ok = await beschwerdeSpeichern({
      id: vorlage?.id ?? null,
      koerperregion: region,
      beschreibung: text.trim().slice(0, 1000),
      seit: seit || null,
      bis: bis || null,
    });
    setLaeuft(false);
    if (!ok) {
      setFehler("Speichern hat nicht geklappt. Bitte versuche es erneut.");
      return;
    }
    fertig();
  }

  async function loeschen() {
    if (!vorlage) return;
    setLaeuft(true);
    const ok = await beschwerdeLoeschen(vorlage.id);
    setLaeuft(false);
    if (!ok) {
      setFehler("Löschen hat nicht geklappt.");
      return;
    }
    fertig();
  }

  return (
    <form onSubmit={speichern} className="mt-3 flex flex-col gap-3 rounded-xl border border-rand p-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="b-region" className="text-sm font-medium">
          Wo?
        </label>
        <select id="b-region" value={region} onChange={(e) => setRegion(e.target.value)} className={feld}>
          <option value="">Bitte wählen</option>
          {Object.entries(regionText).map(([w, t]) => (
            <option key={w} value={w}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="b-text" className="text-sm font-medium">
          Was merkst du, und wobei? (in deinen Worten)
        </label>
        <textarea
          id="b-text"
          rows={2}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="b-seit" className="text-sm font-medium">
            Seit
          </label>
          <input id="b-seit" type="date" value={seit} onChange={(e) => setSeit(e.target.value)} className={feld} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="b-bis" className="text-sm font-medium">
            Abgeklungen am
          </label>
          <input id="b-bis" type="date" value={bis} onChange={(e) => setBis(e.target.value)} className={feld} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={laeuft}
          className="h-11 rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
        >
          Speichern
        </button>
        <button type="button" onClick={fertig} className="h-11 rounded-xl border border-rand px-4 font-medium">
          Abbrechen
        </button>
        {vorlage && (
          <button
            type="button"
            disabled={laeuft}
            onClick={loeschen}
            className="h-11 rounded-xl border border-red-400/60 px-4 font-medium text-red-500"
          >
            Löschen
          </button>
        )}
      </div>
      {fehler && (
        <p role="alert" className="text-sm text-red-500">
          {fehler}
        </p>
      )}
    </form>
  );
}
