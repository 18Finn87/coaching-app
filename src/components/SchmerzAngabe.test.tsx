import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SchmerzAngabe } from "./SchmerzAngabe";

const leer = () => {};

describe("Schmerzangabe", () => {
  it("zeigt ohne Einwilligung nur einen Hinweis", () => {
    const html = renderToStaticMarkup(<SchmerzAngabe wert={null} notiz="" grenze={3} einwilligung={false} aus={false} setzen={leer} />);
    expect(html).toContain("Einwilligung zu Gesundheitsdaten");
    expect(html).not.toContain("radiogroup");
  });

  it("warnt über der Grenze und ändert nichts", () => {
    const html = renderToStaticMarkup(<SchmerzAngabe wert={5} notiz="" grenze={3} einwilligung aus={false} setzen={leer} />);
    expect(html).toContain("in Ordnung bis 3");
    expect(html).toContain("Bitte beende diese Übung");
    expect(html).toContain("ersetzt keine ärztliche");
  });

  it("warnt nicht bis zur Grenze", () => {
    const html = renderToStaticMarkup(<SchmerzAngabe wert={3} notiz="" grenze={3} einwilligung aus={false} setzen={leer} />);
    expect(html).not.toContain("Bitte beende diese Übung");
  });
});
