"use client";

import { Karte, Platzhalter, Seitentitel } from "@/components/Bausteine";
import { useProfil } from "@/lib/konto";

const schritte = [
  { nr: "1.1", text: "Projekt anlegen", fertig: true },
  { nr: "1.2", text: "Supabase-Projekt und E-Mail-Versand", fertig: true },
  { nr: "1.3", text: "Anmeldung mit Code per E-Mail", fertig: true },
  { nr: "1.4", text: "Tabellen und Zugriffsregeln", fertig: true },
  { nr: "1.5", text: "Grundgerüst und Veröffentlichung", fertig: true },
];

export default function Startseite() {
  const profil = useProfil();

  if (profil.rolle === "athlet") {
    return (
      <Platzhalter
        titel="Heute"
        phase="Phase 4"
        text="Hier siehst du deine nächste Trainingseinheit und startest das Training."
      />
    );
  }

  return (
    <>
      <Seitentitel
        titel="Übersicht"
        text="Hier erscheinen später fällige Evaluationen, neue Check-ins und eine Zusammenfassung der letzten Einheiten."
      />
      <Karte titel="Fortschritt Phase 1 · Fundament">
        <ol className="flex flex-col gap-2">
          {schritte.map((s) => (
            <li key={s.nr} className="flex items-center gap-3">
              <span
                aria-hidden
                className={
                  s.fertig
                    ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-akzent text-sm text-akzent-text"
                    : "size-6 shrink-0 rounded-full border-2 border-rand"
                }
              >
                {s.fertig ? "✓" : ""}
              </span>
              <span className={s.fertig ? "" : "text-leise"}>
                {s.nr} {s.text}
                <span className="sr-only">{s.fertig ? " (erledigt)" : " (offen)"}</span>
              </span>
            </li>
          ))}
        </ol>
      </Karte>
    </>
  );
}
