"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Karte, Seitentitel } from "@/components/Bausteine";
import { MeineUebungen } from "@/components/MeineUebungen";
import { useProfil } from "@/lib/konto";
import { supabase } from "@/lib/supabase";
import { UebungFormular } from "@/components/UebungFormular";
import { geraetText, modulText, musterText, uebungenLaden, uebungFreigeben, type Uebung } from "@/lib/uebungen";

export default function UebungenSeite() {
  const profil = useProfil();
  return profil.rolle === "coach" ? <Bibliothek /> : <MeineUebungen athletId={profil.id} />;
}

/** Groß-/Kleinschreibung und Umlaute beim Suchen ignorieren */
function normal(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function Bibliothek() {
  const [uebungen, setUebungen] = useState<Uebung[] | null>(null);
  const [ladeFehler, setLadeFehler] = useState(false);
  const [suche, setSuche] = useState("");
  const [modul, setModul] = useState("");
  const [muster, setMuster] = useState("");
  const [geraet, setGeraet] = useState("");
  const [archivZeigen, setArchivZeigen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState<Uebung | "neu" | null>(null);
  const [nurEigene, setNurEigene] = useState(false);
  const [namen, setNamen] = useState<Record<string, string>>({});

  const laden = useCallback(async () => {
    const { daten, fehler } = await uebungenLaden();
    setLadeFehler(fehler);
    setUebungen(daten);
    // Namen der Personen mit eigenen Übungen
    const ids = [...new Set(daten.map((u) => u.privat_fuer).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data } = await supabase().from("profile").select("id, anzeigename").in("id", ids);
      setNamen(Object.fromEntries(((data as { id: string; anzeigename: string }[] | null) ?? []).map((p) => [p.id, p.anzeigename])));
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const gefiltert = useMemo(() => {
    const s = normal(suche.trim());
    return (uebungen ?? []).filter(
      (u) =>
        u.archiviert === archivZeigen &&
        (!nurEigene || !!u.privat_fuer) &&
        (!s || normal(u.name).includes(s)) &&
        (!modul || u.modul === modul) &&
        (!muster || u.bewegungsmuster === muster) &&
        (!geraet || u.ausstattung.includes(geraet)),
    );
  }, [uebungen, suche, modul, muster, geraet, archivZeigen, nurEigene]);

  const auswahl =
    "h-11 w-full rounded-xl border border-rand bg-background px-3 text-sm outline-none focus:border-akzent";

  if (bearbeiten !== null) {
    return (
      <>
        <Seitentitel titel={bearbeiten === "neu" ? "Neue Übung" : bearbeiten.name} />
        {bearbeiten !== "neu" && bearbeiten.privat_fuer && (
          <Freigeben
            uebung={bearbeiten}
            name={namen[bearbeiten.privat_fuer] || "einer Person"}
            fertig={() => {
              setBearbeiten(null);
              laden();
            }}
          />
        )}
        <Karte>
          <UebungFormular
            vorlage={bearbeiten === "neu" ? null : bearbeiten}
            fertig={(geaendert) => {
              setBearbeiten(null);
              if (geaendert) laden();
            }}
          />
        </Karte>
      </>
    );
  }

  return (
    <>
      <div className="flex items-end justify-between gap-3">
        <Seitentitel titel="Übungen" />
        <button
          type="button"
          onClick={() => setBearbeiten("neu")}
          className="h-11 shrink-0 rounded-xl bg-akzent px-4 font-medium text-akzent-text"
        >
          + Neue Übung
        </button>
      </div>

      <Karte>
        <div className="flex flex-col gap-3">
          <input
            type="search"
            aria-label="Übung suchen"
            placeholder="Suchen, z. B. Kniebeuge"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            className="h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent"
          />
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Bereich" value={modul} onChange={(e) => setModul(e.target.value)} className={`${auswahl} col-span-2`}>
              <option value="">Alle Bereiche</option>
              {Object.entries(modulText).map(([w, t]) => (
                <option key={w} value={w}>
                  {t}
                </option>
              ))}
            </select>
            <select aria-label="Bewegungsmuster" value={muster} onChange={(e) => setMuster(e.target.value)} className={auswahl}>
              <option value="">Alle Bewegungen</option>
              {Object.entries(musterText).map(([w, t]) => (
                <option key={w} value={w}>
                  {t}
                </option>
              ))}
            </select>
            <select aria-label="Ausstattung" value={geraet} onChange={(e) => setGeraet(e.target.value)} className={auswahl}>
              <option value="">Alle Geräte</option>
              {Object.entries(geraetText).map(([w, t]) => (
                <option key={w} value={w}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-leise">
            <input
              type="checkbox"
              checked={archivZeigen}
              onChange={(e) => setArchivZeigen(e.target.checked)}
              className="size-4 accent-akzent"
            />
            Nur archivierte zeigen
          </label>
          <label className="flex items-center gap-2 text-sm text-leise">
            <input type="checkbox" checked={nurEigene} onChange={(e) => setNurEigene(e.target.checked)} className="size-4 accent-akzent" />
            Nur eigene Übungen der Kunden zeigen
          </label>
        </div>
      </Karte>

      <Karte>
        {ladeFehler && <p role="alert">Die Übungen konnten nicht geladen werden.</p>}
        {uebungen === null && !ladeFehler && <p className="text-leise">Lädt …</p>}
        {uebungen && (
          <>
            <p className="mb-2 text-sm text-leise">
              {gefiltert.length} {gefiltert.length === 1 ? "Übung" : "Übungen"}
            </p>
            {gefiltert.length === 0 ? (
              <p className="text-leise">Keine passende Übung gefunden.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-rand">
                {gefiltert.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setBearbeiten(u)}
                      className="flex w-full items-center justify-between gap-3 py-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{u.name}</span>
                        <span className="block truncate text-sm text-leise">
                          {u.modul !== "kraft" && `${modulText[u.modul] ?? u.modul} · `}
                          {musterText[u.bewegungsmuster]}
                          {u.ausstattung.length > 0 && ` · ${u.ausstattung.map((g) => geraetText[g]).join(", ")}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 gap-1">
                        {u.e1rm_geeignet && (
                          <span className="rounded-full border border-rand px-2 py-0.5 text-xs text-leise">1RM</span>
                        )}
                        {u.privat_fuer && (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                            von {namen[u.privat_fuer] || "Kunde"}
                          </span>
                        )}
                        {u.einseitig && (
                          <span className="rounded-full border border-rand px-2 py-0.5 text-xs text-leise">einseitig</span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Karte>
    </>
  );
}

/** Eigene Übung einer Person: nur für sie sichtbar, bis du sie freigibst */
function Freigeben({ uebung, name, fertig }: { uebung: Uebung; name: string; fertig: () => void }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  return (
    <Karte>
      <p className="text-sm">
        Eigene Übung von <span className="font-medium">{name}</span>. Gerade sehen sie nur {name} und du.
      </p>
      <button
        type="button"
        disabled={laeuft}
        onClick={async () => {
          setLaeuft(true);
          const f = await uebungFreigeben(uebung.id);
          setLaeuft(false);
          if (f) setFehler(f);
          else fertig();
        }}
        className="mt-3 h-11 rounded-xl border border-akzent px-4 font-medium text-akzent disabled:opacity-50"
      >
        In meine Sammlung übernehmen (für alle Kunden)
      </button>
      {fehler && <p role="alert" className="mt-2 text-sm text-red-500">{fehler}</p>}
    </Karte>
  );
}
