"use client";

import Link from "next/link";
import { Karte, Seitentitel } from "@/components/Bausteine";
import { useEinwilligungen } from "@/lib/einwilligungen";
import { useProfil } from "@/lib/konto";

const schritte = [
  { nr: "Phase 1", text: "Fundament", fertig: true },
  { nr: "2.1", text: "Einladen und Einladung annehmen", fertig: true },
  { nr: "2.2", text: "Einwilligungen", fertig: true },
  { nr: "2.3", text: "Stammdaten und Erfahrungsstufe", fertig: true },
  { nr: "2.4", text: "Anamnese im geschützten Gesundheitsbereich", fertig: true },
  { nr: "2.5", text: "Daten herunterladen und Konto löschen", fertig: true },
];

export default function Startseite() {
  const profil = useProfil();
  if (profil.rolle === "athlet") return <Heute />;

  return (
    <>
      <Seitentitel
        titel="Übersicht"
        text="Hier erscheinen später fällige Evaluationen, neue Check-ins und eine Zusammenfassung der letzten Einheiten."
      />
      <Karte titel="Fortschritt">
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

function Heute() {
  const { aktiv } = useEinwilligungen();
  return (
    <>
      <Seitentitel titel="Heute" />
      <Karte>
        <p className="text-sm font-medium text-akzent">Kommt in Phase 4</p>
        <p className="mt-1 text-leise">
          Hier siehst du deine nächste Trainingseinheit und startest das Training.
        </p>
      </Karte>
      <Karte titel="Bevor es losgeht">
        <ul className="flex flex-col gap-3">
          <li>
            <Link href="/profil/" className="font-medium text-akzent underline underline-offset-4">
              Angaben zum Training
            </Link>
            <p className="text-sm text-leise">Ziele, Trainingstage, Ausstattung – im Profil.</p>
          </li>
          <li>
            <Link href="/anamnese/" className="font-medium text-akzent underline underline-offset-4">
              Gesundheit und Anamnese
            </Link>
            <p className="text-sm text-leise">
              {aktiv("gesundheitsdaten")
                ? "Ein kurzer Fragebogen für ein sicheres Training."
                : "Nur mit deiner Einwilligung zu Gesundheitsdaten (im Profil)."}
            </p>
          </li>
        </ul>
      </Karte>
    </>
  );
}
