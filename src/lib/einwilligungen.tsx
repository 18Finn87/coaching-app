"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useKonto } from "./konto";

export type EinwilligungArt = "nutzung" | "gesundheitsdaten";

/**
 * Aktuelle Fassung der Texte. Bei inhaltlichen Änderungen die Version erhöhen –
 * dann werden alle Athletinnen und Athleten beim nächsten Start erneut gefragt.
 * Die alten Fassungen bleiben in der Versionsgeschichte des Repos nachvollziehbar.
 */
export const TEXTVERSION: Record<EinwilligungArt, string> = {
  nutzung: "2026-11-v1",
  gesundheitsdaten: "2026-11-v1",
};

export type Abschnitt = { titel: string; punkte: string[] };

export function einwilligungsText(art: EinwilligungArt, coach: string): {
  titel: string;
  pflicht: boolean;
  abschnitte: Abschnitt[];
  bestaetigung: string;
} {
  if (art === "nutzung") {
    return {
      titel: "Nutzung der App",
      pflicht: true,
      abschnitte: [
        {
          titel: "Was wird gespeichert?",
          punkte: [
            "Dein Name und deine E-Mail-Adresse.",
            "Deine Trainingspläne und was du im Training einträgst, zum Beispiel Wiederholungen, Gewichte und deine Einschätzungen.",
            "Deine wöchentlichen Check-ins, zum Beispiel Schlaf, Stress und Energie.",
          ],
        },
        {
          titel: "Wer sieht das?",
          punkte: [`Nur du und dein Coach ${coach}. Niemand sonst.`],
        },
        {
          titel: "Wofür?",
          punkte: [
            "Nur für dein Training und deine Betreuung.",
            "Keine Werbung, kein Verkauf, keine Weitergabe an andere.",
          ],
        },
        {
          titel: "Wo liegen die Daten?",
          punkte: ["Beim Anbieter Supabase auf Servern in Frankfurt (EU)."],
        },
        {
          titel: "Deine Rechte",
          punkte: [
            "Du kannst jederzeit sehen, was gespeichert ist, und deine Daten herunterladen.",
            "Du kannst deine Daten jederzeit löschen lassen.",
            "Du kannst diese Einwilligung jederzeit unter „Profil“ widerrufen. Danach kannst du die App nicht mehr nutzen.",
          ],
        },
        {
          titel: "Freiwillig",
          punkte: ["Die Nutzung ist freiwillig. Ohne diese Einwilligung kannst du die App aber nicht verwenden."],
        },
      ],
      bestaetigung: "Ich habe das gelesen und willige in die Nutzung der App ein.",
    };
  }
  return {
    titel: "Gesundheitsdaten",
    pflicht: false,
    abschnitte: [
      {
        titel: "Worum geht es?",
        punkte: [
          "Für ein sicheres Training kann dein Coach dich nach Gesundheitsangaben fragen, zum Beispiel nach Verletzungen, Beschwerden, Schmerzen oder Vorerkrankungen.",
          "Solche Angaben sind nach der DSGVO besonders geschützt (Artikel 9).",
        ],
      },
      {
        titel: "Wie werden sie geschützt?",
        punkte: [
          "Sie liegen getrennt von den Trainingsdaten und sind extra abgesichert.",
          `Nur du und dein Coach ${coach} sehen sie.`,
          "Jede Änderung wird protokolliert.",
        ],
      },
      {
        titel: "Keine Diagnosen",
        punkte: [
          "Die App stellt keine Diagnosen und gibt keine medizinischen Ratschläge.",
          "Sie ersetzt keine ärztliche Untersuchung.",
        ],
      },
      {
        titel: "Freiwillig",
        punkte: [
          "Du kannst auch ohne diese Einwilligung trainieren. Dein Coach kann Risiken dann aber schlechter einschätzen.",
          "Du kannst sie jederzeit unter „Profil“ erteilen oder widerrufen. Nach einem Widerruf sieht dein Coach deine Gesundheitsangaben nicht mehr.",
        ],
      },
    ],
    bestaetigung: "Ich willige ein, dass meine Gesundheitsangaben wie beschrieben gespeichert werden.",
  };
}

export type Einwilligung = {
  id: string;
  art: EinwilligungArt;
  textversion: string;
  erteilt_am: string;
  widerrufen_am: string | null;
};

type Kontext = {
  /** null = lädt noch */
  liste: Einwilligung[] | null;
  fehler: boolean;
  coachName: string;
  neuLaden: () => Promise<void>;
  aktiv: (art: EinwilligungArt) => Einwilligung | undefined;
  erteilen: (art: EinwilligungArt) => Promise<boolean>;
  widerrufen: (id: string) => Promise<boolean>;
};

const EinwilligungsKontext = createContext<Kontext | null>(null);

/** Lädt die eigenen Einwilligungen (nur für Athletinnen und Athleten). */
export function EinwilligungsAnbieter({ children }: { children: React.ReactNode }) {
  const { zustand } = useKonto();
  const nutzerId = zustand.art === "angemeldet" ? zustand.profil.id : null;
  const [liste, setListe] = useState<Einwilligung[] | null>(null);
  const [fehler, setFehler] = useState(false);
  const [coachName, setCoachName] = useState("");

  const neuLaden = useCallback(async () => {
    if (!nutzerId) return;
    const sb = supabase();
    const [e, c] = await Promise.all([
      sb
        .from("einwilligungen")
        .select("id, art, textversion, erteilt_am, widerrufen_am")
        .eq("athlet_id", nutzerId)
        .order("erteilt_am", { ascending: false }),
      sb
        .from("coach_athlet")
        .select("coach:profile!coach_id(anzeigename)")
        .eq("athlet_id", nutzerId)
        .neq("status", "beendet")
        .limit(1),
    ]);
    const cacheSchluessel = "coaching.einwilligungen." + nutzerId;
    if (e.error) {
      // Ohne Internet: zuletzt bekannten Stand verwenden
      try {
        const roh = localStorage.getItem(cacheSchluessel);
        if (roh) {
          const gespeichert = JSON.parse(roh) as { liste: Einwilligung[]; coach: string };
          setListe(gespeichert.liste);
          setCoachName(gespeichert.coach);
          setFehler(false);
          return;
        }
      } catch {
        // kein Speicher
      }
      setFehler(true);
      return;
    }
    setFehler(false);
    setListe(e.data as Einwilligung[]);
    const coach = (c.data?.[0] as unknown as { coach: { anzeigename: string } | null } | undefined)?.coach;
    setCoachName(coach?.anzeigename ?? "");
    try {
      localStorage.setItem(cacheSchluessel, JSON.stringify({ liste: e.data, coach: coach?.anzeigename ?? "" }));
    } catch {
      // egal
    }
  }, [nutzerId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    neuLaden();
  }, [neuLaden]);

  const aktiv = useCallback(
    (art: EinwilligungArt) => liste?.find((x) => x.art === art && !x.widerrufen_am),
    [liste],
  );

  const erteilen = useCallback(
    async (art: EinwilligungArt) => {
      const { error } = await supabase()
        .from("einwilligungen")
        .insert({ art, textversion: TEXTVERSION[art] });
      await neuLaden();
      return !error;
    },
    [neuLaden],
  );

  const widerrufen = useCallback(
    async (id: string) => {
      const { error } = await supabase()
        .from("einwilligungen")
        .update({ widerrufen_am: new Date().toISOString() })
        .eq("id", id);
      await neuLaden();
      return !error;
    },
    [neuLaden],
  );

  return (
    <EinwilligungsKontext.Provider
      value={{ liste, fehler, coachName, neuLaden, aktiv, erteilen, widerrufen }}
    >
      {children}
    </EinwilligungsKontext.Provider>
  );
}

export function useEinwilligungen(): Kontext {
  const k = useContext(EinwilligungsKontext);
  if (!k) throw new Error("useEinwilligungen nur innerhalb von EinwilligungsAnbieter verwenden");
  return k;
}
