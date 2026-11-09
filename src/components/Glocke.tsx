"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ungeleseneZaehlen } from "@/lib/coaching";

/** Glocke oben rechts mit Zahl der ungelesenen Hinweise. */
export function Glocke() {
  const pfad = usePathname();
  const [anzahl, setAnzahl] = useState(0);

  useEffect(() => {
    let aktiv = true;
    const holen = () =>
      ungeleseneZaehlen()
        .then((n) => aktiv && setAnzahl(n))
        .catch(() => {});
    holen();
    const t = window.setInterval(holen, 60_000);
    return () => {
      aktiv = false;
      window.clearInterval(t);
    };
  }, [pfad]);

  const text = anzahl > 0 ? `Hinweise, ${anzahl} ungelesen` : "Hinweise";
  return (
    <Link
      href="/hinweise/"
      aria-label={text}
      title={text}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full text-leise hover:text-foreground"
    >
      <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a2 2 0 003.4 0" />
      </svg>
      {anzahl > 0 && (
        <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-5 text-white">
          {anzahl > 9 ? "9+" : anzahl}
        </span>
      )}
    </Link>
  );
}
