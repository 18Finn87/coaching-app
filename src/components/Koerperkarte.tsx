"use client";

import { LINIEN, SILHOUETTE_HALB, STELLEN, type Ansicht, type Form } from "@/lib/koerper";

const SPIEGEL = "matrix(-1 0 0 1 200 0)";

function Umriss({ ansicht }: { ansicht: Ansicht }) {
  // Silhouette als Hintergrund (nicht anklickbar)
  return (
    <g pointerEvents="none">
      <g fill="currentColor" opacity={0.1}>
        <path d={SILHOUETTE_HALB} />
        <path d={SILHOUETTE_HALB} transform={SPIEGEL} />
      </g>
      <path d={LINIEN[ansicht]} fill="none" stroke="currentColor" strokeOpacity={0.22} strokeWidth={0.8} strokeLinecap="round" />
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
    fillOpacity: an ? 0.85 : 0.16,
    strokeOpacity: an ? 1 : 0.4,
    strokeWidth: an ? 1.5 : 0.8,
    strokeLinejoin: "round" as const,
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
    <path d={form.d} transform={form.gespiegelt ? SPIEGEL : undefined} {...gemeinsam}>
      <title>{text}</title>
    </path>
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
        <Umriss ansicht={ansicht} />
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
