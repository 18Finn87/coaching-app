import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Liniendiagramm } from "./Liniendiagramm";

describe("Liniendiagramm mit zwei Seiten", () => {
  it("zeichnet links (Kreis) und rechts (Quadrat) bei nur einem Termin", () => {
    const html = renderToStaticMarkup(
      <Liniendiagramm
        titel="Messwert"
        einheit="cm"
        punkte={[{ datum: "2026-11-10T10:00:00Z", wert: 9.5 }]}
        linienName="links"
        reihe2={{ name: "rechts", punkte: [{ datum: "2026-11-10T10:00:00Z", wert: 12 }] }}
      />,
    );
    expect(html).toContain("<circle");
    expect(html).toContain("<rect x=\"311.5\"");
    expect(html).toContain('fill="var(--diagramm-2)"');
  });
});
