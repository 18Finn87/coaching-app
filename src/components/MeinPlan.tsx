"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Karte } from "./Bausteine";
import { PlanAnsicht } from "./PlanAnsicht";
import { versionInhaltLaden } from "@/lib/plaene";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";
import {
  freiesTraining,
  lokaleTrainings,
  lokalSpeichern,
  planCacheLaden,
  planCacheSpeichern,
  trainingAusPlan,
  type LokalesTraining,
  type PlanCache,
} from "@/lib/training";

type Eintrag = {
  id: string;
  titel: string;
  planversionen: { id: string; versionsnummer: number; status: string; gueltig_ab: string | null }[];
};

/**
 * Athletin / Athlet: gültige Pläne mit „Training starten“. Der Plan wird auf
 * dem Handy zwischengespeichert, damit ein Training auch ohne Internet beginnt.
 */
export function MeinPlan({ athletId }: { athletId: string }) {
  const router = useRouter();
  const [plaene, setPlaene] = useState<PlanCache | null>(null);
  const [offline, setOffline] = useState(false);
  const [laufend, setLaufend] = useState<LokalesTraining[]>([]);

  useEffect(() => {
    let aktiv = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLaufend(lokaleTrainings(athletId).filter((t) => t.einheit.status === "laeuft"));
    (async () => {
      const { data, error } = await supabase()
        .from("plaene")
        .select("id, titel, planversionen (id, versionsnummer, status, gueltig_ab)")
        .eq("athlet_id", athletId)
        .eq("status", "aktiv")
        .order("erstellt_am", { ascending: false });
      if (error) {
        if (aktiv) {
          setOffline(true);
          setPlaene(planCacheLaden(athletId));
        }
        return;
      }
      const liste: PlanCache = [];
      for (const p of (data as Eintrag[] | null) ?? []) {
        const v = p.planversionen.find((x) => x.status === "veroeffentlicht");
        if (!v) continue;
        const inhalt = await versionInhaltLaden(v.id);
        liste.push({ titel: p.titel, versionId: v.id, versionsnummer: v.versionsnummer, einheiten: inhalt.daten });
      }
      planCacheSpeichern(athletId, liste);
      // Auf einem anderen Gerät begonnenes Training ebenfalls anzeigen
      const server = await supabase()
        .from("trainingseinheiten")
        .select("id")
        .eq("athlet_id", athletId)
        .eq("status", "laeuft");
      if (aktiv) {
        setPlaene(liste);
        const lokal = lokaleTrainings(athletId).filter((t) => t.einheit.status === "laeuft");
        const nurServer = ((server.data as { id: string }[] | null) ?? []).filter(
          (s) => !lokal.some((l) => l.einheit.id === s.id),
        );
        setLaufend([
          ...lokal,
          ...nurServer.map(
            (s) => ({ einheit: { id: s.id, titel: "Laufendes Training", gestartet_am: "" } }) as unknown as LokalesTraining,
          ),
        ]);
      }
    })();
    return () => {
      aktiv = false;
    };
  }, [athletId]);

  // Schutz gegen doppeltes Antippen: nur ein Start, bis die Trainingsseite offen ist
  const startet = useRef(false);
  function starten(t: LokalesTraining) {
    if (startet.current) return;
    startet.current = true;
    // Läuft für diesen Trainingstag schon ein Training auf dem Handy? Dann dieses fortsetzen.
    const schon = t.einheit.plan_einheit_id
      ? lokaleTrainings(athletId).find(
          (x) => x.einheit.status === "laeuft" && x.einheit.plan_einheit_id === t.einheit.plan_einheit_id,
        )
      : undefined;
    if (schon) {
      router.push(`/training/?id=${schon.einheit.id}`);
      return;
    }
    lokalSpeichern(t);
    router.push(`/training/?id=${t.einheit.id}`);
  }

  return (
    <>
      {laufend.length > 0 && (
        <Karte titel="Laufendes Training">
          <ul className="flex flex-col gap-2">
            {laufend.map((t) => (
              <li key={t.einheit.id}>
                <Link
                  href={`/training/?id=${t.einheit.id}`}
                  className="flex h-12 items-center justify-between rounded-xl bg-akzent px-4 font-semibold text-akzent-text"
                >
                  <span>{t.einheit.titel} fortsetzen</span>
                  <span aria-hidden>→</span>
                </Link>
                {t.einheit.gestartet_am && (
                  <p className="mt-1 text-xs text-leise">begonnen am {datum(t.einheit.gestartet_am)}</p>
                )}
              </li>
            ))}
          </ul>
        </Karte>
      )}

      {offline && (
        <p className="rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-sm">
          Gerade kein Internet. Du siehst den zuletzt gespeicherten Plan und kannst trotzdem trainieren – die
          Einträge werden später hochgeladen.
        </p>
      )}

      {plaene === null && (
        <Karte titel="Dein Plan">
          <p className="text-leise">Lädt …</p>
        </Karte>
      )}
      {plaene && plaene.length === 0 && (
        <Karte titel="Dein Plan">
          <p className="text-leise">Dein Coach hat dir noch keinen Plan freigegeben.</p>
        </Karte>
      )}
      {plaene?.map((p) => (
        <section key={p.versionId} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">{p.titel}</h2>
            <p className="text-sm text-leise">Version {p.versionsnummer}</p>
          </div>
          <PlanAnsicht
            versionId={p.versionId}
            vorgeladen={p.einheiten}
            kacheln
            aktion={(e) => (
              <button
                type="button"
                onClick={() => starten(trainingAusPlan(athletId, p.versionId, e))}
                className="h-12 w-full rounded-xl bg-akzent px-4 font-semibold text-akzent-text"
              >
                {e.name} starten
              </button>
            )}
          />
        </section>
      ))}

      {plaene && (
        <button
          type="button"
          onClick={() => starten(freiesTraining(athletId))}
          className="h-11 rounded-xl border border-rand px-4 font-medium"
        >
          Freies Training ohne Plan
        </button>
      )}
    </>
  );
}
