"use client";

import Link from "next/link";
import { AMPEL, neuAufnehmen, type AmpelEintrag, type Bewertung } from "@/lib/ampel";

/** Kleines Abzeichen: Farbe + Zeichen + Wort (nie nur Farbe) */
export function AmpelAbzeichen({ bewertung }: { bewertung: Bewertung }) {
  const a = AMPEL[bewertung];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${a.klasse}`}>
      <span aria-hidden>{a.symbol}</span>
      {a.text}
    </span>
  );
}

/**
 * Status des Übungsvideos direkt an der Übung (Kundenansicht).
 * Ohne Video: „noch nicht gesendet“. Orange/Rot: „Bitte neu aufnehmen“ mit Kommentar.
 */
export function AmpelAnUebung({
  uebungId,
  eintrag,
  mitAktion = true,
}: {
  uebungId: string;
  eintrag: AmpelEintrag | undefined;
  mitAktion?: boolean;
}) {
  if (!eintrag) {
    return (
      <p className="text-xs text-leise">
        <span aria-hidden>○ </span>Video: noch nicht gesendet
        {mitAktion && (
          <>
            {" · "}
            <Link href={`/videos/?uebung=${uebungId}`} className="text-akzent underline underline-offset-4">
              aufnehmen
            </Link>
          </>
        )}
      </p>
    );
  }
  const nochmal = neuAufnehmen(eintrag.bewertung);
  return (
    <div className="flex flex-col gap-1">
      <span className="flex flex-wrap items-center gap-2">
        <Link href={`/video/?id=${eintrag.analyseId}`} aria-label="Video ansehen">
          <AmpelAbzeichen bewertung={eintrag.bewertung} />
        </Link>
        {nochmal && <span className="text-xs font-medium">Bitte neu aufnehmen</span>}
      </span>
      {eintrag.kommentar && eintrag.bewertung !== "grau" && (
        <p className="text-xs text-leise">„{eintrag.kommentar}“</p>
      )}
      {nochmal && mitAktion && (
        <Link
          href={`/videos/?uebung=${uebungId}`}
          className="self-start rounded-lg border border-akzent px-2 py-1 text-xs font-medium text-akzent"
        >
          🎥 Neues Video aufnehmen
        </Link>
      )}
    </div>
  );
}
