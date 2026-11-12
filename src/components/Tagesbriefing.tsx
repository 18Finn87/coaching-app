"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { DringlichkeitAbzeichen } from "./OffenePunkte";
import { gruendeText, schwierigeWochenLaden, type Checkin } from "@/lib/coaching";
import {
  ART_TEXT,
  auffaelligkeiten,
  offenePunkteLaden,
  ohneTraining,
  punktZiel,
  schwellenLaden,
  seitText,
  type OffenerPunkt,
} from "@/lib/offenePunkte";
import { supabase } from "@/lib/supabase";
import { heute, type TagesCheckin } from "@/lib/tagesabfrage";

type Daten = {
  punkte: OffenerPunkt[];
  auffaellig: { id: string; name: string; hinweise: string[] }[];
  schwierig: (Checkin & { athlet: { anzeigename: string } | null })[];
  ohne: { id: string; name: string; tage: number | null }[];
  tageOhne: number;
};

/**
 * Tagesbriefing oben auf der Coach-Startseite – in 30 Sekunden lesbar.
 * Nur Hinweise: keine Diagnose, die App ändert keinen Plan.
 */
export function Tagesbriefing({ faelligeEvaluationen }: { faelligeEvaluationen: number | null }) {
  const [d, setD] = useState<Daten | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const jetzt = Date.now();
      const { werte: s } = await schwellenLaden();
      const ab4 = heute(new Date(jetzt - 3 * 86400000));
      const abTraining = new Date(jetzt - s.tage_ohne_training * 86400000).toISOString();
      const [punkte, schwierig, personen, tage, trainings] = await Promise.all([
        offenePunkteLaden(),
        schwierigeWochenLaden(),
        sb
          .from("coach_athlet")
          .select("athlet_id, start_am, athlet:profile!athlet_id (anzeigename)")
          .eq("status", "aktiv"),
        sb.from("tages_checkins").select("athlet_id, datum, energie, muskelkater, schlaf_stunden").gte("datum", ab4),
        sb.from("trainingseinheiten").select("athlet_id, gestartet_am").eq("status", "abgeschlossen").gte("gestartet_am", abTraining),
      ]);
      const leute = ((personen.data as unknown as { athlet_id: string; start_am: string | null; athlet: { anzeigename: string } | null }[] | null) ?? []).map((p) => ({
        id: p.athlet_id,
        name: p.athlet?.anzeigename || "Ohne Namen",
        seit: p.start_am ?? new Date(0).toISOString(),
      }));
      const name = new Map(leute.map((p) => [p.id, p.name]));
      const proPerson = new Map<string, TagesCheckin[]>();
      for (const t of (tage.data as TagesCheckin[] | null) ?? []) {
        const l = proPerson.get(t.athlet_id) ?? [];
        l.push({ ...t, schlaf_stunden: t.schlaf_stunden == null ? null : Number(t.schlaf_stunden) });
        proPerson.set(t.athlet_id, l);
      }
      const auffaellig = [...proPerson.entries()]
        .map(([id, l]) => ({ id, name: name.get(id) ?? "Ohne Namen", hinweise: auffaelligkeiten(l, s) }))
        .filter((x) => x.hinweise.length > 0 && name.has(x.id));
      const letztes = new Map<string, string>();
      for (const t of (trainings.data as { athlet_id: string; gestartet_am: string }[] | null) ?? []) {
        if (!letztes.has(t.athlet_id) || letztes.get(t.athlet_id)! < t.gestartet_am) letztes.set(t.athlet_id, t.gestartet_am);
      }
      setD({
        punkte: punkte ?? [],
        auffaellig,
        schwierig,
        ohne: ohneTraining(leute, letztes, s.tage_ohne_training, jetzt),
        tageOhne: s.tage_ohne_training,
      });
    })();
  }, []);

  if (!d) return <Karte titel="Tagesbriefing"><p className="text-sm text-leise">Lädt …</p></Karte>;
  const dringend = d.punkte.filter((p) => p.dringlichkeit === 3);
  const rest = d.punkte.length - dringend.length;
  const nichts =
    dringend.length === 0 && d.auffaellig.length === 0 && d.schwierig.length === 0 && d.ohne.length === 0 && !faelligeEvaluationen && rest === 0;

  return (
    <Karte titel="Tagesbriefing">
      {nichts ? (
        <p className="text-sm">Heute ist nichts offen. ✓</p>
      ) : (
        <div className="flex flex-col gap-4">
          {dringend.length > 0 && (
            <Abschnitt titel={`Dringend (${dringend.length})`}>
              {dringend.map((p) => (
                <li key={`${p.art}-${p.bezug_id ?? p.athlet_id}`}>
                  <Link href={punktZiel(p)} className="flex flex-wrap items-center gap-2 hover:underline">
                    <DringlichkeitAbzeichen stufe={3} />
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm">
                      {ART_TEXT[p.art]}: {p.titel}
                    </span>
                    <span className="text-xs text-leise">{seitText(p.seit)}</span>
                  </Link>
                </li>
              ))}
            </Abschnitt>
          )}
          {d.auffaellig.length > 0 && (
            <Abschnitt titel="Auffällig in den Tagesabfragen" hinweis="Nur ein Hinweis zum Nachfragen – keine Diagnose.">
              {d.auffaellig.map((a) => (
                <li key={a.id}>
                  <Link href={`/athlet/?id=${a.id}#tagesabfrage`} className="hover:underline">
                    <span className="font-medium">{a.name}</span>: <span className="text-sm">{a.hinweise.join(" · ")}</span>
                  </Link>
                </li>
              ))}
            </Abschnitt>
          )}
          {d.schwierig.length > 0 && (
            <Abschnitt titel="Schwierige Woche angekündigt">
              {d.schwierig.map((c) => (
                <li key={c.id}>
                  <Link href={`/athlet/?id=${c.athlet_id}#checkins`} className="hover:underline">
                    <span className="font-medium">{c.athlet?.anzeigename || "Ohne Namen"}</span>:{" "}
                    <span className="text-sm">{c.ausblick_gruende.length ? gruendeText(c) : "ohne Grund"}{c.ausblick_text && ` – „${c.ausblick_text}“`}</span>
                  </Link>
                </li>
              ))}
            </Abschnitt>
          )}
          {!!faelligeEvaluationen && (
            <p className="text-sm">
              <span className="font-semibold">Fällige Evaluationen: {faelligeEvaluationen}</span>{" "}
              <a href="#evaluationen" className="text-akzent underline underline-offset-4">ansehen</a>
            </p>
          )}
          {d.ohne.length > 0 && (
            <Abschnitt titel={`Seit ${d.tageOhne}+ Tagen ohne Training`}>
              {d.ohne.map((o) => (
                <li key={o.id}>
                  <Link href={`/athlet/?id=${o.id}`} className="hover:underline">
                    <span className="font-medium">{o.name}</span>{" "}
                    <span className="text-sm text-leise">{o.tage == null ? `kein Training in den letzten ${d.tageOhne} Tagen` : `zuletzt vor ${o.tage} Tagen`}</span>
                  </Link>
                </li>
              ))}
            </Abschnitt>
          )}
          {rest > 0 && (
            <p className="text-sm">
              Dazu {rest} {rest === 1 ? "weiterer offener Punkt" : "weitere offene Punkte"} –{" "}
              <a href="#offene-punkte" className="text-akzent underline underline-offset-4">zur Liste</a>
            </p>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-leise">Schwellenwerte stellst du unter Profil ein. Die App ändert nichts am Plan.</p>
    </Karte>
  );
}

function Abschnitt({ titel, hinweis, children }: { titel: string; hinweis?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">{titel}</h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
      {hinweis && <p className="mt-1 text-xs text-leise">{hinweis}</p>}
    </section>
  );
}
