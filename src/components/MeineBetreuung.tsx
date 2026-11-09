"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { supabase } from "@/lib/supabase";
import { statusText, stufeText } from "@/lib/texte";

type Betreuung = {
  status: string;
  erfahrungsstufe: string;
  coach: { anzeigename: string } | null;
};

/** Athletin / Athlet: wer betreut mich, welche Erfahrungsstufe hat der Coach eingestellt? */
export function MeineBetreuung({ athletId }: { athletId: string }) {
  const [b, setB] = useState<Betreuung | null | undefined>(undefined);

  useEffect(() => {
    supabase()
      .from("coach_athlet")
      .select("status, erfahrungsstufe, coach:profile!coach_id(anzeigename)")
      .eq("athlet_id", athletId)
      .neq("status", "beendet")
      .limit(1)
      .then(({ data }) => setB((data?.[0] as unknown as Betreuung | undefined) ?? null));
  }, [athletId]);

  return (
    <Karte titel="Deine Betreuung">
      {b === undefined && <p className="text-leise">Lädt …</p>}
      {b === null && <p className="text-leise">Du bist gerade keinem Coach zugeordnet.</p>}
      {b && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-leise">Coach</dt>
          <dd>{b.coach?.anzeigename || "–"}</dd>
          <dt className="text-leise">Erfahrungsstufe</dt>
          <dd>
            {stufeText[b.erfahrungsstufe]}
            <span className="block text-xs text-leise">legt dein Coach fest</span>
          </dd>
          <dt className="text-leise">Status</dt>
          <dd>{statusText[b.status]}</dd>
        </dl>
      )}
    </Karte>
  );
}
