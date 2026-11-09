"use client";

import { useCallback, useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { UebungAuswahl } from "./UebungAuswahl";
import {
  satztypText,
  versionInhaltLaden,
  type Einheit,
  type PlanUebung,
  type Satz,
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
              // Mit einem ersten Satz beginnen
              const vorgabe =
                uebung.messart === "zeit" || uebung.messart === "zeit_last"
                  ? { dauer_sek: 30 }
                  : uebung.messart === "distanz" || uebung.messart === "distanz_last"
                    ? { distanz_m: 20 }
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
  const mitLast = messart !== "wdh" && messart !== "zeit" && messart !== "distanz";

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

      <div className="flex flex-col gap-2">
        {pu.plan_saetze.map((s) => (
          <SatzZeile
            key={s.id}
            satz={s}
            mitWdh={mitWdh}
            mitZeit={mitZeit}
            mitStrecke={mitStrecke}
            mitLast={mitLast}
            aendern={aendern}
          />
        ))}
      </div>

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
        + Satz (wie der letzte)
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
  aendern,
}: {
  satz: Satz;
  mitWdh: boolean;
  mitZeit: boolean;
  mitStrecke: boolean;
  mitLast: boolean;
  aendern: Aendern;
}) {
  const sb = supabase();

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
        <span className="text-sm font-medium">Satz {satz.satznummer}</span>
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
        {mitZeit && zahlFeld("dauer_sek", "Dauer (s)", { ganz: true, min: 1, max: 86400 })}
        {mitStrecke && zahlFeld("distanz_m", "Strecke (m)", { ganz: true, min: 1, max: 100000 })}
        {mitLast && zahlFeld("last_kg", "kg", { min: 0, max: 1000 })}
        {mitLast && zahlFeld("last_prozent", "% 1RM", { min: 1, max: 120 })}
        {zahlFeld("rir_ziel", "RIR", { min: 0, max: 10 })}
        {zahlFeld("pause_sek", "Pause (s)", { ganz: true, min: 0, max: 1800 })}
      </div>
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
