"use client";

import { useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Karte } from "./Bausteine";
import { anamneseListe, beschwerdenListe, gesundheitProtokoll } from "@/lib/anamnese";
import { useKonto } from "@/lib/konto";
import { vergessen } from "@/lib/kontowechsel";
import { supabase } from "@/lib/supabase";

/** Athletin / Athlet: alle eigenen Daten herunterladen oder das Konto löschen. */
export function DatenVerwalten() {
  const { zustand } = useKonto();
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [bestaetigung, setBestaetigung] = useState("");

  if (zustand.art !== "angemeldet") return null;
  const id = zustand.profil.id;
  const email = zustand.sitzung.user.email ?? "";

  async function herunterladen() {
    setLaeuft(true);
    setMeldung(null);
    const sb = supabase();
    const [profil, betreuung, stamm, einw, anamnese, beschwerden, protokoll, checkins, cGesundheit, trainings, maxtests, hinweise] = await Promise.all([
      sb.from("profile").select("rolle, anzeigename, erstellt_am").eq("id", id).maybeSingle(),
      sb
        .from("coach_athlet")
        .select("status, erfahrungsstufe, start_am, coach:profile!coach_id(anzeigename)")
        .eq("athlet_id", id),
      sb.from("athlet_stammdaten").select("*").eq("athlet_id", id).maybeSingle(),
      sb.from("einwilligungen").select("art, textversion, erteilt_am, widerrufen_am").eq("athlet_id", id),
      anamneseListe(id),
      beschwerdenListe(id),
      gesundheitProtokoll(id),
      sb.from("checkins").select("*").eq("athlet_id", id).order("woche"),
      sb.rpc("checkin_gesundheit_liste", { p_athlet: id }),
      sb
        .from("trainingseinheiten")
        .select("*, ausgefuehrte_uebungen (*, ausgefuehrte_saetze (*))")
        .eq("athlet_id", id)
        .order("gestartet_am"),
      sb.from("maxtests").select("*").eq("athlet_id", id).order("datum"),
      sb.from("benachrichtigungen").select("art, text_kurz, erstellt_am, gelesen_am").order("erstellt_am"),
    ]);
    setLaeuft(false);

    const fehler =
      [profil, betreuung, stamm, einw, checkins, cGesundheit, trainings, maxtests, hinweise].some((x) => x.error) ||
      anamnese.fehler ||
      beschwerden.fehler ||
      protokoll.fehler;
    if (fehler) {
      setMeldung({ ok: false, text: "Nicht alle Daten konnten geladen werden. Bitte versuche es erneut." });
      return;
    }

    const paket = {
      hinweis: "Alle Daten, die die Coaching App über dich gespeichert hat.",
      erstellt_am: new Date().toISOString(),
      email,
      profil: profil.data,
      betreuung: betreuung.data,
      angaben_zum_training: stamm.data,
      einwilligungen: einw.data,
      trainings: trainings.data,
      maximaltests: maxtests.data,
      checkins: checkins.data,
      hinweise: hinweise.data,
      gesundheit: {
        anamnese: anamnese.daten,
        beschwerden: beschwerden.daten,
        checkins_gesundheitsteil: cGesundheit.data,
        aenderungsprotokoll: protokoll.daten,
      },
    };
    const blob = new Blob([JSON.stringify(paket, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `coaching-app-meine-daten-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    setMeldung({ ok: true, text: "Die Datei wurde heruntergeladen." });
  }

  async function kontoLoeschen() {
    setLaeuft(true);
    setMeldung(null);
    const { error } = await supabase().functions.invoke("konto-loeschen", {
      body: { bestaetigung: "LÖSCHEN" },
    });
    if (error) {
      let code = "";
      if (error instanceof FunctionsHttpError) {
        try {
          code = ((await error.context.json()) as { fehler?: string }).fehler ?? "";
        } catch {
          // keine lesbare Antwort
        }
      }
      setLaeuft(false);
      setMeldung({
        ok: false,
        text:
          code === "coach_nicht_loeschbar"
            ? "Das Coach-Konto kann hier nicht gelöscht werden."
            : "Das Löschen hat nicht geklappt. Bitte versuche es erneut.",
      });
      return;
    }
    // Konto ist weg – lokal abmelden und auf dem Gerät vergessen
    vergessen(id);
    await supabase().auth.signOut({ scope: "local" });
  }

  return (
    <Karte titel="Deine Daten">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm text-leise">
            Lade alles herunter, was die App über dich gespeichert hat – als Datei (JSON).
          </p>
          <button
            type="button"
            disabled={laeuft}
            onClick={herunterladen}
            className="mt-2 h-11 rounded-xl border border-rand px-4 font-medium disabled:opacity-50"
          >
            {laeuft && !loeschenOffen ? "Wird zusammengestellt …" : "Meine Daten herunterladen"}
          </button>
        </div>

        <div className="border-t border-rand pt-3">
          {!loeschenOffen ? (
            <button
              type="button"
              onClick={() => setLoeschenOffen(true)}
              className="h-11 rounded-xl border border-red-400/60 px-4 font-medium text-red-500"
            >
              Konto löschen
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border border-red-400/50 bg-red-500/10 p-3">
              <p className="text-sm">
                Dein Konto und <strong>alle</strong> deine Daten werden endgültig gelöscht: Angaben zum
                Training, Einwilligungen, Anamnese, Beschwerden und später auch Trainingsdaten. Das kann
                nicht rückgängig gemacht werden. Lade deine Daten vorher herunter, wenn du sie behalten
                möchtest.
              </p>
              <label htmlFor="loeschen-bestaetigung" className="text-sm font-medium">
                Tippe zur Bestätigung LÖSCHEN ein
              </label>
              <input
                id="loeschen-bestaetigung"
                value={bestaetigung}
                autoComplete="off"
                onChange={(e) => setBestaetigung(e.target.value)}
                className="h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-red-500"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={laeuft || bestaetigung.trim().toUpperCase() !== "LÖSCHEN"}
                  onClick={kontoLoeschen}
                  className="h-11 rounded-xl bg-red-600 px-4 font-medium text-white disabled:opacity-50"
                >
                  {laeuft ? "Löscht …" : "Konto endgültig löschen"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoeschenOffen(false);
                    setBestaetigung("");
                  }}
                  className="h-11 rounded-xl border border-rand px-4 font-medium"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}
        </div>

        {meldung && (
          <p role="status" className={meldung.ok ? "text-sm text-akzent" : "text-sm text-red-500"}>
            {meldung.text}
          </p>
        )}
      </div>
    </Karte>
  );
}
