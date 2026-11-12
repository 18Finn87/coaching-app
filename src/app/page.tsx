"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Karte, Seitentitel } from "@/components/Bausteine";
import { MeinPlan } from "@/components/MeinPlan";
import { OffeneNachrichten } from "@/components/NachrichtenFuerCoach";
import { SchwierigeWochen } from "@/components/SchwierigeWochen";
import { UeberDich } from "@/components/UeberDich";
import { TagesAbfrage } from "@/components/TagesAbfrage";
import {
  ausloeserText,
  evaluationenPruefen,
  offeneEvaluationen,
  wochenbeginn,
  wocheText,
  type Evaluation,
} from "@/lib/coaching";
import { useEinwilligungen } from "@/lib/einwilligungen";
import { useProfil } from "@/lib/konto";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";

export default function Startseite() {
  const profil = useProfil();
  return profil.rolle === "athlet" ? <Heute /> : <Uebersicht />;
}

type OffenerCheckin = { id: string; athlet_id: string; woche: string; athlet: { anzeigename: string } | null };
type Einheit = { athlet_id: string; athlet: { anzeigename: string } | null };

function Uebersicht() {
  const [evals, setEvals] = useState<Evaluation[] | null>(null);
  const [checkins, setCheckins] = useState<OffenerCheckin[]>([]);
  const [einheiten, setEinheiten] = useState<{ id: string; name: string; anzahl: number }[]>([]);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      // Prüfung sofort für dich ausführen (zusätzlich zur täglichen Prüfung am Morgen)
      await evaluationenPruefen();
      const letzteWoche = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [e, c, t] = await Promise.all([
        offeneEvaluationen(),
        sb
          .from("checkins")
          .select("id, athlet_id, woche, athlet:profile!athlet_id(anzeigename)")
          .eq("coach_antwort", "")
          .gte("woche", wochenbeginn(letzteWoche))
          .order("woche", { ascending: false }),
        sb
          .from("trainingseinheiten")
          .select("athlet_id, athlet:profile!athlet_id(anzeigename)")
          .eq("status", "abgeschlossen")
          .gte("gestartet_am", letzteWoche.toISOString()),
      ]);
      setEvals(e.daten);
      setCheckins((c.data as unknown as OffenerCheckin[] | null) ?? []);
      const zaehler = new Map<string, { id: string; name: string; anzahl: number }>();
      for (const x of (t.data as unknown as Einheit[] | null) ?? []) {
        const z = zaehler.get(x.athlet_id) ?? { id: x.athlet_id, name: x.athlet?.anzeigename || "Ohne Namen", anzahl: 0 };
        z.anzahl += 1;
        zaehler.set(x.athlet_id, z);
      }
      setEinheiten([...zaehler.values()].sort((a, b) => b.anzahl - a.anzahl));
    })();
  }, []);

  const summe = einheiten.reduce((s, x) => s + x.anzahl, 0);

  return (
    <>
      <Seitentitel titel="Übersicht" />

      <Karte titel="Fällige Evaluationen">
        {evals === null ? (
          <p className="text-sm text-leise">Lädt …</p>
        ) : evals.length === 0 ? (
          <p className="text-sm text-leise">Gerade ist keine Evaluation fällig.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {evals.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/evaluation/?id=${e.id}`}
                  className="flex flex-col rounded-xl border border-rand px-3 py-2 hover:border-akzent"
                >
                  <span className="font-semibold">
                    {e.athlet?.anzeigename || "Ohne Namen"} · {e.plan?.titel}
                  </span>
                  <span className="text-sm text-leise">
                    {e.status === "verschoben" && e.verschoben_bis
                      ? `verschoben bis ${datum(e.verschoben_bis)}`
                      : `${ausloeserText(e)} · fällig seit ${datum(e.faellig_seit)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-leise">
          Die App erinnert dich nur. Ob ein Plan geändert wird, entscheidest du.
        </p>
      </Karte>

      <OffeneNachrichten />
      <SchwierigeWochen />

      <Karte titel="Check-ins ohne Antwort">
        {checkins.length === 0 ? (
          <p className="text-sm text-leise">Alles beantwortet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {checkins.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/athlet/?id=${c.athlet_id}#checkins`}
                  className="flex items-center justify-between rounded-xl border border-rand px-3 py-2 hover:border-akzent"
                >
                  <span className="font-medium">{c.athlet?.anzeigename || "Ohne Namen"}</span>
                  <span className="text-sm text-leise">{wocheText(c.woche)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Karte>

      <Karte titel="Einheiten der letzten 7 Tage">
        {einheiten.length === 0 ? (
          <p className="text-sm text-leise">Keine abgeschlossenen Einheiten.</p>
        ) : (
          <>
            <p className="mb-2 text-sm">
              <strong>{summe}</strong> {summe === 1 ? "Einheit" : "Einheiten"} insgesamt
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {einheiten.map((x) => (
                <li key={x.id} className="flex justify-between">
                  <Link href={`/athlet/?id=${x.id}`} className="text-akzent underline underline-offset-4">
                    {x.name}
                  </Link>
                  <span className="tabular-nums">{x.anzahl}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <p className="mt-3 text-xs text-leise">
          Statt einer Nachricht pro Einheit bekommst du einmal am Morgen eine Zusammenfassung unter der Glocke.
        </p>
      </Karte>
    </>
  );
}

function Heute() {
  const { aktiv, coachName } = useEinwilligungen();
  const profil = useProfil();
  const [checkinFehlt, setCheckinFehlt] = useState(false);

  useEffect(() => {
    supabase()
      .from("checkins")
      .select("id")
      .eq("athlet_id", profil.id)
      .eq("woche", wochenbeginn())
      .maybeSingle()
      .then(({ data, error }) => setCheckinFehlt(!error && !data));
  }, [profil.id]);

  return (
    <>
      <Seitentitel titel="Heute" />
      <TagesAbfrage athletId={profil.id} />
      {checkinFehlt && (
        <Link
          href="/checkin/"
          className="flex flex-col rounded-2xl border border-akzent bg-akzent/10 p-4"
        >
          <span className="font-semibold">Check-in dieser Woche</span>
          <span className="text-sm text-leise">Noch offen – dauert eine Minute.</span>
        </Link>
      )}
      <MeinPlan athletId={profil.id} />
      <UeberDich athletId={profil.id} coachName={coachName} />
      <Karte titel="Deine Angaben">
        <ul className="flex flex-col gap-3">
          <li>
            <Link href="/anamnese/" className="font-medium text-akzent underline underline-offset-4">
              Gesundheit und Anamnese
            </Link>
            <p className="text-sm text-leise">
              {aktiv("gesundheitsdaten")
                ? "Ein kurzer Fragebogen für ein sicheres Training."
                : "Nur mit deiner Einwilligung zu Gesundheitsdaten (im Profil)."}
            </p>
          </li>
          <li>
            <Link href="/videos/" className="font-medium text-akzent underline underline-offset-4">
              Technik-Videos
            </Link>
            <p className="text-sm text-leise">
              {aktiv("videos")
                ? "Videos einer Übung hochladen und mit deinem Coach besprechen."
                : "Nur mit deiner Einwilligung zu Videos (im Profil)."}
            </p>
          </li>
        </ul>
      </Karte>
    </>
  );
}
