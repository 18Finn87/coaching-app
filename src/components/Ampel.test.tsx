import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AmpelAnUebung } from "./Ampel";
import { ampelJeUebung, neuAufnehmen } from "@/lib/ampel";

describe("Video-Ampel", () => {
  it("nimmt je Übung das neueste Video", () => {
    const m = ampelJeUebung([
      { id: "alt", uebung_id: "knie", bewertung: "rot", bewertung_kommentar: "", erstellt_am: "2026-11-01T10:00:00Z" },
      { id: "neu", uebung_id: "knie", bewertung: "grau", bewertung_kommentar: "", erstellt_am: "2026-11-10T10:00:00Z" },
      { id: "x", uebung_id: null, bewertung: "gruen", bewertung_kommentar: "", erstellt_am: "2026-11-11T10:00:00Z" },
    ]);
    expect(m.get("knie")?.analyseId).toBe("neu");
    expect(m.get("knie")?.bewertung).toBe("grau");
    expect(m.size).toBe(1);
  });

  it("fordert bei Orange und Rot zum Neuaufnehmen auf", () => {
    expect(neuAufnehmen("orange")).toBe(true);
    expect(neuAufnehmen("rot")).toBe(true);
    expect(neuAufnehmen("gruen")).toBe(false);
    const html = renderToStaticMarkup(
      <AmpelAnUebung uebungId="knie" eintrag={{ analyseId: "a", bewertung: "orange", kommentar: "Knie stabil halten", erstellt_am: "" }} />,
    );
    expect(html).toContain("Verbesserungsbedürftig");
    expect(html).toContain("Bitte neu aufnehmen");
    expect(html).toContain("„Knie stabil halten“");
    expect(html).toContain("Neues Video aufnehmen");
  });

  it("zeigt Grau ohne Video als „noch nicht gesendet“", () => {
    const html = renderToStaticMarkup(<AmpelAnUebung uebungId="knie" eintrag={undefined} />);
    expect(html).toContain("Video: noch nicht gesendet");
  });

  it("zeigt Grün ohne Aufforderung", () => {
    const html = renderToStaticMarkup(
      <AmpelAnUebung uebungId="knie" eintrag={{ analyseId: "a", bewertung: "gruen", kommentar: "Sauber", erstellt_am: "" }} />,
    );
    expect(html).toContain("Gute Ausführung");
    expect(html).not.toContain("Bitte neu aufnehmen");
  });
});
