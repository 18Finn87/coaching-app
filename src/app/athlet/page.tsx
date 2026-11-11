"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { AnamneseAnsicht } from "@/components/AnamneseAnsicht";
import { CheckinsFuerCoach, EvaluationenFuerCoach } from "@/components/CoachingKarten";
import type { Stufe } from "@/lib/evaluation";
import { EinheitenListe } from "@/components/EinheitenListe";
import { Fortschritt } from "@/components/Fortschritt";
import { NachrichtenFuerCoach } from "@/components/NachrichtenFuerCoach";
import { PulsEinstellung } from "@/components/PulsEinstellung";
import { useProfil } from "@/lib/konto";
import { stammdatenLaden, type Stammdaten } from "@/lib/stammdaten";
import { supabase } from "@/lib/supabase";
import { ausstattungText, datum, statusText, stufeText, tagText, zielText } from "@/lib/texte";

type Betreuung = {
  id: string;
  athlet_id: string;
  status: string;
  erfahrungsstufe: string;
  start_am: string;
  athlet: { anzeigename: string } | null;
};

export default function AthletSeite() {
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
  const [b, setB] = useState<Betreuung | null | undefined>(undefined);
  const [stamm, setStamm] = useState<Stammdaten | null>(null);
  const [einw, setEinw] = useState<{ art: string; erteilt_am: string }[]>([]);

  const laden = useCallback(async () => {
    if (!id) {
      setB(null);
      return;
    }
    const sb = supabase();
    const [r, s, e] = await Promise.all([
      sb
        .from("coach_athlet")
        .select("id, athlet_id, status, erfahrungsstufe, start_am, athlet:profile!athlet_id(anzeigename)")
        .eq("athlet_id", id)
        .maybeSingle(),
      stammdatenLaden(id),
      sb.from("einwilligungen").select("art, erteilt_am").eq("athlet_id", id).is("widerrufen_am", null),
    ]);
    setB((r.data as unknown as Betreuung | null) ?? null);
    setStamm(s.daten);
    setEinw((e.data as { art: string; erteilt_am: string }[]) ?? []);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  if (b === undefined) return <p className="text-leise">Lädt …</p>;
  if (b === null) {
    return (
      <>
        <Seitentitel titel="Nicht gefunden" />
        <Karte>
          <p>Diese Person gibt es nicht oder du betreust sie nicht.</p>
          <Link href="/athleten/" className="mt-3 inline-block text-akzent underline underline-offset-4">
            Zurück zur Liste
          </Link>
        </Karte>
      </>
    );
  }

  const hatGesundheit = einw.some((x) => x.art === "gesundheitsdaten");
  const beendet = b.status === "beendet";

  return (
    <>
      <Link href="/athleten/" className="text-sm text-akzent underline underline-offset-4">
        ← Alle Athleten
      </Link>
      <Seitentitel
        titel={b.athlet?.anzeigename || (beendet ? "Betreuung beendet" : "Ohne Namen")}
        text={`${statusText[b.status]} · betreut seit ${datum(b.start_am)}`}
      />

      <BetreuungVerwalten betreuung={b} beiAenderung={laden} />

      {beendet ? (
        <Karte>
          <p className="text-sm text-leise">
            Die Betreuung ist beendet. Deshalb siehst du keine Angaben dieser Person mehr.
          </p>
        </Karte>
      ) : (
        <>
          <Karte titel="Einwilligungen">
            <ul className="flex flex-col gap-1 text-sm">
              <li>Nutzung der App: {einw.some((x) => x.art === "nutzung") ? "✓ erteilt" : "– fehlt noch"}</li>
              <li>Gesundheitsdaten: {hatGesundheit ? "✓ erteilt" : "– nicht erteilt"}</li>
            </ul>
          </Karte>

          <Karte titel="Angaben zum Training">
            {!stamm ? (
              <p className="text-sm text-leise">Noch keine Angaben.</p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-leise">Geburtsjahr</dt>
                <dd>{stamm.geburtsjahr ?? "–"}</dd>
                <dt className="text-leise">Krafttraining seit</dt>
                <dd>{stamm.training_seit ?? "–"}</dd>
                <dt className="text-leise">Ziele</dt>
                <dd>{stamm.ziele.map((z) => zielText[z]).join(", ") || "–"}</dd>
                {stamm.ziel_text && (
                  <>
                    <dt className="text-leise">In eigenen Worten</dt>
                    <dd className="whitespace-pre-wrap">{stamm.ziel_text}</dd>
                  </>
                )}
                <dt className="text-leise">Trainingstage</dt>
                <dd>{stamm.trainingstage.map((t) => tagText[t]).join(", ") || "–"}</dd>
                <dt className="text-leise">Zeit pro Einheit</dt>
                <dd>{stamm.einheit_minuten ? `${stamm.einheit_minuten} Minuten` : "–"}</dd>
                <dt className="text-leise">Ausstattung</dt>
                <dd>{stamm.ausstattung.map((a) => ausstattungText[a]).join(", ") || "–"}</dd>
                <dt className="text-leise">Zuletzt geändert</dt>
                <dd>{datum(stamm.aktualisiert_am)}</dd>
              </dl>
            )}
          </Karte>

          <EvaluationenFuerCoach athletId={b.athlet_id} stufe={b.erfahrungsstufe as Stufe} />

          <div id="nachrichten" className="scroll-mt-20">
            <NachrichtenFuerCoach athletId={b.athlet_id} />
          </div>

          <CheckinsFuerCoach athletId={b.athlet_id} />

          <Karte titel="Letzte Einheiten">
            <EinheitenListe athletId={b.athlet_id} grenze={10} />
          </Karte>

          <FortschrittAufklappbar athletId={b.athlet_id} />

          <Karte titel="Videos">
            <Link href={`/videos/?athlet=${b.athlet_id}`} className="font-medium text-akzent underline underline-offset-4">
              Technik-Videos ansehen und hochladen
            </Link>
            <p className="text-sm text-leise">
              {einw.some((x) => x.art === "videos")
                ? "Zeitlupe, Anmerkungen, Linien und Winkel, Vergleich vorher/nachher."
                : "Hochladen geht erst mit der Einwilligung „Videos“ der Person."}
            </p>
          </Karte>

          <PulsEinstellung athletId={b.athlet_id} />

          <AnamneseAnsicht athletId={b.athlet_id} einwilligung={hatGesundheit} />
        </>
      )}
    </>
  );
}

function FortschrittAufklappbar({ athletId }: { athletId: string }) {
  const profil = useProfil();
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={offen}
        onClick={() => setOffen(!offen)}
        className="h-12 rounded-xl border border-rand bg-flaeche px-4 text-left font-semibold"
      >
        {offen ? "▾" : "▸"} Fortschritt und Maximaltests
      </button>
      {offen && <Fortschritt athletId={athletId} ichId={profil.id} />}
    </>
  );
}

function BetreuungVerwalten({
  betreuung,
  beiAenderung,
}: {
  betreuung: Betreuung;
  beiAenderung: () => void;
}) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const [beendenFragen, setBeendenFragen] = useState(false);

  async function aendern(werte: { erfahrungsstufe?: string; status?: string }) {
    setLaeuft(true);
    setFehler("");
    const { error } = await supabase().from("coach_athlet").update(werte).eq("id", betreuung.id);
    setLaeuft(false);
    setBeendenFragen(false);
    if (error) setFehler("Speichern hat nicht geklappt. Bitte versuche es erneut.");
    beiAenderung();
  }

  const auswahl =
    "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

  return (
    <Karte titel="Betreuung">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="stufe" className="text-sm font-medium">
            Erfahrungsstufe
          </label>
          <select
            id="stufe"
            value={betreuung.erfahrungsstufe}
            disabled={laeuft || betreuung.status === "beendet"}
            onChange={(e) => aendern({ erfahrungsstufe: e.target.value })}
            className={auswahl}
          >
            {Object.entries(stufeText).map(([wert, text]) => (
              <option key={wert} value={wert}>
                {text}
              </option>
            ))}
          </select>
          <p className="text-xs text-leise">Bestimmt später, wann eine Evaluation fällig wird.</p>
        </div>

        {betreuung.status !== "eingeladen" && (
          <div className="flex flex-wrap gap-2">
            {betreuung.status !== "aktiv" && (
              <button
                type="button"
                disabled={laeuft}
                onClick={() => aendern({ status: "aktiv" })}
                className="h-11 rounded-xl border border-rand px-4 font-medium"
              >
                {betreuung.status === "beendet" ? "Wieder aufnehmen" : "Fortsetzen"}
              </button>
            )}
            {betreuung.status === "aktiv" && (
              <button
                type="button"
                disabled={laeuft}
                onClick={() => aendern({ status: "pausiert" })}
                className="h-11 rounded-xl border border-rand px-4 font-medium"
              >
                Pausieren
              </button>
            )}
            {betreuung.status !== "beendet" && !beendenFragen && (
              <button
                type="button"
                disabled={laeuft}
                onClick={() => setBeendenFragen(true)}
                className="h-11 rounded-xl border border-red-400/60 px-4 font-medium text-red-500"
              >
                Betreuung beenden
              </button>
            )}
          </div>
        )}

        {beendenFragen && (
          <div className="flex flex-col gap-2 rounded-xl border border-red-400/50 bg-red-500/10 p-3">
            <p className="text-sm">
              Nach dem Beenden siehst du keine Angaben dieser Person mehr. Ihr Konto und ihre Daten bleiben
              bestehen, bis sie selbst ihr Konto löscht. Du kannst die Betreuung später wieder aufnehmen.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={laeuft}
                onClick={() => aendern({ status: "beendet" })}
                className="h-11 rounded-xl bg-red-600 px-4 font-medium text-white"
              >
                Ja, beenden
              </button>
              <button
                type="button"
                onClick={() => setBeendenFragen(false)}
                className="h-11 rounded-xl border border-rand px-4 font-medium"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
        {fehler && (
          <p role="alert" className="text-sm text-red-500">
            {fehler}
          </p>
        )}
      </div>
    </Karte>
  );
}
