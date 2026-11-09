// Service Worker der Coaching App
// Speichert nur die App-Dateien (Seiten, Skripte, Schriften) auf dem Handy,
// damit sich die App auch ohne Internet öffnen lässt.
// Daten (Supabase) werden hier NICHT gespeichert – das macht die App selbst.

const CACHE = "coaching-app-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (ereignis) => {
  ereignis.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (ereignis) => {
  const anfrage = ereignis.request;
  if (anfrage.method !== "GET") return;
  const url = new URL(anfrage.url);
  if (url.origin !== self.location.origin) return; // Supabase & Co. nie anfassen

  // Seiten: erst Netz (immer aktuell), ohne Netz die gespeicherte Fassung
  if (anfrage.mode === "navigate") {
    ereignis.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const antwort = await fetch(anfrage);
          if (antwort.ok) cache.put(url.pathname, antwort.clone());
          return antwort;
        } catch {
          return (
            (await cache.match(url.pathname)) ??
            (await cache.match(self.registration.scope)) ??
            new Response("Offline – bitte später erneut versuchen.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Unveränderliche Programmteile (_next/static): erst Speicher, dann Netz
  if (url.pathname.includes("/_next/static/")) {
    ereignis.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const gespeichert = await cache.match(anfrage);
        if (gespeichert) return gespeichert;
        const antwort = await fetch(anfrage);
        if (antwort.ok) cache.put(anfrage, antwort.clone());
        return antwort;
      })(),
    );
    return;
  }

  // Alles andere (z. B. Seitendaten für die Navigation): Netz, ohne Netz Speicher
  ereignis.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const antwort = await fetch(anfrage);
        if (antwort.ok) cache.put(anfrage, antwort.clone());
        return antwort;
      } catch {
        const gespeichert = await cache.match(anfrage, { ignoreSearch: true });
        if (gespeichert) return gespeichert;
        throw new Error("offline");
      }
    })(),
  );
});
