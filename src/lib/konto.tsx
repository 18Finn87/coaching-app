"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { istEingerichtet, supabase } from "./supabase";

export type Rolle = "coach" | "athlet";

export type Profil = {
  id: string;
  rolle: Rolle;
  anzeigename: string;
};

export type KontoZustand =
  | { art: "nicht_eingerichtet" }
  | { art: "laedt" }
  | { art: "abgemeldet" }
  | { art: "ohne_profil"; sitzung: Session }
  | { art: "fehler"; sitzung: Session }
  | { art: "angemeldet"; sitzung: Session; profil: Profil };

type KontoKontext = {
  zustand: KontoZustand;
  /** Profil neu laden, z. B. nach einer Namensänderung. */
  neuLaden: () => Promise<void>;
};

const Kontext = createContext<KontoKontext | null>(null);

async function profilLaden(sitzung: Session): Promise<KontoZustand> {
  const { data, error } = await supabase()
    .from("profile")
    .select("id, rolle, anzeigename")
    .eq("id", sitzung.user.id)
    .maybeSingle();
  if (error) return { art: "fehler", sitzung };
  if (!data) return { art: "ohne_profil", sitzung };
  const profil = data as Profil;
  if (profil.rolle === "athlet") {
    // Erste Anmeldung nach einer Einladung: Betreuung aktivieren.
    // Bei späteren Anmeldungen passiert dabei nichts.
    await supabase().rpc("einladung_annehmen");
  }
  return { art: "angemeldet", sitzung, profil };
}

export function KontoAnbieter({ children }: { children: React.ReactNode }) {
  const [zustand, setZustand] = useState<KontoZustand>(
    istEingerichtet ? { art: "laedt" } : { art: "nicht_eingerichtet" },
  );
  const sitzungRef = useRef<Session | null>(null);

  useEffect(() => {
    if (!istEingerichtet) return;
    // Supabase meldet beim Start den aktuellen Stand und danach jede Änderung.
    let letzteNutzerId: string | null | undefined = undefined;
    const { data } = supabase().auth.onAuthStateChange((_ereignis, sitzung) => {
      sitzungRef.current = sitzung;
      const nutzerId = sitzung?.user.id ?? null;
      // Reines Auffrischen der Anmeldung: nichts neu laden
      if (nutzerId === letzteNutzerId) return;
      letzteNutzerId = nutzerId;

      if (!sitzung) {
        setZustand({ art: "abgemeldet" });
        return;
      }
      setZustand({ art: "laedt" });
      // Supabase empfiehlt, im Melde-Callback nicht direkt weitere Anfragen abzuwarten
      setTimeout(() => {
        profilLaden(sitzung).then((z) => {
          if (letzteNutzerId === nutzerId) setZustand(z);
        });
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const neuLaden = useCallback(async () => {
    const sitzung = sitzungRef.current;
    if (!sitzung) return;
    setZustand(await profilLaden(sitzung));
  }, []);

  return <Kontext.Provider value={{ zustand, neuLaden }}>{children}</Kontext.Provider>;
}

export function useKonto(): KontoKontext {
  const k = useContext(Kontext);
  if (!k) throw new Error("useKonto nur innerhalb von KontoAnbieter verwenden");
  return k;
}

/** Profil der angemeldeten Person. Nur innerhalb des App-Rahmens verwenden. */
export function useProfil(): Profil {
  const { zustand } = useKonto();
  if (zustand.art !== "angemeldet") throw new Error("Nicht angemeldet");
  return zustand.profil;
}
