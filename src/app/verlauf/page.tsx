"use client";

import { useState } from "react";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { EinheitenListe } from "@/components/EinheitenListe";
import { Fortschritt } from "@/components/Fortschritt";
import { useProfil } from "@/lib/konto";

export default function VerlaufSeite() {
  return (
    <NurFuer rolle="athlet">
      <Verlauf />
    </NurFuer>
  );
}

function Verlauf() {
  const profil = useProfil();
  const [ansicht, setAnsicht] = useState<"fortschritt" | "einheiten">("fortschritt");
  const reiter = (wert: typeof ansicht, text: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={ansicht === wert}
      onClick={() => setAnsicht(wert)}
      className={`h-10 flex-1 rounded-lg text-sm font-medium ${ansicht === wert ? "bg-flaeche shadow" : "text-leise"}`}
    >
      {text}
    </button>
  );
  return (
    <>
      <Seitentitel titel="Verlauf" />
      <div role="tablist" className="flex gap-1 rounded-xl bg-rand/60 p-1">
        {reiter("fortschritt", "Fortschritt")}
        {reiter("einheiten", "Einheiten")}
      </div>
      {ansicht === "fortschritt" ? (
        <Fortschritt athletId={profil.id} ichId={profil.id} />
      ) : (
        <Karte>
          <EinheitenListe athletId={profil.id} mitLokalen />
        </Karte>
      )}
    </>
  );
}
