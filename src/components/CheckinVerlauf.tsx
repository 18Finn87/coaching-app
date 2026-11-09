"use client";

import { useState } from "react";
import { regionText } from "@/lib/anamnese";
import {
  SKALA_KURZ,
  SKALEN,
  checkinAntworten,
  wocheText,
  type Checkin,
  type CheckinGesundheit,
} from "@/lib/coaching";

/**
 * Liste von Check-ins. Mit `alsCoach` kann der Coach antworten.
 * Den Gesundheitsteil liefert die Datenbank nur, wenn die Einwilligung gilt.
 */
export function CheckinVerlauf({
  checkins,
  gesundheit,
  alsCoach = false,
  antwortTitel = "Antwort deines Coaches",
  beiAntwort,
}: {
  checkins: Checkin[];
  gesundheit: Record<string, CheckinGesundheit>;
  alsCoach?: boolean;
  antwortTitel?: string;
  beiAntwort?: () => void;
}) {
  if (checkins.length === 0) return <p className="text-sm text-leise">Noch keine Check-ins.</p>;
  return (
    <ul className="flex flex-col divide-y divide-rand">
      {checkins.map((c) => (
        <li key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
          <p className="font-medium">{wocheText(c.woche)}</p>
          <dl className="grid grid-cols-5 gap-1 text-center">
            {SKALEN.map((s) => (
              <div key={s.feld} className="rounded-lg bg-background px-1 py-1.5">
                <dt className="truncate text-[11px] text-leise">{SKALA_KURZ[s.feld]}</dt>
                <dd className="text-base font-semibold tabular-nums">{c[s.feld]}</dd>
              </div>
            ))}
          </dl>
          {c.notiz && <p className="whitespace-pre-wrap text-sm">„{c.notiz}“</p>}
          <GesundheitZeile g={gesundheit[c.id]} />
          {alsCoach ? (
            <Antwort checkin={c} beiAntwort={beiAntwort} />
          ) : (
            c.coach_antwort && (
              <div className="rounded-xl bg-akzent/10 p-3">
                <p className="text-xs font-medium text-akzent">{antwortTitel}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.coach_antwort}</p>
              </div>
            )
          )}
        </li>
      ))}
    </ul>
  );
}

function GesundheitZeile({ g }: { g: CheckinGesundheit | undefined }) {
  if (!g) return null;
  return (
    <p className="rounded-lg border border-rand px-3 py-2 text-sm">
      <span className="text-leise">Geschützter Teil: </span>
      {g.schmerz_vorhanden
        ? `Schmerzen – ${regionText[g.koerperregion ?? ""] ?? "ohne Angabe"}, Stärke ${g.skala_0_10 ?? "–"}/10`
        : "keine Schmerzen"}
      {g.notiz && <span className="block whitespace-pre-wrap text-leise">„{g.notiz}“</span>}
    </p>
  );
}

function Antwort({ checkin, beiAntwort }: { checkin: Checkin; beiAntwort?: () => void }) {
  const [text, setText] = useState(checkin.coach_antwort);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState("");
  const geaendert = text.trim() !== checkin.coach_antwort;

  async function senden() {
    setLaeuft(true);
    const ok = await checkinAntworten(checkin.id, text);
    setLaeuft(false);
    setMeldung(ok ? "Gespeichert." : "Speichern hat nicht geklappt.");
    if (ok) beiAntwort?.();
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Deine Antwort
        <textarea
          value={text}
          maxLength={2000}
          rows={2}
          onChange={(e) => {
            setText(e.target.value);
            setMeldung("");
          }}
          className="w-full rounded-xl border border-rand bg-background px-3 py-2 text-base outline-none focus:border-akzent"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={laeuft || !geaendert}
          onClick={senden}
          className="h-10 rounded-xl bg-akzent px-4 text-sm font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Speichert …" : "Antwort speichern"}
        </button>
        {meldung && (
          <span role="status" className="text-sm text-leise">
            {meldung}
          </span>
        )}
      </div>
    </div>
  );
}
