"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { PlanAnsicht } from "./PlanAnsicht";
import { supabase } from "@/lib/supabase";
import { datum } from "@/lib/texte";

type Eintrag = {
  id: string;
  titel: string;
  ziel: string;
  planversionen: { id: string; versionsnummer: number; status: string; gueltig_ab: string | null }[];
};

/** Athletin / Athlet: die gültigen Versionen der eigenen Pläne (nur lesen). */
export function MeinPlan({ athletId }: { athletId: string }) {
  const [plaene, setPlaene] = useState<Eintrag[] | null>(null);

  useEffect(() => {
    supabase()
      .from("plaene")
      .select("id, titel, ziel, planversionen (id, versionsnummer, status, gueltig_ab)")
      .eq("athlet_id", athletId)
      .eq("status", "aktiv")
      .order("erstellt_am", { ascending: false })
      .then(({ data }) => setPlaene((data as Eintrag[] | null) ?? []));
  }, [athletId]);

  if (plaene === null) {
    return (
      <Karte titel="Dein Plan">
        <p className="text-leise">Lädt …</p>
      </Karte>
    );
  }

  const mitGueltiger = plaene
    .map((p) => ({ plan: p, version: p.planversionen.find((v) => v.status === "veroeffentlicht") }))
    .filter((x) => x.version);

  if (mitGueltiger.length === 0) {
    return (
      <Karte titel="Dein Plan">
        <p className="text-leise">Dein Coach hat dir noch keinen Plan freigegeben.</p>
      </Karte>
    );
  }

  return (
    <>
      {mitGueltiger.map(({ plan, version }) => (
        <section key={plan.id} className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">{plan.titel}</h2>
            <p className="text-sm text-leise">
              Version {version!.versionsnummer}
              {version!.gueltig_ab ? ` · gültig ab ${datum(version!.gueltig_ab)}` : ""}
            </p>
            {plan.ziel && <p className="mt-1 whitespace-pre-wrap text-sm">{plan.ziel}</p>}
          </div>
          <PlanAnsicht versionId={version!.id} />
        </section>
      ))}
    </>
  );
}
