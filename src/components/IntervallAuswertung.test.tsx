import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { IntervallAuswertung } from "./IntervallAuswertung";
import { IntervallTimer } from "./IntervallTimer";
import type { Punkt } from "@/lib/auswertung";
import type { TSatz } from "@/lib/training";

const punkt = (datum: string, zeiten: number[]): Punkt =>
  ({
    einheitId: datum,
    datum,
    saetze: zeiten.length,
    runden: zeiten.map((z) => ({ zeit: z, strecke: 400, nachStrecke: true })),
  }) as unknown as Punkt;

describe("Intervall-Auswertung", () => {
  it("zeigt Rundenzeiten der letzten Einheit und den Abfall", () => {
    const html = renderToStaticMarkup(
      <IntervallAuswertung punkte={[punkt("2026-11-04T08:00:00Z", [90, 90]), punkt("2026-11-11T08:00:00Z", [80, 82, 84, 88])]} />,
    );
    expect(html).toContain("Runden am 11.11.2026");
    expect(html).toContain("Runde 4");
    expect(html).toContain("1:28");
    expect(html).toContain("beste");
    expect(html).toContain("Letzte Runde 10 % langsamer als die erste.");
    expect(html).toContain("Ø Zeit je Runde");
  });
});

describe("Intervall-Timer", () => {
  it("beginnt mit der Vorbereitung und nennt die Übung", () => {
    const runde = (id: string): TSatz => ({
      id,
      plan_satz_id: null,
      satznummer: 1,
      satztyp: "arbeit",
      vorgabe: { distanz_m: 400, pause_sek: 90 },
      wdh: null,
      last_kg: null,
      rir: null,
      dauer_sek: null,
      distanz_m: null,
      erledigt: false,
    });
    const html = renderToStaticMarkup(
      <IntervallTimer titel="Lauf-Intervalle" runden={[runde("a"), runde("b")]} rundeFertig={() => {}} schliessen={() => {}} />,
    );
    expect(html).toContain("Intervall-Timer: Lauf-Intervalle");
    expect(html).toContain("Gleich geht&#x27;s los");
    expect(html).toContain("0:10");
  });
});
