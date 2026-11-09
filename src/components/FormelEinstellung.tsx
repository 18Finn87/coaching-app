"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { FORMELN, STANDARD_FORMEL, STANDARD_MAX_WDH, e1rm, type Formel } from "@/lib/e1rm";
import { supabase } from "@/lib/supabase";

/** Coach: Formel für das geschätzte 1RM wählen. Gilt für alle eigenen Athleten. */
export function FormelEinstellung({ coachId }: { coachId: string }) {
  const [formel, setFormel] = useState<Formel>(STANDARD_FORMEL);
  const [maxWdh, setMaxWdh] = useState(STANDARD_MAX_WDH);
  const [vorhanden, setVorhanden] = useState(false);
  const [meldung, setMeldung] = useState("");

  useEffect(() => {
    supabase()
      .from("coach_einstellungen")
      .select("e1rm_formel, e1rm_max_wdh")
      .eq("coach_id", coachId)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as { e1rm_formel: Formel; e1rm_max_wdh: number } | null;
        if (d) {
          setFormel(d.e1rm_formel);
          setMaxWdh(d.e1rm_max_wdh);
          setVorhanden(true);
        }
      });
  }, [coachId]);

  async function speichern(neueFormel: Formel, neuesMax: number) {
    setFormel(neueFormel);
    setMaxWdh(neuesMax);
    const sb = supabase();
    const werte = { e1rm_formel: neueFormel, e1rm_max_wdh: neuesMax };
    const { error } = vorhanden
      ? await sb.from("coach_einstellungen").update(werte).eq("coach_id", coachId)
      : await sb.from("coach_einstellungen").insert(werte);
    if (!error) setVorhanden(true);
    setMeldung(error ? "Speichern hat nicht geklappt." : "Gespeichert – alle Diagramme rechnen damit neu.");
  }

  const feld = "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

  return (
    <Karte titel="Geschätztes 1RM">
      <p className="mb-3 text-sm text-leise">
        Die App schätzt das 1RM aus Gewicht und Wiederholungen. Es bleibt immer eine Schätzung. Gespeichert wird nur die
        echte Leistung – wechselst du die Formel, rechnen alle Diagramme neu.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Formel
          <select value={formel} onChange={(e) => speichern(e.target.value as Formel, maxWdh)} className={feld}>
            {(Object.keys(FORMELN) as Formel[]).map((f) => (
              <option key={f} value={f}>
                {FORMELN[f].name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nur bis Wiederholungen
          <select value={maxWdh} onChange={(e) => speichern(formel, Number(e.target.value))} className={feld}>
            {[5, 6, 8, 10, 12, 15].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-leise">
        {FORMELN[formel].beschreibung}. Beispiel: 80 kg × 8 Wdh. ≈ {e1rm(80, 8, formel, 15)?.toLocaleString("de-DE")} kg.
      </p>
      {meldung && (
        <p role="status" className="mt-2 text-sm text-akzent">
          {meldung}
        </p>
      )}
    </Karte>
  );
}
