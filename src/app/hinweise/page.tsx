"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Karte, Seitentitel } from "@/components/Bausteine";
import { alleGelesen, benachrichtigungenLaden, hinweisZiel, type Benachrichtigung } from "@/lib/coaching";
import { useProfil } from "@/lib/konto";

export default function HinweiseSeite() {
  const profil = useProfil();
  const [liste, setListe] = useState<Benachrichtigung[] | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    benachrichtigungenLaden().then(({ daten, fehler }) => {
      setListe(daten);
      setFehler(fehler);
      // Beim Öffnen gelten alle als gelesen; die Liste zeigt trotzdem, was neu war
      if (!fehler && daten.some((b) => !b.gelesen_am)) alleGelesen();
    });
  }, []);

  return (
    <>
      <Seitentitel
        titel="Hinweise"
        text={
          profil.rolle === "coach"
            ? "Neue Check-ins, fällige Evaluationen und einmal am Tag eine Zusammenfassung der Einheiten."
            : "Antworten deines Coaches und Erinnerungen an den Check-in."
        }
      />
      <Karte>
        {fehler ? (
          <p role="alert" className="text-sm text-red-500">
            Die Hinweise konnten nicht geladen werden.
          </p>
        ) : liste === null ? (
          <p className="text-leise">Lädt …</p>
        ) : liste.length === 0 ? (
          <p className="text-sm text-leise">Keine Hinweise.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-rand">
            {liste.map((b) => (
              <li key={b.id}>
                <Link href={hinweisZiel(b, profil.rolle)} className="flex items-start gap-3 py-3">
                  <span
                    aria-hidden
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${b.gelesen_am ? "bg-transparent" : "bg-red-600"}`}
                  />
                  <span className="flex flex-col">
                    <span className={b.gelesen_am ? "" : "font-semibold"}>
                      {b.text_kurz}
                      {!b.gelesen_am && <span className="sr-only"> (neu)</span>}
                    </span>
                    <span className="text-xs text-leise">
                      {new Date(b.erstellt_am).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Karte>
      <p className="text-xs text-leise">Hinweise werden nach 90 Tagen automatisch gelöscht.</p>
    </>
  );
}
