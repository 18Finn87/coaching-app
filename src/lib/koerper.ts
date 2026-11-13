/**
 * Körperstellen für das Männchen (vorne/hinten, links/rechts).
 * „links/rechts“ ist immer aus Sicht der Person: In der Ansicht von vorne liegt
 * ihre rechte Seite links im Bild, in der Ansicht von hinten rechts.
 * Koordinaten in einem 200 × 420 großen Bild je Ansicht.
 */

export type Ansicht = "vorne" | "hinten";
export type Form =
  | { art: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { art: "rechteck"; x: number; y: number; b: number; h: number };

export type Stelle = { id: string; text: string; ansicht: Ansicht; form: Form };

const e = (cx: number, cy: number, rx: number, ry = rx): Form => ({ art: "ellipse", cx, cy, rx, ry });
const r = (x: number, y: number, b: number, h: number): Form => ({ art: "rechteck", x, y, b, h });
/** Spiegeln an der Mitte (x = 100) */
const spiegel = (f: Form): Form =>
  f.art === "ellipse" ? { ...f, cx: 200 - f.cx } : { ...f, x: 200 - f.x - f.b };

/** Paar: Form für die Seite, die in der Ansicht links im Bild liegt */
function paar(id: string, text: string, ansicht: Ansicht, linksImBild: Form): Stelle[] {
  // vorne: links im Bild = rechte Körperseite; hinten: links im Bild = linke Körperseite
  const rechtsForm = ansicht === "vorne" ? linksImBild : spiegel(linksImBild);
  const linksForm = ansicht === "vorne" ? spiegel(linksImBild) : linksImBild;
  return [
    { id: `${id}_links`, text: `${text} links`, ansicht, form: linksForm },
    { id: `${id}_rechts`, text: `${text} rechts`, ansicht, form: rechtsForm },
  ];
}

export const STELLEN: Stelle[] = [
  // vorne
  { id: "kopf", text: "Kopf", ansicht: "vorne", form: e(100, 34, 21, 26) },
  ...paar("schulter", "Schulter", "vorne", e(64, 86, 14, 12)),
  { id: "brust", text: "Brust", ansicht: "vorne", form: r(76, 78, 48, 44) },
  { id: "bauch", text: "Bauch", ansicht: "vorne", form: r(78, 124, 44, 50) },
  ...paar("oberarm", "Oberarm", "vorne", r(46, 100, 17, 46)),
  ...paar("ellbogen", "Ellbogen", "vorne", e(53, 154, 9)),
  ...paar("unterarm", "Unterarm", "vorne", r(40, 164, 17, 42)),
  ...paar("hand", "Hand / Handgelenk", "vorne", e(46, 218, 10, 13)),
  ...paar("huefte", "Hüfte", "vorne", e(80, 186, 13, 9)),
  ...paar("leiste", "Leiste", "vorne", e(92, 202, 8, 6)),
  ...paar("oberschenkel_vorne", "Oberschenkel vorne", "vorne", r(72, 210, 25, 70)),
  ...paar("knie", "Knie", "vorne", e(85, 292, 12, 11)),
  ...paar("schienbein", "Schienbein", "vorne", r(76, 305, 19, 66)),
  ...paar("sprunggelenk", "Sprunggelenk", "vorne", e(85, 381, 9, 6)),
  ...paar("fuss", "Fuß", "vorne", e(82, 399, 13, 8)),
  // hinten
  { id: "nacken", text: "Nacken", ansicht: "hinten", form: r(88, 60, 24, 16) },
  ...paar("schulter", "Schulter", "hinten", e(64, 86, 14, 12)),
  { id: "oberer_ruecken", text: "Oberer Rücken", ansicht: "hinten", form: r(76, 78, 48, 50) },
  { id: "unterer_ruecken", text: "Unterer Rücken", ansicht: "hinten", form: r(78, 130, 44, 42) },
  ...paar("gesaess", "Gesäß", "hinten", e(83, 194, 17, 15)),
  ...paar("oberschenkel_hinten", "Oberschenkel hinten", "hinten", r(72, 212, 25, 72)),
  ...paar("wade", "Wade", "hinten", r(75, 300, 20, 70)),
  ...paar("achillessehne", "Achillessehne / Ferse", "hinten", e(85, 383, 7, 9)),
];

/** Jede Stelle einmal (Schultern gibt es in beiden Ansichten) */
export const STELLE_TEXT: Record<string, string> = Object.fromEntries(
  [...STELLEN.map((s) => [s.id, s.text] as const), ["sonstiges", "Sonstiges"] as const],
);

/** Grobe Zuordnung zur alten Einteilung (für ältere Auswertungen und den Check-in) */
export function altRegion(stellen: string[]): string {
  const s = stellen.find((x) => x !== "sonstiges") ?? "";
  const basis = s.replace(/_(links|rechts)$/, "");
  const map: Record<string, string> = {
    nacken: "nacken",
    kopf: "nacken",
    schulter: "schulter",
    oberarm: "schulter",
    ellbogen: "ellbogen",
    unterarm: "hand",
    hand: "hand",
    oberer_ruecken: "oberer_ruecken",
    brust: "oberer_ruecken",
    unterer_ruecken: "unterer_ruecken",
    bauch: "unterer_ruecken",
    huefte: "huefte",
    leiste: "huefte",
    gesaess: "huefte",
    oberschenkel_vorne: "knie",
    oberschenkel_hinten: "knie",
    knie: "knie",
    schienbein: "sprunggelenk",
    wade: "sprunggelenk",
    sprunggelenk: "sprunggelenk",
    achillessehne: "sprunggelenk",
    fuss: "fuss",
  };
  return map[basis] ?? "sonstiges";
}

/** Stellen als lesbarer Text, z. B. „Knie links, Wade links“ */
export function stellenText(stellen: string[]): string {
  return stellen.map((s) => STELLE_TEXT[s] ?? s).join(", ");
}
