"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { CheckinVerlauf } from "./CheckinVerlauf";
import {
  ENTSCHEIDUNG_TEXT,
  ausloeserText,
  checkinGesundheitLaden,
  checkinsLaden,
  evaluationenVon,
  regelnLaden,
  type Checkin,
  type CheckinGesundheit,
  type Evaluation,
} from "@/lib/coaching";
import { evaluationsStand, regelFuer, type Stand, type Stufe } from "@/lib/evaluation";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";

/** Coach: Check-ins einer Person mit Antwortfeld. */
export function CheckinsFuerCoach({ athletId }: { athletId: string }) {
  const [liste, setListe] = useState<Checkin[] | null>(null);
  const [gesundheit, setGesundheit] = useState<Record<string, CheckinGesundheit>>({});
  const [krank, setKrank] = useState<Set<string>>(new Set());

  const laden = useCallback(async () => {
    const [c, g] = await Promise.all([checkinsLaden(athletId, 12), checkinGesundheitLaden(athletId)]);
    setListe(c.daten);
    setGesundheit(g.daten);
    setKrank(g.krank);
  }, [athletId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  // Aus einem Hinweis kommend (…#checkins) nach dem Laden hinscrollen
  const geladen = liste !== null;
  useEffect(() => {
    if (geladen && window.location.hash === "#checkins") {
      document.getElementById("checkins")?.scrollIntoView();
    }
  }, [geladen]);

  return (
    <section id="checkins" className="scroll-mt-20">
      <Karte titel="Check-ins">
        {liste === null ? (
          <p className="text-sm text-leise">Lädt …</p>
        ) : (
          <CheckinVerlauf checkins={liste} gesundheit={gesundheit} krank={krank} alsCoach beiAntwort={laden} />
        )}
        <p className="mt-3 text-xs text-leise">
          Den geschützten Teil (Schmerzen) siehst du nur, solange die Einwilligung zu Gesundheitsdaten gilt.
        </p>
      </Karte>
    </section>
  );
}

type PlanMitVersion = {
  id: string;
  titel: string;
  planversionen: { id: string; status: string; veroeffentlicht_am: string | null }[];
};

type Prognose = { planId: string; titel: string; stand: Stand; regel: { wochen: number; einheiten: number } };

/** Coach: offene und frühere Evaluationen + wann die nächste fällig wird. */
export function EvaluationenFuerCoach({ athletId, stufe }: { athletId: string; stufe: Stufe }) {
  const [evals, setEvals] = useState<Evaluation[] | null>(null);
  const [prognosen, setPrognosen] = useState<Prognose[]>([]);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      await sb.rpc("evaluationen_jetzt_pruefen");
      const [e, regeln, p, t] = await Promise.all([
        evaluationenVon(athletId),
        regelnLaden(),
        sb
          .from("plaene")
          .select("id, titel, planversionen (id, status, veroeffentlicht_am)")
          .eq("athlet_id", athletId)
          .eq("status", "aktiv"),
        sb
          .from("trainingseinheiten")
          .select("gestartet_am, planversion_id")
          .eq("athlet_id", athletId)
          .eq("status", "abgeschlossen"),
      ]);
      setEvals(e.daten);
      const regel = regelFuer(stufe, regeln);
      const einheiten = (t.data as { gestartet_am: string; planversion_id: string | null }[] | null) ?? [];
      const neu: Prognose[] = [];
      for (const plan of (p.data as PlanMitVersion[] | null) ?? []) {
        const v = plan.planversionen.find((x) => x.status === "veroeffentlicht");
        if (!v?.veroeffentlicht_am) continue;
        if (e.daten.some((x) => x.plan_id === plan.id && x.status !== "erledigt")) continue;
        const zuletzt = e.daten
          .filter((x) => x.plan_id === plan.id && x.erledigt_am)
          .map((x) => new Date(x.erledigt_am!).getTime());
        const beginn = new Date(Math.max(new Date(v.veroeffentlicht_am).getTime(), ...zuletzt));
        const versionen = new Set(plan.planversionen.map((x) => x.id));
        const daten = einheiten
          .filter((x) => x.planversion_id && versionen.has(x.planversion_id))
          .map((x) => new Date(x.gestartet_am));
        neu.push({ planId: plan.id, titel: plan.titel, stand: evaluationsStand(beginn, daten, regel), regel });
      }
      setPrognosen(neu);
    })();
  }, [athletId, stufe]);

  const offen = (evals ?? []).filter((e) => e.status !== "erledigt");
  const erledigt = (evals ?? []).filter((e) => e.status === "erledigt");

  return (
    <Karte titel="Evaluationen">
      {evals === null ? (
        <p className="text-sm text-leise">Lädt …</p>
      ) : (
        <div className="flex flex-col gap-3">
          {offen.map((e) => (
            <Link
              key={e.id}
              href={`/evaluation/?id=${e.id}`}
              className="flex flex-col rounded-xl border border-akzent bg-akzent/10 px-3 py-2"
            >
              <span className="font-semibold">
                {e.status === "verschoben" ? "Verschoben" : "Fällig"}: {e.plan?.titel}
              </span>
              <span className="text-sm text-leise">
                {e.status === "verschoben" && e.verschoben_bis
                  ? `bis ${datum(e.verschoben_bis)}`
                  : `${ausloeserText(e)} · seit ${datum(e.faellig_seit)}`}
              </span>
            </Link>
          ))}
          {prognosen.map((p) => (
            <p key={p.planId} className="text-sm">
              <span className="font-medium">{p.titel}:</span> nächste Evaluation nach noch{" "}
              <strong>{p.stand.restEinheiten}</strong> {p.stand.restEinheiten === 1 ? "Einheit" : "Einheiten"} oder in{" "}
              <strong>{p.stand.restTage}</strong> {p.stand.restTage === 1 ? "Tag" : "Tagen"} – je nachdem, was zuerst
              eintritt ({p.regel.wochen} Wochen / {p.regel.einheiten} Einheiten).
            </p>
          ))}
          {offen.length === 0 && prognosen.length === 0 && (
            <p className="text-sm text-leise">Noch kein veröffentlichter Plan – dann gibt es auch keine Evaluation.</p>
          )}
          {erledigt.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-medium">Frühere Evaluationen ({erledigt.length})</summary>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {erledigt.map((e) => (
                  <li key={e.id}>
                    <Link href={`/evaluation/?id=${e.id}`} className="text-akzent underline underline-offset-4">
                      {datum(e.erledigt_am)} · {e.plan?.titel} · {ENTSCHEIDUNG_TEXT[e.entscheidung ?? ""]}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Karte>
  );
}
