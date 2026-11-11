"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Karte, Seitentitel } from "@/components/Bausteine";
import { VideoHochladen } from "@/components/VideoHochladen";
import { useEinwilligungen } from "@/lib/einwilligungen";
import { useProfil } from "@/lib/konto";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";
import { analysenLaden, mb, SPEICHER_GRENZE, speicherLaden, zeitpunktText, type Analyse } from "@/lib/videos";

export default function VideosSeite() {
  return (
    <Suspense fallback={<p className="text-leise">Lädt …</p>}>
      <Inhalt />
    </Suspense>
  );
}

function Inhalt() {
  const p = useSearchParams();
  const profil = useProfil();
  const router = useRouter();
  const coach = profil.rolle === "coach";
  const athletId = coach ? (p.get("athlet") ?? "") : profil.id;
  const vorauswahl = p.get("uebung");
  const { aktiv } = useEinwilligungen();
  const [liste, setListe] = useState<Analyse[] | null>(null);
  const [name, setName] = useState("");
  const [einwilligung, setEinwilligung] = useState<boolean | null>(coach ? null : !!aktiv("videos"));
  const [uebungen, setUebungen] = useState<{ id: string; name: string }[]>([]);
  const [speicher, setSpeicher] = useState<{ anzahl: number; bytes: number } | null>(null);
  const [vergleich, setVergleich] = useState<string[]>([]);
  const [neu, setNeu] = useState(!!vorauswahl);

  const laden = useCallback(async () => {
    if (!athletId) return;
    const sb = supabase();
    const [l, u, n, e, s] = await Promise.all([
      analysenLaden(athletId),
      sb.from("uebungen").select("id, name").eq("archiviert", false).order("name"),
      coach ? sb.from("profile").select("anzeigename").eq("id", athletId).maybeSingle() : Promise.resolve({ data: null }),
      coach
        ? sb.from("einwilligungen").select("id").eq("athlet_id", athletId).eq("art", "videos").is("widerrufen_am", null)
        : Promise.resolve({ data: null }),
      coach ? speicherLaden() : Promise.resolve(null),
    ]);
    setListe(l.daten);
    setUebungen((u.data as { id: string; name: string }[] | null) ?? []);
    if (coach) {
      setName((n.data as { anzeigename: string } | null)?.anzeigename ?? "");
      setEinwilligung(((e.data as unknown[] | null) ?? []).length > 0);
      setSpeicher(s);
    }
  }, [athletId, coach]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!coach) setEinwilligung(!!aktiv("videos"));
  }, [aktiv, coach]);

  if (!athletId)
    return (
      <Karte>
        <p>
          Videos findest du auf der Seite der jeweiligen Person unter{" "}
          <Link href="/athleten/" className="text-akzent underline">
            Athleten
          </Link>
          .
        </p>
      </Karte>
    );

  const umschalten = (id: string) =>
    setVergleich((alt) => (alt.includes(id) ? alt.filter((x) => x !== id) : [...alt.slice(-1), id]));
  const mitVideo = (liste ?? []).filter((x) => !x.video_geloescht_am);

  return (
    <>
      {coach && (
        <Link href={`/athlet/?id=${athletId}`} className="text-sm text-akzent underline underline-offset-4">
          ← {name || "Zurück"}
        </Link>
      )}
      <Seitentitel
        titel={coach ? `Videos${name ? ` von ${name}` : ""}` : "Technik-Videos"}
        text="Kurze Videos einer Übung ansehen, in Zeitlupe besprechen und vergleichen."
      />

      <Karte titel="Neues Video">
        {einwilligung === null ? (
          <p className="text-leise">Lädt …</p>
        ) : !einwilligung ? (
          <p className="text-sm">
            {coach
              ? "Für Videos braucht es die Einwilligung „Videos“ der Person. Sie kann sie im Profil erteilen."
              : "Auf Videos bist du erkennbar. Deshalb brauchst du dafür eine eigene Einwilligung – du findest sie im "}
            {!coach && (
              <Link href="/profil/" className="text-akzent underline">
                Profil
              </Link>
            )}
            {!coach && "."}
          </p>
        ) : neu ? (
          <VideoHochladen
            athletId={athletId}
            uebungen={uebungen}
            vorauswahl={vorauswahl}
            fertig={(id) => router.push(`/video/?id=${id}`)}
          />
        ) : (
          <button type="button" onClick={() => setNeu(true)} className="h-12 w-full rounded-xl bg-akzent font-semibold text-akzent-text">
            + Video hinzufügen
          </button>
        )}
      </Karte>

      <Karte titel="Alle Videos">
        {liste === null ? (
          <p className="text-leise">Lädt …</p>
        ) : liste.length === 0 ? (
          <p className="text-sm text-leise">Noch keine Videos.</p>
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-rand">
              {liste.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2">
                  {!x.video_geloescht_am && (
                    <input
                      type="checkbox"
                      aria-label={`${x.titel || x.uebung?.name || "Video"} zum Vergleich auswählen`}
                      checked={vergleich.includes(x.id)}
                      onChange={() => umschalten(x.id)}
                      className="size-5 shrink-0 accent-akzent"
                    />
                  )}
                  <Link href={`/video/?id=${x.id}`} className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{x.titel || x.uebung?.name || "Video"}</span>
                    <span className="text-xs text-leise">
                      {datum(x.erstellt_am)}
                      {x.uebung?.name && x.titel ? ` · ${x.uebung.name}` : ""}
                      {x.dauer_sek ? ` · ${zeitpunktText(x.dauer_sek)}` : ""}
                      {x.video_geloescht_am ? " · Video gelöscht, Anmerkungen da" : ` · ${mb(x.groesse_bytes)} MB`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {mitVideo.length >= 2 && (
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  disabled={vergleich.length !== 2}
                  onClick={() => router.push(`/vergleich/?a=${vergleich[0]}&b=${vergleich[1]}`)}
                  className="h-11 rounded-xl border border-akzent px-4 font-medium text-akzent disabled:opacity-40"
                >
                  Nebeneinander vergleichen
                </button>
                <span className="text-xs text-leise">{vergleich.length}/2 ausgewählt</span>
              </div>
            )}
          </>
        )}
      </Karte>

      {coach && speicher && (
        <Karte titel="Speicher">
          <p className="text-sm">
            {mb(speicher.bytes)} MB von 1 GB belegt ({speicher.anzahl} {speicher.anzahl === 1 ? "Video" : "Videos"} insgesamt)
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-rand" aria-hidden>
            <div className="h-2 rounded-full bg-diagramm" style={{ width: `${Math.min(100, (speicher.bytes / SPEICHER_GRENZE) * 100)}%` }} />
          </div>
          <p className="mt-2 text-xs text-leise">Kostenloser Tarif. Videos werden nach 12 Monaten automatisch gelöscht.</p>
        </Karte>
      )}
    </>
  );
}
