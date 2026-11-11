"use client";

import { neigung, winkel, type Punkt, type Zeichnung } from "@/lib/videos";

/** Messwert einer Zeichnung als Text: Winkel am mittleren Punkt bzw. Neigung zur Senkrechten */
export function zeichnungText(z: Zeichnung, seitenverhaeltnis: number): string {
  if (z.art === "winkel" && z.punkte.length === 3) {
    return `Winkel ${z.grad ?? winkel(z.punkte[0], z.punkte[1], z.punkte[2], seitenverhaeltnis)}°`;
  }
  if (z.art === "linie" && z.punkte.length === 2) {
    return `Neigung ${z.grad ?? neigung(z.punkte[0], z.punkte[1], seitenverhaeltnis)}° zur Senkrechten`;
  }
  return "";
}

/**
 * Durchsichtige Fläche über dem Video. Im Zeichenmodus setzt ein Antippen einen Punkt.
 * Punkte sind relativ (0–1), damit sie bei jeder Bildschirmgröße passen.
 */
export function ZeichenFlaeche({
  seitenverhaeltnis,
  zeichnungen,
  entwurf,
  aktiv,
  tippen,
}: {
  seitenverhaeltnis: number;
  zeichnungen: Zeichnung[];
  entwurf: Punkt[];
  aktiv: boolean;
  tippen: (p: Punkt) => void;
}) {
  const B = 1000;
  const H = Math.round(B / seitenverhaeltnis);
  const xy = (p: Punkt) => [p[0] * B, p[1] * H] as const;

  function form(punkte: Punkt[], key: string, farbe: string, text?: string) {
    const pkt = punkte.map(xy);
    return (
      <g key={key}>
        {pkt.length >= 2 && (
          <polyline
            points={pkt.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="white"
            strokeWidth={10}
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity={0.8}
          />
        )}
        {pkt.length >= 2 && (
          <polyline
            points={pkt.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke={farbe}
            strokeWidth={5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {pkt.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={14} fill={farbe} stroke="white" strokeWidth={4} />
        ))}
        {text && pkt.length > 0 && (
          <text
            x={Math.min(B - 10, pkt[Math.min(1, pkt.length - 1)][0] + 24)}
            y={Math.max(40, pkt[Math.min(1, pkt.length - 1)][1] - 20)}
            fontSize={44}
            fontWeight={700}
            fill="white"
            stroke="black"
            strokeWidth={8}
            paintOrder="stroke"
            textAnchor={pkt[Math.min(1, pkt.length - 1)][0] > B * 0.7 ? "end" : "start"}
          >
            {text}
          </text>
        )}
      </g>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${B} ${H}`}
      className={`absolute inset-0 h-full w-full ${aktiv ? "cursor-crosshair touch-none" : "pointer-events-none"}`}
      role={aktiv ? "application" : "img"}
      aria-label={aktiv ? "Zeichenfläche: Punkte auf das Standbild tippen" : "Zeichnungen auf dem Video"}
      onPointerDown={(e) => {
        if (!aktiv) return;
        const r = e.currentTarget.getBoundingClientRect();
        if (!(r.width > 0 && r.height > 0)) return;
        const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        tippen([Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
      }}
    >
      {zeichnungen.map((z, i) => form(z.punkte, `z${i}`, "#f59e0b", zeichnungText(z, seitenverhaeltnis)))}
      {entwurf.length > 0 && form(entwurf, "entwurf", "#2563eb")}
    </svg>
  );
}
