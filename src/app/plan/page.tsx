"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { PlanAnsicht } from "@/components/PlanAnsicht";
import { PlanEditor } from "@/components/PlanEditor";
import { VersionsVergleich } from "@/components/VersionsVergleich";
import { planFehler, versionStatusText, type Plan, type Version } from "@/lib/plaene";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";

export default function PlanSeite() {
  return (
    <NurFuer rolle="coach">
      <Suspense fallback={<p className="text-leise">Lädt …</p>}>
        <Inhalt />
      </Suspense>
    </NurFuer>
  );
}

function Inhalt() {
  const parameter = useSearchParams();
  const id = parameter.get("id") ?? "";
  const nachEvaluation = parameter.get("nach_evaluation") === "1";
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [person, setPerson] = useState("");
  const [versionen, setVersionen] = useState<Version[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [grund, setGrund] = useState("");
  const [vergleich, setVergleich] = useState(false);
  const [verwerfenFragen, setVerwerfenFragen] = useState(false);

  const laden = useCallback(
    async (auswahl?: string) => {
      if (!id) {
        setPlan(null);
        return;
      }
      const sb = supabase();
      const [p, v] = await Promise.all([
        sb.from("plaene").select("id, athlet_id, titel, ziel, status, erstellt_am").eq("id", id).maybeSingle(),
        sb
          .from("planversionen")
          .select("id, plan_id, versionsnummer, status, gueltig_ab, aenderungsgrund, erstellt_am, veroeffentlicht_am")
          .eq("plan_id", id)
          .order("versionsnummer", { ascending: false }),
      ]);
      const planDaten = (p.data as Plan | null) ?? null;
      setPlan(planDaten);
      const liste = (v.data as Version[] | null) ?? [];
      setVersionen(liste);
      setGewaehlt((alt) => {
        if (auswahl) return auswahl;
        if (alt && liste.some((x) => x.id === alt)) return alt;
        return (liste.find((x) => x.status === "entwurf") ?? liste.find((x) => x.status === "veroeffentlicht") ?? liste[0])?.id ?? null;
      });
      if (planDaten) {
        const { data } = await sb.from("profile").select("anzeigename").eq("id", planDaten.athlet_id).maybeSingle();
        setPerson((data as { anzeigename: string } | null)?.anzeigename ?? "");
      }
    },
    [id],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  if (plan === undefined) return <p className="text-leise">Lädt …</p>;
  if (plan === null) {
    return (
      <Karte>
        <p>Diesen Plan gibt es nicht oder du hast keinen Zugriff mehr.</p>
        <Link href="/plaene/" className="mt-3 inline-block text-akzent underline underline-offset-4">
          Zu den Plänen
        </Link>
      </Karte>
    );
  }

  const version = versionen.find((v) => v.id === gewaehlt) ?? null;
  const entwurf = versionen.find((v) => v.status === "entwurf");
  const vorgaenger = version ? versionen.find((v) => v.versionsnummer === version.versionsnummer - 1) : undefined;
  const nieVeroeffentlicht = !versionen.some((v) => v.status !== "entwurf");

  async function veroeffentlichen() {
    if (!version) return;
    setLaeuft(true);
    setMeldung(null);
    const sb = supabase();
    if (grund.trim() !== version.aenderungsgrund) {
      await sb.from("planversionen").update({ aenderungsgrund: grund.trim() }).eq("id", version.id);
    }
    const { error } = await sb.rpc("plan_veroeffentlichen", { p_version: version.id });
    setLaeuft(false);
    if (error) {
      setMeldung({ ok: false, text: planFehler(error) });
      return;
    }
    setMeldung({ ok: true, text: `Version ${version.versionsnummer} ist veröffentlicht. ${person || "Die Person"} sieht sie jetzt.` });
    setGrund("");
    laden(version.id);
  }

  async function neueVersion() {
    setLaeuft(true);
    setMeldung(null);
    const { data, error } = await supabase().rpc("plan_neue_version", { p_plan: plan!.id, p_aenderungsgrund: "" });
    setLaeuft(false);
    if (error) {
      setMeldung({ ok: false, text: planFehler(error) });
      return;
    }
    laden(data as string);
  }

  async function verwerfen() {
    if (!entwurf) return;
    setLaeuft(true);
    const sb = supabase();
    const { error } = nieVeroeffentlicht
      ? await sb.from("plaene").delete().eq("id", plan!.id)
      : await sb.from("planversionen").delete().eq("id", entwurf.id);
    setLaeuft(false);
    setVerwerfenFragen(false);
    if (error) {
      setMeldung({ ok: false, text: planFehler(error) });
      return;
    }
    if (nieVeroeffentlicht) router.push("/plaene/");
    else laden();
  }

  async function archivUmschalten() {
    await supabase()
      .from("plaene")
      .update({ status: plan!.status === "aktiv" ? "archiviert" : "aktiv" })
      .eq("id", plan!.id);
    laden();
  }

  return (
    <>
      <Link href="/plaene/" className="text-sm text-akzent underline underline-offset-4">
        ← Alle Pläne
      </Link>
      <Seitentitel titel={plan.titel} text={`für ${person || "–"}${plan.status === "archiviert" ? " · archiviert" : ""}`} />
      {plan.ziel && <p className="-mt-2 whitespace-pre-wrap text-sm text-leise">{plan.ziel}</p>}
      {nachEvaluation && (
        <p role="status" className="rounded-xl border border-akzent bg-akzent/10 p-3 text-sm">
          Evaluation abgeschlossen: „Plan anpassen“. Am Plan wurde nichts verändert. Wenn du etwas ändern willst, lege
          unten eine neue Version an und veröffentliche sie.
        </p>
      )}

      <Karte titel="Versionen">
        <div className="flex flex-wrap gap-2">
          {versionen.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setGewaehlt(v.id);
                setVergleich(false);
                setMeldung(null);
              }}
              aria-pressed={v.id === gewaehlt}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                v.id === gewaehlt ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"
              }`}
            >
              V{v.versionsnummer} · {versionStatusText[v.status]}
            </button>
          ))}
        </div>
        {version && (
          <p className="mt-2 text-sm text-leise">
            {version.status === "entwurf"
              ? "Entwurf – nur für dich sichtbar. Änderungen werden sofort gespeichert."
              : `Veröffentlicht am ${datum(version.veroeffentlicht_am)}${version.gueltig_ab ? ` · gültig ab ${datum(version.gueltig_ab)}` : ""}. Nicht mehr änderbar.`}
            {version.aenderungsgrund && ` Grund: ${version.aenderungsgrund}`}
          </p>
        )}
        {!entwurf && plan.status === "aktiv" && (
          <button
            type="button"
            disabled={laeuft}
            onClick={neueVersion}
            className="mt-3 h-11 rounded-xl border border-akzent px-4 font-medium text-akzent disabled:opacity-50"
          >
            Neue Version erstellen (Kopie der gültigen)
          </button>
        )}
        {vorgaenger && (
          <button
            type="button"
            onClick={() => setVergleich(!vergleich)}
            aria-expanded={vergleich}
            className="mt-3 block text-sm text-akzent underline underline-offset-4"
          >
            {vergleich ? "Vergleich ausblenden" : `Änderungen gegenüber V${vorgaenger.versionsnummer} zeigen`}
          </button>
        )}
        {vergleich && vorgaenger && version && (
          <div className="mt-3 rounded-xl border border-rand p-3">
            <VersionsVergleich key={version.id} altId={vorgaenger.id} neuId={version.id} />
          </div>
        )}
        {meldung && (
          <p role="status" className={`mt-3 text-sm ${meldung.ok ? "text-akzent" : "text-red-500"}`}>
            {meldung.text}
          </p>
        )}
      </Karte>

      {version &&
        (version.status === "entwurf" ? (
          <>
            <PlanEditor key={version.id} versionId={version.id} />
            <Karte titel="Veröffentlichen">
              <p className="mb-3 text-sm text-leise">
                Danach sieht {person || "die Person"} diese Version und kann damit trainieren. Die Version lässt sich
                dann nicht mehr ändern – für Änderungen erstellst du eine neue Version.
              </p>
              {version.versionsnummer > 1 && (
                <div className="mb-3 flex flex-col gap-1">
                  <label htmlFor="grund" className="text-sm font-medium">
                    Was hat sich geändert? (freiwillig, sieht nur du)
                  </label>
                  <input
                    id="grund"
                    value={grund}
                    maxLength={1000}
                    onChange={(e) => setGrund(e.target.value)}
                    placeholder="z. B. Gewichte gesteigert nach Evaluation"
                    className="h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={laeuft}
                  onClick={veroeffentlichen}
                  className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
                >
                  {laeuft ? "…" : `Version ${version.versionsnummer} veröffentlichen`}
                </button>
                {!verwerfenFragen ? (
                  <button
                    type="button"
                    onClick={() => setVerwerfenFragen(true)}
                    className="h-12 rounded-xl border border-rand px-4 font-medium text-leise"
                  >
                    {nieVeroeffentlicht ? "Plan verwerfen" : "Entwurf verwerfen"}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 text-sm">
                    Wirklich?
                    <button
                      type="button"
                      onClick={verwerfen}
                      className="h-10 rounded-lg bg-red-600 px-3 font-medium text-white"
                    >
                      Ja, verwerfen
                    </button>
                    <button
                      type="button"
                      onClick={() => setVerwerfenFragen(false)}
                      className="h-10 rounded-lg border border-rand px-3"
                    >
                      Nein
                    </button>
                  </span>
                )}
              </div>
            </Karte>
          </>
        ) : (
          <PlanAnsicht key={version.id} versionId={version.id} />
        ))}

      {!nieVeroeffentlicht && (
        <button
          type="button"
          onClick={archivUmschalten}
          className="h-11 self-start rounded-xl border border-rand px-4 text-sm font-medium text-leise"
        >
          {plan.status === "aktiv" ? "Plan archivieren" : "Plan wieder aktivieren"}
        </button>
      )}
    </>
  );
}
