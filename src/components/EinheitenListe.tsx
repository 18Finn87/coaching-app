"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";
import { lokaleTrainings } from "@/lib/training";

type Zeile = {
  id: string;
  titel: string;
  status: string;
  gestartet_am: string;
  session_rpe: number | null;
  saetze: number;
  nichtHochgeladen?: boolean;
};

const statusText: Record<string, string> = { laeuft: "läuft", abgeschlossen: "abgeschlossen", abgebrochen: "abgebrochen" };

/** Liste der Trainingseinheiten einer Person (neueste zuerst). */
export function EinheitenListe({ athletId, mitLokalen = false, grenze = 50 }: { athletId: string; mitLokalen?: boolean; grenze?: number }) {
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    supabase()
      .from("trainingseinheiten")
      .select("id, titel, status, gestartet_am, session_rpe, ausgefuehrte_uebungen (ausgefuehrte_saetze (erledigt))")
      .eq("athlet_id", athletId)
      .order("gestartet_am", { ascending: false })
      .limit(grenze)
      .then(({ data, error }) => {
        type Roh = Omit<Zeile, "saetze"> & { ausgefuehrte_uebungen: { ausgefuehrte_saetze: { erledigt: boolean }[] }[] };
        const server: Zeile[] = ((data as unknown as Roh[] | null) ?? []).map((z) => ({
          id: z.id,
          titel: z.titel,
          status: z.status,
          gestartet_am: z.gestartet_am,
          session_rpe: z.session_rpe,
          saetze: z.ausgefuehrte_uebungen.reduce((n, u) => n + u.ausgefuehrte_saetze.filter((s) => s.erledigt).length, 0),
        }));
        let liste = server;
        if (mitLokalen) {
          const lokal = lokaleTrainings(athletId).filter((t) => t.ungespeichert && !server.some((s) => s.id === t.einheit.id));
          liste = [
            ...lokal.map((t) => ({
              id: t.einheit.id,
              titel: t.einheit.titel,
              status: t.einheit.status,
              gestartet_am: t.einheit.gestartet_am,
              session_rpe: t.einheit.session_rpe,
              saetze: t.einheit.uebungen.reduce((n, u) => n + u.saetze.filter((s) => s.erledigt).length, 0),
              nichtHochgeladen: true,
            })),
            ...server,
          ];
        }
        setFehler(!!error && !mitLokalen);
        setZeilen(liste);
      });
  }, [athletId, mitLokalen, grenze]);

  if (fehler) return <p role="alert">Die Einheiten konnten nicht geladen werden.</p>;
  if (zeilen === null) return <p className="text-leise">Lädt …</p>;
  if (zeilen.length === 0) return <p className="text-sm text-leise">Noch kein Training.</p>;

  return (
    <ul className="flex flex-col divide-y divide-rand">
      {zeilen.map((z) => (
        <li key={z.id}>
          <Link href={`/training/?id=${z.id}`} className="flex items-center justify-between gap-3 py-3">
            <span className="min-w-0">
              <span className="block truncate font-medium">{z.titel}</span>
              <span className="block text-sm text-leise">
                {datum(z.gestartet_am)} · {z.saetze} Sätze{z.session_rpe ? ` · RPE ${z.session_rpe}` : ""}
              </span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                z.nichtHochgeladen
                  ? "bg-amber-400/15 text-amber-600"
                  : z.status === "abgeschlossen"
                    ? "bg-akzent/15 text-akzent"
                    : "border border-rand text-leise"
              }`}
            >
              {z.nichtHochgeladen ? "noch nicht hochgeladen" : statusText[z.status]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
