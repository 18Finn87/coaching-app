"use client";

import Link from "next/link";
import { useState } from "react";
import { Karte } from "./Bausteine";
import { AmpelAbzeichen } from "./Ampel";
import { AMPEL, bewerten, neuAufnehmen, type Bewertung } from "@/lib/ampel";
import { datum } from "@/lib/texte";

type Stand = { id: string; bewertung: Bewertung; bewertung_kommentar: string; bewertet_am: string | null; uebung_id: string | null };

/** Coach bewertet ein Video (Ampel + Kommentar); die Person sieht das Ergebnis. */
export function VideoBewertung({ analyse, alsCoach, geaendert }: { analyse: Stand; alsCoach: boolean; geaendert: () => void }) {
  const [wahl, setWahl] = useState<Bewertung>(analyse.bewertung);
  const [kommentar, setKommentar] = useState(analyse.bewertung_kommentar);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  if (!alsCoach) {
    if (analyse.bewertung === "grau")
      return (
        <Karte>
          <p className="text-sm">
            <AmpelAbzeichen bewertung="grau" /> <span className="ml-1 text-leise">Dein Coach hat das Video noch nicht bewertet.</span>
          </p>
        </Karte>
      );
    return (
      <Karte titel="Bewertung deines Coaches">
        <div className="flex flex-col gap-2">
          <span>
            <AmpelAbzeichen bewertung={analyse.bewertung} />
            {analyse.bewertet_am && <span className="ml-2 text-xs text-leise">{datum(analyse.bewertet_am)}</span>}
          </span>
          {analyse.bewertung_kommentar && <p className="whitespace-pre-wrap text-sm">„{analyse.bewertung_kommentar}“</p>}
          {neuAufnehmen(analyse.bewertung) && (
            <Link
              href={`/videos/${analyse.uebung_id ? `?uebung=${analyse.uebung_id}` : ""}`}
              className="self-start rounded-xl bg-akzent px-4 py-2 text-sm font-semibold text-akzent-text"
            >
              🎥 Bitte neu aufnehmen
            </Link>
          )}
        </div>
      </Karte>
    );
  }

  const nochmal = neuAufnehmen(wahl);
  async function speichern() {
    setLaeuft(true);
    setMeldung(null);
    const ok = await bewerten(analyse.id, wahl, kommentar);
    setLaeuft(false);
    setMeldung(ok ? { ok: true, text: wahl === "grau" ? "Bewertung zurückgenommen." : "Gespeichert – die Person bekommt einen Hinweis." } : { ok: false, text: "Das hat nicht geklappt." });
    if (ok) geaendert();
  }

  return (
    <Karte titel="Bewertung (Ampel)">
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Bewertung" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["gruen", "orange", "rot", "grau"] as Bewertung[]).map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={wahl === b}
              onClick={() => setWahl(b)}
              className={`flex h-12 items-center justify-center gap-1 rounded-xl border text-sm font-medium ${
                wahl === b ? AMPEL[b].klasse + " ring-2 ring-current" : "border-rand"
              }`}
            >
              <span aria-hidden>{AMPEL[b].symbol}</span>
              {b === "grau" ? "Noch offen" : AMPEL[b].text}
            </button>
          ))}
        </div>
        <label className="flex flex-col gap-1 text-sm font-medium">
          {nochmal ? "Was soll besser werden? (die Person sieht das)" : "Kommentar (freiwillig)"}
          <textarea
            value={kommentar}
            onChange={(e) => setKommentar(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder={nochmal ? "z. B. Knie stabil über dem Fuß halten, bitte von der Seite filmen" : ""}
            className="rounded-xl border border-rand bg-background p-3 text-base font-normal outline-none focus:border-akzent"
          />
        </label>
        <button
          type="button"
          disabled={laeuft || (nochmal && !kommentar.trim()) || (wahl === analyse.bewertung && kommentar.trim() === analyse.bewertung_kommentar)}
          onClick={speichern}
          className="h-11 self-start rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "…" : "Bewertung speichern"}
        </button>
        {nochmal && !kommentar.trim() && <p className="text-xs text-leise">Bei Orange und Rot bitte kurz sagen, was besser werden soll.</p>}
        {meldung && (
          <p role={meldung.ok ? "status" : "alert"} className={`text-sm ${meldung.ok ? "text-akzent" : "text-red-500"}`}>
            {meldung.text}
          </p>
        )}
        <p className="text-xs text-leise">Orange und Rot zeigen der Person „Bitte neu aufnehmen“ direkt an der Übung.</p>
      </div>
    </Karte>
  );
}
