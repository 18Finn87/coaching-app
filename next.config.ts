import type { NextConfig } from "next";

// Die App wird als statische Webseite gebaut (Ordner "out") und über GitHub Pages ausgeliefert.
// Auf GitHub Pages liegt sie unter https://<name>.github.io/coaching-app/ –
// deshalb setzt der Veröffentlichungs-Ablauf NEXT_PUBLIC_BASE_PATH=/coaching-app.
// Lokal bleibt der Pfad leer.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
