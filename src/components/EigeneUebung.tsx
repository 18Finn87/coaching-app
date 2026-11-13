"use client";

import { useState, type FormEvent } from "react";
import { EIGENE_ARTEN, eigeneArt, eigeneUebungSpeichern, uebungArchivieren, type Uebung } from "@/lib/uebungen";

const feld = "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

/** Kunde: eigene Übung anlegen oder ändern (einfache Felder, ohne Fachbegriffe) */
export function EigeneUebungFormular({
  athletId,
  vorlage,
  vorhandene = [],
  fertig,
}: {
  athletId: string;
  vorlage: Uebung | null;
  vorhandene?: { id: string; name: string }[];
  fertig: (u: Uebung | null) => void;
}) {
  const [name, setName] = useState(vorlage?.name ?? "");
  const [art, setArt] = useState(vorlage ? eigeneArt(vorlage) : "kraft_last");
  const [einseitig, setEinseitig] = useState(vorlage?.einseitig ?? false);
  const [beschreibung, setBeschreibung] = useState(vorlage?.beschreibung ?? "");
  const [video, setVideo] = useState(vorlage?.video_link ?? "");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  async function speichern(e: FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler("");
    const { uebung, fehler } = await eigeneUebungSpeichern(
      vorlage?.id ?? null,
      athletId,
      { name, art, einseitig, beschreibung, video_link: video.trim() || null },
      vorhandene,
    );
    setLaeuft(false);
    if (fehler) setFehler(fehler);
    else fertig(uebung);
  }

  async function archivieren() {
    if (!vorlage) return;
    setLaeuft(true);
    const ok = await uebungArchivieren(vorlage.id, !vorlage.archiviert);
    setLaeuft(false);
    if (ok) fertig({ ...vorlage, archiviert: !vorlage.archiviert });
    else setFehler("Das hat nicht geklappt. Bitte versuche es erneut.");
  }

  return (
    <form onSubmit={speichern} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Name der Übung
        <input
          value={name}
          maxLength={80}
          autoFocus={!vorlage}
          onChange={(e) => setName(e.target.value)}
          placeholder="z. B. Bulgarian Split Squat"
          className={`${feld} font-normal`}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Was trägst du ein?
        <select value={art} onChange={(e) => setArt(e.target.value)} className={`${feld} font-normal`}>
          {EIGENE_ARTEN.map((a) => (
            <option key={a.wert} value={a.wert}>
              {a.text}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={einseitig} onChange={(e) => setEinseitig(e.target.checked)} className="size-5 accent-akzent" />
        Einseitig (z. B. ein Bein oder ein Arm nach dem anderen)
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Beschreibung (freiwillig)
        <textarea
          rows={3}
          maxLength={2000}
          value={beschreibung}
          onChange={(e) => setBeschreibung(e.target.value)}
          placeholder="Wie führst du sie aus? Worauf achtest du?"
          className="w-full rounded-xl border border-rand bg-background p-3 text-base font-normal outline-none focus:border-akzent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Video-Link (freiwillig)
        <input
          value={video}
          maxLength={500}
          inputMode="url"
          onChange={(e) => setVideo(e.target.value)}
          placeholder="https://…"
          className={`${feld} font-normal`}
        />
      </label>
      {fehler && (
        <p role="alert" className="text-sm text-red-500">
          {fehler}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={laeuft} className="h-12 flex-1 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50">
          {laeuft ? "Speichert …" : "Speichern"}
        </button>
        <button type="button" onClick={() => fertig(null)} className="h-12 rounded-xl border border-rand px-4 font-medium">
          Abbrechen
        </button>
      </div>
      {vorlage && (
        <button type="button" disabled={laeuft} onClick={archivieren} className="text-sm text-leise underline">
          {vorlage.archiviert ? "Wieder aktivieren" : "Archivieren (erscheint dann nicht mehr in der Auswahl)"}
        </button>
      )}
    </form>
  );
}
