import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AntwortenListe } from "./AnamneseTeile";
import { Koerperkarte } from "./Koerperkarte";
import { altRegion, STELLEN, stellenText } from "@/lib/koerper";
import { aerztlichNoetig, bereinigen, offeneFragen, pruefen, STANDARD_FRAGEBOGEN, type FrageDef } from "@/lib/fragebogen";

const fragen: FrageDef[] = [
  { id: "a", typ: "janein", text: "Herzprobleme?", aerztlich: true, mitText: "Welche?" },
  { id: "b", typ: "auswahl", text: "Wie oft Sport?", optionen: ["nie", "1x", "3x"], aerztlichBei: ["nie"] },
  { id: "c", typ: "text", text: "Ziele?" },
];

describe("Körperkarte", () => {
  it("hat eindeutige Stellen, links und rechts paarweise", () => {
    for (const ansicht of ["vorne", "hinten"]) {
      const je = STELLEN.filter((s) => s.ansicht === ansicht).map((s) => s.id);
      expect(new Set(je).size).toBe(je.length);
    }
    const ids = STELLEN.map((s) => s.id);
    for (const id of ids.filter((x) => x.endsWith("_links"))) expect(ids).toContain(id.replace("_links", "_rechts"));
  });
  it("ordnet Stellen der alten Einteilung zu", () => {
    expect(altRegion(["knie_links"])).toBe("knie");
    expect(altRegion(["sonstiges", "wade_rechts"])).toBe("sprunggelenk");
    expect(altRegion(["sonstiges"])).toBe("sonstiges");
    expect(stellenText(["knie_links", "sonstiges"])).toBe("Knie links, Sonstiges");
  });
  it("markiert gewählte Stellen", () => {
    const html = renderToStaticMarkup(<Koerperkarte gewaehlt={["knie_links"]} umschalten={() => {}} />);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Knie links");
  });
});

describe("Fragebogen", () => {
  it("Standard enthält die bisherigen Fragen", () => {
    expect(STANDARD_FRAGEBOGEN.fragen.map((f) => f.id)).toContain("brustschmerz");
    expect(STANDARD_FRAGEBOGEN.fragen.every((f) => f.typ === "janein")).toBe(true);
  });
  it("prüft verständlich", () => {
    expect(pruefen(fragen)).toEqual([]);
    expect(pruefen([])).toHaveLength(1);
    const f = pruefen([{ id: "x", typ: "auswahl", text: " ", optionen: ["a", " "] }]);
    expect(f.join(" ")).toContain("Fragetext");
    expect(f.join(" ")).toContain("mindestens 2");
  });
  it("bereinigt Felder je nach Art", () => {
    const [a, b, c] = bereinigen([
      { id: "a", typ: "janein", text: " Frage ", mitText: " ", optionen: ["x"] },
      { id: "b", typ: "auswahl", text: "W", optionen: [" eins ", "", "zwei"], aerztlichBei: ["weg", "eins"] },
      { id: "c", typ: "text", text: "T", aerztlich: true },
    ]);
    expect(a).toEqual({ id: "a", typ: "janein", text: "Frage" });
    expect(b).toEqual({ id: "b", typ: "auswahl", text: "W", optionen: ["eins", "zwei"], aerztlichBei: ["eins"] });
    expect(c).toEqual({ id: "c", typ: "text", text: "T" });
  });
  it("zählt offene Pflichtfragen und erkennt ärztliche Hinweise", () => {
    expect(offeneFragen(fragen, {})).toBe(2);
    expect(offeneFragen(fragen, { a: { wert: "nein" }, b: { wert: "1x" } })).toBe(0);
    expect(aerztlichNoetig(fragen, { a: { wert: "nein" }, b: { wert: "1x" } })).toBe(false);
    expect(aerztlichNoetig(fragen, { a: { wert: "ja" } })).toBe(true);
    expect(aerztlichNoetig(fragen, { b: { wert: "nie" } })).toBe(true);
  });
  it("zeigt Antworten zu den Fragen ihrer Fassung", () => {
    const html = renderToStaticMarkup(
      <AntwortenListe fragen={fragen} antworten={{ a: { wert: "ja", text: "Bluthochdruck" }, b: { wert: "3x" }, c: { text: "Kraft" } }} />,
    );
    expect(html).toContain("Herzprobleme?");
    expect(html).toContain("Ja");
    expect(html).toContain("Bluthochdruck");
    expect(html).toContain("3x");
    expect(html).toContain("Kraft");
  });
});
