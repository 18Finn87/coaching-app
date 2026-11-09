"use client";

import { useEffect } from "react";

const BASIS = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Meldet den Service Worker an (nur in der veröffentlichten App, nicht beim Entwickeln). */
export function OfflineVorbereitung() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(`${BASIS}/sw.js`, { scope: `${BASIS}/` }).then(
      () => {
        // Wichtige Seiten einmal vorladen, damit sie auch offline aufgehen
        for (const seite of ["/", "/training/", "/verlauf/", "/profil/"]) {
          fetch(`${BASIS}${seite}`, { credentials: "same-origin" }).catch(() => undefined);
        }
      },
      () => undefined,
    );
  }, []);
  return null;
}
