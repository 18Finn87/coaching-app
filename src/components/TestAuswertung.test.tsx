import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TestAuswertung, TestUeberblick, type TestInfo } from "./TestAuswertung";
import type { Punkt, UebungsVerlauf } from "@/lib/auswertung";

const punkt = (datum: string, messwerte: number[]): Punkt => ({ einheitId: datum, datum, messwerte }) as unknown as Punkt;
const sprint: UebungsVerlauf = {
  uebungId: "s10",
  name: "Test: Sprint 10 m",
  e1rmGeeignet: false,
  messart: "test",
  punkte: [
    punkt("2026-09-01T08:00:00Z", [2.0, 1.98]),
    punkt("2026-10-01T08:00:00Z", [1.95]),
    punkt("2026-11-01T08:00:00Z", [1.93, 1.9, 1.94]),
  ],
};
const info: TestInfo = { einheit: "s", wertung: "bester", kleinerBesser: true };

describe("Leistungstest-Anzeige", () => {
  it("zeigt bestes Ergebnis, Versuche und Veränderung", () => {
    const html = renderToStaticMarkup(<TestAuswertung verlauf={sprint} info={info} />);
    expect(html).toContain("Test am 01.11.2026");
    expect(html).toContain("1,90 s");
    expect(html).toContain("Versuche: 1,93 · 1,90 · 1,94 s");
    expect(html).toContain("−2,6 % (besser)");
    expect(html).toContain("−4 % (besser)");
    expect(html).toContain("Kein Vergleich mit Normwerten");
  });

  it("listet alle Tests im Überblick", () => {
    const html = renderToStaticMarkup(
      <TestUeberblick verlaeufe={[sprint]} infos={new Map([["s10", info]])} waehlen={() => {}} />,
    );
    expect(html).toContain("Leistungstests");
    expect(html).toContain("Sprint 10 m");
    expect(html).not.toContain("Test: Sprint");
  });
});
