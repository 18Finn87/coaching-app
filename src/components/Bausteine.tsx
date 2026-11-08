"use client";

import { useProfil, type Rolle } from "@/lib/konto";

export function Seitentitel({ titel, text }: { titel: string; text?: string }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
      {text && <p className="text-leise">{text}</p>}
    </header>
  );
}

export function Karte({ titel, children }: { titel?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-rand bg-flaeche p-4">
      {titel && <h2 className="mb-3 text-lg font-semibold">{titel}</h2>}
      {children}
    </section>
  );
}

/** Platzhalter für Bereiche, die in einer späteren Phase gebaut werden. */
export function Platzhalter({ titel, phase, text }: { titel: string; phase: string; text: string }) {
  return (
    <>
      <Seitentitel titel={titel} />
      <Karte>
        <p className="text-sm font-medium text-akzent">Kommt in {phase}</p>
        <p className="mt-1 text-leise">{text}</p>
      </Karte>
    </>
  );
}

/**
 * Zeigt den Inhalt nur für die passende Rolle. Das ist nur Bedienkomfort –
 * den eigentlichen Schutz der Daten übernimmt die Datenbank (RLS).
 */
export function NurFuer({ rolle, children }: { rolle: Rolle; children: React.ReactNode }) {
  const profil = useProfil();
  if (profil.rolle !== rolle) {
    return (
      <Karte>
        <p>Dieser Bereich ist nur für {rolle === "coach" ? "den Coach" : "Athletinnen und Athleten"}.</p>
      </Karte>
    );
  }
  return <>{children}</>;
}
