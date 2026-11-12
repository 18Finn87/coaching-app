"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Karte } from "@/components/Bausteine";
import { ZeichenFlaeche, zeichnungText } from "@/components/Zeichnung";
import { VideoBewertung } from "@/components/VideoBewertung";
import { useProfil } from "@/lib/konto";
import { datum } from "@/lib/texte";
import {
  analyseLaden,
  analyseLoeschen,
  anmerkungenLaden,
  anmerkungLoeschen,
  anmerkungSpeichern,
  neigung,
  videoEntfernen,
  videoLink,
  winkel,
  zeitpunktText,
  type Analyse,
  type Anmerkung,
  type Punkt,
  type Zeichnung,
} from "@/lib/videos";

export default function VideoSeite() {
  return (
    <Suspense fallback={<p className="text-leise">Lädt …</p>}>
      <Inhalt />
    </Suspense>
  );
}

const BILD = 1 / 30; // ein Bild vor/zurück
const TEMPI = [0.25, 0.5, 1];

function Inhalt() {
  const id = useSearchParams().get("id") ?? "";
  const profil = useProfil();
  const router = useRouter();
  const [a, setA] = useState<Analyse | null | undefined>(undefined);
  const [url, setUrl] = useState<string | null>(null);
  const [anm, setAnm] = useState<Anmerkung[]>([]);
  const video = useRef<HTMLVideoElement>(null);
  const [zeit, setZeit] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [tempo, setTempo] = useState(0.5);
  const [modus, setModus] = useState<null | "linie" | "winkel">(null);
  const [punkte, setPunkte] = useState<Punkt[]>([]);
  const [text, setText] = useState("");
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [meldung, setMeldung] = useState("");
  const [loeschenFragen, setLoeschenFragen] = useState(false);
  const [format, setFormat] = useState<number | null>(null);

  const laden = useCallback(async () => {
    const x = await analyseLaden(id);
    setA(x);
    if (!x) return;
    setAnm(await anmerkungenLaden(id));
    if (!x.video_geloescht_am && new Date(x.loeschen_am) > new Date()) setUrl(await videoLink(x.pfad));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  if (a === undefined) return <p className="text-leise">Lädt …</p>;
  if (a === null)
    return (
      <Karte>
        <p>Diese Analyse gibt es nicht (mehr) oder du darfst sie nicht sehen.</p>
      </Karte>
    );

  const sv = format ?? (a.breite && a.hoehe ? a.breite / a.hoehe : 9 / 16);
  const eigene = a.athlet_id === profil.id;
  const darfLoeschen = eigene || a.hochgeladen_von === profil.id;
  const dauer = a.dauer_sek ?? 30;
  const zurueck = profil.rolle === "coach" ? `/videos/?athlet=${a.athlet_id}` : "/videos/";

  const v = () => video.current;
  function springen(t: number) {
    const el = v();
    if (!el) return;
    el.pause();
    el.currentTime = Math.min(Math.max(0, t), dauer);
    setZeit(el.currentTime);
  }
  function abspielen() {
    const el = v();
    if (!el) return;
    if (el.paused) {
      el.playbackRate = tempo;
      el.play();
    } else el.pause();
  }

  const zeichnungJetzt: Zeichnung[] = gewaehlt
    ? anm.filter((x) => x.id === gewaehlt && x.zeichnung).map((x) => x.zeichnung!)
    : modus
      ? []
      : anm.filter((x) => x.zeichnung && Math.abs(x.zeit_sek - zeit) < 0.12).map((x) => x.zeichnung!);
  const fertigePunkte = modus === "linie" ? 2 : 3;
  const entwurf: Zeichnung | null =
    modus && punkte.length === fertigePunkte
      ? {
          art: modus,
          punkte,
          grad: modus === "winkel" ? winkel(punkte[0], punkte[1], punkte[2], sv) : neigung(punkte[0], punkte[1], sv),
        }
      : null;

  async function speichern() {
    if (!text.trim() && !entwurf) return;
    setMeldung("");
    const { error } = await anmerkungSpeichern(a!.id, zeit, text, entwurf);
    if (error) {
      setMeldung("Speichern hat nicht geklappt.");
      return;
    }
    setText("");
    setPunkte([]);
    setModus(null);
    setAnm(await anmerkungenLaden(a!.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={zurueck} className="text-sm text-akzent underline underline-offset-4">
        ← Alle Videos
      </Link>
      <div>
        <h1 className="text-xl font-semibold">{a.titel || a.uebung?.name || "Video"}</h1>
        <p className="text-sm text-leise">
          {a.uebung?.name && a.titel ? `${a.uebung.name} · ` : ""}
          {datum(a.erstellt_am)}
          {a.hochgeladen_von !== a.athlet_id ? " · vom Coach hochgeladen" : ""}
        </p>
      </div>

      <VideoBewertung analyse={a} alsCoach={profil.rolle === "coach"} geaendert={laden} />

      {url ? (
        <div className="flex flex-col gap-2">
          <div
            className="relative mx-auto overflow-hidden rounded-xl bg-black"
            style={{ aspectRatio: String(sv), width: `min(100%, calc(65vh * ${sv}))` }}
          >
            <video
              ref={video}
              src={url}
              playsInline
              muted
              preload="auto"
              className="absolute inset-0 h-full w-full"
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                if (el.videoWidth && el.videoHeight) setFormat(el.videoWidth / el.videoHeight);
              }}
              onTimeUpdate={(e) => setZeit(e.currentTarget.currentTime)}
              onSeeked={(e) => setZeit(e.currentTarget.currentTime)}
              onPlay={() => {
                setLaeuft(true);
                setGewaehlt(null);
              }}
              onPause={() => setLaeuft(false)}
              onEnded={() => setLaeuft(false)}
            />
            <ZeichenFlaeche
              seitenverhaeltnis={sv}
              zeichnungen={entwurf ? [entwurf] : zeichnungJetzt}
              entwurf={entwurf ? [] : punkte}
              aktiv={!!modus && punkte.length < fertigePunkte}
              tippen={(p) => setPunkte((alt) => [...alt, p])}
            />
          </div>

          <input
            type="range"
            aria-label="Zeitpunkt im Video"
            min={0}
            max={dauer}
            step={0.01}
            value={Math.min(zeit, dauer)}
            onChange={(e) => springen(Number(e.target.value))}
            className="w-full accent-akzent"
          />
          <div className="flex items-center justify-between text-sm tabular-nums">
            <span className="font-semibold">{zeitpunktText(zeit, 2)}</span>
            <span className="text-leise">{zeitpunktText(dauer)}</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => springen(zeit - BILD)} className="h-12 rounded-xl border border-rand text-lg" aria-label="Ein Bild zurück">
              ◀︎|
            </button>
            <button type="button" onClick={abspielen} className="col-span-2 h-12 rounded-xl bg-akzent font-semibold text-akzent-text">
              {laeuft ? "❚❚ Anhalten" : "▶ Abspielen"}
            </button>
            <button type="button" onClick={() => springen(zeit + BILD)} className="h-12 rounded-xl border border-rand text-lg" aria-label="Ein Bild vor">
              |▶︎
            </button>
          </div>
          <div role="radiogroup" aria-label="Geschwindigkeit" className="grid grid-cols-3 gap-2">
            {TEMPI.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={tempo === t}
                onClick={() => {
                  setTempo(t);
                  if (v()) v()!.playbackRate = t;
                }}
                className={`h-10 rounded-lg border text-sm font-medium ${tempo === t ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"}`}
              >
                {t === 1 ? "normal" : `${t.toLocaleString("de-DE")}×`}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Karte>
          <p className="text-sm">
            {a.video_geloescht_am
              ? `Das Video wurde am ${datum(a.video_geloescht_am)} gelöscht. Die Anmerkungen bleiben erhalten.`
              : "Das Video kann gerade nicht angezeigt werden (keine Einwilligung oder abgelaufen)."}
          </p>
        </Karte>
      )}

      {url && (
        <Karte titel={`Anmerkung bei ${zeitpunktText(zeit)}`}>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {(["linie", "winkel"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={modus === m}
                  onClick={() => {
                    v()?.pause();
                    setGewaehlt(null);
                    setPunkte([]);
                    setModus(modus === m ? null : m);
                  }}
                  className={`h-10 rounded-lg border px-3 text-sm font-medium ${modus === m ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"}`}
                >
                  {m === "linie" ? "／ Linie (Neigung)" : "∠ Winkel"}
                </button>
              ))}
              {punkte.length > 0 && (
                <button type="button" onClick={() => setPunkte([])} className="h-10 rounded-lg border border-rand px-3 text-sm">
                  Punkte neu setzen
                </button>
              )}
            </div>
            {modus && (
              <p className="text-sm text-leise">
                {entwurf
                  ? `Gemessen: ${zeichnungText(entwurf, sv)} – von Hand gesetzt, keine automatische Messung.`
                  : modus === "linie"
                    ? `Tippe 2 Punkte auf das Standbild (z. B. Schulter und Hüfte). Noch ${2 - punkte.length}.`
                    : `Tippe 3 Punkte – der mittlere ist der Scheitel (z. B. Hüfte, Knie, Sprunggelenk). Noch ${3 - punkte.length}.`}
              </p>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="z. B. Knie fällt nach innen"
              className="rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
            />
            <button
              type="button"
              disabled={!text.trim() && !entwurf}
              onClick={speichern}
              className="h-11 self-start rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
            >
              Anmerkung speichern
            </button>
            {meldung && (
              <p role="alert" className="text-sm text-red-500">
                {meldung}
              </p>
            )}
          </div>
        </Karte>
      )}

      <Karte titel={`Anmerkungen (${anm.length})`}>
        {anm.length === 0 ? (
          <p className="text-sm text-leise">Noch keine. Halte das Video an der passenden Stelle an und schreib etwas dazu.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rand">
            {anm.map((x) => (
              <li key={x.id} className={`flex items-start gap-2 py-2 ${gewaehlt === x.id ? "bg-akzent/5" : ""}`}>
                <button
                  type="button"
                  disabled={!url}
                  onClick={() => {
                    setModus(null);
                    setPunkte([]);
                    springen(x.zeit_sek);
                    setGewaehlt(x.id);
                  }}
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                >
                  <span className="font-semibold tabular-nums text-akzent">{zeitpunktText(x.zeit_sek)}</span>
                  {x.text && <span className="break-words">{x.text}</span>}
                  {x.zeichnung && <span className="text-sm text-leise">{zeichnungText(x.zeichnung, sv)}</span>}
                  <span className="text-xs text-leise">{x.autor_id === a.athlet_id ? (eigene ? "du" : "Athlet") : x.autor_id === profil.id ? "du" : "Coach"}</span>
                </button>
                {(x.autor_id === profil.id || eigene) && (
                  <button
                    type="button"
                    aria-label="Anmerkung löschen"
                    onClick={async () => {
                      await anmerkungLoeschen(x.id);
                      setAnm(await anmerkungenLaden(a.id));
                    }}
                    className="h-9 w-9 shrink-0 rounded-lg text-leise"
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Karte>

      <Karte>
        <p className="text-sm text-leise">
          {a.video_geloescht_am
            ? "Nur noch die Anmerkungen sind gespeichert."
            : `Das Video wird am ${datum(a.loeschen_am)} automatisch gelöscht, die Anmerkungen bleiben.`}{" "}
          Linien und Winkel setzt ihr von Hand – die App erkennt und bewertet nichts automatisch.
        </p>
        {darfLoeschen && !loeschenFragen && (
          <button type="button" onClick={() => setLoeschenFragen(true)} className="mt-3 h-11 rounded-xl border border-rand px-4 font-medium">
            Löschen …
          </button>
        )}
        {darfLoeschen && loeschenFragen && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-red-400/50 bg-red-500/10 p-3">
            <p className="text-sm">Was soll gelöscht werden? Das lässt sich nicht rückgängig machen.</p>
            <div className="flex flex-wrap gap-2">
              {!a.video_geloescht_am && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await videoEntfernen(a);
                    if (!ok) setMeldung("Löschen hat nicht geklappt.");
                    setLoeschenFragen(false);
                    setUrl(null);
                    laden();
                  }}
                  className="h-11 rounded-xl border border-red-500 px-4 font-medium"
                >
                  Nur das Video
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (await analyseLoeschen(a)) router.push(zurueck);
                  else setMeldung("Löschen hat nicht geklappt.");
                }}
                className="h-11 rounded-xl bg-red-600 px-4 font-medium text-white"
              >
                Video und Anmerkungen
              </button>
              <button type="button" onClick={() => setLoeschenFragen(false)} className="h-11 rounded-xl border border-rand px-4 font-medium">
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </Karte>
    </div>
  );
}
