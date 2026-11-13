"use client";

import { SONSTIGES_ID, wertText, type Antworten, type Wert } from "@/lib/anamnese";
import type { FrageDef } from "@/lib/fragebogen";

export function AerztlicherHinweis({ fuerCoach = false }: { fuerCoach?: boolean }) {
  return (
    <div className="rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-sm">
      <p className="font-medium">Vor dem Training ärztlich abklären</p>
      <p className="mt-1">
        {fuerCoach
          ? "Bei mindestens einer Frage mit ärztlichem Hinweis steht die entsprechende Antwort. Vor dem Training sollte ärztlich abgeklärt sein, ob Krafttraining unbedenklich ist."
          : "Bei mindestens einer Frage steht eine Antwort, die ärztlich abgeklärt werden sollte. Lass bitte von einer Ärztin oder einem Arzt abklären, ob Krafttraining für dich unbedenklich ist."}{" "}
        Das ist keine Diagnose, sondern eine übliche Vorsichtsmaßnahme.
      </p>
    </div>
  );
}

const antwortText = (f: FrageDef, wert: string | undefined) =>
  !wert ? "–" : f.typ === "janein" ? (wertText[wert as Wert] ?? wert) : wert;

/** Antworten zu genau den Fragen der Fassung, mit der sie ausgefüllt wurden */
export function AntwortenListe({ antworten, fragen }: { antworten: Antworten; fragen: FrageDef[] }) {
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {fragen.map((f) => {
        const a = antworten[f.id];
        const hervor = f.typ === "janein" ? a?.wert === "ja" : f.typ === "auswahl" ? (f.aerztlichBei ?? []).includes(a?.wert ?? "") : false;
        return (
          <div key={f.id}>
            <dt className="text-leise">{f.text}</dt>
            <dd className={hervor ? "font-medium" : ""}>
              {f.typ !== "text" && antwortText(f, a?.wert)}
              {a?.text && <span className="block whitespace-pre-wrap font-normal">„{a.text}“</span>}
              {f.typ === "text" && !a?.text && "–"}
            </dd>
          </div>
        );
      })}
      {antworten[SONSTIGES_ID]?.text && (
        <div>
          <dt className="text-leise">Sonstiges</dt>
          <dd className="whitespace-pre-wrap">{antworten[SONSTIGES_ID]?.text}</dd>
        </div>
      )}
    </dl>
  );
}
