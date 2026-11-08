"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  TEXTVERSION,
  einwilligungsText,
  useEinwilligungen,
  type EinwilligungArt,
} from "@/lib/einwilligungen";

/** Zeigt einen Einwilligungstext übersichtlich an. */
export function EinwilligungsText({ art, coach }: { art: EinwilligungArt; coach: string }) {
  const text = einwilligungsText(art, coach || "(dein Coach)");
  return (
    <div className="flex flex-col gap-3">
      {text.abschnitte.map((a) => (
        <div key={a.titel}>
          <h3 className="font-medium">{a.titel}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-leise">
            {a.punkte.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-leise">Fassung {TEXTVERSION[art]}</p>
    </div>
  );
}

/**
 * Für Athletinnen und Athleten: Ohne gültige Einwilligung zur Nutzung
 * (in der aktuellen Fassung) geht es nicht weiter.
 */
export function Einwilligungspruefung({ children }: { children: React.ReactNode }) {
  const { liste, fehler, aktiv, neuLaden } = useEinwilligungen();

  if (fehler) {
    return (
      <Rahmen>
        <p role="alert">Deine Einwilligungen konnten nicht geladen werden. Bitte prüfe dein Internet.</p>
        <button
          type="button"
          onClick={() => neuLaden()}
          className="h-11 rounded-xl border border-rand px-4 font-medium"
        >
          Erneut versuchen
        </button>
      </Rahmen>
    );
  }
  if (liste === null) {
    return (
      <Rahmen>
        <p className="text-leise" role="status">
          Einen Moment …
        </p>
      </Rahmen>
    );
  }

  const nutzung = aktiv("nutzung");
  if (nutzung && nutzung.textversion === TEXTVERSION.nutzung) return <>{children}</>;
  return <Abfrage erneut={!!nutzung} />;
}

function Abfrage({ erneut }: { erneut: boolean }) {
  const { coachName, aktiv, erteilen, widerrufen } = useEinwilligungen();
  const [nutzungJa, setNutzungJa] = useState(false);
  const [gesundheitJa, setGesundheitJa] = useState(!!aktiv("gesundheitsdaten"));
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  async function weiter(e: FormEvent) {
    e.preventDefault();
    if (!nutzungJa) return;
    setLaeuft(true);
    setFehler("");
    // Eine ältere Fassung zuerst beenden, dann die neue erteilen
    const alt = aktiv("nutzung");
    if (alt && !(await widerrufen(alt.id))) {
      setLaeuft(false);
      setFehler("Speichern hat nicht geklappt. Bitte versuche es erneut.");
      return;
    }
    let ok = true;
    if (gesundheitJa && !aktiv("gesundheitsdaten")) ok = await erteilen("gesundheitsdaten");
    if (ok) ok = await erteilen("nutzung");
    setLaeuft(false);
    if (!ok) setFehler("Speichern hat nicht geklappt. Bitte versuche es erneut.");
  }

  const nutzungText = einwilligungsText("nutzung", coachName);
  const gesundheitText = einwilligungsText("gesundheitsdaten", coachName);

  return (
    <Rahmen>
      <p className="text-leise">
        {erneut
          ? "Wir haben die Hinweise zum Datenschutz überarbeitet. Bitte lies sie dir kurz durch und bestätige sie erneut."
          : "Willkommen! Bevor es losgeht: So geht die App mit deinen Daten um."}
      </p>

      <form onSubmit={weiter} className="flex flex-col gap-4">
        <section className="rounded-2xl border border-rand bg-flaeche p-4">
          <h2 className="mb-1 text-lg font-semibold">1. {nutzungText.titel}</h2>
          <p className="mb-3 text-sm font-medium text-akzent">Nötig, um die App zu nutzen</p>
          <EinwilligungsText art="nutzung" coach={coachName} />
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-rand p-3">
            <input
              type="checkbox"
              checked={nutzungJa}
              onChange={(e) => setNutzungJa(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-akzent"
            />
            <span className="text-sm">{nutzungText.bestaetigung}</span>
          </label>
        </section>

        <section className="rounded-2xl border border-rand bg-flaeche p-4">
          <h2 className="mb-1 text-lg font-semibold">2. {gesundheitText.titel}</h2>
          <p className="mb-3 text-sm font-medium text-leise">Freiwillig – kannst du auch später unter „Profil“ erteilen</p>
          <EinwilligungsText art="gesundheitsdaten" coach={coachName} />
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-rand p-3">
            <input
              type="checkbox"
              checked={gesundheitJa}
              disabled={!!aktiv("gesundheitsdaten")}
              onChange={(e) => setGesundheitJa(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-akzent"
            />
            <span className="text-sm">
              {aktiv("gesundheitsdaten") ? "Bereits erteilt." : gesundheitText.bestaetigung}
            </span>
          </label>
        </section>

        <button
          type="submit"
          disabled={!nutzungJa || laeuft}
          className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Speichert …" : "Weiter zur App"}
        </button>
        {fehler && (
          <p role="alert" className="text-sm text-red-500">
            {fehler}
          </p>
        )}
        <button
          type="button"
          onClick={() => supabase().auth.signOut()}
          className="text-sm text-leise underline underline-offset-4"
        >
          Nicht jetzt – abmelden
        </button>
      </form>
    </Rahmen>
  );
}

function Rahmen({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Datenschutz</h1>
      {children}
    </main>
  );
}
