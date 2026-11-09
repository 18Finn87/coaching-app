"use client";

import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { EinheitenListe } from "@/components/EinheitenListe";
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
  return (
    <>
      <Seitentitel titel="Verlauf" text="Deine Trainingseinheiten. Diagramme und Fortschritt kommen in Phase 5." />
      <Karte>
        <EinheitenListe athletId={profil.id} mitLokalen />
      </Karte>
    </>
  );
}
