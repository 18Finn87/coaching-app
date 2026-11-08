"use client";

import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { fehlertext, istNichtFreigeschaltet } from "@/lib/fehlertexte";

type Schritt = "email" | "code";

const knopf =
  "h-12 w-full rounded-xl bg-akzent px-4 font-semibold text-akzent-text disabled:opacity-50";
const feld =
  "h-12 w-full rounded-xl border border-rand bg-background px-3 text-base outline-none focus:border-akzent";

/** Anmeldung in zwei Schritten: E-Mail-Adresse → Code aus der Mail. */
export function Anmeldung() {
  const [schritt, setSchritt] = useState<Schritt>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");

  async function codeAnfordern(e: FormEvent) {
    e.preventDefault();
    const adresse = email.trim().toLowerCase();
    setEmail(adresse);
    setFehler("");
    setLaeuft(true);
    const { error } = await supabase().auth.signInWithOtp({
      email: adresse,
      // Nur bereits eingeladene Personen bekommen einen Code.
      options: { shouldCreateUser: false },
    });
    setLaeuft(false);
    if (error && !istNichtFreigeschaltet(error)) {
      setFehler(fehlertext(error));
      return;
    }
    setCode("");
    setSchritt("code");
  }

  async function codePruefen(e: FormEvent) {
    e.preventDefault();
    const eingabe = code.replace(/\s/g, "");
    setFehler("");
    setLaeuft(true);
    const { error } = await supabase().auth.verifyOtp({
      email,
      token: eingabe,
      type: "email",
    });
    setLaeuft(false);
    if (error) setFehler(fehlertext(error));
    // Bei Erfolg meldet Supabase die neue Sitzung, die Startseite wechselt von selbst.
  }

  if (schritt === "email") {
    return (
      <form onSubmit={codeAnfordern} className="flex flex-col gap-3">
        <label htmlFor="email" className="font-medium">
          Deine E-Mail-Adresse
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={feld}
          placeholder="name@beispiel.de"
        />
        <button type="submit" disabled={laeuft || !email.trim()} className={knopf}>
          {laeuft ? "Einen Moment …" : "Code per E-Mail schicken"}
        </button>
        {fehler && <Hinweis>{fehler}</Hinweis>}
        <p className="text-sm text-leise">
          Die App ist nur für eingeladene Personen. Ein Passwort brauchst du nicht.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={codePruefen} className="flex flex-col gap-3">
      <p>
        Falls <strong>{email}</strong> freigeschaltet ist, ist jetzt ein Code unterwegs.
        Schau auch im Spam-Ordner nach.
      </p>
      <label htmlFor="code" className="font-medium">
        Code aus der E-Mail
      </label>
      <input
        id="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={12}
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className={`${feld} tracking-[0.3em] text-lg`}
        placeholder="123456"
      />
      <button
        type="submit"
        disabled={laeuft || code.replace(/\s/g, "").length < 6}
        className={knopf}
      >
        {laeuft ? "Wird geprüft …" : "Anmelden"}
      </button>
      {fehler && <Hinweis>{fehler}</Hinweis>}
      <button
        type="button"
        onClick={() => {
          setSchritt("email");
          setFehler("");
        }}
        className="text-sm text-akzent underline underline-offset-4"
      >
        Kein Code gekommen? Adresse prüfen oder neu anfordern
      </button>
    </form>
  );
}

function Hinweis({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-red-400/50 bg-red-500/10 p-3 text-sm">
      {children}
    </p>
  );
}
