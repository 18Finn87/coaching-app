"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Karte } from "./Bausteine";
import { stammdatenLaden, stammdatenSpeichern } from "@/lib/stammdaten";
import { ausstattungText, tagText, zielText } from "@/lib/texte";

const feld =
  "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

function zahlOderNull(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : NaN;
}

/** Athletin / Athlet: trainingsrelevante Angaben über sich selbst. */
export function StammdatenFormular({
  athletId,
  eingebettet = false,
  gespeichert,
}: {
  athletId: string;
  /** ohne eigene Karte, z. B. im Bereich „Über dich“ */
  eingebettet?: boolean;
  gespeichert?: () => void;
}) {
  const Rahmen = eingebettet ? EingebettetRahmen : Karte;
  const [geladen, setGeladen] = useState(false);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [geburtsjahr, setGeburtsjahr] = useState("");
  const [trainingSeit, setTrainingSeit] = useState("");
  const [ziele, setZiele] = useState<string[]>([]);
  const [zielTextFeld, setZielTextFeld] = useState("");
  const [tage, setTage] = useState<number[]>([]);
  const [minuten, setMinuten] = useState("");
  const [ausstattung, setAusstattung] = useState<string[]>([]);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    stammdatenLaden(athletId).then(({ daten, fehler }) => {
      setLadeFehler(fehler);
      if (daten) {
        setGeburtsjahr(daten.geburtsjahr?.toString() ?? "");
        setTrainingSeit(daten.training_seit?.toString() ?? "");
        setZiele(daten.ziele);
        setZielTextFeld(daten.ziel_text);
        setTage(daten.trainingstage);
        setMinuten(daten.einheit_minuten?.toString() ?? "");
        setAusstattung(daten.ausstattung);
      }
      setGeladen(true);
    });
  }, [athletId]);

  function umschalten<T>(liste: T[], wert: T): T[] {
    return liste.includes(wert) ? liste.filter((x) => x !== wert) : [...liste, wert];
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setMeldung(null);
    const jahr = zahlOderNull(geburtsjahr);
    const seit = zahlOderNull(trainingSeit);
    const min = zahlOderNull(minuten);
    const aktuell = new Date().getFullYear();
    if (jahr !== null && (Number.isNaN(jahr) || jahr < 1920 || jahr > 2015)) {
      setMeldung({ ok: false, text: "Bitte gib ein Geburtsjahr zwischen 1920 und 2015 ein." });
      return;
    }
    if (seit !== null && (Number.isNaN(seit) || seit < 1950 || seit > aktuell)) {
      setMeldung({ ok: false, text: `Bitte gib ein Jahr zwischen 1950 und ${aktuell} ein.` });
      return;
    }
    if (min !== null && (Number.isNaN(min) || min < 15 || min > 240)) {
      setMeldung({ ok: false, text: "Bitte gib eine Dauer zwischen 15 und 240 Minuten ein." });
      return;
    }
    setLaeuft(true);
    const ok = await stammdatenSpeichern(athletId, {
      geburtsjahr: jahr,
      training_seit: seit,
      ziele,
      ziel_text: zielTextFeld.trim(),
      trainingstage: [...tage].sort(),
      einheit_minuten: min,
      ausstattung,
    });
    setLaeuft(false);
    if (ok) gespeichert?.();
    setMeldung(
      ok
        ? { ok: true, text: "Gespeichert. Dein Coach sieht jetzt deine Angaben." }
        : { ok: false, text: "Speichern hat nicht geklappt. Bitte versuche es erneut." },
    );
  }

  if (!geladen) {
    return (
      <Rahmen titel="Über dich (Training)">
        <p className="text-leise">Lädt …</p>
      </Rahmen>
    );
  }

  return (
    <Rahmen titel="Über dich (Training)">
      {ladeFehler && (
        <p role="alert" className="mb-3 text-sm">
          Deine Angaben konnten nicht geladen werden.
        </p>
      )}
      <p className="mb-3 text-sm text-leise">
        Damit dein Coach deinen Plan passend erstellen kann. Gesundheitsangaben gehören nicht hierher –
        dafür gibt es die Anamnese.
      </p>
      <form onSubmit={speichern} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="sd-jahr" className="text-sm font-medium">
              Geburtsjahr
            </label>
            <input
              id="sd-jahr"
              inputMode="numeric"
              maxLength={4}
              value={geburtsjahr}
              onChange={(e) => setGeburtsjahr(e.target.value)}
              className={feld}
              placeholder="z. B. 1998"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="sd-seit" className="text-sm font-medium">
              Krafttraining seit
            </label>
            <input
              id="sd-seit"
              inputMode="numeric"
              maxLength={4}
              value={trainingSeit}
              onChange={(e) => setTrainingSeit(e.target.value)}
              className={feld}
              placeholder="Jahr, z. B. 2022"
            />
          </div>
        </div>

        <Auswahl
          titel="Deine Ziele"
          optionen={zielText}
          gewaehlt={ziele}
          umschalten={(w) => setZiele(umschalten(ziele, w))}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor="sd-ziel" className="text-sm font-medium">
            Ziel in deinen Worten (freiwillig)
          </label>
          <textarea
            id="sd-ziel"
            rows={3}
            maxLength={500}
            value={zielTextFeld}
            onChange={(e) => setZielTextFeld(e.target.value)}
            className="w-full rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">An welchen Tagen kannst du trainieren?</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((t) => (
              <label
                key={t}
                className={`flex h-11 w-12 cursor-pointer items-center justify-center rounded-xl border text-sm font-medium ${
                  tage.includes(t) ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={tage.includes(t)}
                  onChange={() => setTage(umschalten(tage, t))}
                />
                {tagText[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1">
          <label htmlFor="sd-min" className="text-sm font-medium">
            Zeit pro Einheit (Minuten)
          </label>
          <input
            id="sd-min"
            inputMode="numeric"
            maxLength={3}
            value={minuten}
            onChange={(e) => setMinuten(e.target.value)}
            className={feld}
            placeholder="z. B. 60"
          />
        </div>

        <Auswahl
          titel="Wo und womit trainierst du?"
          optionen={ausstattungText}
          gewaehlt={ausstattung}
          umschalten={(w) => setAusstattung(umschalten(ausstattung, w))}
        />

        <button
          type="submit"
          disabled={laeuft}
          className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Speichert …" : "Speichern"}
        </button>
        {meldung && (
          <p role="status" className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
            {meldung.text}
          </p>
        )}
      </form>
    </Rahmen>
  );
}

function Auswahl({
  titel,
  optionen,
  gewaehlt,
  umschalten,
}: {
  titel: string;
  optionen: Record<string, string>;
  gewaehlt: string[];
  umschalten: (wert: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{titel}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(optionen).map(([wert, text]) => (
          <label
            key={wert}
            className={`cursor-pointer rounded-full border px-3 py-2 text-sm ${
              gewaehlt.includes(wert) ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={gewaehlt.includes(wert)}
              onChange={() => umschalten(wert)}
            />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EingebettetRahmen({ titel, children }: { titel?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      {titel && <h3 className="mb-3 font-semibold">{titel}</h3>}
      {children}
    </div>
  );
}
