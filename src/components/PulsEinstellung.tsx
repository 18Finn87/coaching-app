"use client";

import { useEffect, useState } from "react";
import { Karte } from "./Bausteine";
import { ZONEN_NAME, pulszonen, type Pulswerte } from "@/lib/ausdauer";
import { supabase } from "@/lib/supabase";

/** Maximal- und Schwellenpuls einer Person; daraus geschätzte Pulszonen. Coach und Person selbst. */
export function PulsEinstellung({ athletId }: { athletId: string }) {
  const [werte, setWerte] = useState<Pulswerte>({ hf_max: null, hf_schwelle: null });
  const [vorhanden, setVorhanden] = useState(false);
  const [eingabe, setEingabe] = useState({ hf_max: "", hf_schwelle: "" });
  const [meldung, setMeldung] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    supabase()
      .from("athlet_ausdauer")
      .select("hf_max, hf_schwelle")
      .eq("athlet_id", athletId)
      .maybeSingle()
      .then(({ data }) => {
        const d = data as Pulswerte | null;
        if (!d) return;
        setWerte(d);
        setVorhanden(true);
        setEingabe({ hf_max: d.hf_max?.toString() ?? "", hf_schwelle: d.hf_schwelle?.toString() ?? "" });
      });
  }, [athletId]);

  async function speichern() {
    const lese = (t: string) => (t.trim() === "" ? null : Number(t.trim()));
    const neu = { hf_max: lese(eingabe.hf_max), hf_schwelle: lese(eingabe.hf_schwelle) };
    const okMax = neu.hf_max === null || (Number.isInteger(neu.hf_max) && neu.hf_max >= 100 && neu.hf_max <= 230);
    const okSchw = neu.hf_schwelle === null || (Number.isInteger(neu.hf_schwelle) && neu.hf_schwelle >= 80 && neu.hf_schwelle <= 220);
    if (!okMax || !okSchw) {
      setMeldung({ ok: false, text: "Bitte ganze Zahlen eingeben: Maximalpuls 100–230, Schwellenpuls 80–220." });
      return;
    }
    if (neu.hf_max && neu.hf_schwelle && neu.hf_schwelle >= neu.hf_max) {
      setMeldung({ ok: false, text: "Der Schwellenpuls muss unter dem Maximalpuls liegen." });
      return;
    }
    const sb = supabase();
    const { error } = vorhanden
      ? await sb.from("athlet_ausdauer").update(neu).eq("athlet_id", athletId)
      : await sb.from("athlet_ausdauer").insert({ athlet_id: athletId, ...neu });
    if (error) {
      setMeldung({ ok: false, text: "Speichern hat nicht geklappt." });
      return;
    }
    setVorhanden(true);
    setWerte(neu);
    setMeldung({ ok: true, text: "Gespeichert." });
  }

  const z = pulszonen(werte);
  const feld = "h-11 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

  return (
    <Karte titel="Ausdauer: Puls">
      <p className="mb-3 text-sm text-leise">
        Freiwillig. Daraus schätzt die App die Pulszonen. Am genauesten ist der Schwellenpuls (z. B. aus einem
        30-Minuten-Lauf: Ø-Puls der letzten 20 Minuten).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Maximalpuls
          <input
            inputMode="numeric"
            value={eingabe.hf_max}
            onChange={(e) => setEingabe({ ...eingabe, hf_max: e.target.value })}
            placeholder="z. B. 190"
            className={feld}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Schwellenpuls
          <input
            inputMode="numeric"
            value={eingabe.hf_schwelle}
            onChange={(e) => setEingabe({ ...eingabe, hf_schwelle: e.target.value })}
            placeholder="z. B. 168"
            className={feld}
          />
        </label>
      </div>
      <button type="button" onClick={speichern} className="mt-3 h-11 rounded-xl border border-rand px-4 font-medium">
        Speichern
      </button>
      {meldung && (
        <p role={meldung.ok ? "status" : "alert"} className={`mt-2 text-sm ${meldung.ok ? "text-akzent" : "text-red-500"}`}>
          {meldung.text}
        </p>
      )}
      {z && (
        <div className="mt-4">
          <p className="mb-1 text-sm font-medium">
            Geschätzte Pulszonen{" "}
            <span className="font-normal text-leise">
              ({z.methode === "schwelle" ? "aus dem Schwellenpuls" : "aus dem Maximalpuls"} – Schätzung, kein Messwert)
            </span>
          </p>
          <table className="w-full text-sm">
            <tbody>
              {z.zonen.map((zone) => (
                <tr key={zone.zone} className="border-t border-rand">
                  <td className="py-1">{ZONEN_NAME[zone.zone]}</td>
                  <td className="py-1 text-right tabular-nums">
                    {zone.von}–{zone.bis} Schläge/min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Karte>
  );
}
