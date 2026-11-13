/**
 * Körperstellen für das Männchen (vorne/hinten, links/rechts).
 * „links/rechts“ ist immer aus Sicht der Person: In der Ansicht von vorne liegt
 * ihre rechte Seite links im Bild, in der Ansicht von hinten rechts.
 * Koordinaten in einem 200 × 420 großen Bild je Ansicht; Flächen folgen grob
 * den Muskelgruppen (Schulter, Brust, Bauch, Oberschenkel …).
 */

export type Ansicht = "vorne" | "hinten";
export type Form =
  | { art: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { art: "pfad"; d: string; gespiegelt?: boolean };

export type Stelle = { id: string; text: string; ansicht: Ansicht; form: Form };

const e = (cx: number, cy: number, rx: number, ry = rx): Form => ({ art: "ellipse", cx, cy, rx, ry });
const p = (d: string): Form => ({ art: "pfad", d });
/** Spiegeln an der Mitte (x = 100) */
const spiegel = (f: Form): Form => (f.art === "ellipse" ? { ...f, cx: 200 - f.cx } : { ...f, gespiegelt: !f.gespiegelt });

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

/** Halbe Körper-Silhouette (linke Bildhälfte); die rechte entsteht durch Spiegeln */
export const SILHOUETTE_HALB =
  "M100 8 C88 8 81 17 81 32 C81 44 85 53 91 58 L91 68 C84 73 70 76 58 79 C49 82 45 90 44 100 " +
  "C42 115 42 135 41 150 C38 170 36 190 35 205 C33 215 32 228 34 238 C36 244 42 244 44 238 " +
  "C45 228 47 215 49 205 C53 188 57 170 59 152 C61 138 63 125 64 118 C65 140 68 160 70 178 " +
  "C67 192 65 205 66 220 C66 250 70 275 74 292 C71 310 71 330 75 350 C78 365 80 378 80 386 " +
  "C78 395 73 402 77 406 L95 406 C97 398 94 390 92 384 C94 365 96 335 95 312 C95 300 96 295 96 288 " +
  "C98 270 100 250 100 228 Z";

/** Feine, nicht anklickbare Linien für die Muskelzeichnung */
export const LINIEN: Record<Ansicht, string> = {
  vorne: "M100 90 L100 196 M78 149 Q100 152 122 149 M80 167 Q100 170 120 167 M88 70 Q78 76 66 80 M112 70 Q122 76 134 80",
  hinten: "M100 74 L100 200 M100 166 L100 166 M80 112 Q90 126 100 130 Q110 126 120 112",
};

export const STELLEN: Stelle[] = [
  // vorne
  { id: "kopf", text: "Kopf", ansicht: "vorne", form: p("M100 10 C89 10 83 18 83 32 C83 44 88 52 100 56 C112 52 117 44 117 32 C117 18 111 10 100 10 Z") },
  ...paar("schulter", "Schulter", "vorne", p("M58 81 C50 84 46 91 45 101 C45 108 47 114 50 118 C53 110 58 104 64 100 C66 94 66 86 64 82 Z")),
  {
    id: "brust",
    text: "Brust",
    ansicht: "vorne",
    form: p("M67 85 C79 82 90 85 100 89 C110 85 121 82 133 85 C137 97 137 110 133 122 C123 128 110 128 100 124 C90 128 77 128 67 122 C63 110 63 97 67 85 Z"),
  },
  {
    id: "bauch",
    text: "Bauch",
    ansicht: "vorne",
    form: p("M71 131 C81 133 91 131 100 131 C109 131 119 133 129 131 C129 150 127 168 125 180 C117 191 108 197 100 197 C92 197 83 191 75 180 C73 168 71 150 71 131 Z"),
  },
  ...paar("oberarm", "Oberarm", "vorne", p("M49 119 C46 127 44 138 44 147 C48 149 54 149 58 147 C60 137 62 126 62 113 C58 113 52 115 49 119 Z")),
  ...paar("ellbogen", "Ellbogen", "vorne", e(50.5, 156, 7, 6)),
  ...paar("unterarm", "Unterarm", "vorne", p("M43 164 C41 178 39 192 38 202 C42 204 46 204 49 202 C52 190 55 176 57 164 C52 166 47 166 43 164 Z")),
  ...paar("hand", "Hand / Handgelenk", "vorne", p("M37 208 C35 218 34 228 36 236 C39 240 42 240 44 236 C46 226 47 216 49 208 C45 210 41 210 37 208 Z")),
  ...paar("huefte", "Hüfte", "vorne", p("M70 186 C67 195 66 204 67 213 C71 213 75 209 77 203 C76 197 74 191 70 186 Z")),
  ...paar("leiste", "Leiste", "vorne", p("M80 203 C86 209 92 215 98 221 C95 224 91 224 87 222 C83 216 80 210 78 205 Z")),
  ...paar("oberschenkel_vorne", "Oberschenkel vorne", "vorne", p("M68 220 C68 245 71 268 76 283 C82 285 89 285 94 283 C96 264 98 244 98 229 C92 223 84 215 78 210 C74 214 70 216 68 220 Z")),
  ...paar("knie", "Knie", "vorne", e(85, 293, 10, 8.5)),
  ...paar("schienbein", "Schienbein", "vorne", p("M76 306 C74 322 75 340 79 360 C80 368 81 374 82 378 C85 379 88 379 91 378 C92 360 94 335 94 312 C93 306 92 304 91 303 C86 305 81 305 76 306 Z")),
  ...paar("sprunggelenk", "Sprunggelenk", "vorne", e(86, 386, 6.5, 4.5)),
  ...paar("fuss", "Fuß", "vorne", p("M78 394 C75 400 76 405 80 406 L94 406 C96 402 95 396 92 393 C88 395 83 395 78 394 Z")),
  // hinten (Kopf, Arme und Kniekehle sind dieselben Stellen wie vorne)
  { id: "kopf", text: "Kopf", ansicht: "hinten", form: p("M100 10 C89 10 83 18 83 32 C83 44 88 52 100 55 C112 52 117 44 117 32 C117 18 111 10 100 10 Z") },
  ...paar("oberarm", "Oberarm", "hinten", p("M49 119 C46 127 44 138 44 147 C48 149 54 149 58 147 C60 137 62 126 62 113 C58 113 52 115 49 119 Z")),
  ...paar("ellbogen", "Ellbogen", "hinten", e(50.5, 156, 7, 6)),
  ...paar("unterarm", "Unterarm", "hinten", p("M43 164 C41 178 39 192 38 202 C42 204 46 204 49 202 C52 190 55 176 57 164 C52 166 47 166 43 164 Z")),
  ...paar("hand", "Hand / Handgelenk", "hinten", p("M37 208 C35 218 34 228 36 236 C39 240 42 240 44 236 C46 226 47 216 49 208 C45 210 41 210 37 208 Z")),
  ...paar("knie", "Knie / Kniekehle", "hinten", e(85, 294, 9, 4)),
  { id: "nacken", text: "Nacken", ansicht: "hinten", form: p("M91 56 C94 60 106 60 109 56 L110 71 C106 73 94 73 90 71 Z") },
  ...paar("schulter", "Schulter", "hinten", p("M58 81 C50 84 46 91 45 101 C45 108 47 114 50 118 C53 110 58 104 64 100 C66 94 66 86 64 82 Z")),
  {
    id: "oberer_ruecken",
    text: "Oberer Rücken",
    ansicht: "hinten",
    form: p("M90 74 C80 77 72 79 67 83 C68 97 68 111 71 130 C77 149 85 158 100 160 C115 158 123 149 129 130 C132 111 132 97 133 83 C128 79 120 77 110 74 C106 76 94 76 90 74 Z"),
  },
  {
    id: "unterer_ruecken",
    text: "Unterer Rücken",
    ansicht: "hinten",
    form: p("M74 166 C84 167 92 165 100 165 C108 165 116 167 126 166 C127 177 128 187 130 196 C120 200 110 202 100 202 C90 202 80 200 70 196 C72 187 73 177 74 166 Z"),
  },
  ...paar("gesaess", "Gesäß", "hinten", p("M70 205 C66 217 66 232 72 244 C80 250 91 250 98 244 C99 232 99 218 98 207 C89 209 79 209 70 205 Z")),
  ...paar("oberschenkel_hinten", "Oberschenkel hinten", "hinten", p("M69 251 C69 263 72 277 76 289 C82 291 89 291 95 289 C96 277 97 263 97 253 C89 257 78 257 69 251 Z")),
  ...paar("wade", "Wade", "hinten", p("M74 300 C70 312 70 328 74 342 C78 352 82 360 84 366 C87 366 90 366 92 364 C93 350 95 330 94 312 C93 304 92 300 90 298 C84 300 79 300 74 300 Z")),
  ...paar("achillessehne", "Achillessehne / Ferse", "hinten", p("M83 372 C83 380 82 388 80 397 C84 401 89 401 92 397 C91 388 90 380 90 372 C88 374 86 374 83 372 Z")),
];

/** Jede Stelle einmal (manche gibt es in beiden Ansichten; der Text von vorne gilt) */
export const STELLE_TEXT: Record<string, string> = Object.fromEntries(
  [...[...STELLEN].reverse().map((s) => [s.id, s.text] as const), ["sonstiges", "Sonstiges"] as const],
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
