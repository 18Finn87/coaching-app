"use client";

import { useState } from "react";
import { Karte } from "./Bausteine";
import { EinwilligungsText } from "./Einwilligungsabfrage";
import { einwilligungsText, useEinwilligungen, type EinwilligungArt } from "@/lib/einwilligungen";
import { datum } from "@/lib/texte";
import { videosAufraeumen } from "@/lib/videos";

/** Profil-Bereich für Athletinnen und Athleten: Einwilligungen ansehen, erteilen, widerrufen. */
export function EinwilligungenVerwalten() {
  return (
    <Karte titel="Datenschutz und Einwilligungen">
      <div className="flex flex-col divide-y divide-rand">
        <Eintrag art="nutzung" />
        <Eintrag art="gesundheitsdaten" />
        <Eintrag art="videos" />
      </div>
    </Karte>
  );
}

function Eintrag({ art }: { art: EinwilligungArt }) {
  const { aktiv, erteilen, widerrufen, coachName } = useEinwilligungen();
  const [offen, setOffen] = useState(false);
  const [bestaetigen, setBestaetigen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  const e = aktiv(art);
  const text = einwilligungsText(art, coachName);

  async function ausfuehren(aktion: () => Promise<boolean>) {
    setLaeuft(true);
    setFehler("");
    const ok = await aktion();
    setLaeuft(false);
    setBestaetigen(false);
    if (!ok) setFehler("Das hat nicht geklappt. Bitte versuche es erneut.");
  }

  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{text.titel}</p>
          <p className="text-sm text-leise">
            {e ? `Erteilt am ${datum(e.erteilt_am)}` : "Nicht erteilt"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            e ? "bg-akzent/15 text-akzent" : "border border-rand text-leise"
          }`}
        >
          {e ? "Erteilt" : "Nein"}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        className="self-start text-sm text-akzent underline underline-offset-4"
      >
        {offen ? "Text ausblenden" : "Text lesen"}
      </button>
      {offen && (
        <div className="rounded-xl border border-rand p-3">
          <EinwilligungsText art={art} coach={coachName} />
        </div>
      )}

      {!e && art !== "nutzung" && (
        <button
          type="button"
          disabled={laeuft}
          onClick={() => ausfuehren(() => erteilen(art))}
          className="h-11 self-start rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
        >
          Einwilligung erteilen
        </button>
      )}

      {e && !bestaetigen && (
        <button
          type="button"
          onClick={() => setBestaetigen(true)}
          className="h-11 self-start rounded-xl border border-rand px-4 font-medium"
        >
          Widerrufen
        </button>
      )}
      {e && bestaetigen && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-400/50 bg-red-500/10 p-3">
          <p className="text-sm">
            {art === "nutzung"
              ? "Wenn du die Nutzung widerrufst, kannst du die App nicht mehr verwenden, bis du erneut einwilligst. Deine gespeicherten Daten bleiben erhalten, bis du die Löschung beantragst."
              : art === "videos"
                ? "Nach dem Widerruf werden alle Videos von dir gelöscht – auch die, die dein Coach hochgeladen hat. Die schriftlichen Anmerkungen bleiben."
                : "Nach dem Widerruf sieht dein Coach deine Gesundheitsangaben nicht mehr und es können keine neuen eingetragen werden."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={laeuft}
              onClick={() =>
                ausfuehren(async () => {
                  const ok = await widerrufen(e.id);
                  if (ok && art === "videos") await videosAufraeumen(true);
                  return ok;
                })
              }
              className="h-11 rounded-xl bg-red-600 px-4 font-medium text-white disabled:opacity-50"
            >
              {laeuft ? "…" : "Ja, widerrufen"}
            </button>
            <button
              type="button"
              onClick={() => setBestaetigen(false)}
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
  );
}
