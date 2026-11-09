import { describe, expect, it } from "vitest";
import { STANDARD_REGELN, evaluationsStand, regelFuer } from "./evaluation";

const jetzt = new Date("2026-11-09T12:00:00Z");
const vorTagen = (t: number) => new Date(jetzt.getTime() - t * 24 * 60 * 60 * 1000);
const anfaenger = STANDARD_REGELN.anfaenger;

describe("Evaluation fällig", () => {
  it("Anfänger: 10 Einheiten in 3 Wochen → fällig wegen Einheiten", () => {
    const einheiten = Array.from({ length: 10 }, (_, i) => vorTagen(19 - i * 2));
    const s = evaluationsStand(vorTagen(21), einheiten, anfaenger, jetzt);
    expect(s.faellig).toBe(true);
    expect(s.ausloeser).toBe("einheiten");
    expect(s.faelligAm).toEqual(einheiten[9]);
  });

  it("Anfänger: 4 Wochen mit 6 Einheiten → fällig wegen Wochen", () => {
    const einheiten = Array.from({ length: 6 }, (_, i) => vorTagen(24 - i * 4));
    const s = evaluationsStand(vorTagen(29), einheiten, anfaenger, jetzt);
    expect(s.faellig).toBe(true);
    expect(s.ausloeser).toBe("wochen");
    expect(s.restEinheiten).toBe(4);
  });

  it("2 Wochen mit 5 Einheiten → noch nicht fällig, Rest wird angezeigt", () => {
    const einheiten = Array.from({ length: 5 }, (_, i) => vorTagen(12 - i * 2));
    const s = evaluationsStand(vorTagen(14), einheiten, anfaenger, jetzt);
    expect(s.faellig).toBe(false);
    expect(s.restEinheiten).toBe(5);
    expect(s.restTage).toBe(14);
  });

  it("Einheiten vor dem Beginn zählen nicht", () => {
    const einheiten = Array.from({ length: 12 }, (_, i) => vorTagen(40 - i));
    const s = evaluationsStand(vorTagen(5), einheiten, anfaenger, jetzt);
    expect(s.einheitenSeitBeginn).toBe(0);
    expect(s.faellig).toBe(false);
  });

  it("Wenn beides erreicht ist, zählt was zuerst eintrat", () => {
    // 10. Einheit erst nach 30 Tagen, Wochen-Termin schon nach 28 Tagen
    const einheiten = Array.from({ length: 10 }, (_, i) => vorTagen(32 - (i + 1) * 3));
    const s = evaluationsStand(vorTagen(32), einheiten, anfaenger, jetzt);
    expect(s.ausloeser).toBe("wochen");
  });

  it("Anfänger-Regel bleibt fest, andere Stufen sind einstellbar", () => {
    const eigene = { anfaenger: { wochen: 9, einheiten: 99 }, fortgeschritten: { wochen: 5, einheiten: 12 } };
    expect(regelFuer("anfaenger", eigene)).toEqual({ wochen: 4, einheiten: 10 });
    expect(regelFuer("fortgeschritten", eigene)).toEqual({ wochen: 5, einheiten: 12 });
    expect(regelFuer("sehr_erfahren", eigene)).toEqual({ wochen: 8, einheiten: 20 });
  });
});
