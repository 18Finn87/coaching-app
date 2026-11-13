"use client";

import { hatLast } from "@/lib/uebungen";
import { INTENSITAET_ART, paceLesen, paceText, type Intensitaet } from "@/lib/ausdauer";
import { blockSaetze, blockText, type BlockEingabe } from "@/lib/intervall";
import { useCallback, useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { UebungAuswahl } from "./UebungAuswahl";
import {
  satztypText,
  versionInhaltLaden,
  type Einheit,
  type PlanUebung,
  type Satz,
  zeitText,
} from "@/lib/plaene";
import { supabase } from "@/lib/supabase";

const klein =
  "h-10 w-full min-w-0 rounded-lg border border-rand bg-background px-2 text-base outline-none focus:border-akzent";

/** Bearbeitet einen ENTWURF. Jede Änderung wird sofort gespeichert. */
export function PlanEditor({ versionId }: { versionId: string }) {
  const [einheiten, setEinheiten] = useState<Einheit[] | null>(null);
  const [fehler, setFehler] = useState("");
  const [gespeichert, setGespeichert] = useState(false);

  const laden = useCallback(async () => {
    const { daten, fehler } = await versionInhaltLaden(versionId);
    if (fehler) setFehler("Der Plan konnte nicht geladen werden.");
    setEinheiten(daten);
  }, [versionId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  /** Eine Änderung ausführen, danach neu laden und kurz „Gespeichert“ zeigen */
  const aendern = useCallback(
    async (aktion: () => PromiseLike<{ error: { message?: string; code?: string } | null }>) => {
      setFehler("");
      const { error } = await aktion();
      if (error) {
        setFehler(
          error.code === "23514"
            ? "Diese Angabe ist nicht erlaubt (z. B. „von“ größer als „bis“). Bitte prüfen."
            : "Speichern hat nicht geklappt. Bitte versuche es erneut.",
        );
      } else {
        setGespeichert(true);
        setTimeout(() => setGespeichert(false), 1500);
      }
      await laden();
    },
    [laden],
  );

  if (einheiten === null) return <p className="text-leise">Lädt …</p>;

  const sb = supabase();
  const naechsteReihenfolge = Math.max(0, ...einheiten.map((e) => e.reihenfolge)) + 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-14 z-[5] -mx-4 flex min-h-6 items-center justify-end px-4 text-sm" aria-live="polite">
        {gespeichert && <span className="rounded-full bg-akzent/15 px-3 py-1 text-akzent">Gespeichert</span>}
        {fehler && (
          <span role="alert" className="rounded-xl bg-red-500/15 px-3 py-1 text-red-500">
            {fehler}
          </span>
        )}
      </div>

      {einheiten.length === 0 && (
        <Karte>
          <p className="text-leise">Noch kein Trainingstag. Lege unten den ersten an.</p>
        </Karte>
      )}

      {einheiten.map((e, i) => (
        <EinheitKarte
          key={e.id}
          einheit={e}
          ersteOben={i === 0}
          letzteUnten={i === einheiten.length - 1}
          aendern={aendern}
          tauschen={(richtung) => {
            const anderer = einheiten[i + richtung];
            return aendern(async () => {
              const a = await sb.from("plan_einheiten").update({ reihenfolge: anderer.reihenfolge }).eq("id", e.id);
              if (a.error) return a;
              return sb.from("plan_einheiten").update({ reihenfolge: e.reihenfolge }).eq("id", anderer.id);
            });
          }}
        />
      ))}

      <button
        type="button"
        onClick={() =>
          aendern(() =>
            sb.from("plan_einheiten").insert({
              planversion_id: versionId,
              name: `Tag ${String.fromCharCode(65 + Math.min(einheiten.length, 25))}`,
              reihenfolge: naechsteReihenfolge,
            }),
          )
        }
        className="h-12 rounded-xl border border-dashed border-akzent px-4 font-medium text-akzent"
      >
        + Trainingstag
      </button>
    </div>
  );
}

type Aendern = (aktion: () => PromiseLike<{ error: { message?: string; code?: string } | null }>) => Promise<void>;

function EinheitKarte({
  einheit,
  ersteOben,
  letzteUnten,
  aendern,
  tauschen,
}: {
  einheit: Einheit;
  ersteOben: boolean;
  letzteUnten: boolean;
  aendern: Aendern;
  tauschen: (richtung: -1 | 1) => Promise<void>;
}) {
  const sb = supabase();
  const [auswahl, setAuswahl] = useState(false);
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const uebungen = einheit.plan_uebungen;

  return (
    <section className="rounded-2xl border border-rand bg-flaeche p-4">
      <div className="mb-3 flex items-center gap-2">
        <input
          key={einheit.name}
          aria-label="Name des Trainingstags"
          defaultValue={einheit.name}
          maxLength={80}
          onBlur={(ev) => {
            const n = ev.target.value.trim().replace(/\s+/g, " ");
            if (!n) {
              ev.target.value = einheit.name;
              return;
            }
            if (n !== einheit.name) aendern(() => sb.from("plan_einheiten").update({ name: n }).eq("id", einheit.id));
          }}
          className="h-11 min-w-0 flex-1 rounded-xl border border-rand bg-background px-3 text-lg font-semibold outline-none focus:border-akzent"
        />
        <Knopf titel="Nach oben" aus={ersteOben} onClick={() => tauschen(-1)}>
          ↑
        </Knopf>
        <Knopf titel="Nach unten" aus={letzteUnten} onClick={() => tauschen(1)}>
          ↓
        </Knopf>
        <Knopf titel="Trainingstag löschen" onClick={() => setLoeschenFragen(true)}>
          ✕
        </Knopf>
      </div>

      {loeschenFragen && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-400/50 bg-red-500/10 p-3 text-sm">
          <span>„{einheit.name}“ mit allen Übungen löschen?</span>
          <button
            type="button"
            onClick={() => aendern(() => sb.from("plan_einheiten").delete().eq("id", einheit.id))}
            className="h-9 rounded-lg bg-red-600 px-3 font-medium text-white"
          >
            Löschen
          </button>
          <button type="button" onClick={() => setLoeschenFragen(false)} className="h-9 rounded-lg border border-rand px-3">
            Abbrechen
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {uebungen.map((u, i) => (
          <UebungBlock
            key={u.id}
            pu={u}
            ersteOben={i === 0}
            letzteUnten={i === uebungen.length - 1}
            aendern={aendern}
            tauschen={(richtung) => {
              const anderer = uebungen[i + richtung];
              return aendern(async () => {
                const a = await sb.from("plan_uebungen").update({ reihenfolge: i + richtung }).eq("id", u.id);
                if (a.error) return a;
                return sb.from("plan_uebungen").update({ reihenfolge: i }).eq("id", anderer.id);
              });
            }}
          />
        ))}
      </div>

      {auswahl ? (
        <UebungAuswahl
          fuerPlanEinheit={einheit.id}
          abbrechen={() => setAuswahl(false)}
          waehlen={(uebung) => {
            setAuswahl(false);
            aendern(async () => {
              const neu = await sb
                .from("plan_uebungen")
                .insert({ plan_einheit_id: einheit.id, uebung_id: uebung.id, reihenfolge: uebungen.length })
                .select("id")
                .single();
              if (neu.error) return neu;
              if (uebung.messart === "intervall") return neu;
              // Leistungstest: 3 Versuche mit 2 min Pause
              if (uebung.messart === "test")
                return sb.from("plan_saetze").insert(
                  [1, 2, 3].map((n) => ({ plan_uebung_id: neu.data.id, satznummer: n, pause_sek: 120 })),
                );
              // Mit einem ersten Satz beginnen
              const vorgabe =
                uebung.messart === "zeit" || uebung.messart === "zeit_last"
                  ? { dauer_sek: 30 }
                  : uebung.messart === "distanz" || uebung.messart === "distanz_last"
                    ? { distanz_m: 20 }
                    : uebung.messart === "umfang"
                      ? {}
                      : { wdh_min: 8, wdh_max: 10 };
              return sb.from("plan_saetze").insert({ plan_uebung_id: neu.data.id, satznummer: 1, pause_sek: 90, ...vorgabe });
            });
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAuswahl(true)}
          className="mt-3 h-11 w-full rounded-xl border border-rand px-4 font-medium"
        >
          + Übung hinzufügen
        </button>
      )}
    </section>
  );
}

function UebungBlock({
  pu,
  ersteOben,
  letzteUnten,
  aendern,
  tauschen,
}: {
  pu: PlanUebung;
  ersteOben: boolean;
  letzteUnten: boolean;
  aendern: Aendern;
  tauschen: (richtung: -1 | 1) => Promise<void>;
}) {
  const sb = supabase();
  const messart = pu.uebung?.messart ?? "wdh_last";
  const mitWdh = messart === "wdh_last" || messart === "wdh";
  const mitZeit = messart === "zeit" || messart === "zeit_last";
  const mitStrecke = messart === "distanz" || messart === "distanz_last";
  const mitLast = hatLast(messart);
  const intervall = messart === "intervall";

  return (
    <div className="rounded-xl border border-rand p-3">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {pu.gruppe && <span className="mr-1 rounded bg-akzent/15 px-1.5 text-akzent">{pu.gruppe}</span>}
            {pu.uebung?.name ?? "Übung"}
            {pu.uebung?.einseitig && <span className="ml-1 text-xs text-leise">(pro Seite)</span>}
          </p>
        </div>
        <Knopf titel="Nach oben" aus={ersteOben} onClick={() => tauschen(-1)}>
          ↑
        </Knopf>
        <Knopf titel="Nach unten" aus={letzteUnten} onClick={() => tauschen(1)}>
          ↓
        </Knopf>
        <Knopf titel="Übung entfernen" onClick={() => aendern(() => sb.from("plan_uebungen").delete().eq("id", pu.id))}>
          ✕
        </Knopf>
      </div>

      <div className="mb-2 grid grid-cols-[auto_1fr] items-center gap-2">
        <select
          aria-label="Supersatz-Gruppe"
          value={pu.gruppe ?? ""}
          onChange={(e) =>
            aendern(() => sb.from("plan_uebungen").update({ gruppe: e.target.value || null }).eq("id", pu.id))
          }
          className="h-10 rounded-lg border border-rand bg-background px-2 text-sm"
        >
          <option value="">kein Supersatz</option>
          {["A", "B", "C", "D", "E"].map((g) => (
            <option key={g} value={g}>
              Supersatz {g}
            </option>
          ))}
        </select>
        <input
          key={pu.hinweis}
          aria-label="Hinweis zur Übung"
          placeholder="Hinweis (z. B. Griffbreite)"
          defaultValue={pu.hinweis}
          maxLength={500}
          onBlur={(ev) => {
            const h = ev.target.value.trim();
            if (h !== pu.hinweis) aendern(() => sb.from("plan_uebungen").update({ hinweis: h }).eq("id", pu.id));
          }}
          className="h-10 min-w-0 rounded-lg border border-rand bg-background px-2 text-sm outline-none focus:border-akzent"
        />
      </div>
      <label className="mb-2 flex items-center gap-2 text-sm">
        <span className="text-leise">Schmerzgrenze (0–10)</span>
        <input
          key={`sg-${pu.schmerzgrenze ?? ""}`}
          aria-label="Schmerzgrenze 0 bis 10"
          inputMode="numeric"
          placeholder={pu.uebung?.modul === "reha" ? "keine" : "–"}
          defaultValue={pu.schmerzgrenze ?? ""}
          onBlur={(ev) => {
            const t = ev.target.value.trim();
            const n = t === "" ? null : Number(t);
            if (n !== null && (!Number.isInteger(n) || n < 0 || n > 10)) {
              ev.target.value = pu.schmerzgrenze?.toString() ?? "";
              return;
            }
            if (n !== (pu.schmerzgrenze ?? null))
              aendern(() => sb.from("plan_uebungen").update({ schmerzgrenze: n }).eq("id", pu.id));
          }}
          className="h-9 w-16 rounded-lg border border-rand bg-background px-2 text-center text-sm outline-none focus:border-akzent"
        />
        <span className="text-xs text-leise">
          {pu.uebung?.modul === "reha" ? "Reha: Schmerz wird immer abgefragt" : "mit Grenze wird nach Schmerz gefragt"}
        </span>
      </label>

      <div className="flex flex-col gap-2">
        {pu.plan_saetze.map((s) => (
          <SatzZeile
            key={s.id}
            satz={s}
            mitWdh={mitWdh}
            mitZeit={mitZeit}
            mitStrecke={mitStrecke}
            mitLast={mitLast}
            ausdauer={messart === "ausdauer"}
            intervall={intervall}
            test={messart === "test"}
            aendern={aendern}
          />
        ))}
      </div>

      {intervall && pu.plan_saetze.length > 0 && (
        <p className="mt-2 text-sm font-medium">{blockText(pu.plan_saetze, zeitText)}</p>
      )}
      {intervall && (
        <IntervallBaukasten
          leer={pu.plan_saetze.length === 0}
          erzeugen={(b) => {
            const start = (pu.plan_saetze[pu.plan_saetze.length - 1]?.satznummer ?? 0) + 1;
            aendern(() =>
              sb.from("plan_saetze").insert(blockSaetze(b, start).map((x) => ({ plan_uebung_id: pu.id, ...x }))),
            );
          }}
          alleEntfernen={() => aendern(() => sb.from("plan_saetze").delete().eq("plan_uebung_id", pu.id))}
        />
      )}

      <button
        type="button"
        onClick={() => {
          const letzter = pu.plan_saetze[pu.plan_saetze.length - 1];
          const kopie = letzter
            ? {
                satztyp: letzter.satztyp,
                wdh_min: letzter.wdh_min,
                wdh_max: letzter.wdh_max,
                last_kg: letzter.last_kg,
                last_prozent: letzter.last_prozent,
                rir_ziel: letzter.rir_ziel,
                tempo: letzter.tempo,
                pause_sek: letzter.pause_sek,
                dauer_sek: letzter.dauer_sek,
                distanz_m: letzter.distanz_m,
                // Intensität mitnehmen, aber nicht das Serienende
                zusatz: (({ serienende: _weg, ...rest }) => (void _weg, rest))(letzter.zusatz ?? {}),
              }
            : {};
          aendern(() =>
            sb.from("plan_saetze").insert({
              plan_uebung_id: pu.id,
              satznummer: (letzter?.satznummer ?? 0) + 1,
              ...kopie,
            }),
          );
        }}
        className="mt-2 h-10 w-full rounded-lg border border-dashed border-rand text-sm font-medium text-leise"
      >
        {intervall ? "+ Runde (wie die letzte)" : "+ Satz (wie der letzte)"}
      </button>
    </div>
  );
}

function SatzZeile({
  satz,
  mitWdh,
  mitZeit,
  mitStrecke,
  mitLast,
  ausdauer = false,
  intervall = false,
  test = false,
  aendern,
}: {
  satz: Satz;
  mitWdh: boolean;
  mitZeit: boolean;
  mitStrecke: boolean;
  mitLast: boolean;
  ausdauer?: boolean;
  intervall?: boolean;
  test?: boolean;
  aendern: Aendern;
}) {
  const sb = supabase();
  const intensitaet = satz.zusatz?.intensitaet ?? null;
  function intensitaetSetzen(neu: Intensitaet | null) {
    const zusatz = { ...(satz.zusatz ?? {}) };
    if (neu) zusatz.intensitaet = neu;
    else delete zusatz.intensitaet;
    aendern(() => sb.from("plan_saetze").update({ zusatz }).eq("id", satz.id));
  }

  function zahlFeld(spalte: keyof Satz, label: string, opt: { ganz?: boolean; min: number; max: number }) {
    const wert = satz[spalte] as number | null;
    return (
      <label className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] text-leise">{label}</span>
        <input
          key={`${spalte}-${wert}`}
          inputMode={opt.ganz ? "numeric" : "decimal"}
          defaultValue={wert ?? ""}
          onBlur={(ev) => {
            const text = ev.target.value.trim().replace(",", ".");
            const neu = text === "" ? null : Number(text);
            if (neu !== null && (Number.isNaN(neu) || neu < opt.min || neu > opt.max || (opt.ganz && !Number.isInteger(neu)))) {
              ev.target.value = wert?.toString() ?? "";
              return;
            }
            if (neu !== wert) aendern(() => sb.from("plan_saetze").update({ [spalte]: neu }).eq("id", satz.id));
          }}
          className={klein}
        />
      </label>
    );
  }

  return (
    <div className="rounded-lg bg-background/60 p-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-sm font-medium">
          {intervall ? "Runde" : test ? "Versuch" : "Satz"} {satz.satznummer}
          {intervall && satz.zusatz?.serienende && <span className="ml-1 text-xs font-normal text-leise">· Serienende</span>}
        </span>
        <select
          aria-label="Satztyp"
          value={satz.satztyp}
          onChange={(e) => aendern(() => sb.from("plan_saetze").update({ satztyp: e.target.value }).eq("id", satz.id))}
          className="h-8 rounded-lg border border-rand bg-background px-1 text-xs"
        >
          {Object.entries(satztypText).map(([w, t]) => (
            <option key={w} value={w}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={`Satz ${satz.satznummer} löschen`}
          onClick={() => aendern(() => sb.from("plan_saetze").delete().eq("id", satz.id))}
          className="ml-auto h-8 w-8 rounded-lg text-leise"
        >
          ✕
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {mitWdh && zahlFeld("wdh_min", "Wdh. von", { ganz: true, min: 1, max: 100 })}
        {mitWdh && zahlFeld("wdh_max", "Wdh. bis", { ganz: true, min: 1, max: 100 })}
        {ausdauer && (
          <>
            <Umgerechnet
              label="Dauer (min)"
              wert={satz.dauer_sek}
              faktor={60}
              max={1440}
              setzen={(w) => aendern(() => sb.from("plan_saetze").update({ dauer_sek: w }).eq("id", satz.id))}
            />
            <Umgerechnet
              label="Strecke (km)"
              wert={satz.distanz_m}
              faktor={1000}
              max={100}
              setzen={(w) => aendern(() => sb.from("plan_saetze").update({ distanz_m: w }).eq("id", satz.id))}
            />
          </>
        )}
        {!ausdauer && mitZeit && zahlFeld("dauer_sek", "Dauer (s)", { ganz: true, min: 1, max: 86400 })}
        {!ausdauer && mitStrecke && zahlFeld("distanz_m", "Strecke (m)", { ganz: true, min: 1, max: 100000 })}
        {intervall && zahlFeld("dauer_sek", "Zeit (s)", { ganz: true, min: 1, max: 86400 })}
        {intervall && zahlFeld("distanz_m", "Strecke (m)", { ganz: true, min: 1, max: 100000 })}
        {mitLast && zahlFeld("last_kg", "kg", { min: 0, max: 1000 })}
        {mitLast && zahlFeld("last_prozent", "% 1RM", { min: 1, max: 120 })}
        {!ausdauer && !intervall && !test && zahlFeld("rir_ziel", "RIR", { min: 0, max: 10 })}
        {zahlFeld("pause_sek", "Pause (s)", { ganz: true, min: 0, max: 1800 })}
      </div>
      {(ausdauer || intervall) && <IntensitaetFeld wert={intensitaet} setzen={intensitaetSetzen} />}
    </div>
  );
}

/** Zahl in einer anderen Einheit anzeigen, z. B. Minuten statt Sekunden, km statt m. */
function Umgerechnet({
  label,
  wert,
  faktor,
  max,
  setzen,
}: {
  label: string;
  wert: number | null;
  faktor: number;
  max: number;
  setzen: (w: number | null) => void;
}) {
  const anzeige = wert == null ? "" : String(Math.round((wert / faktor) * 100) / 100).replace(".", ",");
  return (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] text-leise">{label}</span>
      <input
        key={`${label}-${wert}`}
        inputMode="decimal"
        defaultValue={anzeige}
        onBlur={(ev) => {
          const text = ev.target.value.trim().replace(",", ".");
          const zahl = text === "" ? null : Number(text);
          if (zahl !== null && (Number.isNaN(zahl) || zahl <= 0 || zahl > max)) {
            ev.target.value = anzeige;
            return;
          }
          const neu = zahl === null ? null : Math.round(zahl * faktor);
          if (neu !== wert) setzen(neu);
        }}
        className={klein}
      />
    </label>
  );
}

/** Intensitäts-Vorgabe für Ausdauer: Pulszone, Pace, km/h, Watt oder Anstrengung. */
function IntensitaetFeld({ wert, setzen }: { wert: Intensitaet | null; setzen: (w: Intensitaet | null) => void }) {
  const art = wert?.art ?? "";
  const istPace = art === "pace";
  const zeige = (n: number | null) => (n == null ? "" : istPace ? paceText(n).replace(" /km", "") : String(n).replace(".", ","));
  const lese = (t: string): number | null | undefined => {
    const x = t.trim();
    if (x === "") return null;
    if (istPace) return paceLesen(x) ?? undefined;
    const n = Number(x.replace(",", "."));
    if (Number.isNaN(n) || n < 0) return undefined;
    if (art === "zone" && !(Number.isInteger(n) && n >= 1 && n <= 5)) return undefined;
    if (art === "rpe" && !(Number.isInteger(n) && n >= 1 && n <= 10)) return undefined;
    return n;
  };
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      <label className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] text-leise">Intensität</span>
        <select
          value={art}
          onChange={(e) => {
            const neu = e.target.value as Intensitaet["art"] | "";
            setzen(neu ? { art: neu, von: null, bis: null } : null);
          }}
          className={klein}
        >
          <option value="">keine</option>
          {Object.entries(INTENSITAET_ART).map(([w, t]) => (
            <option key={w} value={w}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {wert &&
        (["von", "bis"] as const).map((feld) => (
          <label key={feld} className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[11px] text-leise">
              {feld}
              {istPace ? " (m:ss)" : ""}
            </span>
            <input
              key={`${art}-${feld}-${wert[feld]}`}
              inputMode={istPace ? "text" : "decimal"}
              defaultValue={zeige(wert[feld])}
              placeholder={istPace ? "5:30" : art === "zone" ? "2" : ""}
              onBlur={(ev) => {
                const n = lese(ev.target.value);
                if (n === undefined) {
                  ev.target.value = zeige(wert[feld]);
                  return;
                }
                if (n !== wert[feld]) setzen({ ...wert, [feld]: n });
              }}
              className={klein}
            />
          </label>
        ))}
    </div>
  );
}

/** Intervall-Block erzeugen: Runden × Belastung, Pause, Serien mit Serienpause. */
function IntervallBaukasten({
  leer,
  erzeugen,
  alleEntfernen,
}: {
  leer: boolean;
  erzeugen: (b: BlockEingabe) => void;
  alleEntfernen: () => void;
}) {
  const [offen, setOffen] = useState(leer);
  const [w, setW] = useState({ runden: "6", serien: "1", art: "strecke" as "zeit" | "strecke", wert: "400", pause: "90", serienpause: "180" });
  const [fehler, setFehler] = useState("");
  const zahl = (t: string) => Number(t.replace(",", "."));

  if (!offen) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => setOffen(true)} className="h-10 rounded-lg border border-rand px-3 text-sm font-medium">
          + Block hinzufügen
        </button>
        {!leer && (
          <button type="button" onClick={alleEntfernen} className="h-10 rounded-lg border border-rand px-3 text-sm text-leise">
            Alle Runden entfernen
          </button>
        )}
      </div>
    );
  }

  function los() {
    const b: BlockEingabe = {
      runden: zahl(w.runden),
      serien: zahl(w.serien),
      art: w.art,
      wert: zahl(w.wert),
      pauseSek: zahl(w.pause),
      serienpauseSek: zahl(w.serienpause),
    };
    const ganz = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
    if (
      !ganz(b.runden, 1, 30) ||
      !ganz(b.serien, 1, 10) ||
      b.runden * b.serien > 50 ||
      !ganz(b.wert, 1, b.art === "zeit" ? 3600 : 50000) ||
      !ganz(b.pauseSek, 0, 1800) ||
      !ganz(b.serienpauseSek, 0, 1800)
    ) {
      setFehler("Bitte ganze Zahlen prüfen: 1–30 Runden, 1–10 Serien (höchstens 50 Runden), Pausen bis 1800 s.");
      return;
    }
    setFehler("");
    erzeugen(b);
    setOffen(false);
  }

  const f = (feld: keyof typeof w, label: string) => (
    <label className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] text-leise">{label}</span>
      <input inputMode="numeric" value={w[feld]} onChange={(e) => setW({ ...w, [feld]: e.target.value })} className={klein} />
    </label>
  );

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-lg border border-akzent/50 p-2">
      <p className="text-sm font-medium">Intervall-Block</p>
      <div className="flex gap-2" role="group" aria-label="Belastung nach">
        {(["strecke", "zeit"] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={w.art === a}
            onClick={() => setW({ ...w, art: a, wert: a === "zeit" ? "60" : "400" })}
            className={`h-9 flex-1 rounded-lg border text-sm ${w.art === a ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"}`}
          >
            {a === "strecke" ? "nach Strecke" : "nach Zeit"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {f("runden", "Runden")}
        {f("wert", w.art === "zeit" ? "Belastung (s)" : "Strecke (m)")}
        {f("pause", "Pause (s)")}
        {f("serien", "Serien")}
        {f("serienpause", "Serienpause (s)")}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={los} className="h-10 flex-1 rounded-lg bg-akzent text-sm font-semibold text-akzent-text">
          Runden anlegen
        </button>
        {!leer && (
          <button type="button" onClick={() => setOffen(false)} className="h-10 rounded-lg border border-rand px-3 text-sm">
            Abbrechen
          </button>
        )}
      </div>
      {fehler && (
        <p role="alert" className="text-sm text-red-500">
          {fehler}
        </p>
      )}
    </div>
  );
}

function Knopf({
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
      title={titel}
      disabled={aus}
      onClick={onClick}
      className="h-10 w-10 shrink-0 rounded-lg border border-rand text-leise disabled:opacity-30"
    >
      {children}
    </button>
  );
}
