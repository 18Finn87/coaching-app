"use client";

import { useState, type FormEvent } from "react";
import {
  geraetText,
  messartJeModul,
  messartText,
  modulText,
  musterJeModul,
  muskelText,
  musterText,
  uebungArchivieren,
  uebungSpeichern,
  type Uebung,
} from "@/lib/uebungen";

const feld =
  "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

/** Übung anlegen oder bearbeiten (nur Coach). */
export function UebungFormular({
  vorlage,
  fertig,
}: {
  vorlage: Uebung | null;
  fertig: (geaendert: boolean) => void;
}) {
  const [name, setName] = useState(vorlage?.name ?? "");
  const [modul, setModul] = useState(vorlage?.modul ?? "kraft");
  const [muster, setMuster] = useState(vorlage?.bewegungsmuster ?? "sonstiges");
  const [muskeln, setMuskeln] = useState<string[]>(vorlage?.muskelgruppen ?? []);
  const [geraete, setGeraete] = useState<string[]>(vorlage?.ausstattung ?? []);
  const [messart, setMessart] = useState(vorlage?.messart ?? "wdh_last");
  const [einseitig, setEinseitig] = useState(vorlage?.einseitig ?? false);
  const [seitenGetrennt, setSeitenGetrennt] = useState(vorlage?.seiten_getrennt ?? false);
  const [kleinerBesser, setKleinerBesser] = useState(vorlage?.kleiner_besser ?? false);
  const [e1rm, setE1rm] = useState(vorlage?.e1rm_geeignet ?? false);
  const [beschreibung, setBeschreibung] = useState(vorlage?.beschreibung ?? "");
  const [video, setVideo] = useState(vorlage?.video_link ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  const umschalten = (liste: string[], w: string) =>
    liste.includes(w) ? liste.filter((x) => x !== w) : [...liste, w];

  async function speichern(e: FormEvent) {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, " ");
    const v = video.trim();
    if (!n) {
      setFehler("Bitte gib einen Namen ein.");
      return;
    }
    if (v && !v.startsWith("https://")) {
      setFehler("Der Video-Link muss mit https:// beginnen.");
      return;
    }
    setLaeuft(true);
    setFehler("");
    const meldung = await uebungSpeichern(vorlage?.id ?? null, {
      name: n,
      modul,
      bewegungsmuster: muster,
      muskelgruppen: muskeln,
      ausstattung: geraete,
      einseitig,
      seiten_getrennt: einseitig && seitenGetrennt,
      kleiner_besser: messart === "umfang" && kleinerBesser,
      messart,
      e1rm_geeignet: modul === "kraft" && e1rm,
      beschreibung: beschreibung.trim(),
      video_link: v || null,
    });
    setLaeuft(false);
    if (meldung) {
      setFehler(meldung);
      return;
    }
    fertig(true);
  }

  async function archivUmschalten() {
    if (!vorlage) return;
    setLaeuft(true);
    const ok = await uebungArchivieren(vorlage.id, !vorlage.archiviert);
    setLaeuft(false);
    if (!ok) {
      setFehler("Das hat nicht geklappt.");
      return;
    }
    fertig(true);
  }

  return (
    <form onSubmit={speichern} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="u-name" className="text-sm font-medium">
          Name
        </label>
        <input id="u-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={feld} />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="u-modul" className="text-sm font-medium">
          Bereich
        </label>
        <select
          id="u-modul"
          value={modul}
          onChange={(e) => {
            const neu = e.target.value;
            setModul(neu);
            if (!musterJeModul[neu]?.includes(muster)) setMuster("sonstiges");
            // Bei neuen Übungen eine passende Messart vorschlagen
            if (!vorlage) setMessart(messartJeModul[neu] ?? "wdh_last");
          }}
          className={feld}
        >
          {Object.entries(modulText).map(([w, t]) => (
            <option key={w} value={w}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="u-muster" className="text-sm font-medium">
            Bewegungsmuster
          </label>
          <select id="u-muster" value={muster} onChange={(e) => setMuster(e.target.value)} className={feld}>
            {Object.entries(musterText)
              .filter(([w]) => w === muster || (musterJeModul[modul] ?? []).includes(w))
              .map(([w, t]) => (
                <option key={w} value={w}>
                  {t}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="u-messart" className="text-sm font-medium">
            Was wird eingetragen?
          </label>
          <select id="u-messart" value={messart} onChange={(e) => setMessart(e.target.value)} className={feld}>
            {Object.entries(messartText).map(([w, t]) => (
              <option key={w} value={w}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {messart === "umfang" && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={kleinerBesser}
            onChange={(e) => setKleinerBesser(e.target.checked)}
            className="mt-0.5 size-5 accent-akzent"
          />
          <span>
            Kleiner ist besser
            <span className="block text-xs text-leise">Zum Beispiel beim Finger-Boden-Abstand. Sonst gilt: größer ist besser.</span>
          </span>
        </label>
      )}

      <Chips titel="Muskelgruppen" optionen={muskelText} gewaehlt={muskeln} umschalten={(w) => setMuskeln(umschalten(muskeln, w))} />
      <Chips titel="Ausstattung" optionen={geraetText} gewaehlt={geraete} umschalten={(w) => setGeraete(umschalten(geraete, w))} />

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={einseitig} onChange={(e) => setEinseitig(e.target.checked)} className="size-5 accent-akzent" />
          Einseitig (pro Seite)
        </label>
        {einseitig && (
          <label className="ml-8 flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={seitenGetrennt}
              onChange={(e) => setSeitenGetrennt(e.target.checked)}
              className="mt-0.5 size-5 accent-akzent"
            />
            <span>
              Links und rechts getrennt eintragen
              <span className="block text-xs text-leise">Sinnvoll bei Mobilität und Reha, um Seitenunterschiede zu sehen.</span>
            </span>
          </label>
        )}
        {modul === "kraft" && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={e1rm} onChange={(e) => setE1rm(e.target.checked)} className="mt-0.5 size-5 accent-akzent" />
          <span>
            Für die 1RM-Schätzung geeignet
            <span className="block text-xs text-leise">Sinnvoll bei großen Grundübungen mit freiem Gewicht.</span>
          </span>
        </label>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="u-text" className="text-sm font-medium">
          Ausführung / Hinweise
        </label>
        <textarea
          id="u-text"
          rows={3}
          maxLength={2000}
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          className="w-full rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="u-video" className="text-sm font-medium">
          Video-Link (freiwillig)
        </label>
        <input
          id="u-video"
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={video}
          onChange={(e) => setVideo(e.target.value)}
          className={feld}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={laeuft}
          className="h-11 rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Speichert …" : "Speichern"}
        </button>
        <button type="button" onClick={() => fertig(false)} className="h-11 rounded-xl border border-rand px-4 font-medium">
          Abbrechen
        </button>
        {vorlage && (
          <button
            type="button"
            disabled={laeuft}
            onClick={archivUmschalten}
            className="h-11 rounded-xl border border-rand px-4 font-medium text-leise"
          >
            {vorlage.archiviert ? "Wiederherstellen" : "Archivieren"}
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

function Chips({
  titel,
  optionen,
  gewaehlt,
  umschalten,
}: {
  titel: string;
  optionen: Record<string, string>;
  gewaehlt: string[];
  umschalten: (w: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{titel}</legend>
      <div className="flex flex-wrap gap-2">
        {Object.entries(optionen).map(([w, t]) => (
          <label
            key={w}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${
              gewaehlt.includes(w) ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"
            }`}
          >
            <input type="checkbox" className="sr-only" checked={gewaehlt.includes(w)} onChange={() => umschalten(w)} />
            {t}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
