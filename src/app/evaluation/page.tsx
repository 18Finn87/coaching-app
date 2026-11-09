"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { CheckinVerlauf } from "@/components/CheckinVerlauf";
import { Fortschritt } from "@/components/Fortschritt";
import {
  ENTSCHEIDUNG_TEXT,
  EVAL_SPALTEN,
  ausloeserText,
  checkinGesundheitLaden,
  checkinsLaden,
  type Checkin,
  type CheckinGesundheit,
  type Evaluation,
} from "@/lib/coaching";
import { useProfil } from "@/lib/konto";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";

export default function EvaluationSeite() {
  return (
    <NurFuer rolle="coach">
      <Suspense fallback={<p className="text-leise">Lädt …</p>}>
        <Inhalt />
      </Suspense>
    </NurFuer>
  );
}

function Inhalt() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const profil = useProfil();
  const [ev, setEv] = useState<Evaluation | null | undefined>(undefined);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [gesundheit, setGesundheit] = useState<Record<string, CheckinGesundheit>>({});
  const [einheiten, setEinheiten] = useState<{ gestartet_am: string; session_rpe: number | null }[]>([]);
  const [notiz, setNotiz] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const laden = useCallback(async () => {
    if (!id) {
      setEv(null);
      return;
    }
    const sb = supabase();
    const { data } = await sb.from("evaluationen").select(EVAL_SPALTEN).eq("id", id).maybeSingle();
    const e = (data as unknown as Evaluation | null) ?? null;
    setEv(e);
    if (!e) return;
    setNotiz(e.coach_notiz);
    const bis = e.erledigt_am ?? new Date().toISOString();
    const [c, g, t] = await Promise.all([
      checkinsLaden(e.athlet_id, 52),
      checkinGesundheitLaden(e.athlet_id),
      sb
        .from("trainingseinheiten")
        .select("gestartet_am, session_rpe")
        .eq("athlet_id", e.athlet_id)
        .eq("status", "abgeschlossen")
        .gte("gestartet_am", e.zeitraum_von)
        .lte("gestartet_am", bis)
        .order("gestartet_am"),
    ]);
    // Check-ins, deren Woche den Zeitraum berührt
    const vonWoche = new Date(e.zeitraum_von).getTime() - 7 * 24 * 60 * 60 * 1000;
    setCheckins(c.daten.filter((x) => new Date(x.woche + "T00:00:00").getTime() > vonWoche && x.woche <= bis.slice(0, 10)));
    setGesundheit(g.daten);
    setEinheiten((t.data as { gestartet_am: string; session_rpe: number | null }[] | null) ?? []);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  async function aendern(werte: Partial<Pick<Evaluation, "status" | "entscheidung" | "verschoben_bis" | "coach_notiz">>) {
    setLaeuft(true);
    setMeldung(null);
    const { error } = await supabase()
      .from("evaluationen")
      .update({ coach_notiz: notiz.trim(), ...werte })
      .eq("id", id);
    setLaeuft(false);
    if (error) {
      setMeldung({ ok: false, text: "Speichern hat nicht geklappt. Bitte versuche es erneut." });
      return false;
    }
    return true;
  }

  async function abschliessen(entscheidung: "beibehalten" | "anpassen") {
    if (!(await aendern({ status: "erledigt", entscheidung }))) return;
    if (entscheidung === "anpassen" && ev) {
      // Nur den Plan öffnen – eine neue Version legst du dort selbst an
      router.push(`/plan/?id=${ev.plan_id}&nach_evaluation=1`);
      return;
    }
    setMeldung({ ok: true, text: "Evaluation abgeschlossen. Der Plan läuft unverändert weiter." });
    laden();
  }

  async function verschieben() {
    const in7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (await aendern({ status: "verschoben", verschoben_bis: in7 })) {
      setMeldung({ ok: true, text: `Verschoben bis ${datum(in7)}. Dann erinnert dich die App erneut.` });
      laden();
    }
  }

  async function notizSpeichern() {
    if (await aendern({})) {
      setMeldung({ ok: true, text: "Notiz gespeichert." });
      laden();
    }
  }

  if (ev === undefined) return <p className="text-leise">Lädt …</p>;
  if (ev === null) {
    return (
      <>
        <Seitentitel titel="Nicht gefunden" />
        <Karte>
          <p>Diese Evaluation gibt es nicht oder du betreust die Person nicht mehr.</p>
          <Link href="/" className="mt-3 inline-block text-akzent underline underline-offset-4">
            Zur Übersicht
          </Link>
        </Karte>
      </>
    );
  }

  const erledigt = ev.status === "erledigt";
  const rpe = einheiten.filter((x) => x.session_rpe != null).map((x) => x.session_rpe!);
  const rpeSchnitt = rpe.length ? (rpe.reduce((a, b) => a + b, 0) / rpe.length).toLocaleString("de-DE", { maximumFractionDigits: 1 }) : null;
  const wochen = Math.max(
    1,
    Math.round(((erledigt ? new Date(ev.erledigt_am!) : new Date()).getTime() - new Date(ev.zeitraum_von).getTime()) / (7 * 24 * 60 * 60 * 1000)),
  );

  return (
    <>
      <Link href={`/athlet/?id=${ev.athlet_id}`} className="text-sm text-akzent underline underline-offset-4">
        ← {ev.athlet?.anzeigename || "Zur Person"}
      </Link>
      <Seitentitel
        titel={`Evaluation: ${ev.plan?.titel ?? "Plan"}`}
        text={`${ausloeserText(ev)} · Zeitraum ab ${datum(ev.zeitraum_von)}${erledigt ? ` bis ${datum(ev.erledigt_am)}` : ""}`}
      />

      {erledigt && (
        <Karte>
          <p className="font-semibold">Abgeschlossen am {datum(ev.erledigt_am)}</p>
          <p className="text-sm">Entscheidung: {ENTSCHEIDUNG_TEXT[ev.entscheidung ?? ""]}</p>
          {ev.entscheidung === "anpassen" && (
            <Link href={`/plan/?id=${ev.plan_id}`} className="mt-2 inline-block text-sm text-akzent underline underline-offset-4">
              Plan öffnen
            </Link>
          )}
        </Karte>
      )}

      <Karte titel="Im Zeitraum">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-background p-2">
            <dt className="text-xs text-leise">Einheiten</dt>
            <dd className="text-2xl font-semibold tabular-nums">{einheiten.length}</dd>
          </div>
          <div className="rounded-xl bg-background p-2">
            <dt className="text-xs text-leise">pro Woche</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {(einheiten.length / wochen).toLocaleString("de-DE", { maximumFractionDigits: 1 })}
            </dd>
          </div>
          <div className="rounded-xl bg-background p-2">
            <dt className="text-xs text-leise">Ø Anstrengung</dt>
            <dd className="text-2xl font-semibold tabular-nums">{rpeSchnitt ?? "–"}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-leise">Anstrengung = Selbsteinschätzung der Einheit (1–10).</p>
      </Karte>

      <Karte titel="Check-ins im Zeitraum">
        <CheckinVerlauf checkins={checkins} gesundheit={gesundheit} antwortTitel="Deine Antwort" />
      </Karte>

      <details className="rounded-2xl border border-rand bg-flaeche p-4">
        <summary className="cursor-pointer text-lg font-semibold">Vorgabe, Leistung und Fortschritt</summary>
        <div className="mt-3 flex flex-col gap-4">
          <Fortschritt athletId={ev.athlet_id} ichId={profil.id} />
        </div>
      </details>

      <Karte titel={erledigt ? "Notiz" : "Deine Entscheidung"}>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Notiz (nur für dich)
            <textarea
              value={notiz}
              maxLength={4000}
              rows={4}
              onChange={(e) => setNotiz(e.target.value)}
              className="w-full rounded-xl border border-rand bg-background px-3 py-2 text-base outline-none focus:border-akzent"
            />
          </label>
          {erledigt ? (
            <button
              type="button"
              disabled={laeuft || notiz.trim() === ev.coach_notiz}
              onClick={notizSpeichern}
              className="h-12 rounded-xl border border-rand px-4 font-medium disabled:opacity-50"
            >
              Notiz speichern
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => abschliessen("beibehalten")}
                className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
              >
                Plan beibehalten
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={() => abschliessen("anpassen")}
                className="h-12 rounded-xl border border-akzent px-4 font-semibold text-akzent disabled:opacity-50"
              >
                Plan anpassen
              </button>
              <button
                type="button"
                disabled={laeuft}
                onClick={verschieben}
                className="h-11 rounded-xl border border-rand px-4 font-medium disabled:opacity-50"
              >
                Um 1 Woche verschieben
              </button>
              <p className="text-xs text-leise">
                „Plan anpassen“ öffnet nur den Plan. Eine neue Version legst du dort selbst an – die App ändert nie
                etwas von allein. Danach beginnt die Zählung bis zur nächsten Evaluation neu.
              </p>
            </>
          )}
          {meldung && (
            <p role={meldung.ok ? "status" : "alert"} className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
              {meldung.text}
            </p>
          )}
        </div>
      </Karte>
    </>
  );
}
