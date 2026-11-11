import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlanAnsicht } from "./PlanAnsicht";
import { Klappkarte } from "./UeberDich";
import { angabenVollstaendig } from "@/lib/nachrichten";
import type { Einheit } from "@/lib/plaene";

const einheit = (id: string, name: string, uebungen: string[]): Einheit =>
  ({
    id,
    name,
    reihenfolge: 0,
    notiz: "",
    plan_uebungen: uebungen.map((u, i) => ({
      id: id + i,
      reihenfolge: i,
      gruppe: null,
      hinweis: "",
      uebung_id: u,
      uebung: { name: u, messart: "wdh_last", einseitig: false },
      plan_saetze: [{ id: id + i + "s", satznummer: 1, satztyp: "arbeit", wdh_min: 8, wdh_max: 10, last_kg: 60, last_prozent: null, rir_ziel: null, tempo: null, pause_sek: 90, dauer_sek: null, distanz_m: null, zusatz: {} }],
    })),
  }) as unknown as Einheit;

describe("Kundenansicht", () => {
  it("zeigt Trainingstage eingeklappt als Kacheln", () => {
    const html = renderToStaticMarkup(
      <PlanAnsicht
        versionId="v"
        kacheln
        vorgeladen={[einheit("a", "Oberkörper", ["Bankdrücken", "Rudern"]), einheit("b", "Unterkörper", ["Kniebeuge"])]}
        aktion={(e) => <button type="button">{e.name} starten</button>}
      />,
    );
    expect(html).toContain("Oberkörper");
    expect(html).toContain("2 Übungen · Bankdrücken, Rudern");
    expect(html).toContain("1 Übung · Kniebeuge");
    expect(html).toContain('aria-expanded="false"');
    // Sätze und Start-Knopf erst nach dem Aufklappen
    expect(html).not.toContain("8–10 Wdh.");
    expect(html).not.toContain("starten");
  });

  it("zeigt den Plan für den Coach weiter offen", () => {
    const html = renderToStaticMarkup(<PlanAnsicht versionId="v" vorgeladen={[einheit("a", "Oberkörper", ["Bankdrücken"])]} />);
    expect(html).toContain("8–10 Wdh.");
  });

  it("zeigt den Status einer Klappkarte", () => {
    const html = renderToStaticMarkup(
      <Klappkarte id="x" titel="Über dich" status="Erledigt ✓" erledigt offen={false} umschalten={() => {}}>
        <p>Inhalt</p>
      </Klappkarte>,
    );
    expect(html).toContain("Erledigt ✓");
    expect(html).not.toContain("Inhalt");
  });

  it("erkennt vollständige Angaben", () => {
    expect(angabenVollstaendig({ ziele: ["kraft"], trainingstage: [1, 4] })).toBe(true);
    expect(angabenVollstaendig({ ziele: [], trainingstage: [1] })).toBe(false);
    expect(angabenVollstaendig(null)).toBe(false);
  });
});
