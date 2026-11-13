"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { artText, nachrichtBeantworten, nachrichtenLaden, offeneNachrichtenLaden, type Nachricht } from "@/lib/nachrichten";
import { datum } from "@/lib/texte";
import { uebungFreigeben } from "@/lib/uebungen";

/** Personenseite: Nachrichten und Zieländerungen, mit Antwort oder „gesehen“ */
export function NachrichtenFuerCoach({ athletId }: { athletId: string }) {
  const [liste, setListe] = useState<Nachricht[] | null>(null);
  const laden = useCallback(async () => setListe(await nachrichtenLaden(athletId, 30)), [athletId]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);
  // Über den Link „#nachrichten“ gekommen: nach dem Laden hinscrollen
  const geladen = liste !== null;
  useEffect(() => {
    if (geladen && window.location.hash === "#nachrichten")
      document.getElementById("nachrichten")?.scrollIntoView({ block: "start" });
  }, [geladen]);

  if (liste === null) return null;
  const offen = liste.filter((n) => !n.gesehen_am).length;
  return (
    <Karte titel={`Nachrichten${offen ? ` (${offen} offen)` : ""}`}>
      {liste.length === 0 ? (
        <p className="text-sm text-leise">Noch keine Nachrichten.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rand">
          {liste.map((n) => (
            <NachrichtZeile key={n.id} n={n} fertig={laden} />
          ))}
        </ul>
      )}
    </Karte>
  );
}

function NachrichtZeile({ n, fertig }: { n: Nachricht; fertig: () => void }) {
  const [antwort, setAntwort] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState(false);
  const ziele = n.art === "ziele_geaendert";
  const vorschlag = n.art === "uebung_vorschlag";
  const [freigabe, setFreigabe] = useState<"" | "laeuft" | "ok" | string>("");

  async function los(text: string) {
    setLaeuft(true);
    setFehler(false);
    const ok = await nachrichtBeantworten(n.id, text);
    setLaeuft(false);
    if (!ok) setFehler(true);
    else {
      setAntwort("");
      fertig();
    }
  }

  return (
    <li className="flex flex-col gap-2 py-3">
      <span className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${
            ziele ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-akzent/10 text-akzent"
          }`}
        >
          {ziele ? "⚑ " : vorschlag ? "＋ " : "✎ "}
          {artText[n.art]}
        </span>
        <span className="text-leise">{datum(n.erstellt_am)}</span>
        {!n.gesehen_am && <span className="font-medium text-amber-600 dark:text-amber-400">offen</span>}
      </span>
      <p className="whitespace-pre-wrap break-words">{n.text}</p>
      {vorschlag && (
        <div className="flex flex-col gap-2 rounded-lg border border-rand p-2 text-sm">
          {n.uebung ? (
            <>
              <p>
                Übung: <span className="font-medium">{n.uebung.name}</span>
                {n.uebung.privat_fuer && freigabe !== "ok" ? " (eigene Übung der Person)" : " (in deiner Sammlung)"}
              </p>
              {n.uebung.privat_fuer && freigabe !== "ok" && (
                <button
                  type="button"
                  disabled={freigabe === "laeuft"}
                  onClick={async () => {
                    setFreigabe("laeuft");
                    setFreigabe((await uebungFreigeben(n.uebung!.id)) ?? "ok");
                  }}
                  className="h-10 self-start rounded-xl border border-akzent px-3 text-sm font-medium text-akzent disabled:opacity-50"
                >
                  In meine Sammlung übernehmen
                </button>
              )}
              {freigabe && freigabe !== "laeuft" && freigabe !== "ok" && <p role="alert" className="text-red-500">{freigabe}</p>}
              <p className="text-leise">In den Plan kommt sie nur, wenn du sie im Plan-Editor einfügst.</p>
            </>
          ) : (
            <p className="text-leise">Die Übung gibt es nicht mehr.</p>
          )}
        </div>
      )}
      {n.coach_antwort ? (
        <p className="whitespace-pre-wrap break-words rounded-lg bg-akzent/10 p-2 text-sm">
          <span className="font-medium">Deine Antwort ({n.coach_antwort_am ? datum(n.coach_antwort_am) : ""}):</span> {n.coach_antwort}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            value={antwort}
            onChange={(e) => setAntwort(e.target.value)}
            maxLength={2000}
            rows={2}
            aria-label="Antwort"
            placeholder="Antwort (die Person bekommt einen Hinweis)"
            className="rounded-xl border border-rand bg-background p-2 text-sm outline-none focus:border-akzent"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={laeuft || !antwort.trim()}
              onClick={() => los(antwort)}
              className="h-10 rounded-xl bg-akzent px-3 text-sm font-medium text-akzent-text disabled:opacity-50"
            >
              Antworten
            </button>
            {!n.gesehen_am && (
              <button type="button" disabled={laeuft} onClick={() => los("")} className="h-10 rounded-xl border border-rand px-3 text-sm font-medium">
                Gesehen
              </button>
            )}
          </div>
          {ziele && (
            <p className="text-xs text-leise">Die App ändert nichts am Plan – passe ihn bei Bedarf selbst an.</p>
          )}
          {fehler && (
            <p role="alert" className="text-sm text-red-500">
              Das hat nicht geklappt.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

/** Coach-Startseite: Nachrichten ohne Reaktion */
export function OffeneNachrichten() {
  const [liste, setListe] = useState<Nachricht[] | null>(null);
  useEffect(() => {
    offeneNachrichtenLaden().then(setListe);
  }, []);
  if (liste === null) return null;
  return (
    <Karte titel="Nachrichten ohne Reaktion">
      {liste.length === 0 ? (
        <p className="text-sm text-leise">Alles beantwortet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {liste.map((n) => (
            <li key={n.id}>
              <Link
                href={`/athlet/?id=${n.athlet_id}#nachrichten`}
                className="flex items-center justify-between gap-3 rounded-xl border border-rand px-3 py-2 hover:border-akzent"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{n.athlet?.anzeigename || "Ohne Namen"}</span>
                  <span className="block truncate text-sm text-leise">
                    {n.art === "ziele_geaendert" ? "⚑ Ziele geändert: " : n.art === "uebung_vorschlag" ? "＋ Übungsvorschlag: " : ""}
                    {n.text}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-leise">{datum(n.erstellt_am)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Karte>
  );
}
