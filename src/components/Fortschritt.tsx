"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Karte } from "./Bausteine";
import { Liniendiagramm } from "./Liniendiagramm";
import { auswerten, type AEinheit } from "@/lib/auswertung";
import { FORMELN, STANDARD_FORMEL, STANDARD_MAX_WDH, type Formel } from "@/lib/e1rm";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";

type Maxtest = { id: string; uebung_id: string; datum: string; last_kg: number; wdh: number; notiz: string; erfasst_von: string | null };

const zahl = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

/** Fortschritt einer Person: e1RM (Schätzung), Gewicht, Volumen, Vorgabe vs. Leistung, Maximaltests. */
export function Fortschritt({ athletId, ichId }: { athletId: string; ichId: string }) {
  const [einheiten, setEinheiten] = useState<AEinheit[] | null>(null);
  const [geeignet, setGeeignet] = useState<Set<string>>(new Set());
  const [formel, setFormel] = useState<Formel>(STANDARD_FORMEL);
  const [maxWdh, setMaxWdh] = useState(STANDARD_MAX_WDH);
  const [tests, setTests] = useState<Maxtest[]>([]);
  const [auswahl, setAuswahl] = useState<string>("");
  const [fehler, setFehler] = useState(false);

  const laden = useCallback(async () => {
    const sb = supabase();
    const [e, u, k, m] = await Promise.all([
      sb
        .from("trainingseinheiten")
        .select(
          "id, gestartet_am, ausgefuehrte_uebungen (uebung_id, uebung_name, ausgefuehrte_saetze (satztyp, erledigt, wdh, last_kg, vorgabe))",
        )
        .eq("athlet_id", athletId)
        .eq("status", "abgeschlossen")
        .order("gestartet_am", { ascending: true })
        .limit(500),
      sb.from("uebungen").select("id, e1rm_geeignet").eq("e1rm_geeignet", true),
      sb.from("coach_einstellungen").select("e1rm_formel, e1rm_max_wdh").limit(1).maybeSingle(),
      sb
        .from("maxtests")
        .select("id, uebung_id, datum, last_kg, wdh, notiz, erfasst_von")
        .eq("athlet_id", athletId)
        .order("datum"),
    ]);
    if (e.error) {
      setFehler(true);
      return;
    }
    type Roh = { id: string; gestartet_am: string; ausgefuehrte_uebungen: { uebung_id: string; uebung_name: string; ausgefuehrte_saetze: AEinheit["uebungen"][0]["saetze"] }[] };
    setEinheiten(
      ((e.data as unknown as Roh[]) ?? []).map((x) => ({
        id: x.id,
        gestartet_am: x.gestartet_am,
        uebungen: x.ausgefuehrte_uebungen.map((au) => ({
          uebung_id: au.uebung_id,
          uebung_name: au.uebung_name,
          saetze: au.ausgefuehrte_saetze,
        })),
      })),
    );
    setGeeignet(new Set(((u.data as { id: string }[] | null) ?? []).map((x) => x.id)));
    const einst = k.data as { e1rm_formel: Formel; e1rm_max_wdh: number } | null;
    if (einst) {
      setFormel(einst.e1rm_formel);
      setMaxWdh(einst.e1rm_max_wdh);
    }
    setTests(((m.data as Maxtest[] | null) ?? []).map((t) => ({ ...t, last_kg: Number(t.last_kg) })));
  }, [athletId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const verlauf = useMemo(
    () => (einheiten ? auswerten(einheiten, (id) => geeignet.has(id), formel, maxWdh) : []),
    [einheiten, geeignet, formel, maxWdh],
  );

  if (fehler) return <p role="alert">Die Trainingsdaten konnten nicht geladen werden.</p>;
  if (einheiten === null) return <p className="text-leise">Lädt …</p>;
  if (verlauf.length === 0) {
    return (
      <Karte>
        <p className="text-leise">Noch keine abgeschlossenen Trainings – hier erscheint dann der Fortschritt.</p>
      </Karte>
    );
  }

  const gewaehlt = verlauf.find((v) => v.uebungId === auswahl) ?? verlauf[0];
  const p = gewaehlt.punkte;
  const testsHier = tests.filter((t) => t.uebung_id === gewaehlt.uebungId);
  const letzter = p[p.length - 1];

  return (
    <div className="flex flex-col gap-4">
      <Karte>
        <label htmlFor="fs-uebung" className="mb-1 block text-sm font-medium">
          Übung
        </label>
        <select
          id="fs-uebung"
          value={gewaehlt.uebungId}
          onChange={(e) => setAuswahl(e.target.value)}
          className="h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent"
        >
          {verlauf.map((v) => (
            <option key={v.uebungId} value={v.uebungId}>
              {v.name} ({v.punkte.length}×)
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-leise">
          {p.length} {p.length === 1 ? "Training" : "Trainings"} · zuletzt am {datum(letzter.datum)} ·{" "}
          {letzter.saetze} Sätze
          {letzter.vorgabeGesamt > 0 && ` · Vorgabe in ${letzter.vorgabeErreicht} von ${letzter.vorgabeGesamt} Sätzen erreicht`}
        </p>
      </Karte>

      {gewaehlt.e1rmGeeignet && (
        <Karte>
          <Liniendiagramm
            titel="Geschätztes 1RM"
            einheit="kg"
            hinweis={`Schätzung nach ${FORMELN[formel].name} aus dem besten Satz bis ${maxWdh} Wdh. – kein gemessener Wert.`}
            punkte={p.filter((x) => x.e1rm != null).map((x) => ({ datum: x.datum, wert: x.e1rm! }))}
            markierungen={testsHier.filter((t) => t.wdh === 1).map((t) => ({ datum: t.datum, wert: t.last_kg, text: "getestet" }))}
            linienName="geschätzt"
            markierungsName="getestetes 1RM"
          />
        </Karte>
      )}

      {p.some((x) => x.topKg != null) && (
        <Karte>
          <Liniendiagramm
            titel="Höchstes Gewicht"
            einheit="kg"
            hinweis="Schwerster abgehakter Arbeitssatz pro Training."
            punkte={p.filter((x) => x.topKg != null).map((x) => ({ datum: x.datum, wert: x.topKg! }))}
          />
        </Karte>
      )}

      {p.some((x) => x.volumen > 0) && (
        <Karte>
          <Liniendiagramm
            titel="Volumen"
            einheit="kg"
            hinweis="Summe aus Wiederholungen × Gewicht aller abgehakten Arbeitssätze."
            punkte={p.filter((x) => x.volumen > 0).map((x) => ({ datum: x.datum, wert: x.volumen }))}
          />
        </Karte>
      )}

      {p.some((x) => x.vorgabeGesamt > 0) && (
        <Karte titel="Vorgabe und Leistung">
          <ul className="flex flex-col gap-2">
            {[...p]
              .reverse()
              .filter((x) => x.vorgabeGesamt > 0)
              .slice(0, 8)
              .map((x) => (
                <li key={x.einheitId} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 text-leise">{datum(x.datum)}</span>
                  <span className="flex flex-1 gap-0.5" aria-hidden>
                    {Array.from({ length: x.vorgabeGesamt }, (_, i) => (
                      <span
                        key={i}
                        className={`h-3 flex-1 rounded-sm ${i < x.vorgabeErreicht ? "bg-diagramm" : "bg-rand"}`}
                      />
                    ))}
                  </span>
                  <span className="w-28 shrink-0 text-right tabular-nums">
                    {x.vorgabeErreicht} von {x.vorgabeGesamt} erreicht
                  </span>
                </li>
              ))}
          </ul>
          <p className="mt-2 text-xs text-leise">
            „Erreicht“ heißt: mindestens die vorgegebenen Wiederholungen mit mindestens dem vorgegebenen Gewicht.
          </p>
        </Karte>
      )}

      <Maxtests
        athletId={athletId}
        ichId={ichId}
        uebungId={gewaehlt.uebungId}
        uebungName={gewaehlt.name}
        tests={testsHier}
        geschaetzt={letzter.e1rm}
        beiAenderung={laden}
      />
    </div>
  );
}

function Maxtests({
  athletId,
  ichId,
  uebungId,
  uebungName,
  tests,
  geschaetzt,
  beiAenderung,
}: {
  athletId: string;
  ichId: string;
  uebungId: string;
  uebungName: string;
  tests: Maxtest[];
  geschaetzt: number | null;
  beiAenderung: () => void;
}) {
  const [offen, setOffen] = useState(false);
  const [kg, setKg] = useState("");
  const [wdh, setWdh] = useState("1");
  const [tag, setTag] = useState(() => new Date().toISOString().slice(0, 10));
  const [fehler, setFehler] = useState("");

  async function speichern(e: FormEvent) {
    e.preventDefault();
    const k = Number(kg.replace(",", "."));
    const w = Number(wdh);
    if (!(k > 0 && k <= 1000) || !(Number.isInteger(w) && w >= 1 && w <= 10)) {
      setFehler("Bitte prüfe Gewicht (über 0) und Wiederholungen (1–10).");
      return;
    }
    const { error } = await supabase()
      .from("maxtests")
      .insert({ athlet_id: athletId, uebung_id: uebungId, last_kg: k, wdh: w, datum: tag });
    if (error) {
      setFehler("Speichern hat nicht geklappt.");
      return;
    }
    setOffen(false);
    setKg("");
    setFehler("");
    beiAenderung();
  }

  const feld = "h-11 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

  return (
    <Karte titel="Getestete Maximalwerte">
      <p className="mb-2 text-sm text-leise">
        Echte Tests ({uebungName}) – getrennt von der Schätzung.
        {geschaetzt != null && ` Zum Vergleich: zuletzt geschätzt ${zahl(geschaetzt)} kg.`}
      </p>
      {tests.length === 0 ? (
        <p className="text-sm text-leise">Noch kein Test eingetragen.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rand">
          {[...tests].reverse().map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-medium">
                  {t.wdh === 1 ? "1RM" : `${t.wdh}RM`}: {zahl(t.last_kg)} kg
                </span>
                <span className="block text-leise">{datum(t.datum)}</span>
              </span>
              {t.erfasst_von === ichId && (
                <button
                  type="button"
                  onClick={async () => {
                    await supabase().from("maxtests").delete().eq("id", t.id);
                    beiAenderung();
                  }}
                  className="text-xs text-leise underline underline-offset-4"
                >
                  Löschen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {offen ? (
        <form onSubmit={speichern} className="mt-3 grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-xs text-leise">
            kg
            <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className={feld} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-leise">
            Wdh. (1 = 1RM)
            <input inputMode="numeric" value={wdh} onChange={(e) => setWdh(e.target.value)} className={feld} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-leise">
            Datum
            <input type="date" value={tag} onChange={(e) => setTag(e.target.value)} className={feld} />
          </label>
          <div className="col-span-3 flex gap-2">
            <button type="submit" className="h-11 rounded-xl bg-akzent px-4 font-medium text-akzent-text">
              Speichern
            </button>
            <button type="button" onClick={() => setOffen(false)} className="h-11 rounded-xl border border-rand px-4 font-medium">
              Abbrechen
            </button>
          </div>
          {fehler && (
            <p role="alert" className="col-span-3 text-sm text-red-500">
              {fehler}
            </p>
          )}
        </form>
      ) : (
        <button type="button" onClick={() => setOffen(true)} className="mt-3 h-11 rounded-xl border border-rand px-4 font-medium">
          + Test eintragen
        </button>
      )}
    </Karte>
  );
}
