"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { supabase } from "@/lib/supabase";
import { datum, statusText, stufeText } from "@/lib/texte";

type Betreuung = {
  id: string;
  status: string;
  erfahrungsstufe: string;
  start_am: string;
  athlet: { id: string; anzeigename: string } | null;
};

type OffeneEinladung = {
  id: string;
  email: string;
  name: string | null;
  gueltig_bis: string;
};

const einladeFehler: Record<string, string> = {
  email_ungueltig: "Diese E-Mail-Adresse sieht nicht gültig aus.",
  schon_eingeladen: "An diese Adresse gibt es schon eine offene Einladung.",
  hat_schon_zugang: "Diese Person hat schon einen Zugang zur App.",
  nicht_erlaubt: "Nur der Coach darf einladen.",
  nicht_angemeldet: "Bitte melde dich neu an.",
  zu_viele_mails: "Gerade wurden zu viele Mails verschickt. Bitte versuche es in einer Stunde erneut.",
  versand_fehlgeschlagen: "Die Einladungs-Mail konnte nicht verschickt werden.",
};

export default function AthletenSeite() {
  return (
    <NurFuer rolle="coach">
      <Athleten />
    </NurFuer>
  );
}

function Athleten() {
  const [betreuungen, setBetreuungen] = useState<Betreuung[] | null>(null);
  const [einladungen, setEinladungen] = useState<OffeneEinladung[]>([]);
  const [ladeFehler, setLadeFehler] = useState(false);

  const laden = useCallback(async () => {
    const sb = supabase();
    const [b, e] = await Promise.all([
      sb
        .from("coach_athlet")
        .select("id, status, erfahrungsstufe, start_am, athlet:profile!athlet_id(id, anzeigename)")
        .order("start_am", { ascending: false }),
      sb
        .from("einladungen")
        .select("id, email, name, gueltig_bis")
        .is("angenommen_am", null)
        .order("erstellt_am", { ascending: false }),
    ]);
    if (b.error || e.error) {
      setLadeFehler(true);
      return;
    }
    setLadeFehler(false);
    setBetreuungen(b.data as unknown as Betreuung[]);
    setEinladungen(e.data as OffeneEinladung[]);
  }, []);

  useEffect(() => {
    // Daten aus der Datenbank holen, sobald die Seite erscheint
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const offen = einladungen.filter((e) => new Date(e.gueltig_bis) > new Date());

  return (
    <>
      <Seitentitel titel="Athleten" />
      <Einladen beiErfolg={laden} />

      <Karte titel="Deine Athletinnen und Athleten">
        {ladeFehler && (
          <p role="alert" className="text-sm">
            Die Liste konnte nicht geladen werden. Bitte prüfe deine Internetverbindung.
          </p>
        )}
        {!ladeFehler && betreuungen === null && <p className="text-leise">Lädt …</p>}
        {betreuungen?.length === 0 && (
          <p className="text-leise">Noch niemand. Lade oben die erste Person ein.</p>
        )}
        {betreuungen && betreuungen.length > 0 && (
          <ul className="flex flex-col divide-y divide-rand">
            {betreuungen.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.athlet?.anzeigename || "Ohne Namen"}</p>
                  <p className="text-sm text-leise">
                    {stufeText[b.erfahrungsstufe]} · seit {datum(b.start_am)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    b.status === "aktiv"
                      ? "bg-akzent/15 text-akzent"
                      : "border border-rand text-leise"
                  }`}
                >
                  {statusText[b.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Karte>

      {offen.length > 0 && (
        <Karte titel="Offene Einladungen">
          <p className="mb-2 text-sm text-leise">
            Noch nicht angemeldet. Die Person meldet sich mit ihrer E-Mail-Adresse und einem Code an.
          </p>
          <ul className="flex flex-col divide-y divide-rand">
            {offen.map((e) => (
              <li key={e.id} className="py-2">
                <p className="font-medium">{e.name || e.email}</p>
                <p className="break-all text-sm text-leise">
                  {e.name ? `${e.email} · ` : ""}gültig bis {datum(e.gueltig_bis)}
                </p>
              </li>
            ))}
          </ul>
        </Karte>
      )}
    </>
  );
}

function Einladen({ beiErfolg }: { beiErfolg: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const adresse = email.trim().toLowerCase();
    const bereinigterName = name.trim().replace(/\s+/g, " ");
    setLaeuft(true);
    setMeldung(null);
    const { error } = await supabase().functions.invoke("einladen", {
      body: { email: adresse, name: bereinigterName },
    });
    setLaeuft(false);

    if (error) {
      let code = "";
      if (error instanceof FunctionsHttpError) {
        try {
          code = ((await error.context.json()) as { fehler?: string }).fehler ?? "";
        } catch {
          // keine lesbare Antwort
        }
      }
      setMeldung({
        ok: false,
        text:
          einladeFehler[code] ??
          "Das hat nicht geklappt. Bitte prüfe deine Internetverbindung und versuche es erneut.",
      });
      return;
    }

    setMeldung({
      ok: true,
      text: `Einladung an ${adresse} ist verschickt. ${bereinigterName || "Die Person"} bekommt eine Mail mit einem Link zur App.`,
    });
    setName("");
    setEmail("");
    beiErfolg();
  }

  const feld =
    "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

  return (
    <Karte titel="Neue Person einladen">
      <form onSubmit={absenden} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="ein-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="ein-name"
            value={name}
            maxLength={80}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            className={feld}
            placeholder="z. B. Lena"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ein-email" className="text-sm font-medium">
            E-Mail-Adresse
          </label>
          <input
            id="ein-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={feld}
            placeholder="name@beispiel.de"
          />
        </div>
        <button
          type="submit"
          disabled={laeuft || !email.trim()}
          className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
        >
          {laeuft ? "Wird verschickt …" : "Einladung schicken"}
        </button>
        {meldung && (
          <p role="status" className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
            {meldung.text}
          </p>
        )}
      </form>
    </Karte>
  );
}
