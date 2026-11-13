"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Karte, Seitentitel } from "./Bausteine";
import { EigeneUebungFormular } from "./EigeneUebung";
import { uebungVorschlagen } from "@/lib/nachrichten";
import { EIGENE_ARTEN, eigeneArt, uebungenLaden, type Uebung } from "@/lib/uebungen";

const artText = (u: Uebung) => EIGENE_ARTEN.find((a) => a.wert === eigeneArt(u))?.text ?? "";

/** Kunde: eigene Übungen anlegen, ändern und dem Coach vorschlagen */
export function MeineUebungen({ athletId }: { athletId: string }) {
  const [alle, setAlle] = useState<Uebung[] | null>(null);
  const [bearbeiten, setBearbeiten] = useState<Uebung | "neu" | null>(null);
  const [archivZeigen, setArchivZeigen] = useState(false);
  const [offen, setOffen] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const { daten } = await uebungenLaden();
    setAlle(daten);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  if (bearbeiten !== null) {
    return (
      <>
        <Seitentitel titel={bearbeiten === "neu" ? "Eigene Übung" : bearbeiten.name} />
        <Karte>
          <EigeneUebungFormular
            athletId={athletId}
            vorlage={bearbeiten === "neu" ? null : bearbeiten}
            vorhandene={(alle ?? []).filter((u) => !u.archiviert)}
            fertig={(u) => {
              setBearbeiten(null);
              if (u) laden();
            }}
          />
        </Karte>
      </>
    );
  }

  const eigene = (alle ?? []).filter((u) => u.privat_fuer === athletId && u.archiviert === archivZeigen);

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <Seitentitel titel="Meine Übungen" />
        <button type="button" onClick={() => setBearbeiten("neu")} className="h-11 shrink-0 rounded-xl bg-akzent px-4 font-medium text-akzent-text">
          + Eigene Übung
        </button>
      </div>
      <Karte>
        <p className="text-sm text-leise">
          Eigene Übungen siehst nur du und dein Coach. Du kannst sie im <Link href="/" className="underline">freien Training</Link> nutzen
          oder deinem Coach vorschlagen. In deinen Plan kommen sie nur, wenn dein Coach das entscheidet.
        </p>
      </Karte>
      <Karte>
        {alle === null ? (
          <p className="text-leise">Lädt …</p>
        ) : eigene.length === 0 ? (
          <p className="text-leise">{archivZeigen ? "Keine archivierten Übungen." : "Du hast noch keine eigene Übung angelegt."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rand">
            {eigene.map((u) => (
              <li key={u.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{u.name}</span>
                    <span className="block truncate text-sm text-leise">
                      {artText(u)}
                      {u.einseitig && " · einseitig"}
                    </span>
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => setBearbeiten(u)} className="h-10 rounded-xl border border-rand px-3 text-sm">
                      Ändern
                    </button>
                    {!u.archiviert && (
                      <button
                        type="button"
                        aria-expanded={offen === u.id}
                        onClick={() => setOffen(offen === u.id ? null : u.id)}
                        className="h-10 rounded-xl border border-akzent px-3 text-sm text-akzent"
                      >
                        Vorschlagen
                      </button>
                    )}
                  </span>
                </div>
                {offen === u.id && <Vorschlag uebung={u} fertig={() => setOffen(null)} />}
              </li>
            ))}
          </ul>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm text-leise">
          <input type="checkbox" checked={archivZeigen} onChange={(e) => setArchivZeigen(e.target.checked)} className="size-4 accent-akzent" />
          Nur archivierte zeigen
        </label>
      </Karte>
    </>
  );
}

function Vorschlag({ uebung, fertig }: { uebung: Uebung; fertig: () => void }) {
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  async function senden() {
    setLaeuft(true);
    const ok = await uebungVorschlagen(uebung.id, uebung.name, text);
    setLaeuft(false);
    setMeldung(
      ok
        ? { ok: true, text: "Gesendet. Dein Coach sieht deinen Vorschlag und meldet sich." }
        : { ok: false, text: "Senden hat nicht geklappt. Bitte versuche es erneut." },
    );
    if (ok) {
      setText("");
      setTimeout(fertig, 2500);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl border border-akzent/40 p-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nachricht an deinen Coach (freiwillig)
        <textarea
          rows={2}
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`z. B. Ich würde „${uebung.name}“ gern statt Ausfallschritten machen, die tun meinem Knie besser.`}
          className="w-full rounded-xl border border-rand bg-background p-2 text-base font-normal outline-none focus:border-akzent"
        />
      </label>
      <button type="button" disabled={laeuft} onClick={senden} className="h-11 rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50">
        {laeuft ? "Sendet …" : "Dem Coach vorschlagen"}
      </button>
      {meldung && (
        <p role="status" className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
          {meldung.text}
        </p>
      )}
    </div>
  );
}
