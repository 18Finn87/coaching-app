"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Karte } from "@/components/Bausteine";
import { useProfil } from "@/lib/konto";
import { datum } from "@/lib/texte";
import { analyseLaden, videoLink, zeitpunktText, type Analyse } from "@/lib/videos";

export default function VergleichSeite() {
  return (
    <Suspense fallback={<p className="text-leise">Lädt …</p>}>
      <Inhalt />
    </Suspense>
  );
}

type Seite = { a: Analyse; url: string | null };
const BILD = 1 / 30;

function Inhalt() {
  const p = useSearchParams();
  const profil = useProfil();
  const ids = [p.get("a") ?? "", p.get("b") ?? ""];
  const [seiten, setSeiten] = useState<(Seite | null)[] | null>(null);
  const v1 = useRef<HTMLVideoElement>(null);
  const v2 = useRef<HTMLVideoElement>(null);
  const [zeiten, setZeiten] = useState([0, 0]);
  const [tempo, setTempo] = useState(0.5);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await Promise.all(
        [p.get("a") ?? "", p.get("b") ?? ""].map(async (id) => {
          const a = id ? await analyseLaden(id) : null;
          if (!a) return null;
          return { a, url: a.video_geloescht_am ? null : await videoLink(a.pfad) };
        }),
      );
      setSeiten(s);
    })();
  }, [p]);

  if (seiten === null) return <p className="text-leise">Lädt …</p>;
  const videos = [v1, v2];
  const athlet = seiten.find((s) => s)?.a.athlet_id;
  const zurueck = profil.rolle === "coach" && athlet ? `/videos/?athlet=${athlet}` : "/videos/";

  function alle(f: (el: HTMLVideoElement) => void) {
    videos.forEach((r) => r.current && f(r.current));
  }
  function schritt(i: number | null, d: number) {
    videos.forEach((r, k) => {
      if (r.current && (i === null || i === k)) {
        r.current.pause();
        r.current.currentTime = Math.max(0, r.current.currentTime + d);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={zurueck} className="text-sm text-akzent underline underline-offset-4">
        ← Alle Videos
      </Link>
      <h1 className="text-xl font-semibold">Vergleich</h1>
      <p className="text-sm text-leise">
        Stell beide Videos mit den kleinen Knöpfen auf denselben Moment (z. B. Beginn der Bewegung) und spiel sie dann
        gemeinsam ab.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {seiten.map((s, i) => (
          <div key={ids[i] || i} className="flex min-w-0 flex-col gap-1">
            {s?.url ? (
              <div className="overflow-hidden rounded-xl bg-black">
                <video
                  ref={videos[i]}
                  src={s.url}
                  playsInline
                  muted
                  preload="auto"
                  className="max-h-[60vh] w-full"
                  onTimeUpdate={(e) => {
                    const t = e.currentTarget.currentTime;
                    setZeiten((z) => (i === 0 ? [t, z[1]] : [z[0], t]));
                  }}
                  onSeeked={(e) => {
                    const t = e.currentTarget.currentTime;
                    setZeiten((z) => (i === 0 ? [t, z[1]] : [z[0], t]));
                  }}
                  onPause={() => setLaeuft(false)}
                />
              </div>
            ) : (
              <Karte>
                <p className="text-sm">Video nicht verfügbar.</p>
              </Karte>
            )}
            <p className="truncate text-sm font-medium">{s ? s.a.titel || s.a.uebung?.name || "Video" : "–"}</p>
            <p className="text-xs text-leise">{s ? datum(s.a.erstellt_am) : ""} · <span className="tabular-nums">{zeitpunktText(zeiten[i])}</span></p>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => schritt(i, -BILD)} className="h-10 rounded-lg border border-rand" aria-label={`Video ${i + 1}: ein Bild zurück`}>
                ◀︎|
              </button>
              <button type="button" onClick={() => schritt(i, BILD)} className="h-10 rounded-lg border border-rand" aria-label={`Video ${i + 1}: ein Bild vor`}>
                |▶︎
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        <button type="button" onClick={() => schritt(null, -BILD)} className="h-12 rounded-xl border border-rand" aria-label="Beide: ein Bild zurück">
          ◀︎|
        </button>
        <button
          type="button"
          onClick={() => {
            if (laeuft) {
              alle((el) => el.pause());
              setLaeuft(false);
            } else {
              alle((el) => {
                el.playbackRate = tempo;
                el.play();
              });
              setLaeuft(true);
            }
          }}
          className="col-span-2 h-12 rounded-xl bg-akzent font-semibold text-akzent-text"
        >
          {laeuft ? "❚❚ Beide anhalten" : "▶ Beide abspielen"}
        </button>
        <button type="button" onClick={() => schritt(null, BILD)} className="h-12 rounded-xl border border-rand" aria-label="Beide: ein Bild vor">
          |▶︎
        </button>
      </div>
      <div role="radiogroup" aria-label="Geschwindigkeit" className="grid grid-cols-3 gap-2">
        {[0.25, 0.5, 1].map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={tempo === t}
            onClick={() => {
              setTempo(t);
              alle((el) => (el.playbackRate = t));
            }}
            className={`h-10 rounded-lg border text-sm font-medium ${tempo === t ? "border-akzent bg-akzent/15 text-akzent" : "border-rand"}`}
          >
            {t === 1 ? "normal" : `${t.toLocaleString("de-DE")}×`}
          </button>
        ))}
      </div>
    </div>
  );
}
