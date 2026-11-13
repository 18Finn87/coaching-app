"use client";

import { useEffect, useMemo, useState } from "react";
import { modulText, musterText, uebungenLaden, type Uebung } from "@/lib/uebungen";
import { useProfil } from "@/lib/konto";
import { supabase } from "@/lib/supabase";
import { EigeneUebungFormular } from "./EigeneUebung";

function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss");
}

/**
 * Übung aus der Bibliothek wählen (archivierte werden nicht angeboten).
 * Kunden können hier auch eine eigene Übung anlegen. Im Plan-Editor
 * (fuerPlanEinheit) zeigt sie dem Coach nur eigene Übungen genau dieser Person.
 */
export function UebungAuswahl({
  waehlen,
  abbrechen,
  fuerPlanEinheit,
}: {
  waehlen: (u: Uebung) => void;
  abbrechen: () => void;
  fuerPlanEinheit?: string;
}) {
  const profil = useProfil();
  const coach = profil.rolle === "coach";
  const [neu, setNeu] = useState(false);
  const [planAthlet, setPlanAthlet] = useState<string | null>(null);
  const [alle, setAlle] = useState<Uebung[] | null>(null);
  const [suche, setSuche] = useState("");
  const [modul, setModul] = useState("");

  useEffect(() => {
    uebungenLaden().then(({ daten }) => setAlle(daten.filter((u) => !u.archiviert)));
  }, []);
  useEffect(() => {
    if (!coach || !fuerPlanEinheit) return;
    supabase()
      .from("plan_einheiten")
      .select("planversion:planversionen (plan:plaene (athlet_id))")
      .eq("id", fuerPlanEinheit)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as unknown as { planversion: { plan: { athlet_id: string } | null } | null } | null;
        setPlanAthlet(d?.planversion?.plan?.athlet_id ?? null);
      });
  }, [coach, fuerPlanEinheit]);
  // Coach: eigene Übungen von Kunden nur im Plan genau dieser Person
  const sichtbar = (u: Uebung) => !coach || !u.privat_fuer || u.privat_fuer === planAthlet;

  const treffer = useMemo(() => {
    const s = normal(suche.trim());
    return (alle ?? [])
      .filter((u) => sichtbar(u) && (!s || normal(u.name).includes(s)) && (!modul || u.modul === modul))
      .slice(0, 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alle, suche, modul, planAthlet, coach]);
  const vorhandeneModule = [...new Set((alle ?? []).filter(sichtbar).map((u) => u.modul))];

  if (neu) {
    return (
      <div className="mt-2 rounded-xl border border-akzent/50 p-3">
        <p className="mb-3 font-medium">Eigene Übung anlegen</p>
        <EigeneUebungFormular
          athletId={profil.id}
          vorlage={null}
          vorhandene={alle ?? []}
          fertig={(u) => {
            setNeu(false);
            if (u) waehlen(u);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-akzent/50 p-3">
      <div className="flex gap-2">
        <input
          type="search"
          autoFocus
          aria-label="Übung suchen"
          placeholder="Übung suchen …"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent"
        />
        <button type="button" onClick={abbrechen} className="h-11 rounded-xl border border-rand px-3 text-sm font-medium">
          Abbrechen
        </button>
      </div>
      {vorhandeneModule.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bereich">
          {["", ...vorhandeneModule].map((m) => (
            <button
              key={m || "alle"}
              type="button"
              aria-pressed={modul === m}
              onClick={() => setModul(m)}
              className={`rounded-full border px-3 py-1 text-sm ${modul === m ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"}`}
            >
              {m ? (modulText[m] ?? m) : "Alle"}
            </button>
          ))}
        </div>
      )}
      {alle === null ? (
        <p className="text-sm text-leise">Lädt …</p>
      ) : (
        <ul className="flex max-h-72 flex-col divide-y divide-rand overflow-y-auto">
          {treffer.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => waehlen(u)} className="w-full py-2 text-left">
                <span className="block font-medium">
                  {u.name}
                  {u.privat_fuer && <span className="ml-2 text-xs font-normal text-leise">(eigene)</span>}
                </span>
                <span className="block text-xs text-leise">
                  {u.modul !== "kraft" && `${modulText[u.modul] ?? u.modul} · `}
                  {musterText[u.bewegungsmuster]}
                </span>
              </button>
            </li>
          ))}
          {treffer.length === 0 && <li className="py-2 text-sm text-leise">Nichts gefunden.</li>}
        </ul>
      )}
      {!coach && (
        <button type="button" onClick={() => setNeu(true)} className="h-11 rounded-xl border border-akzent px-3 text-sm font-medium text-akzent">
          + Eigene Übung anlegen
        </button>
      )}
    </div>
  );
}
