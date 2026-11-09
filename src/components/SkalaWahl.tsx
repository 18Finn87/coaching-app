"use client";

/** Auswahl 1–5 mit Beschriftung der Enden. Große Knöpfe für den Daumen. */
export function SkalaWahl({
  name,
  frage,
  links,
  rechts,
  wert,
  beiWahl,
}: {
  name: string;
  frage: string;
  links: string;
  rechts: string;
  wert: number | null;
  beiWahl: (w: number) => void;
}) {
  const titelId = `skala-${name}`;
  return (
    <div className="flex flex-col gap-1.5">
      <p id={titelId} className="text-sm font-medium">
        {frage}
      </p>
      <div role="radiogroup" aria-labelledby={titelId} className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={wert === n}
            aria-label={`${n}${n === 1 ? ` (${links})` : n === 5 ? ` (${rechts})` : ""}`}
            onClick={() => beiWahl(n)}
            className={`h-12 rounded-xl border text-base font-semibold ${
              wert === n ? "border-akzent bg-akzent text-akzent-text" : "border-rand"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-leise">
        <span>{links}</span>
        <span>{rechts}</span>
      </div>
    </div>
  );
}
