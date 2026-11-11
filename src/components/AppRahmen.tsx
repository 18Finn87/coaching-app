"use client";

import { EinwilligungsAnbieter } from "@/lib/einwilligungen";
import { videosAufraeumen } from "@/lib/videos";
import { useEffect } from "react";
import { KontoAnbieter, useKonto } from "@/lib/konto";
import { supabase } from "@/lib/supabase";
import { Anmeldung } from "./Anmeldung";
import { Einwilligungspruefung } from "./Einwilligungsabfrage";
import { Glocke } from "./Glocke";
import { GemerkteKontenListe } from "./KontoWechsel";
import { gemerkteKonten } from "@/lib/kontowechsel";
import { Navigation } from "./Navigation";
import { TrainingSync } from "./TrainingSync";

/**
 * Umschließt jede Seite: Ohne Anmeldung erscheint nur die Anmeldung,
 * mit Anmeldung der Rahmen mit Menü passend zur Rolle (Coach oder Athlet).
 */
export function AppRahmen({ children }: { children: React.ReactNode }) {
  return (
    <KontoAnbieter>
      <Inhalt>{children}</Inhalt>
    </KontoAnbieter>
  );
}

function Inhalt({ children }: { children: React.ReactNode }) {
  const { zustand } = useKonto();

  switch (zustand.art) {
    case "nicht_eingerichtet":
      return (
        <Einfach titel="Noch nicht eingerichtet">
          <p className="text-leise">Die Verbindung zur Datenbank fehlt noch.</p>
        </Einfach>
      );
    case "laedt":
      return (
        <Einfach titel="Coaching App">
          <p className="text-leise" role="status">
            Einen Moment …
          </p>
        </Einfach>
      );
    case "abgemeldet":
      return (
        <Einfach titel="Coaching App" untertitel="Private App für Krafttraining und Coaching.">
          {gemerkteKonten().length > 0 && (
            <section className="rounded-2xl border border-rand bg-flaeche p-4">
              <h2 className="mb-3 text-lg font-semibold">Gemerkte Konten</h2>
              <GemerkteKontenListe aktuell={null} />
            </section>
          )}
          <section className="rounded-2xl border border-rand bg-flaeche p-4">
            <h2 className="mb-3 text-lg font-semibold">Anmelden</h2>
            <Anmeldung />
          </section>
        </Einfach>
      );
    case "ohne_profil":
    case "fehler":
      return (
        <Einfach titel="Coaching App">
          <p role="alert">
            {zustand.art === "fehler"
              ? "Dein Profil konnte gerade nicht geladen werden. Bitte prüfe deine Internetverbindung und lade die Seite neu."
              : "Dein Zugang ist noch nicht vollständig eingerichtet. Bitte wende dich an deinen Coach."}
          </p>
          <button
            type="button"
            onClick={() => supabase().auth.signOut()}
            className="h-11 rounded-xl border border-rand px-4 font-medium"
          >
            Abmelden
          </button>
        </Einfach>
      );
    case "angemeldet":
      const rahmen = (
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-10 border-b border-rand bg-background/90 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between px-4">
              <span className="font-semibold">Coaching App</span>
              <span className="flex min-w-0 items-center gap-1">
                <span className="truncate pl-4 text-sm text-leise">
                  {zustand.profil.anzeigename || zustand.sitzung.user.email}
                  {zustand.profil.rolle === "coach" ? " · Coach" : ""}
                </span>
                <Glocke />
              </span>
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pt-5 pb-28">
            {children}
          </main>
          <Navigation rolle={zustand.profil.rolle} />
          <VideosAufraeumen />
        </div>
      );
      return (
        <EinwilligungsAnbieter>
          {zustand.profil.rolle === "athlet" ? (
            <Einwilligungspruefung>
              <TrainingSync athletId={zustand.profil.id} />
              {rahmen}
            </Einwilligungspruefung>
          ) : (
            rahmen
          )}
        </EinwilligungsAnbieter>
      );
  }
}

function Einfach({
  titel,
  untertitel,
  children,
}: {
  titel: string;
  untertitel?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{titel}</h1>
        {untertitel && <p className="text-leise">{untertitel}</p>}
      </header>
      {children}
    </main>
  );
}

/** Abgelaufene Videos (12 Monate) und Videos nach Widerruf entfernen – höchstens einmal am Tag */
function VideosAufraeumen() {
  useEffect(() => {
    const t = setTimeout(() => videosAufraeumen(), 4000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
