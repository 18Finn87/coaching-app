"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { AerztlicherHinweis, AntwortenListe } from "@/components/AnamneseTeile";
import { BeschwerdenListe } from "@/components/BeschwerdenListe";
import {
  FRAGEN,
  SONSTIGES_ID,
  aerztlicherHinweis,
  anamneseListe,
  anamneseLoeschen,
  anamneseSpeichern,
  beschwerdeLoeschen,
  beschwerdenListe,
  gesundheitProtokoll,
  wertText,
  type AnamneseVersion,
  type Antworten,
  type Beschwerde,
  type ProtokollEintrag,
  type Wert,
} from "@/lib/anamnese";
import { useEinwilligungen } from "@/lib/einwilligungen";
import { useProfil } from "@/lib/konto";
import { datum } from "@/lib/texte";

export default function AnamneseSeite() {
  return (
    <NurFuer rolle="athlet">
      <Inhalt />
    </NurFuer>
  );
}

function Inhalt() {
  const profil = useProfil();
  const { aktiv } = useEinwilligungen();
  const einwilligung = !!aktiv("gesundheitsdaten");

  const [versionen, setVersionen] = useState<AnamneseVersion[] | null>(null);
  const [beschwerden, setBeschwerden] = useState<Beschwerde[]>([]);
  const [protokoll, setProtokoll] = useState<ProtokollEintrag[]>([]);
  const [ladeFehler, setLadeFehler] = useState(false);

  const laden = useCallback(async () => {
    const [a, b, p] = await Promise.all([
      anamneseListe(profil.id),
      beschwerdenListe(profil.id),
      gesundheitProtokoll(profil.id),
    ]);
    setLadeFehler(a.fehler || b.fehler || p.fehler);
    setVersionen(a.daten);
    setBeschwerden(b.daten);
    setProtokoll(p.daten);
  }, [profil.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const neueste = versionen?.[0];
  const hatDaten = !!neueste || beschwerden.length > 0;

  return (
    <>
      <Seitentitel
        titel="Gesundheit"
        text="Deine Angaben helfen deinem Coach, dein Training sicher zu planen. Die App stellt keine Diagnosen."
      />

      {!einwilligung && (
        <Karte>
          <p>
            Du hast der Speicherung von Gesundheitsangaben nicht zugestimmt
            {hatDaten ? " oder deine Zustimmung widerrufen" : ""}. Deshalb kannst du hier nichts
            eintragen{hatDaten ? ", und dein Coach sieht deine bisherigen Angaben nicht" : ""}.
          </p>
          <Link href="/profil/" className="mt-3 inline-block text-akzent underline underline-offset-4">
            Zur Einwilligung im Profil
          </Link>
        </Karte>
      )}

      {ladeFehler && (
        <Karte>
          <p role="alert">Deine Angaben konnten nicht vollständig geladen werden.</p>
        </Karte>
      )}

      {versionen === null ? (
        <p className="text-leise">Lädt …</p>
      ) : (
        <>
          {einwilligung ? (
            <Fragebogen
              key={neueste?.id ?? "neu"}
              neueste={neueste}
              beiGespeichert={laden}
            />
          ) : (
            neueste && <AntwortenAnzeige version={neueste} />
          )}

          <BeschwerdenListe
            beschwerden={beschwerden}
            bearbeitbar={einwilligung}
            beiAenderung={laden}
          />

          {protokoll.length > 0 && <Protokoll eintraege={protokoll} />}

          {hatDaten && (
            <AllesLoeschen
              beschwerden={beschwerden}
              beiGeloescht={laden}
            />
          )}
        </>
      )}
    </>
  );
}

function Fragebogen({
  neueste,
  beiGespeichert,
}: {
  neueste: AnamneseVersion | undefined;
  beiGespeichert: () => void;
}) {
  const [antworten, setAntworten] = useState<Antworten>(neueste?.antworten ?? {});
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  function setzen(id: string, teil: Partial<{ wert: Wert; text: string }>) {
    setAntworten((alt) => ({ ...alt, [id]: { ...alt[id], ...teil } }));
    setMeldung(null);
  }

  const offen = FRAGEN.filter((f) => !antworten[f.id]?.wert).length;

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (offen > 0) {
      setMeldung({ ok: false, text: `Bitte beantworte noch ${offen} Frage(n). „Keine Angabe“ ist auch möglich.` });
      return;
    }
    // Texte bereinigen; Freitext nur behalten, wo er gefragt ist
    const sauber: Antworten = {};
    for (const f of FRAGEN) {
      const a = antworten[f.id];
      const text = f.mitText && a?.wert === "ja" ? (a.text ?? "").trim().slice(0, 1000) : "";
      sauber[f.id] = text ? { wert: a!.wert, text } : { wert: a!.wert };
    }
    const sonst = (antworten[SONSTIGES_ID]?.text ?? "").trim().slice(0, 2000);
    if (sonst) sauber[SONSTIGES_ID] = { text: sonst };

    setLaeuft(true);
    const version = await anamneseSpeichern(sauber);
    setLaeuft(false);
    if (version === null) {
      setMeldung({ ok: false, text: "Speichern hat nicht geklappt. Bitte versuche es erneut." });
      return;
    }
    setMeldung({ ok: true, text: `Gespeichert (Fassung ${version}). Dein Coach sieht jetzt deine Angaben.` });
    beiGespeichert();
  }

  return (
    <Karte titel="Anamnese">
      <p className="mb-4 text-sm text-leise">
        {neueste
          ? `Zuletzt gespeichert am ${datum(neueste.erstellt_am)} (Fassung ${neueste.version}). Wenn sich etwas ändert, passe es an und speichere neu – frühere Fassungen bleiben erhalten.`
          : "Bitte beantworte die Fragen ehrlich. Bei jeder Frage kannst du auch „Keine Angabe“ wählen."}
      </p>
      <form onSubmit={speichern} className="flex flex-col gap-5">
        {FRAGEN.map((f, i) => {
          const a = antworten[f.id];
          return (
            <fieldset key={f.id} className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                {i + 1}. {f.text}
              </legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(wertText) as Wert[]).map((w) => (
                  <label
                    key={w}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-sm ${
                      a?.wert === w ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"
                    }`}
                  >
                    <input
                      type="radio"
                      name={f.id}
                      className="sr-only"
                      checked={a?.wert === w}
                      onChange={() => setzen(f.id, { wert: w })}
                    />
                    {wertText[w]}
                  </label>
                ))}
              </div>
              {f.mitText && a?.wert === "ja" && (
                <textarea
                  aria-label={f.mitText}
                  placeholder={f.mitText}
                  rows={2}
                  maxLength={1000}
                  value={a.text ?? ""}
                  onChange={(e) => setzen(f.id, { text: e.target.value })}
                  className="w-full rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
                />
              )}
            </fieldset>
          );
        })}

        <div className="flex flex-col gap-1">
          <label htmlFor="sonstiges" className="text-sm font-medium">
            Gibt es sonst etwas, das dein Coach wissen sollte? (freiwillig)
          </label>
          <textarea
            id="sonstiges"
            rows={3}
            maxLength={2000}
            value={antworten[SONSTIGES_ID]?.text ?? ""}
            onChange={(e) => setzen(SONSTIGES_ID, { text: e.target.value })}
            className="w-full rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
          />
        </div>

        {aerztlicherHinweis(antworten) && <AerztlicherHinweis />}

        <button
          type="submit"
          disabled={laeuft}
          className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Speichert …" : neueste ? "Neue Fassung speichern" : "Speichern"}
        </button>
        {meldung && (
          <p role="status" className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
            {meldung.text}
          </p>
        )}
      </form>
    </Karte>
  );
}

function AntwortenAnzeige({ version }: { version: AnamneseVersion }) {
  return (
    <Karte titel="Anamnese">
      <p className="mb-3 text-sm text-leise">
        Fassung {version.version} vom {datum(version.erstellt_am)} – nur für dich sichtbar.
      </p>
      <AntwortenListe antworten={version.antworten} />
    </Karte>
  );
}

const aktionText: Record<string, string> = { insert: "angelegt", update: "geändert", delete: "gelöscht" };
const tabelleText: Record<string, string> = { anamnese: "Anamnese", beschwerden: "Beschwerde" };

function Protokoll({ eintraege }: { eintraege: ProtokollEintrag[] }) {
  const [offen, setOffen] = useState(false);
  return (
    <Karte titel="Änderungsprotokoll">
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen(!offen)}
        className="text-sm text-akzent underline underline-offset-4"
      >
        {offen ? "Ausblenden" : `${eintraege.length} Einträge anzeigen`}
      </button>
      {offen && (
        <ul className="mt-3 flex flex-col gap-1 text-sm">
          {eintraege.map((e, i) => (
            <li key={i} className="text-leise">
              {new Date(e.zeitpunkt).toLocaleString("de-DE")} · {tabelleText[e.tabelle] ?? e.tabelle}{" "}
              {aktionText[e.aktion] ?? e.aktion}
              {e.durch_selbst ? " (von dir)" : ""}
            </li>
          ))}
        </ul>
      )}
    </Karte>
  );
}

function AllesLoeschen({
  beschwerden,
  beiGeloescht,
}: {
  beschwerden: Beschwerde[];
  beiGeloescht: () => void;
}) {
  const [fragen, setFragen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  async function loeschen() {
    setLaeuft(true);
    setFehler("");
    let ok = await anamneseLoeschen();
    for (const b of beschwerden) ok = (await beschwerdeLoeschen(b.id)) && ok;
    setLaeuft(false);
    setFragen(false);
    if (!ok) setFehler("Nicht alles konnte gelöscht werden. Bitte versuche es erneut.");
    beiGeloescht();
  }

  return (
    <Karte titel="Gesundheitsangaben löschen">
      {!fragen ? (
        <button
          type="button"
          onClick={() => setFragen(true)}
          className="h-11 rounded-xl border border-red-400/60 px-4 font-medium text-red-500"
        >
          Alle Gesundheitsangaben löschen
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-red-400/50 bg-red-500/10 p-3">
          <p className="text-sm">
            Das löscht deine Anamnese mit allen Fassungen und alle Beschwerden endgültig. Das kann nicht
            rückgängig gemacht werden. Im Protokoll bleibt nur vermerkt, dass gelöscht wurde.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={laeuft}
              onClick={loeschen}
              className="h-11 rounded-xl bg-red-600 px-4 font-medium text-white disabled:opacity-50"
            >
              {laeuft ? "Löscht …" : "Ja, endgültig löschen"}
            </button>
            <button
              type="button"
              onClick={() => setFragen(false)}
              className="h-11 rounded-xl border border-rand px-4 font-medium"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {fehler && (
        <p role="alert" className="mt-2 text-sm text-red-500">
          {fehler}
        </p>
      )}
    </Karte>
  );
}
