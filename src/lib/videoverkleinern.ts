/**
 * Video auf dem Handy verkleinern, bevor es hochgeladen wird.
 * Das Video wird einmal abgespielt, in kleinerer Auflösung (max. 720 px) neu
 * aufgenommen und ohne Ton gespeichert. Dauert so lange wie das Video selbst.
 * Klappt das im Browser nicht, wird das Original genommen (wenn es klein genug ist).
 */

export const MAX_SEK = 30;
export const MAX_BYTES = 50 * 1024 * 1024;
export const MAX_KANTE = 720;

export type VideoMime = "video/mp4" | "video/webm" | "video/quicktime";

const gerade = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Zielgröße: längste Kante höchstens max, Seitenverhältnis bleibt */
export function zielGroesse(breite: number, hoehe: number, max = MAX_KANTE): { breite: number; hoehe: number } {
  const lang = Math.max(breite, hoehe);
  const f = lang > max ? max / lang : 1;
  return { breite: gerade(breite * f), hoehe: gerade(hoehe * f) };
}

/** Beste Aufnahmeart, die der Browser kann (MP4 bevorzugt, sonst WebM) */
export function aufnahmeformat(kann: (typ: string) => boolean): { typ: string; mime: VideoMime } | null {
  const liste: [string, VideoMime][] = [
    ["video/mp4;codecs=avc1.42E01E", "video/mp4"],
    ["video/mp4;codecs=avc1", "video/mp4"],
    ["video/mp4", "video/mp4"],
    ["video/webm;codecs=vp9", "video/webm"],
    ["video/webm;codecs=vp8", "video/webm"],
    ["video/webm", "video/webm"],
  ];
  for (const [typ, mime] of liste) if (kann(typ)) return { typ, mime };
  return null;
}

export const endung = (mime: VideoMime) => (mime === "video/webm" ? "webm" : mime === "video/quicktime" ? "mov" : "mp4");

/** Erlaubter Dateityp des Originals */
export function originalMime(typ: string): VideoMime | null {
  if (typ === "video/mp4" || typ === "video/webm" || typ === "video/quicktime") return typ;
  return null;
}

export type Verkleinert = { blob: Blob; mime: VideoMime; dauer: number; breite: number; hoehe: number; verkleinert: boolean };

export class VideoFehler extends Error {
  constructor(public grund: "zu_lang" | "zu_gross" | "unlesbar" | "nicht_moeglich") {
    super(grund);
  }
}

function warte(video: HTMLVideoElement, ereignis: string, ms: number): Promise<void> {
  return new Promise((ok, nein) => {
    const t = setTimeout(() => nein(new VideoFehler("unlesbar")), ms);
    video.addEventListener(
      ereignis,
      () => {
        clearTimeout(t);
        ok();
      },
      { once: true },
    );
    video.addEventListener("error", () => {
      clearTimeout(t);
      nein(new VideoFehler("unlesbar"));
    }, { once: true });
  });
}

export async function verkleinern(datei: File, fortschritt: (anteil: number) => void): Promise<Verkleinert> {
  const url = URL.createObjectURL(datei);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await warte(video, "loadedmetadata", 15000);
    const dauer = video.duration;
    if (!Number.isFinite(dauer) || dauer <= 0) throw new VideoFehler("unlesbar");
    if (dauer > MAX_SEK + 0.5) throw new VideoFehler("zu_lang");
    const ziel = zielGroesse(video.videoWidth || 720, video.videoHeight || 1280);

    const format =
      typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function"
        ? aufnahmeformat((t) => MediaRecorder.isTypeSupported(t))
        : null;

    if (!format) {
      // Ohne Verkleinern: Original, wenn erlaubt und klein genug
      const mime = originalMime(datei.type);
      if (!mime) throw new VideoFehler("nicht_moeglich");
      if (datei.size > MAX_BYTES) throw new VideoFehler("zu_gross");
      fortschritt(1);
      return { blob: datei, mime, dauer, breite: video.videoWidth, hoehe: video.videoHeight, verkleinert: false };
    }

    const leinwand = document.createElement("canvas");
    leinwand.width = ziel.breite;
    leinwand.height = ziel.hoehe;
    const ctx = leinwand.getContext("2d");
    if (!ctx) throw new VideoFehler("nicht_moeglich");
    const strom = leinwand.captureStream(30);
    const rec = new MediaRecorder(strom, { mimeType: format.typ, videoBitsPerSecond: 2_500_000 });
    const teile: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) teile.push(e.data);
    };
    const gestoppt = new Promise<void>((ok) => (rec.onstop = () => ok()));

    let laeuft = true;
    const zeichnen = () => {
      if (!laeuft) return;
      ctx.drawImage(video, 0, 0, ziel.breite, ziel.hoehe);
      fortschritt(Math.min(0.99, video.currentTime / dauer));
      if ("requestVideoFrameCallback" in video) video.requestVideoFrameCallback(zeichnen);
      else requestAnimationFrame(zeichnen);
    };

    rec.start(500);
    const ende = warte(video, "ended", (dauer + 20) * 1000);
    await video.play();
    zeichnen();
    await ende;
    laeuft = false;
    ctx.drawImage(video, 0, 0, ziel.breite, ziel.hoehe);
    rec.stop();
    await gestoppt;
    strom.getTracks().forEach((t) => t.stop());

    const blob = new Blob(teile, { type: format.mime });
    if (blob.size === 0) throw new VideoFehler("nicht_moeglich");
    if (blob.size > MAX_BYTES) throw new VideoFehler("zu_gross");
    fortschritt(1);
    return { blob, mime: format.mime, dauer, breite: ziel.breite, hoehe: ziel.hoehe, verkleinert: true };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export const fehlerText: Record<VideoFehler["grund"], string> = {
  zu_lang: `Das Video ist länger als ${MAX_SEK} Sekunden. Bitte kürze es in der Galerie und versuche es erneut.`,
  zu_gross: "Das Video ist zu groß (über 50 MB). Bitte kürze es oder nimm es in niedrigerer Auflösung auf.",
  unlesbar: "Das Video lässt sich nicht öffnen. Bitte versuche ein anderes.",
  nicht_moeglich: "Dieser Browser kann das Video nicht verkleinern. Bitte versuche es mit Chrome oder Safari.",
};
