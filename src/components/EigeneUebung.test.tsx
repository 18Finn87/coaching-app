import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EigeneUebungFormular } from "./EigeneUebung";
import { EIGENE_ARTEN, eigeneArt, eigeneUebungSpeichern, messartText, modulText } from "@/lib/uebungen";
import { artText } from "@/lib/nachrichten";

describe("Eigene Übungen", () => {
  it("einfache Arten passen zu Bereich und Messart der App", () => {
    for (const a of EIGENE_ARTEN) {
      expect(modulText[a.modul]).toBeTruthy();
      expect(messartText[a.messart]).toBeTruthy();
      expect(eigeneArt(a)).toBe(a.wert);
    }
    expect(eigeneArt({ modul: "athletik", messart: "test" })).toBe("kraft_last");
  });

  it("prüft vor dem Speichern verständlich", async () => {
    expect((await eigeneUebungSpeichern(null, "a", { name: "  ", art: "kraft_last", einseitig: false, beschreibung: "", video_link: null })).fehler).toContain("Namen");
    const doppelt = await eigeneUebungSpeichern(null, "a", { name: "kniebeuge", art: "kraft_last", einseitig: false, beschreibung: "", video_link: null }, [
      { id: "x", name: "Kniebeuge" },
    ]);
    expect(doppelt.fehler).toContain("gibt es schon");
    const link = await eigeneUebungSpeichern(null, "a", { name: "Neu", art: "halten", einseitig: false, beschreibung: "", video_link: "http://x" });
    expect(link.fehler).toContain("https://");
  });

  it("zeigt das einfache Formular", () => {
    const html = renderToStaticMarkup(<EigeneUebungFormular athletId="a" vorlage={null} fertig={() => {}} />);
    expect(html).toContain("Name der Übung");
    expect(html).toContain("Kraft mit Gewicht");
    expect(html).toContain("Einseitig");
    expect(html).not.toContain("Archivieren");
  });

  it("Vorschläge haben einen eigenen Namen", () => {
    expect(artText.uebung_vorschlag).toBe("Übungsvorschlag");
  });
});
