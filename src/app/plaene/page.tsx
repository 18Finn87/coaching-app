"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Karte, NurFuer, Seitentitel } from "@/components/Bausteine";
import { planFehler } from "@/lib/plaene";
import { supabase } from "@/lib/supabase";

type Zeile = {
  id: string;
  titel: string;
  status: string;
  athlet_id: string;
  planversionen: { versionsnummer: number; status: string }[];
};

type Person = { athlet_id: string; athlet: { anzeigename: string } | null };

export default function PlaeneSeite() {
  return (
    <NurFuer rolle="coach">
      <Plaene />
    </NurFuer>
  );
}

function Plaene() {
  const [plaene, setPlaene] = useState<Zeile[] | null>(null);
  const [personen, setPersonen] = useState<Person[]>([]);
  const [archivZeigen, setArchivZeigen] = useState(false);
  const [fehler, setFehler] = useState(false);

  const laden = useCallback(async () => {
    const sb = supabase();
    const [p, b] = await Promise.all([
      sb
        .from("plaene")
        .select("id, titel, status, athlet_id, planversionen (versionsnummer, status)")
        .order("erstellt_am", { ascending: false }),
      sb
        .from("coach_athlet")
        .select("athlet_id, athlet:profile!athlet_id(anzeigename)")
        .in("status", ["aktiv", "pausiert", "eingeladen"]),
    ]);
    setFehler(!!(p.error || b.error));
    setPlaene((p.data as Zeile[] | null) ?? []);
    setPersonen((b.data as unknown as Person[] | null) ?? []);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    laden();
  }, [laden]);

  const name = (id: string) => personen.find((p) => p.athlet_id === id)?.athlet?.anzeigename || "Ohne Namen";
  const sichtbar = (plaene ?? []).filter((p) => (p.status === "archiviert") === archivZeigen);

  return (
    <>
      <Seitentitel titel="Pläne" />
      <NeuerPlan personen={personen} />

      <Karte titel={archivZeigen ? "Archivierte Pläne" : "Alle Pläne"}>
        {fehler && <p role="alert">Die Pläne konnten nicht geladen werden.</p>}
        {plaene === null && !fehler && <p className="text-leise">Lädt …</p>}
        {plaene && sichtbar.length === 0 && <p className="text-leise">Noch keine Pläne.</p>}
        {sichtbar.length > 0 && (
          <ul className="flex flex-col divide-y divide-rand">
            {sichtbar.map((p) => {
              const gueltig = p.planversionen.find((v) => v.status === "veroeffentlicht");
              const entwurf = p.planversionen.find((v) => v.status === "entwurf");
              return (
                <li key={p.id}>
                  <Link href={`/plan/?id=${p.id}`} className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{p.titel}</span>
                      <span className="block text-sm text-leise">für {name(p.athlet_id)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                      {gueltig && (
                        <span className="rounded-full bg-akzent/15 px-2.5 py-1 font-medium text-akzent">
                          V{gueltig.versionsnummer} gültig
                        </span>
                      )}
                      {entwurf && (
                        <span className="rounded-full border border-rand px-2.5 py-1 text-leise">
                          V{entwurf.versionsnummer} Entwurf
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <label className="mt-3 flex items-center gap-2 text-sm text-leise">
          <input
            type="checkbox"
            checked={archivZeigen}
            onChange={(e) => setArchivZeigen(e.target.checked)}
            className="size-4 accent-akzent"
          />
          Archivierte zeigen
        </label>
      </Karte>
    </>
  );
}

function NeuerPlan({ personen }: { personen: Person[] }) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [athlet, setAthlet] = useState("");
  const [titel, setTitel] = useState("");
  const [ziel, setZiel] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  async function anlegen(e: FormEvent) {
    e.preventDefault();
    const t = titel.trim().replace(/\s+/g, " ");
    if (!athlet || !t) {
      setFehler("Bitte wähle eine Person und gib einen Titel ein.");
      return;
    }
    setLaeuft(true);
    setFehler("");
    const { data, error } = await supabase().rpc("plan_anlegen", {
      p_athlet: athlet,
      p_titel: t,
      p_ziel: ziel.trim(),
    });
    setLaeuft(false);
    if (error) {
      setFehler(planFehler(error));
      return;
    }
    router.push(`/plan/?id=${data as string}`);
  }

  const feld =
    "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        disabled={personen.length === 0}
        className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
      >
        {personen.length === 0 ? "Erst eine Person einladen" : "+ Neuer Plan"}
      </button>
    );
  }

  return (
    <Karte titel="Neuer Plan">
      <form onSubmit={anlegen} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="np-person" className="text-sm font-medium">
            Für wen?
          </label>
          <select id="np-person" value={athlet} onChange={(e) => setAthlet(e.target.value)} className={feld}>
            <option value="">Bitte wählen</option>
            {personen.map((p) => (
              <option key={p.athlet_id} value={p.athlet_id}>
                {p.athlet?.anzeigename || "Ohne Namen"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="np-titel" className="text-sm font-medium">
            Titel
          </label>
          <input
            id="np-titel"
            value={titel}
            maxLength={100}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="z. B. Grundlagen Kraft – Ganzkörper 2×"
            className={feld}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="np-ziel" className="text-sm font-medium">
            Ziel des Plans (freiwillig)
          </label>
          <textarea
            id="np-ziel"
            rows={2}
            maxLength={1000}
            value={ziel}
            onChange={(e) => setZiel(e.target.value)}
            className="w-full rounded-xl border border-rand bg-background p-3 text-base outline-none focus:border-akzent"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={laeuft}
            className="h-11 rounded-xl bg-akzent px-4 font-medium text-akzent-text disabled:opacity-50"
          >
            {laeuft ? "Legt an …" : "Anlegen und bearbeiten"}
          </button>
          <button type="button" onClick={() => setOffen(false)} className="h-11 rounded-xl border border-rand px-4 font-medium">
            Abbrechen
          </button>
        </div>
        {fehler && (
          <p role="alert" className="text-sm text-red-500">
            {fehler}
          </p>
        )}
      </form>
    </Karte>
  );
}
