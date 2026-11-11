import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AusdauerFelder } from "./AusdauerFelder";
import type { TSatz } from "@/lib/training";

const satz: TSatz = {
  id: "s1",
  plan_satz_id: null,
  satznummer: 1,
  satztyp: "arbeit",
  vorgabe: { dauer_sek: 1800, distanz_m: 5000 },
  wdh: null,
  last_kg: null,
  rir: null,
  dauer_sek: 1680,
  distanz_m: 5000,
  puls_schnitt: 145,
  anstrengung: 4,
  erledigt: true,
  zusatz: { quelle: "fit", hoehenmeter: 42, splits: [330, 340] },
};

describe("Ausdauer-Felder", () => {
  it("zeigt Pace, Uhr-Werte und den Knopf für die Uhr-Datei", () => {
    const html = renderToStaticMarkup(
      <AusdauerFelder satz={satz} aus={false} setzen={() => {}} abhaken={() => {}} bearbeitbar />,
    );
    expect(html).toContain("5:36 /km");
    expect(html).toContain("von der Uhr (FIT) · 42 Höhenmeter · km-Zeiten: 5:30 · 5:40");
    expect(html).toContain("Datei von der Uhr einlesen");
  });
  it("ohne Bearbeiten kein Uhr-Knopf", () => {
    const html = renderToStaticMarkup(
      <AusdauerFelder satz={satz} aus setzen={() => {}} abhaken={() => {}} bearbeitbar={false} />,
    );
    expect(html).not.toContain("Datei von der Uhr einlesen");
  });
});
