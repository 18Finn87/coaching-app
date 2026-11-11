"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Karte, Seitentitel } from "@/components/Bausteine";
import { Stoppuhr } from "@/components/Stoppuhr";
import { UebungAuswahl } from "@/components/UebungAuswahl";
import { useProfil } from "@/lib/konto";
import { zeitText } from "@/lib/plaene";
import { hatLast } from "@/lib/uebungen";
import { AusdauerFelder } from "@/components/AusdauerFelder";
import { IntervallRunde } from "@/components/IntervallRunde";
import { einheitKurz } from "@/lib/athletik";
import { SchmerzAngabe } from "@/components/SchmerzAngabe";
import { useEinwilligungen } from "@/lib/einwilligungen";
import { IntervallTimer } from "@/components/IntervallTimer";
import { dauerText, intensitaetText, kmText } from "@/lib/ausdauer";
import {
  hochladen,
  lokalLaden,
  lokalSpeichern,
  neueId,
  nummerieren,
  seitenAufteilen,
  vomServerLaden,
  type LokalesTraining,
  type TEinheit,
  type TSatz,
  type TUebung,
  type Vorgabe,
} from "@/lib/training";
import { datum } from "@/lib/texte";

export default function TrainingSeite() {
  return (
    <Suspense fallback={<p className="text-leise">Lädt …</p>}>
      <Inhalt />
    </Suspense>
  );
}

function Inhalt() {
  const id = useSearchParams().get("id") ?? "";
  const profil = useProfil();
  const [t, setT] = useState<LokalesTraining | null | undefined>(undefined);
  const [korrigieren, setKorrigieren] = useState(false);

  useEffect(() => {
    let aktiv = true;
    const lokal = lokalLaden(id);
    if (lokal && lokal.einheit.athlet_id === profil.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setT(lokal);
    } else {
      vomServerLaden(id).then(({ daten }) => aktiv && setT(daten));
    }
    const neu = (ev: Event) => {
      if ((ev as CustomEvent).detail === id) {
        const l = lokalLaden(id);
        if (l) setT(l);
      }
    };
    window.addEventListener("training-geaendert", neu);
    return () => {
      aktiv = false;
      window.removeEventListener("training-geaendert", neu);
    };
  }, [id, profil.id]);

  if (t === undefined) return <p className="text-leise">Lädt …</p>;
  if (t === null) {
    return (
      <Karte>
        <p>Dieses Training gibt es nicht oder du hast keinen Zugriff.</p>
        <Link href="/" className="mt-3 inline-block text-akzent underline underline-offset-4">
          Zur Startseite
        </Link>
      </Karte>
    );
  }

  const eigenes = t.einheit.athlet_id === profil.id;
  const bearbeitbar = eigenes && (t.einheit.status === "laeuft" || korrigieren);
  return (
    <Training
      training={t}
      bearbeitbar={bearbeitbar}
      eigenes={eigenes}
      korrigieren={korrigieren}
      setKorrigieren={setKorrigieren}
    />
  );
}

/** Auf dem Handy speichern und Hochladen anstoßen */
function aendern(t: LokalesTraining, schritt: (e: TEinheit, geloescht: LokalesTraining["geloescht"]) => void) {
  // Immer vom neuesten Stand ausgehen: Ein Feld kann gerade erst beim Verlassen
  // gespeichert worden sein (z. B. Wiederholungen tippen, dann sofort abhaken).
  const kopie: LokalesTraining = structuredClone(lokalLaden(t.einheit.id) ?? t);
  schritt(kopie.einheit, kopie.geloescht);
  kopie.ungespeichert = true;
  lokalSpeichern(kopie);
  hochladen(kopie.einheit.id);
}

function Training({
  training,
  bearbeitbar,
  eigenes,
  korrigieren,
  setKorrigieren,
}: {
  training: LokalesTraining;
  bearbeitbar: boolean;
  eigenes: boolean;
  korrigieren: boolean;
  setKorrigieren: (w: boolean) => void;
}) {
  const e = training.einheit;
  const router = useRouter();
  const [pauseEnde, setPauseEnde] = useState<number | null>(null);
  const [zusatz, setZusatz] = useState(false);
  const [abschluss, setAbschluss] = useState(false);
  const [abbrechenFragen, setAbbrechenFragen] = useState(false);
  const laeuft = e.status === "laeuft";

  const satzAendern = useCallback(
    (uId: string, sId: string, werte: Partial<TSatz>) =>
      aendern(training, (ein) => {
        const s = ein.uebungen.find((u) => u.id === uId)?.saetze.find((x) => x.id === sId);
        if (s) Object.assign(s, werte);
      }),
    [training],
  );

  function satzErledigt(u: TUebung, s: TSatz) {
    let jetzt = false;
    aendern(training, (ein) => {
      const ue = ein.uebungen.find((x) => x.id === u.id);
      const satz = ue?.saetze.find((x) => x.id === s.id);
      if (!ue || !satz) return;
      jetzt = !satz.erledigt;
      satz.erledigt = jetzt;
      // Leere Felder beim Abhaken mit der Vorgabe füllen
      if (jetzt && satz.wdh === null && (ue.messart === "wdh_last" || ue.messart === "wdh")) {
        satz.wdh = satz.vorgabe.wdh_max ?? satz.vorgabe.wdh_min ?? null;
      }
      if (jetzt && satz.dauer_sek === null && satz.vorgabe.dauer_sek) satz.dauer_sek = satz.vorgabe.dauer_sek;
      if (jetzt && satz.distanz_m === null && satz.vorgabe.distanz_m) satz.distanz_m = satz.vorgabe.distanz_m;
    });
    if (jetzt && laeuft) setPauseEnde(Date.now() + (s.vorgabe.pause_sek ?? 90) * 1000);
  }

  const erledigt = e.uebungen.reduce((n, u) => n + u.saetze.filter((s) => s.erledigt).length, 0);
  const gesamt = e.uebungen.reduce((n, u) => n + u.saetze.length, 0);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <Seitentitel
          titel={e.titel}
          text={`${datum(e.gestartet_am)} · ${erledigt} von ${gesamt} Sätzen${
            e.status === "abgeschlossen" ? ` · abgeschlossen${e.session_rpe ? ` · RPE ${e.session_rpe}` : ""}` : ""
          }${e.status === "abgebrochen" ? " · abgebrochen" : ""}`}
        />
        {eigenes && <SyncAnzeige training={training} />}
      </div>

      {laeuft && <Dauer seit={e.gestartet_am} />}

      {korrigieren && (
        <p className="rounded-xl border border-amber-400/60 bg-amber-400/10 p-3 text-sm">
          Du korrigierst ein abgeschlossenes Training. Jede Änderung wird protokolliert und ist für deinen Coach
          sichtbar.
        </p>
      )}

      {e.uebungen.map((u, i) => (
        <UebungKarte
          key={u.id}
          u={u}
          bearbeitbar={bearbeitbar}
          ersteOben={i === 0}
          letzteUnten={i === e.uebungen.length - 1}
          satzAendern={satzAendern}
          satzErledigt={satzErledigt}
          training={training}
          eigenes={eigenes}
        />
      ))}

      {bearbeitbar &&
        (zusatz ? (
          <UebungAuswahl
            abbrechen={() => setZusatz(false)}
            waehlen={(neu) => {
              setZusatz(false);
              aendern(training, (ein) => {
                ein.uebungen.push({
                  id: neueId(),
                  uebung_id: neu.id,
                  plan_uebung_id: null,
                  reihenfolge: ein.uebungen.length,
                  uebung_name: neu.name,
                  messart: neu.messart,
                  ersetzt: false,
                  notiz: "",
                  einseitig: neu.einseitig,
                  seiten_getrennt: neu.seiten_getrennt,
                  einheit: neu.einheit,
                  saetze: seitenAufteilen(neu.seiten_getrennt, [leererSatz(1, {})]),
                });
              });
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setZusatz(true)}
            className="h-12 rounded-xl border border-dashed border-akzent px-4 font-medium text-akzent"
          >
            + Übung hinzufügen
          </button>
        ))}

      {eigenes && laeuft && !abschluss && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setPauseEnde(null);
              setAbschluss(true);
            }}
            className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text"
          >
            Training abschließen
          </button>
          {!abbrechenFragen ? (
            <button
              type="button"
              onClick={() => setAbbrechenFragen(true)}
              className="text-sm text-leise underline underline-offset-4"
            >
              Training abbrechen
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rand p-3 text-sm">
              Abbrechen? Eingetragene Sätze bleiben gespeichert.
              <button
                type="button"
                onClick={() => {
                  aendern(training, (ein) => {
                    ein.status = "abgebrochen";
                    ein.beendet_am = new Date().toISOString();
                  });
                  router.push("/");
                }}
                className="h-10 rounded-lg border border-rand px-3 font-medium"
              >
                Ja, abbrechen
              </button>
              <button type="button" onClick={() => setAbbrechenFragen(false)} className="h-10 rounded-lg px-3">
                Nein
              </button>
            </div>
          )}
        </div>
      )}

      {abschluss && (
        <Abschluss
          abbrechen={() => setAbschluss(false)}
          speichern={(rpe, notiz) => {
            aendern(training, (ein) => {
              ein.status = "abgeschlossen";
              ein.beendet_am = new Date().toISOString();
              ein.session_rpe = rpe;
              ein.notiz = notiz;
            });
            setAbschluss(false);
          }}
        />
      )}

      {eigenes && e.status === "abgeschlossen" && (
        <button
          type="button"
          onClick={() => setKorrigieren(!korrigieren)}
          className="h-11 self-start rounded-xl border border-rand px-4 text-sm font-medium"
        >
          {korrigieren ? "Korrektur beenden" : "Einträge korrigieren"}
        </button>
      )}

      {e.notiz && !abschluss && (
        <Karte titel="Notiz">
          <p className="whitespace-pre-wrap text-sm">{e.notiz}</p>
        </Karte>
      )}

      {pauseEnde && <Pausentimer ende={pauseEnde} setEnde={setPauseEnde} />}
    </>
  );
}

function leererSatz(nr: number, vorgabe: Vorgabe): TSatz {
  return {
    id: neueId(),
    plan_satz_id: null,
    satznummer: nr,
    satztyp: "arbeit",
    vorgabe,
    wdh: null,
    last_kg: vorgabe.last_kg ?? null,
    rir: null,
    dauer_sek: null,
    distanz_m: null,
    erledigt: false,
  };
}

function vorgabeText(v: Vorgabe, messart: string): string {
  const teile: string[] = [];
  if (messart === "intervall") {
    if (v.distanz_m) teile.push(`${v.distanz_m} m`);
    else if (v.dauer_sek) teile.push(zeitText(v.dauer_sek));
    const i = intensitaetText(v.intensitaet);
    if (i) teile.push(i);
    if (v.pause_sek) teile.push(`dann ${zeitText(v.pause_sek)} Pause`);
    return teile.join(" · ");
  }
  if (messart === "ausdauer") {
    if (v.dauer_sek) teile.push(`${dauerText(v.dauer_sek)} min`);
    if (v.distanz_m) teile.push(kmText(v.distanz_m));
    const i = intensitaetText(v.intensitaet);
    if (i) teile.push(i);
    return teile.join(" · ");
  }
  if (v.wdh_min && v.wdh_max && v.wdh_min !== v.wdh_max) teile.push(`${v.wdh_min}–${v.wdh_max} Wdh.`);
  else if (v.wdh_min || v.wdh_max) teile.push(`${v.wdh_min ?? v.wdh_max} Wdh.`);
  if (v.dauer_sek) teile.push(zeitText(v.dauer_sek));
  if (v.distanz_m) teile.push(`${v.distanz_m} m`);
  if (v.last_kg != null && hatLast(messart)) teile.push(`${v.last_kg} kg`);
  if (v.last_prozent) teile.push(`${v.last_prozent} % 1RM`);
  if (v.rir_ziel != null) teile.push(`RIR ${v.rir_ziel}`);
  if (v.tempo) teile.push(`Tempo ${v.tempo}`);
  return teile.join(" · ");
}

function UebungKarte({
  u,
  bearbeitbar,
  ersteOben,
  letzteUnten,
  satzAendern,
  satzErledigt,
  training,
  eigenes,
}: {
  u: TUebung;
  bearbeitbar: boolean;
  ersteOben: boolean;
  letzteUnten: boolean;
  satzAendern: (uId: string, sId: string, werte: Partial<TSatz>) => void;
  satzErledigt: (u: TUebung, s: TSatz) => void;
  training: LokalesTraining;
  eigenes: boolean;
}) {
  const [tauschen, setTauschen] = useState(false);
  const { aktiv } = useEinwilligungen();
  const mitWdh = u.messart === "wdh_last" || u.messart === "wdh";
  const mitZeit = u.messart === "zeit" || u.messart === "zeit_last";
  const mitStrecke = u.messart === "distanz" || u.messart === "distanz_last";
  const mitLast = hatLast(u.messart);
  const test = u.messart === "test";
  const mitMesswert = u.messart === "umfang" || test;
  const ausdauer = u.messart === "ausdauer";
  const intervall = u.messart === "intervall";
  const [timer, setTimer] = useState(false);
  const seiten = u.seiten_getrennt ?? u.saetze.some((s) => s.seite);
  const [uhr, setUhr] = useState<string | null>(null);

  return (
    <section className="rounded-2xl border border-rand bg-flaeche p-4">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">
            {u.uebung_name}
            {u.einseitig && <span className="ml-1 text-xs font-normal text-leise">(pro Seite)</span>}
          </h2>
          {u.ersetzt && <p className="text-xs text-amber-500">statt der geplanten Übung</p>}
          {u.hinweis && <p className="text-sm text-leise">{u.hinweis}</p>}
        </div>
        {bearbeitbar && (
          <>
            <KleinKnopf
              titel="Nach oben"
              aus={ersteOben}
              onClick={() =>
                aendern(training, (ein) => {
                  const i = ein.uebungen.findIndex((x) => x.id === u.id);
                  [ein.uebungen[i - 1], ein.uebungen[i]] = [ein.uebungen[i], ein.uebungen[i - 1]];
                })
              }
            >
              ↑
            </KleinKnopf>
            <KleinKnopf
              titel="Nach unten"
              aus={letzteUnten}
              onClick={() =>
                aendern(training, (ein) => {
                  const i = ein.uebungen.findIndex((x) => x.id === u.id);
                  [ein.uebungen[i + 1], ein.uebungen[i]] = [ein.uebungen[i], ein.uebungen[i + 1]];
                })
              }
            >
              ↓
            </KleinKnopf>
          </>
        )}
      </div>

      {intervall && bearbeitbar && u.saetze.some((x) => !x.erledigt) && (
        <button
          type="button"
          onClick={() => setTimer(true)}
          className="mb-2 h-12 w-full rounded-xl bg-akzent font-semibold text-akzent-text"
        >
          ▶ Intervall-Timer starten
        </button>
      )}
      {timer && (
        <IntervallTimer
          titel={u.uebung_name}
          runden={u.saetze}
          rundeFertig={(id, werte) => satzAendern(u.id, id, werte)}
          schliessen={() => setTimer(false)}
        />
      )}

      <div className="flex flex-col gap-2">
        {u.saetze.map((s) => {
          // Bei getauschter Übung passt das geplante Gewicht nicht – nur Wdh./RIR zeigen
          const vt = vorgabeText(
            u.ersetzt ? { ...s.vorgabe, last_kg: null, last_prozent: null } : s.vorgabe,
            u.messart,
          );
          return (
            <div
              key={s.id}
              className={`rounded-xl border p-2 ${s.erledigt ? "border-akzent/50 bg-akzent/5" : "border-rand"}`}
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-leise">
                <span>
                  {intervall ? "Runde" : test ? "Versuch" : "Satz"} {s.satznummer}
                  {s.seite && <strong className="font-semibold text-foreground"> · {s.seite === "links" ? "links" : "rechts"}</strong>}
                  {s.satztyp !== "arbeit" ? ` · ${s.satztyp === "aufwaermen" ? "Aufwärmen" : s.satztyp}` : ""}
                  {vt ? ` · Vorgabe: ${vt}` : ""}
                </span>
                {bearbeitbar && !s.erledigt && (
                  <button
                    type="button"
                    aria-label={`Satz ${s.satznummer} entfernen`}
                    onClick={() =>
                      aendern(training, (ein, weg) => {
                        const ue = ein.uebungen.find((x) => x.id === u.id)!;
                        // Bei getrennten Seiten verschwinden links und rechts gemeinsam
                        const raus = ue.saetze.filter((x) => x.id === s.id || (s.seite && x.satznummer === s.satznummer));
                        ue.saetze = ue.saetze.filter((x) => !raus.includes(x));
                        nummerieren(ue.saetze);
                        weg.saetze.push(...raus.map((x) => x.id));
                      })
                    }
                    className="px-2 text-leise"
                  >
                    ✕
                  </button>
                )}
              </div>
              {ausdauer ? (
                <AusdauerFelder
                  satz={s}
                  aus={!bearbeitbar}
                  setzen={(werte) => satzAendern(u.id, s.id, werte)}
                  stoppuhr={bearbeitbar ? () => setUhr(s.id) : undefined}
                  abhaken={() => satzErledigt(u, s)}
                  bearbeitbar={bearbeitbar}
                />
              ) : intervall ? (
                <IntervallRunde
                  satz={s}
                  aus={!bearbeitbar}
                  setzen={(werte) => satzAendern(u.id, s.id, werte)}
                  abhaken={() => satzAendern(u.id, s.id, { erledigt: !s.erledigt })}
                  bearbeitbar={bearbeitbar}
                />
              ) : (
              <div className="flex items-end gap-2">
                {mitWdh && (
                  <Zahl
                    label="Wdh."
                    wert={s.wdh}
                    platzhalter={s.vorgabe.wdh_max?.toString() ?? s.vorgabe.wdh_min?.toString() ?? ""}
                    ganz
                    max={200}
                    aus={!bearbeitbar}
                    setzen={(w) => satzAendern(u.id, s.id, { wdh: w })}
                  />
                )}
                {mitZeit && (
                  <Zahl
                    label="Sek."
                    wert={s.dauer_sek}
                    platzhalter={s.vorgabe.dauer_sek?.toString() ?? ""}
                    ganz
                    max={86400}
                    aus={!bearbeitbar}
                    setzen={(w) => satzAendern(u.id, s.id, { dauer_sek: w })}
                  />
                )}
                {mitZeit && bearbeitbar && (
                  <button
                    type="button"
                    aria-label={`Stoppuhr für Satz ${s.satznummer}${s.seite ? ` ${s.seite}` : ""}`}
                    onClick={() => setUhr(s.id)}
                    className="h-12 w-12 shrink-0 rounded-xl border border-rand text-lg"
                  >
                    ⏱
                  </button>
                )}
                {mitStrecke && (
                  <Zahl
                    label="Meter"
                    wert={s.distanz_m}
                    platzhalter={s.vorgabe.distanz_m?.toString() ?? ""}
                    ganz
                    max={100000}
                    aus={!bearbeitbar}
                    setzen={(w) => satzAendern(u.id, s.id, { distanz_m: w })}
                  />
                )}
                {mitLast && (
                  <Zahl
                    label="kg"
                    wert={s.last_kg}
                    platzhalter={s.vorgabe.last_kg?.toString() ?? ""}
                    max={1000}
                    aus={!bearbeitbar}
                    setzen={(w) => satzAendern(u.id, s.id, { last_kg: w })}
                  />
                )}
                {mitMesswert && (
                  <Zahl
                    label={test ? (u.einheit ? einheitKurz[u.einheit] ?? u.einheit : "Ergebnis") : "cm"}
                    wert={s.messwert ?? null}
                    platzhalter=""
                    min={-1000}
                    max={10000}
                    aus={!bearbeitbar}
                    setzen={(w) => satzAendern(u.id, s.id, { messwert: w })}
                  />
                )}
                {!mitMesswert && (
                <Zahl
                  label="RIR*"
                  wert={s.rir}
                  platzhalter={s.vorgabe.rir_ziel?.toString() ?? ""}
                  max={10}
                  aus={!bearbeitbar}
                  setzen={(w) => satzAendern(u.id, s.id, { rir: w })}
                />
                )}
                <button
                  type="button"
                  disabled={!bearbeitbar}
                  aria-pressed={s.erledigt}
                  aria-label={s.erledigt ? `Satz ${s.satznummer} erledigt – zurücknehmen` : `Satz ${s.satznummer} abhaken`}
                  onClick={() => satzErledigt(u, s)}
                  className={`h-12 w-12 shrink-0 rounded-xl text-xl font-bold ${
                    s.erledigt ? "bg-akzent text-akzent-text" : "border-2 border-rand text-leise"
                  } disabled:opacity-60`}
                >
                  ✓
                </button>
              </div>
              )}
            </div>
          );
        })}
      </div>

      {bearbeitbar && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              aendern(training, (ein) => {
                const ue = ein.uebungen.find((x) => x.id === u.id)!;
                const letzter = ue.saetze[ue.saetze.length - 1];
                const neu = leererSatz((letzter?.satznummer ?? 0) + 1, letzter ? { ...letzter.vorgabe } : {});
                if (letzter) neu.last_kg = letzter.last_kg;
                ue.saetze.push(...seitenAufteilen(seiten, [neu]));
              })
            }
            className="h-10 rounded-lg border border-dashed border-rand px-3 text-sm font-medium text-leise"
          >
            + Satz
          </button>
          <button
            type="button"
            onClick={() => setTauschen(!tauschen)}
            className="h-10 rounded-lg border border-rand px-3 text-sm font-medium text-leise"
          >
            Übung tauschen
          </button>
          {!u.plan_uebung_id && (
            <button
              type="button"
              onClick={() =>
                aendern(training, (ein, weg) => {
                  ein.uebungen = ein.uebungen.filter((x) => x.id !== u.id);
                  weg.uebungen.push(u.id);
                })
              }
              className="h-10 rounded-lg border border-rand px-3 text-sm font-medium text-leise"
            >
              Entfernen
            </button>
          )}
        </div>
      )}
      {tauschen && (
        <UebungAuswahl
          abbrechen={() => setTauschen(false)}
          waehlen={(neu) => {
            setTauschen(false);
            aendern(training, (ein) => {
              const ue = ein.uebungen.find((x) => x.id === u.id)!;
              ue.uebung_id = neu.id;
              ue.uebung_name = neu.name;
              ue.messart = neu.messart;
              ue.einseitig = neu.einseitig;
              ue.ersetzt = ue.plan_uebung_id !== null;
              // Das Gewicht der alten Übung passt nicht zur neuen: offene Sätze leeren
              for (const s of ue.saetze) if (!s.erledigt) s.last_kg = null;
            });
          }}
        />
      )}
      {eigenes && bearbeitbar && aktiv("videos") && (
        <Link
          href={`/videos/?uebung=${u.uebung_id}`}
          className="mt-2 inline-block text-sm text-akzent underline underline-offset-4"
        >
          🎥 Video zu dieser Übung
        </Link>
      )}
      {(u.schmerz_abfragen || u.schmerz) && (eigenes || u.schmerz?.wert != null) && (
        <SchmerzAngabe
          wert={u.schmerz?.wert ?? null}
          notiz={u.schmerz?.notiz ?? ""}
          grenze={u.schmerzgrenze ?? null}
          einwilligung={!eigenes || !!aktiv("gesundheitsdaten")}
          aus={!bearbeitbar || !eigenes}
          setzen={(wert, notiz) =>
            aendern(training, (ein) => {
              const ue = ein.uebungen.find((x) => x.id === u.id);
              if (ue) ue.schmerz = { wert, notiz };
            })
          }
        />
      )}
      {intervall ? (
        <p className="mt-2 text-[11px] text-leise">Der Timer trägt jede Runde selbst ein. Bei Strecken-Intervallen misst er die Zeit bis „Runde fertig“.</p>
      ) : ausdauer ? (
        <p className="mt-2 text-[11px] text-leise">Pace rechnet die App aus Zeit und Strecke. Puls ist freiwillig. Anstrengung = deine Einschätzung (1–10).</p>
      ) : test ? (
        <p className="mt-2 text-[11px] text-leise">Ein Satz = ein Versuch. Ergebnis eintragen und abhaken, Kommazahlen mit „,“ (z. B. 1,85).</p>
      ) : u.messart === "umfang" ? (
        <p className="mt-2 text-[11px] text-leise">Messwert in cm. Minuswerte mit „-“ eingeben (z. B. -3).</p>
      ) : (
        <p className="mt-2 text-[11px] text-leise">* RIR = Wiederholungen in Reserve, deine Selbsteinschätzung</p>
      )}
      {uhr && (() => {
        const satz = u.saetze.find((x) => x.id === uhr);
        if (!satz) return null;
        return (
          <Stoppuhr
            titel={`${u.uebung_name} · Satz ${satz.satznummer}${satz.seite ? ` ${satz.seite}` : ""}`}
            ziel={satz.vorgabe.dauer_sek ?? null}
            fertig={(sek) => {
              setUhr(null);
              if (sek != null) satzAendern(u.id, satz.id, { dauer_sek: sek });
            }}
          />
        );
      })()}
    </section>
  );
}

function Zahl({
  label,
  wert,
  platzhalter,
  ganz,
  min = 0,
  max,
  aus,
  setzen,
}: {
  label: string;
  wert: number | null;
  platzhalter: string;
  ganz?: boolean;
  min?: number;
  max: number;
  aus: boolean;
  setzen: (w: number | null) => void;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="text-[11px] text-leise">{label}</span>
      <input
        key={`${label}-${wert}`}
        inputMode={ganz ? "numeric" : min < 0 ? "text" : "decimal"}
        defaultValue={wert ?? ""}
        placeholder={platzhalter}
        disabled={aus}
        onBlur={(ev) => {
          const text = ev.target.value.trim().replace(",", ".");
          const neu = text === "" ? null : Number(text);
          if (neu !== null && (Number.isNaN(neu) || neu < min || neu > max || (ganz && !Number.isInteger(neu)))) {
            ev.target.value = wert?.toString() ?? "";
            return;
          }
          if (neu !== wert) setzen(neu);
        }}
        className="h-12 w-full min-w-0 rounded-xl border border-rand bg-background px-2 text-center text-lg outline-none focus:border-akzent disabled:opacity-70"
      />
    </label>
  );
}

function KleinKnopf({
  titel,
  aus,
  onClick,
  children,
}: {
  titel: string;
  aus?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={titel}
      disabled={aus}
      onClick={onClick}
      className="h-9 w-9 shrink-0 rounded-lg border border-rand text-leise disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SyncAnzeige({ training }: { training: LokalesTraining }) {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const neu = () => setOnline(navigator.onLine);
    neu();
    window.addEventListener("online", neu);
    window.addEventListener("offline", neu);
    return () => {
      window.removeEventListener("online", neu);
      window.removeEventListener("offline", neu);
    };
  }, []);
  const offen = training.ungespeichert;
  return (
    <span
      role="status"
      className={`mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
        offen ? "bg-amber-400/15 text-amber-600" : "bg-akzent/15 text-akzent"
      }`}
    >
      {offen ? (online ? "Wird gespeichert …" : "Offline – noch nicht hochgeladen") : "Gespeichert"}
    </span>
  );
}

function Dauer({ seit }: { seit: string }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setJetzt(Date.now()), 15000);
    return () => clearInterval(i);
  }, []);
  const min = Math.max(0, Math.floor((jetzt - Date.parse(seit)) / 60000));
  return <p className="-mt-2 text-sm text-leise">läuft seit {min} Minuten</p>;
}

function Pausentimer({ ende, setEnde }: { ende: number; setEnde: (e: number | null) => void }) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setJetzt(Date.now()), 250);
    return () => clearInterval(i);
  }, []);
  const rest = Math.max(0, Math.ceil((ende - jetzt) / 1000));
  useEffect(() => {
    if (rest === 0) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        // Vibration nicht verfügbar
      }
    }
  }, [rest]);
  return (
    <div
      role="timer"
      aria-live="polite"
      className="fixed inset-x-0 bottom-16 z-20 mx-auto flex max-w-2xl items-center gap-3 border-t border-rand bg-flaeche px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-lg"
    >
      <span className={`text-2xl font-semibold tabular-nums ${rest === 0 ? "text-akzent" : ""}`}>
        {rest === 0 ? "Weiter!" : zeitText(rest)}
      </span>
      <span className="text-sm text-leise">Pause</span>
      <button
        type="button"
        onClick={() => setEnde(Math.max(Date.now(), ende) + 30000)}
        className="ml-auto h-10 rounded-lg border border-rand px-3 text-sm font-medium"
      >
        +30 s
      </button>
      <button type="button" onClick={() => setEnde(null)} className="h-10 rounded-lg border border-rand px-3 text-sm font-medium">
        {rest === 0 ? "Schließen" : "Überspringen"}
      </button>
    </div>
  );
}

const rpeText: Record<number, string> = {
  1: "sehr, sehr leicht",
  2: "sehr leicht",
  3: "leicht",
  4: "eher leicht",
  5: "mittel",
  6: "etwas anstrengend",
  7: "anstrengend",
  8: "sehr anstrengend",
  9: "extrem anstrengend",
  10: "maximal",
};

function Abschluss({
  abbrechen,
  speichern,
}: {
  abbrechen: () => void;
  speichern: (rpe: number | null, notiz: string) => void;
}) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [notiz, setNotiz] = useState("");
  return (
    <Karte titel="Training abschließen">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Wie anstrengend war das Training insgesamt? (Session-RPE)</legend>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={rpe === n}
              onClick={() => setRpe(n)}
              className={`h-12 rounded-xl border text-lg font-semibold ${
                rpe === n ? "border-akzent bg-akzent text-akzent-text" : "border-rand"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 min-h-5 text-sm text-leise">{rpe ? `${rpe} = ${rpeText[rpe]}` : "Deine Selbsteinschätzung."}</p>
      </fieldset>
      <div className="mt-3 flex flex-col gap-1">
        <label htmlFor="notiz" className="text-sm font-medium">
          Notiz für deinen Coach (freiwillig)
        </label>
        <textarea
          id="notiz"
          rows={2}
          maxLength={2000}
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          className="w-full rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => speichern(rpe, notiz.trim())}
          className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text"
        >
          Abschließen
        </button>
        <button type="button" onClick={abbrechen} className="h-12 rounded-xl border border-rand px-4 font-medium">
          Zurück
        </button>
      </div>
    </Karte>
  );
}
