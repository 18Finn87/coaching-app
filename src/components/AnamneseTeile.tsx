"use client";

import { FRAGEN, SONSTIGES_ID, wertText, type Antworten } from "@/lib/anamnese";

export function AerztlicherHinweis({ fuerCoach = false }: { fuerCoach?: boolean }) {
  return (
    <div className="rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-sm">
      <p className="font-medium">Vor dem Training ärztlich abklären</p>
      <p className="mt-1">
        {fuerCoach
          ? "Bei mindestens einer der Fragen 1–4 steht „Ja“. Vor dem Training sollte ärztlich abgeklärt sein, ob Krafttraining unbedenklich ist."
          : "Bei mindestens einer Frage steht „Ja“. Lass bitte von einer Ärztin oder einem Arzt abklären, ob Krafttraining für dich unbedenklich ist."}{" "}
        Das ist keine Diagnose, sondern eine übliche Vorsichtsmaßnahme.
      </p>
    </div>
  );
}

export function AntwortenListe({ antworten }: { antworten: Antworten }) {
  return (
    <dl className="flex flex-col gap-3 text-sm">
      {FRAGEN.map((f) => {
        const a = antworten[f.id];
        return (
          <div key={f.id}>
            <dt className="text-leise">{f.text}</dt>
            <dd className={a?.wert === "ja" ? "font-medium" : ""}>
              {a?.wert ? wertText[a.wert] : "–"}
              {a?.text && <span className="block whitespace-pre-wrap font-normal">„{a.text}“</span>}
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
