"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Rolle } from "@/lib/konto";

type Eintrag = { href: string; text: string; symbol: React.ReactNode };

// Einfache Strich-Symbole (24×24), passen sich der Textfarbe an
const s = (d: string) => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const symbole = {
  haus: s("M3 11l9-7 9 7M5 10v10h14V10"),
  personen: s("M16 20v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 20v-1a4 4 0 00-3-3.9M16 4.1a3.5 3.5 0 010 6.8"),
  hantel: s("M6 7v10M3 9.5v5M18 7v10M21 9.5v5M6 12h12"),
  plan: s("M8 4h8M6 6h12v14H6zM9 11h6M9 15h4"),
  verlauf: s("M4 19h16M7 16V9M12 16V5M17 16v-4"),
  haken: s("M4 6h16v14H4zM8 13l3 3 5-6"),
  person: s("M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a6 6 0 016-6h4a6 6 0 016 6v1"),
};

const menue: Record<Rolle, Eintrag[]> = {
  coach: [
    { href: "/", text: "Übersicht", symbol: symbole.haus },
    { href: "/athleten/", text: "Athleten", symbol: symbole.personen },
    { href: "/uebungen/", text: "Übungen", symbol: symbole.hantel },
    { href: "/plaene/", text: "Pläne", symbol: symbole.plan },
    { href: "/profil/", text: "Profil", symbol: symbole.person },
  ],
  athlet: [
    { href: "/", text: "Heute", symbol: symbole.haus },
    { href: "/verlauf/", text: "Verlauf", symbol: symbole.verlauf },
    { href: "/checkin/", text: "Check-in", symbol: symbole.haken },
    { href: "/profil/", text: "Profil", symbol: symbole.person },
  ],
};

/** Menüleiste am unteren Rand – gut mit dem Daumen erreichbar. */
export function Navigation({ rolle }: { rolle: Rolle }) {
  const pfad = usePathname();
  const aktiv = (href: string) =>
    href === "/" ? pfad === "/" : pfad === href || pfad === href.replace(/\/$/, "");

  return (
    <nav
      aria-label="Hauptmenü"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-rand bg-flaeche pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {menue[rolle].map((e) => (
          <li key={e.href} className="flex-1">
            <Link
              href={e.href}
              aria-current={aktiv(e.href) ? "page" : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                aktiv(e.href) ? "text-akzent" : "text-leise"
              }`}
            >
              {e.symbol}
              {e.text}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
