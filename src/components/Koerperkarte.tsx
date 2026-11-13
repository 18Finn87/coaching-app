"use client";

import { STELLEN, type Ansicht, type Form } from "@/lib/koerper";

function Umriss() {
  // Dezente Silhouette als Hintergrund (nicht anklickbar)
  return (
    <g fill="currentColor" opacity={0.08}>
      <ellipse cx={100} cy={34} rx={23} ry={28} />
      <rect x={90} y={58} width={20} height={20} rx={6} />
      <path d="M58 78 Q100 66 142 78 L150 100 L163 210 L150 226 L138 160 L130 180 L132 400 L104 410 L100 230 L96 410 L68 400 L70 180 L62 160 L50 226 L37 210 L50 100 Z" />
    </g>
  );
}

function Flaeche({
  form,
  an,
  aktiv,
  text,
  tippen,
}: {
  form: Form;
  an: boolean;
  aktiv: boolean;
  text: string;
  tippen?: () => void;
}) {
  const gemeinsam = {
    className: `${an ? "fill-amber-500 stroke-amber-700" : "fill-current stroke-current"} ${aktiv ? "cursor-pointer" : ""}`,
    fillOpacity: an ? 0.85 : 0.14,
    strokeOpacity: an ? 1 : 0.35,
    strokeWidth: an ? 2 : 1,
    role: aktiv ? "checkbox" : undefined,
    "aria-checked": aktiv ? an : undefined,
    "aria-label": text,
    tabIndex: aktiv ? 0 : undefined,
    onClick: tippen,
    onKeyDown: aktiv
      ? (ev: React.KeyboardEvent) => {
          if (ev.key === " " || ev.key === "Enter") {
            ev.preventDefault();
            tippen?.();
          }
        }
      : undefined,
  };
  return form.art === "ellipse" ? (
    <ellipse cx={form.cx} cy={form.cy} rx={form.rx} ry={form.ry} {...gemeinsam}>
      <title>{text}</title>
    </ellipse>
  ) : (
    <rect x={form.x} y={form.y} width={form.b} height={form.h} rx={6} {...gemeinsam}>
      <title>{text}</title>
    </rect>
  );
}

function Figur({
  ansicht,
  gewaehlt,
  umschalten,
}: {
  ansicht: Ansicht;
  gewaehlt: Set<string>;
  umschalten?: (id: string) => void;
}) {
  const aktiv = !!umschalten;
  return (
    <figure className="flex min-w-0 flex-1 flex-col items-center">
      <svg viewBox="0 0 200 420" className="h-auto w-full max-w-[13rem] text-foreground" role="group" aria-label={`Körper von ${ansicht}`}>
        <Umriss />
        {STELLEN.filter((s) => s.ansicht === ansicht).map((s) => (
          <Flaeche
            key={`${ansicht}-${s.id}`}
            form={s.form}
            an={gewaehlt.has(s.id)}
            aktiv={aktiv}
            text={s.text}
            tippen={aktiv ? () => umschalten!(s.id) : undefined}
          />
        ))}
        {/* Seitenangabe aus Sicht der Person */}
        <text x={14} y={412} fontSize={14} className="fill-current" opacity={0.6}>
          {ansicht === "vorne" ? "R" : "L"}
        </text>
        <text x={178} y={412} fontSize={14} className="fill-current" opacity={0.6}>
          {ansicht === "vorne" ? "L" : "R"}
        </text>
      </svg>
      <figcaption className="text-xs text-leise">{ansicht === "vorne" ? "von vorne" : "von hinten"}</figcaption>
    </figure>
  );
}

/**
 * Männchen von vorne und hinten. Mit `umschalten` lassen sich Stellen antippen,
 * ohne nur zur Anzeige (z. B. alle aktuellen Beschwerden).
 */
export function Koerperkarte({ gewaehlt, umschalten }: { gewaehlt: string[]; umschalten?: (id: string) => void }) {
  const set = new Set(gewaehlt);
  return (
    <div className="flex gap-2">
      <Figur ansicht="vorne" gewaehlt={set} umschalten={umschalten} />
      <Figur ansicht="hinten" gewaehlt={set} umschalten={umschalten} />
    </div>
  );
}
