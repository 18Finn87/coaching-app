import { describe, expect, it } from "vitest";
import { neigung, winkel, zeitpunktText } from "./videos";
import { aufnahmeformat, endung, originalMime, zielGroesse } from "./videoverkleinern";

describe("Video-Analyse", () => {
  it("zeigt Zeitpunkte als 0:03,4", () => {
    expect(zeitpunktText(3.4)).toBe("0:03,4");
    expect(zeitpunktText(0)).toBe("0:00,0");
    expect(zeitpunktText(29.99)).toBe("0:29,9");
    expect(zeitpunktText(61.25)).toBe("1:01,2");
  });

  it("misst Winkel am mittleren Punkt", () => {
    expect(winkel([0, 0], [0, 1], [1, 1])).toBe(90);
    expect(winkel([0, 0], [0, 1], [0, 2])).toBe(180);
    // Hochformat 9:16: gleiche relative Strecken sind unterschiedlich lang
    expect(winkel([0, 0], [0, 0.5], [0.5, 0.5], 9 / 16)).toBe(90);
  });

  it("misst Neigung zur Senkrechten", () => {
    expect(neigung([0.5, 0.2], [0.5, 0.8])).toBe(0);
    expect(neigung([0.2, 0.2], [0.8, 0.8])).toBe(45);
    expect(neigung([0.3, 0.5], [0.7, 0.5])).toBe(90);
  });
});

describe("Video verkleinern", () => {
  it("begrenzt die längste Kante auf 720 px und behält das Format", () => {
    expect(zielGroesse(1080, 1920)).toEqual({ breite: 406, hoehe: 720 });
    expect(zielGroesse(3840, 2160)).toEqual({ breite: 720, hoehe: 406 });
    expect(zielGroesse(640, 360)).toEqual({ breite: 640, hoehe: 360 });
  });

  it("bevorzugt MP4 und nimmt sonst WebM", () => {
    expect(aufnahmeformat((t) => t.startsWith("video/mp4"))?.mime).toBe("video/mp4");
    expect(aufnahmeformat((t) => t === "video/webm;codecs=vp8")).toEqual({ typ: "video/webm;codecs=vp8", mime: "video/webm" });
    expect(aufnahmeformat(() => false)).toBeNull();
  });

  it("kennt die erlaubten Dateitypen", () => {
    expect(endung("video/webm")).toBe("webm");
    expect(endung("video/quicktime")).toBe("mov");
    expect(originalMime("video/quicktime")).toBe("video/quicktime");
    expect(originalMime("image/png")).toBeNull();
  });
});
