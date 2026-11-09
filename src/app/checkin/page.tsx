"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { CheckinVerlauf } from "@/components/CheckinVerlauf";
import { SkalaWahl } from "@/components/SkalaWahl";
import { regionText } from "@/lib/anamnese";
import {
  SKALEN,
  checkinGesundheitLaden,
  checkinGesundheitLoeschen,
  checkinGesundheitSpeichern,
  checkinSpeichern,
  checkinsLaden,
  wochenbeginn,
  wocheText,
  type Checkin,
  type CheckinGesundheit,
  type SkalaFeld,
} from "@/lib/coaching";
import { useEinwilligungen } from "@/lib/einwilligungen";
import { useProfil } from "@/lib/konto";

export default function Seite() {
  return (
    <NurFuer rolle="athlet">
      <CheckinSeite />
    </NurFuer>
  );
}

function CheckinSeite() {
  const profil = useProfil();
  const [liste, setListe] = useState<Checkin[] | null>(null);
  const [gesundheit, setGesundheit] = useState<Record<string, CheckinGesundheit>>({});
  const [ladeFehler, setLadeFehler] = useState(false);

  const laden = useCallback(async () => {
    const [c, g] = await Promise.all([checkinsLaden(profil.id), checkinGesundheitLaden(profil.id)]);
    setLadeFehler(c.fehler);
    setListe(c.daten);
    setGesundheit(g.daten);
  }, [profil.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const woche = wochenbeginn();
  const aktuell = liste?.find((c) => c.woche === woche) ?? null;
  const frueher = (liste ?? []).filter((c) => c.woche !== woche);

  return (
    <>
      <Seitentitel titel="Check-in" text="Einmal pro Woche, dauert eine Minute. So weiß dein Coach, wie es dir geht." />
      {ladeFehler && (
        <Karte>
          <p role="alert" className="text-sm text-red-500">
            Die Check-ins konnten nicht geladen werden. Für den Check-in brauchst du Internet.
          </p>
        </Karte>
      )}
      {liste === null && !ladeFehler ? (
        <p className="text-leise">Lädt …</p>
      ) : (
        !ladeFehler && (
          <CheckinFormular
            key={woche}
            woche={woche}
            vorhanden={aktuell}
            gesundheitVorhanden={aktuell ? gesundheit[aktuell.id] ?? null : null}
            beiGespeichert={laden}
          />
        )
      )}
      {frueher.length > 0 && (
        <Karte titel="Frühere Wochen">
          <CheckinVerlauf checkins={frueher} gesundheit={gesundheit} />
        </Karte>
      )}
    </>
  );
}

function CheckinFormular({
  woche,
  vorhanden,
  gesundheitVorhanden,
  beiGespeichert,
}: {
  woche: string;
  vorhanden: Checkin | null;
  gesundheitVorhanden: CheckinGesundheit | null;
  beiGespeichert: () => void;
}) {
  const { aktiv } = useEinwilligungen();
  const mitGesundheit = aktiv("gesundheitsdaten");
  const [werte, setWerte] = useState<Partial<Record<SkalaFeld, number>>>(() =>
    vorhanden ? Object.fromEntries(SKALEN.map((s) => [s.feld, vorhanden[s.feld]])) : {},
  );
  const [notiz, setNotiz] = useState(vorhanden?.notiz ?? "");
  const [schmerz, setSchmerz] = useState<boolean | null>(gesundheitVorhanden?.schmerz_vorhanden ?? null);
  const [region, setRegion] = useState(gesundheitVorhanden?.koerperregion ?? "");
  const [skala, setSkala] = useState<number | null>(gesundheitVorhanden?.skala_0_10 ?? null);
  const [gNotiz, setGNotiz] = useState(gesundheitVorhanden?.notiz ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const fehlt = SKALEN.filter((s) => !werte[s.feld]);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (fehlt.length) {
      setMeldung({ ok: false, text: `Bitte beantworte noch: ${fehlt.map((s) => s.frage).join(" ")}` });
      return;
    }
    if (mitGesundheit && schmerz && (!region || skala === null)) {
      setMeldung({ ok: false, text: "Bitte wähle, wo es wehtut und wie stark." });
      return;
    }
    setLaeuft(true);
    setMeldung(null);
    const id = await checkinSpeichern(vorhanden?.id ?? null, {
      schlaf: werte.schlaf!,
      stress: werte.stress!,
      energie: werte.energie!,
      muskelkater: werte.muskelkater!,
      motivation: werte.motivation!,
      notiz: notiz.trim(),
    });
    let ok = !!id;
    if (id && mitGesundheit && schmerz !== null) {
      ok = await checkinGesundheitSpeichern(id, { schmerz, region: region || null, skala, notiz: gNotiz.trim() });
    }
    setLaeuft(false);
    if (!ok) {
      setMeldung({ ok: false, text: "Speichern hat nicht geklappt. Bitte prüfe deine Internetverbindung." });
      return;
    }
    setMeldung({ ok: true, text: "Danke! Dein Check-in ist gespeichert." });
    beiGespeichert();
  }

  async function gesundheitEntfernen() {
    if (!vorhanden) return;
    if (await checkinGesundheitLoeschen(vorhanden.id)) {
      setSchmerz(null);
      setRegion("");
      setSkala(null);
      setGNotiz("");
      beiGespeichert();
    }
  }

  const feld = "w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

  return (
    <Karte titel={`${wocheText(woche)}${vorhanden ? " · abgegeben" : ""}`}>
      <form onSubmit={absenden} className="flex flex-col gap-5">
        {vorhanden && <p className="text-sm text-leise">Du kannst deine Angaben bis Sonntag noch ändern.</p>}
        {SKALEN.map((s) => (
          <SkalaWahl
            key={s.feld}
            name={s.feld}
            frage={s.frage}
            links={s.links}
            rechts={s.rechts}
            wert={werte[s.feld] ?? null}
            beiWahl={(w) => setWerte({ ...werte, [s.feld]: w })}
          />
        ))}

        <label className="flex flex-col gap-1 text-sm font-medium">
          Möchtest du noch etwas sagen? (freiwillig)
          <textarea
            value={notiz}
            maxLength={1000}
            rows={3}
            onChange={(e) => setNotiz(e.target.value)}
            className={`${feld} py-2`}
          />
          <span className="text-xs font-normal text-leise">
            Bitte keine Gesundheitsangaben hier – dafür gibt es den geschützten Teil darunter.
          </span>
        </label>

        {mitGesundheit ? (
          <fieldset className="flex flex-col gap-3 rounded-xl border border-rand p-3">
            <legend className="px-1 text-sm font-semibold">Geschützter Teil: Schmerzen oder Beschwerden</legend>
            <p className="text-sm">Hattest du diese Woche Schmerzen oder Beschwerden?</p>
            <div className="flex gap-2">
              {[
                { w: false, t: "Nein" },
                { w: true, t: "Ja" },
              ].map((o) => (
                <button
                  key={o.t}
                  type="button"
                  aria-pressed={schmerz === o.w}
                  onClick={() => setSchmerz(o.w)}
                  className={`h-11 flex-1 rounded-xl border font-medium ${
                    schmerz === o.w ? "border-akzent bg-akzent text-akzent-text" : "border-rand"
                  }`}
                >
                  {o.t}
                </button>
              ))}
            </div>
            {schmerz && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Wo?
                  <select value={region} onChange={(e) => setRegion(e.target.value)} className={`${feld} h-12`}>
                    <option value="">Bitte wählen</option>
                    {Object.entries(regionText).map(([w, t]) => (
                      <option key={w} value={w}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium" id="skala-titel">
                    Wie stark? (0 = gar nicht, 10 = sehr stark)
                  </p>
                  <div role="radiogroup" aria-labelledby="skala-titel" className="grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }, (_, i) => (
                      <button
                        key={i}
                        type="button"
                        role="radio"
                        aria-checked={skala === i}
                        onClick={() => setSkala(i)}
                        className={`h-10 rounded-lg border text-sm font-medium ${
                          skala === i ? "border-akzent bg-akzent text-akzent-text" : "border-rand"
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            {schmerz !== null && (
              <label className="flex flex-col gap-1 text-sm font-medium">
                Anmerkung (freiwillig)
                <textarea
                  value={gNotiz}
                  maxLength={1000}
                  rows={2}
                  onChange={(e) => setGNotiz(e.target.value)}
                  className={`${feld} py-2`}
                />
              </label>
            )}
            <p className="text-xs text-leise">
              Diese Angaben liegen im geschützten Gesundheitsbereich. Dein Coach sieht sie nur, solange deine
              Einwilligung gilt. Die App stellt keine Diagnosen – bei starken oder anhaltenden Schmerzen wende dich bitte
              an eine Ärztin oder einen Arzt.
            </p>
            {gesundheitVorhanden && (
              <button type="button" onClick={gesundheitEntfernen} className="self-start text-sm text-red-500 underline">
                Diesen Teil löschen
              </button>
            )}
          </fieldset>
        ) : (
          <p className="text-sm text-leise">
            Schmerzen oder Beschwerden kannst du hier nur mit deiner Einwilligung zu Gesundheitsdaten angeben (unter{" "}
            <Link href="/profil/" className="text-akzent underline underline-offset-4">
              Profil
            </Link>
            ).
          </p>
        )}

        <button
          type="submit"
          disabled={laeuft}
          className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Speichert …" : vorhanden ? "Änderungen speichern" : "Check-in abgeben"}
        </button>
        {meldung && (
          <p role={meldung.ok ? "status" : "alert"} className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
            {meldung.text}
          </p>
        )}
        {vorhanden?.coach_antwort && (
          <div className="rounded-xl bg-akzent/10 p-3">
            <p className="text-xs font-medium text-akzent">Antwort deines Coaches</p>
            <p className="mt-1 whitespace-pre-wrap text-sm">{vorhanden.coach_antwort}</p>
          </div>
        )}
      </form>
    </Karte>
  );
}
