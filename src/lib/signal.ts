"use client";

/** Kurzer Ton und Vibration (für Timer). Klappt nicht überall – dann still. */
export function signal(art: "kurz" | "lang" | "ende" = "kurz") {
  const muster = art === "kurz" ? [120] : art === "lang" ? [400] : [300, 120, 300, 120, 300];
  try {
    navigator.vibrate?.(muster);
  } catch {
    // keine Vibration
  }
  try {
    const Kontext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Kontext();
    const laut = ctx.createGain();
    laut.gain.value = 0.18;
    laut.connect(ctx.destination);
    let zeit = ctx.currentTime;
    for (const ms of muster.filter((_, i) => i % 2 === 0)) {
      const ton = ctx.createOscillator();
      ton.frequency.value = art === "kurz" ? 660 : 880;
      ton.connect(laut);
      ton.start(zeit);
      ton.stop(zeit + ms / 1000);
      zeit += ms / 1000 + 0.12;
    }
    setTimeout(() => ctx.close(), (zeit - ctx.currentTime) * 1000 + 200);
  } catch {
    // kein Ton möglich
  }
}

/** Bildschirm während des Timers anlassen (wenn das Gerät es erlaubt). */
export async function wachHalten(): Promise<() => void> {
  try {
    const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const sperre = await nav.wakeLock?.request("screen");
    return () => {
      sperre?.release().catch(() => {});
    };
  } catch {
    return () => {};
  }
}
