import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CheckinVerlauf } from "./CheckinVerlauf";
import { gruendeText, type Checkin } from "@/lib/coaching";

const c: Checkin = {
  id: "c1",
  athlet_id: "a",
  woche: "2026-11-09",
  schlaf: 4,
  stress: 3,
  energie: 3,
  muskelkater: 2,
  motivation: 4,
  notiz: "",
  coach_antwort: "",
  coach_antwort_am: null,
  erstellt_am: "2026-11-12T10:00:00Z",
  woche_bewertung: 4,
  gut: "Alle Einheiten geschafft",
  schwer: "Wenig Schlaf",
  ausblick_schwierig: true,
  ausblick_gruende: ["pruefungen", "reise"],
  ausblick_text: "Klausuren Mo–Mi",
};

describe("Wochen-Rück- und Ausblick", () => {
  it("nennt Gründe, Krankheit nur wenn bekannt", () => {
    expect(gruendeText(c)).toBe("Prüfungen, Reise");
    expect(gruendeText(c, true)).toBe("Prüfungen, Krankheit, Reise");
  });

  it("zeigt Rückblick und Ausblick im Verlauf", () => {
    const html = renderToStaticMarkup(<CheckinVerlauf checkins={[c]} gesundheit={{}} krank={new Set(["c1"])} />);
    expect(html).toContain("Woche 4/5");
    expect(html).toContain("Gut: „Alle Einheiten geschafft“");
    expect(html).toContain("nächste Woche schwierig");
    expect(html).toContain("Prüfungen, Krankheit, Reise");
    expect(html).toContain("Klausuren Mo–Mi");
  });

  it("zeigt alte Check-ins ohne Rück- und Ausblick wie bisher", () => {
    const alt = { ...c, woche_bewertung: null, gut: "", schwer: "", ausblick_schwierig: null, ausblick_gruende: [], ausblick_text: "" };
    const html = renderToStaticMarkup(<CheckinVerlauf checkins={[alt]} gesundheit={{}} />);
    expect(html).not.toContain("Rückblick");
    expect(html).not.toContain("Ausblick");
  });
});
