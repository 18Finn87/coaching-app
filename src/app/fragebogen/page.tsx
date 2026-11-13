"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import {
  aktuellerFragebogen,
  fragebogenSpeichern,
  neueFrageId,
  pruefen,
  STANDARD_FRAGEBOGEN,
  TYP_TEXT,
  type FrageDef,
  type Fragebogen,
  type FrageTyp,
} from "@/lib/fragebogen";

export default function FragebogenSeite() {
  return (
    <NurFuer rolle="coach">
      <Seitentitel
        titel="Anamnese-Fragebogen"
        text="Hier legst du fest, welche Fragen deine Athletinnen und Athleten in der Anamnese beantworten."
      />
      <Bearbeiten />
    </NurFuer>
  );
}

const feld = "w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";
const knopf = "h-10 min-w-10 rounded-xl border border-rand px-3 text-sm disabled:opacity-30";

function Bearbeiten() {
  const [bogen, setBogen] = useState<Fragebogen | null>(null);
  const [fragen, setFragen] = useState<FrageDef[]>([]);
  const [geaendert, setGeaendert] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string[] } | null>(null);

  useEffect(() => {
    aktuellerFragebogen().then((b) => {
      setBogen(b);
      setFragen(b.fragen);
    });
  }, []);

  if (!bogen) return <p className="text-leise">Lädt …</p>;

  function aendern(neu: FrageDef[]) {
    setFragen(neu);
    setGeaendert(true);
    setMeldung(null);
  }
  const setzen = (i: number, teil: Partial<FrageDef>) => aendern(fragen.map((f, j) => (j === i ? { ...f, ...teil } : f)));
  function schieben(i: number, um: number) {
    const neu = [...fragen];
    [neu[i], neu[i + um]] = [neu[i + um], neu[i]];
    aendern(neu);
  }
  function typAendern(i: number, typ: FrageTyp) {
    // Neue Kennung: alte Antworten passen nicht zur neuen Art der Frage
    const f = fragen[i];
    setzen(i, { typ, id: neueFrageId(), optionen: typ === "auswahl" ? (f.optionen ?? ["", ""]) : f.optionen });
  }

  async function speichern() {
    const fehler = pruefen(fragen);
    if (fehler.length) {
      setMeldung({ ok: false, text: fehler });
      return;
    }
    setLaeuft(true);
    const version = await fragebogenSpeichern(fragen);
    setLaeuft(false);
    if (version === null) {
      setMeldung({ ok: false, text: ["Speichern hat nicht geklappt. Bitte versuche es erneut."] });
      return;
    }
    const b = await aktuellerFragebogen();
    setBogen(b);
    setFragen(b.fragen);
    setGeaendert(false);
    setMeldung({
      ok: true,
      text: [`Fassung ${version} ist gespeichert. Deine Athletinnen und Athleten sehen beim nächsten Öffnen der Anamnese den Hinweis auf neue Fragen.`],
    });
  }

  return (
    <>
      <Karte titel="So funktioniert es">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-leise">
          <li>
            {bogen.standard
              ? "Gerade gilt der eingebaute Standard-Fragebogen."
              : `Gerade gilt deine Fassung ${bogen.version}.`}
          </li>
          <li>Jedes Speichern legt eine neue Fassung an. Schon ausgefüllte Fragebögen bleiben mit ihren damaligen Fragen lesbar.</li>
          <li>Wenn du nur den Text einer Frage änderst, bleiben die bisherigen Antworten bei der Frage stehen.</li>
          <li>Freier Text ist immer freiwillig. Ja/Nein und Auswahl müssen beantwortet werden.</li>
        </ul>
      </Karte>

      {fragen.map((f, i) => (
        <Karte key={f.id} titel={`Frage ${i + 1}`}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              Fragetext
              <textarea rows={2} maxLength={500} value={f.text} onChange={(e) => setzen(i, { text: e.target.value })} className={`${feld} py-2`} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Art der Antwort
              <select value={f.typ} onChange={(e) => typAendern(i, e.target.value as FrageTyp)} className={`${feld} h-12 font-normal`}>
                {(Object.keys(TYP_TEXT) as FrageTyp[]).map((t) => (
                  <option key={t} value={t}>
                    {TYP_TEXT[t]}
                  </option>
                ))}
              </select>
            </label>

            {f.typ === "janein" && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Nachfrage bei „Ja“ (freiwillig, leer = keine)
                  <input
                    maxLength={200}
                    value={f.mitText ?? ""}
                    placeholder="z. B. Welche Medikamente?"
                    onChange={(e) => setzen(i, { mitText: e.target.value })}
                    className={`${feld} h-12 font-normal`}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!f.aerztlich} onChange={(e) => setzen(i, { aerztlich: e.target.checked })} className="size-5 accent-akzent" />
                  Bei „Ja“ Hinweis: ärztlich abklären
                </label>
              </>
            )}

            {f.typ === "auswahl" && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Antwortmöglichkeiten (eine pro Zeile)
                  <textarea
                    rows={4}
                    value={(f.optionen ?? []).join("\n")}
                    onChange={(e) => setzen(i, { optionen: e.target.value.split("\n").slice(0, 30) })}
                    className={`${feld} py-2 font-normal`}
                  />
                </label>
                {(f.optionen ?? []).some((o) => o.trim()) && (
                  <fieldset className="flex flex-col gap-1">
                    <legend className="mb-1 text-sm font-medium">Hinweis „ärztlich abklären“ bei:</legend>
                    {[...new Set((f.optionen ?? []).map((o) => o.trim()).filter(Boolean))].map((o) => (
                      <label key={o} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={(f.aerztlichBei ?? []).includes(o)}
                          onChange={(e) =>
                            setzen(i, {
                              aerztlichBei: e.target.checked
                                ? [...(f.aerztlichBei ?? []), o]
                                : (f.aerztlichBei ?? []).filter((x) => x !== o),
                            })
                          }
                          className="size-5 accent-akzent"
                        />
                        {o}
                      </label>
                    ))}
                  </fieldset>
                )}
              </>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" aria-label="Nach oben" disabled={i === 0} onClick={() => schieben(i, -1)} className={knopf}>
                ↑
              </button>
              <button type="button" aria-label="Nach unten" disabled={i === fragen.length - 1} onClick={() => schieben(i, 1)} className={knopf}>
                ↓
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Frage ${i + 1} entfernen? Bisherige Antworten darauf bleiben in den alten Fassungen erhalten.`))
                    aendern(fragen.filter((_, j) => j !== i));
                }}
                className={`${knopf} ml-auto text-red-500`}
              >
                Entfernen
              </button>
            </div>
          </div>
        </Karte>
      ))}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={fragen.length >= 60}
          onClick={() => aendern([...fragen, { id: neueFrageId(), typ: "janein", text: "" }])}
          className="h-12 rounded-xl border border-akzent px-4 font-semibold text-akzent disabled:opacity-50"
        >
          + Frage hinzufügen
        </button>
        <button
          type="button"
          disabled={laeuft || !geaendert}
          onClick={speichern}
          className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Speichert …" : "Neue Fassung speichern"}
        </button>
        {meldung && (
          <div role="status" className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
            {meldung.text.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (confirm("Alle Fragen auf den Standard-Fragebogen zurücksetzen? Gespeichert wird erst mit „Neue Fassung speichern“."))
              aendern(STANDARD_FRAGEBOGEN.fragen);
          }}
          className="text-sm text-leise underline"
        >
          Auf Standard-Fragebogen zurücksetzen
        </button>
        <Link href="/profil/" className="text-center text-sm text-leise underline">
          Zurück zum Profil
        </Link>
      </div>
    </>
  );
}
