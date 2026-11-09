"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Karte, Seitentitel } from "@/components/Bausteine";
import { DatenVerwalten } from "@/components/DatenVerwalten";
import { FormelEinstellung } from "@/components/FormelEinstellung";
import { EinwilligungenVerwalten } from "@/components/EinwilligungenVerwalten";
import { MeineBetreuung } from "@/components/MeineBetreuung";
import { RegelEinstellung } from "@/components/RegelEinstellung";
import { KontoWechsel } from "@/components/KontoWechsel";
import { abmelden } from "@/lib/kontowechsel";
import { StammdatenFormular } from "@/components/StammdatenFormular";
import { useKonto, useProfil } from "@/lib/konto";
import { supabase } from "@/lib/supabase";

export default function ProfilSeite() {
  const profil = useProfil();
  const { zustand, neuLaden } = useKonto();
  const email = zustand.art === "angemeldet" ? zustand.sitzung.user.email : "";

  const [name, setName] = useState(profil.anzeigename);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  const bereinigt = name.trim().replace(/\s+/g, " ");
  const geaendert = bereinigt !== profil.anzeigename;

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!bereinigt) {
      setMeldung({ ok: false, text: "Bitte gib einen Namen ein." });
      return;
    }
    setLaeuft(true);
    setMeldung(null);
    const { error } = await supabase()
      .from("profile")
      .update({ anzeigename: bereinigt })
      .eq("id", profil.id);
    setLaeuft(false);
    if (error) {
      setMeldung({ ok: false, text: "Speichern hat nicht geklappt. Bitte versuche es erneut." });
      return;
    }
    setName(bereinigt);
    setMeldung({ ok: true, text: "Gespeichert." });
    await neuLaden();
  }

  return (
    <>
      <Seitentitel titel="Profil" />

      <Karte titel="Dein Name">
        <form onSubmit={speichern} className="flex flex-col gap-3">
          <label htmlFor="name" className="text-sm text-leise">
            So erscheinst du in der App
          </label>
          <input
            id="name"
            value={name}
            maxLength={80}
            autoComplete="name"
            onChange={(e) => {
              setName(e.target.value);
              setMeldung(null);
            }}
            className="h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent"
          />
          <button
            type="submit"
            disabled={laeuft || !geaendert}
            className="h-12 rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50"
          >
            {laeuft ? "Speichert …" : "Speichern"}
          </button>
          {meldung && (
            <p role="status" className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
              {meldung.text}
            </p>
          )}
        </form>
      </Karte>

      {profil.rolle === "athlet" && (
        <>
          <MeineBetreuung athletId={profil.id} />
          <StammdatenFormular athletId={profil.id} />
          <Karte titel="Gesundheit">
            <Link href="/anamnese/" className="font-medium text-akzent underline underline-offset-4">
              Anamnese und Beschwerden öffnen
            </Link>
          </Karte>
        </>
      )}

      <Karte titel="Zugang">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-leise">E-Mail</dt>
          <dd className="break-all">{email}</dd>
          <dt className="text-leise">Rolle</dt>
          <dd>{profil.rolle === "coach" ? "Coach" : "Athlet/Athletin"}</dd>
        </dl>
        <button
          type="button"
          onClick={() => abmelden(profil.id)}
          className="mt-4 h-11 rounded-xl border border-rand px-4 font-medium"
        >
          Abmelden
        </button>
      </Karte>

      <KontoWechsel profil={profil} />

      {profil.rolle === "athlet" ? (
        <EinwilligungenVerwalten />
      ) : (
        <>
          <FormelEinstellung coachId={profil.id} />
          <RegelEinstellung />
          <Karte titel="Datenschutz">
            <p className="text-sm text-leise">
              Die Einwilligungen deiner Athletinnen und Athleten siehst du unter „Athleten“.
            </p>
          </Karte>
        </>
      )}

      {profil.rolle === "athlet" && <DatenVerwalten />}
    </>
  );
}
