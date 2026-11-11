"use client";

import { useEffect, useState } from "react";
import { satzText, satztypText, versionInhaltLaden, type Einheit } from "@/lib/plaene";

/** Zeigt eine Planversion zum Lesen (Coach und Athlet). */
export function PlanAnsicht({
  versionId,
  vorgeladen,
  aktion,
}: {
  versionId: string;
  /** Bereits geladener Inhalt (z. B. aus dem Speicher auf dem Handy) */
  vorgeladen?: Einheit[];
  /** Zusätzlicher Knopf pro Trainingstag, z. B. „Training starten“ */
  aktion?: (e: Einheit) => React.ReactNode;
}) {
  const [geladen, setGeladen] = useState<Einheit[] | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    if (vorgeladen) return;
    versionInhaltLaden(versionId).then(({ daten, fehler }) => {
      setFehler(fehler);
      setGeladen(daten);
    });
  }, [versionId, vorgeladen]);

  const einheiten = vorgeladen ?? geladen;
  if (fehler && !vorgeladen) return <p role="alert">Der Plan konnte nicht geladen werden.</p>;
  if (einheiten === null) return <p className="text-leise">Lädt …</p>;
  if (einheiten.length === 0) return <p className="text-leise">Dieser Plan ist leer.</p>;

  return (
    <div className="flex flex-col gap-4">
      {einheiten.map((e) => (
        <section key={e.id} className="rounded-2xl border border-rand bg-flaeche p-4">
          <h3 className="mb-2 text-lg font-semibold">{e.name}</h3>
          {e.notiz && <p className="mb-2 whitespace-pre-wrap text-sm text-leise">{e.notiz}</p>}
          <ol className="flex flex-col gap-3">
            {e.plan_uebungen.map((u) => (
              <li key={u.id}>
                <p className="font-medium">
                  {u.gruppe && <span className="mr-1 rounded bg-akzent/15 px-1.5 text-akzent">{u.gruppe}</span>}
                  {u.uebung?.name}
                  {u.uebung?.einseitig && <span className="ml-1 text-xs text-leise">(pro Seite)</span>}
                </p>
                {u.hinweis && <p className="text-sm text-leise">{u.hinweis}</p>}
                {u.schmerzgrenze != null && <p className="text-sm text-leise">Schmerz in Ordnung bis {u.schmerzgrenze} von 10</p>}
                <ul className="mt-1 flex flex-col gap-0.5 text-sm">
                  {u.plan_saetze.map((s) => (
                    <li key={s.id}>
                      <span className="text-leise">
                        {s.satznummer}.{s.satztyp !== "arbeit" ? ` ${satztypText[s.satztyp]}:` : ""}
                      </span>{" "}
                      {satzText(s, u.uebung?.messart)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
          {aktion && <div className="mt-3">{aktion(e)}</div>}
        </section>
      ))}
    </div>
  );
}
