"use client";

import { useCallback, useEffect, useState } from "react";
import { StammdatenFormular } from "./StammdatenFormular";
import { angabenVollstaendig, artText, nachrichtenLaden, nachrichtSenden, nachrichtZurueckziehen, type Nachricht, type NachrichtArt } from "@/lib/nachrichten";
import { stammdatenLaden } from "@/lib/stammdaten";
import { datum } from "@/lib/texte";

/** Ein- und ausklappbarer Abschnitt mit Status („Erledigt ✓“ / „Noch offen“) */
export function Klappkarte({
  id,
  titel,
  status,
  erledigt,
  offen,
  umschalten,
  children,
}: {
  id: string;
  titel: string;
  status: string;
  erledigt: boolean;
  offen: boolean;
  umschalten: () => void;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-2xl border border-rand bg-flaeche">
      <button
        type="button"
        aria-expanded={offen}
        aria-controls={`${id}-inhalt`}
        onClick={umschalten}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <span className="text-lg font-semibold">{titel}</span>
        <span className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              erledigt ? "bg-akzent/15 text-akzent" : "border border-amber-500/60 text-amber-600 dark:text-amber-400"
            }`}
          >
            {status}
          </span>
          <span aria-hidden className="text-leise">
            {offen ? "▾" : "▸"}
          </span>
        </span>
      </button>
      {offen && (
        <div id={`${id}-inhalt`} className="flex flex-col gap-4 border-t border-rand p-4">
          {children}
        </div>
      )}
    </section>
  );
}

/**
 * „Über dich“ auf der Startseite: Angaben zum Training (eingeklappt, mit Status),
 * Nachricht an den Coach und „Meine Ziele haben sich geändert“.
 */
export function UeberDich({ athletId, coachName }: { athletId: string; coachName: string }) {
  const [offen, setOffen] = useState(false);
  const [vollstaendig, setVollstaendig] = useState<boolean | null>(null);
  const [liste, setListe] = useState<Nachricht[] | null>(null);
  const [art, setArt] = useState<NachrichtArt | null>(null);
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const laden = useCallback(async () => {
    const [s, n] = await Promise.all([stammdatenLaden(athletId), nachrichtenLaden(athletId, 10)]);
    setVollstaendig(angabenVollstaendig(s.daten));
    setListe(n);
  }, [athletId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
    // Über einen Hinweis („Dein Coach hat geantwortet“) direkt geöffnet
    if (typeof window !== "undefined" && window.location.hash === "#ueber-dich") setOffen(true);
  }, [laden]);

  // Über einen Hinweis gekommen: nach dem Laden hinscrollen
  const geladen = liste !== null;
  useEffect(() => {
    if (geladen && window.location.hash === "#ueber-dich")
      document.getElementById("ueber-dich")?.scrollIntoView({ block: "start" });
  }, [geladen]);

  const offeneAntworten = (liste ?? []).filter((n) => n.coach_antwort && n.coach_antwort_am).length;
  const status =
    vollstaendig === null ? "…" : vollstaendig ? (offeneAntworten > 0 ? "Erledigt ✓ · Antwort da" : "Erledigt ✓") : "Noch offen";
  const wer = coachName || "deinen Coach";

  async function senden() {
    if (!art) return;
    setLaeuft(true);
    setMeldung(null);
    const ok = await nachrichtSenden(art, text);
    setLaeuft(false);
    if (!ok) {
      setMeldung({ ok: false, text: "Senden hat nicht geklappt. Bitte versuche es erneut." });
      return;
    }
    setMeldung({
      ok: true,
      text:
        art === "ziele_geaendert"
          ? `Gesendet. ${coachName || "Dein Coach"} sieht das als offenen Punkt. Trag deine neuen Ziele oben auch gleich ein.`
          : `Gesendet an ${coachName || "deinen Coach"}.`,
    });
    setText("");
    setArt(null);
    laden();
  }

  return (
    <Klappkarte
      id="ueber-dich"
      titel="Über dich"
      status={status}
      erledigt={!!vollstaendig}
      offen={offen}
      umschalten={() => setOffen(!offen)}
    >
      <StammdatenFormular athletId={athletId} eingebettet gespeichert={laden} />

      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">Nachricht an {wer}</h3>
        {art === null ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setArt("kommentar")} className="h-11 rounded-xl border border-rand px-4 font-medium">
              ✎ Kommentar schreiben
            </button>
            <button type="button" onClick={() => setArt("ziele_geaendert")} className="h-11 rounded-xl border border-rand px-4 font-medium">
              ⚑ Meine Ziele haben sich geändert
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              {art === "ziele_geaendert" ? "Was hat sich geändert?" : "Deine Nachricht"}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder={art === "ziele_geaendert" ? "z. B. Ich möchte im Frühjahr einen Halbmarathon laufen." : "z. B. Das Knie zwickt bei Ausfallschritten."}
                className="rounded-xl border border-rand bg-background p-3 text-base font-normal outline-none focus:border-akzent"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={laeuft || !text.trim()}
                onClick={senden}
                className="h-11 rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
              >
                {laeuft ? "…" : "Senden"}
              </button>
              <button type="button" onClick={() => setArt(null)} className="h-11 rounded-xl border border-rand px-4 font-medium">
                Abbrechen
              </button>
            </div>
          </div>
        )}
        {meldung && (
          <p role={meldung.ok ? "status" : "alert"} className={`text-sm ${meldung.ok ? "text-akzent" : "text-red-500"}`}>
            {meldung.text}
          </p>
        )}
        {liste && liste.length > 0 && (
          <ul className="mt-1 flex flex-col divide-y divide-rand">
            {liste.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 py-2 text-sm">
                <span className="text-xs text-leise">
                  {artText[n.art]} · {datum(n.erstellt_am)}
                  {!n.coach_antwort && (n.gesehen_am ? " · gesehen" : " · noch nicht gelesen")}
                </span>
                <span className="whitespace-pre-wrap break-words">{n.text}</span>
                {n.coach_antwort && (
                  <span className="whitespace-pre-wrap break-words rounded-lg bg-akzent/10 p-2">
                    <span className="font-medium">{coachName || "Coach"}:</span> {n.coach_antwort}
                  </span>
                )}
                {!n.coach_antwort && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (await nachrichtZurueckziehen(n.id)) laden();
                    }}
                    className="self-start text-xs text-leise underline underline-offset-4"
                  >
                    Zurückziehen
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Klappkarte>
  );
}
