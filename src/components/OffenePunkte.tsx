"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import {
  ART_TEXT,
  DRINGLICHKEIT,
  mitGesehen,
  offenePunkteLaden,
  punktGesehen,
  punktZiel,
  seitText,
  type OffenerPunkt,
} from "@/lib/offenePunkte";

export function DringlichkeitAbzeichen({ stufe }: { stufe: 1 | 2 | 3 }) {
  const d = DRINGLICHKEIT[stufe];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${d.klasse}`}>
      <span aria-hidden>{d.symbol}</span>
      {d.text}
    </span>
  );
}

export function PunktZeile({ p, mitName, erledigt }: { p: OffenerPunkt; mitName: boolean; erledigt: () => void }) {
  const [laeuft, setLaeuft] = useState(false);
  return (
    <li className="flex flex-col gap-1 py-2">
      <span className="flex flex-wrap items-center gap-2">
        <DringlichkeitAbzeichen stufe={p.dringlichkeit} />
        {mitName && <span className="font-medium">{p.name}</span>}
        <span className="text-sm text-leise">
          {ART_TEXT[p.art]} · {seitText(p.seit)}
        </span>
      </span>
      <span className="break-words text-sm">{p.titel}</span>
      <span className="flex gap-2">
        <Link href={punktZiel(p)} className="h-9 rounded-lg border border-rand px-3 text-sm font-medium leading-9">
          {p.art === "video" ? "Bewerten" : p.art === "nachricht" || p.art === "checkin" ? "Antworten" : "Öffnen"}
        </Link>
        {mitGesehen(p.art) && (
          <button
            type="button"
            disabled={laeuft}
            onClick={async () => {
              setLaeuft(true);
              if (await punktGesehen(p)) erledigt();
              setLaeuft(false);
            }}
            className="h-9 rounded-lg border border-rand px-3 text-sm font-medium disabled:opacity-50"
          >
            ✓ Gesehen
          </button>
        )}
      </span>
    </li>
  );
}

/** Alle offenen Punkte (Startseite) oder die einer Person (Personenseite) */
export function OffenePunkte({ athletId, titel = "Offene Punkte", grenze }: { athletId?: string; titel?: string; grenze?: number }) {
  const [liste, setListe] = useState<OffenerPunkt[] | null>(null);
  const [alle, setAlle] = useState(false);
  const laden = useCallback(async () => setListe(await offenePunkteLaden(athletId)), [athletId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  if (liste === null) return null;
  if (athletId && liste.length === 0) return null;
  const sichtbar = grenze && !alle ? liste.slice(0, grenze) : liste;
  return (
    <Karte titel={`${titel}${liste.length ? ` (${liste.length})` : ""}`}>
      {liste.length === 0 ? (
        <p className="text-sm text-leise">Alles erledigt – nichts ist offen.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-rand">
            {sichtbar.map((p) => (
              <PunktZeile key={`${p.art}-${p.bezug_id ?? p.athlet_id}`} p={p} mitName={!athletId} erledigt={laden} />
            ))}
          </ul>
          {grenze && liste.length > grenze && (
            <button type="button" onClick={() => setAlle(!alle)} className="mt-2 text-sm text-akzent underline underline-offset-4">
              {alle ? "Weniger zeigen" : `Alle ${liste.length} zeigen`}
            </button>
          )}
        </>
      )}
      <p className="mt-2 text-xs text-leise">
        Offen, bis du antwortest, bewertest oder „gesehen“ tippst. Nach 2 Tagen ohne Reaktion steigt ein Punkt eine Stufe.
      </p>
    </Karte>
  );
}
