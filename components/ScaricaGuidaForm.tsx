"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Button } from "./Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { CAMPO_MANDA_LINK, CAMPO_RITORNO, emailValida } from "@/lib/guide/scaricamento";
import { TESTI_SCARICAMENTO as T } from "@/lib/guide/testiScaricamento";

// IL GESTO DI SCARICARE UNA GUIDA, UNA COPIA SOLA (29/10). Lo usano la guida di
// un ente (`GuidaEnteForm`) e la Panoramica di un'area (`GuidaAreaForm`).
//
// ⚠️ È UNA POST NATIVA, NON UN `fetch` E POI UN `location.href`. La traccia la
// scrive la route, prima di rimandare al file (vedi `lib/guide/scaricamento.ts`):
// qui non c'è niente che parta dopo la navigazione, quindi non c'è niente da
// perdere quando il PDF sostituisce la pagina. Chi rimettesse una scrittura nel
// browser «dopo il download» rimetterebbe il difetto del 29/10.
//
// Chi ha fatto l'accesso vede un bottone e la riga che dice dove arriva il
// link; chi no, l'email e la privacy. Nient'altro: un campo che nessuno legge
// non si chiede.
export default function ScaricaGuidaForm({
  azione,
  emailAccount,
  esito,
  sotto,
  conferma,
}: {
  azione: string;
  // `string`: ha fatto l'accesso (con il suo indirizzo); `null`: no.
  emailAccount: string | null;
  esito?: string | null;
  sotto?: ReactNode;
  conferma?: ReactNode;
}) {
  const percorso = usePathname();
  const [email, setEmail] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [errori, setErrori] = useState<{ email?: string; privacy?: string }>({});
  const [inviato, setInviato] = useState(false);
  const collegato = emailAccount !== null;

  function alSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!collegato) {
      const prossimi: typeof errori = {};
      if (!emailValida(email)) prossimi.email = T.erroreEmail;
      if (!privacy) prossimi.privacy = T.errorePrivacy;
      setErrori(prossimi);
      if (Object.keys(prossimi).length > 0) {
        e.preventDefault();
        return;
      }
    }
    // La POST parte da sola (niente preventDefault). La conferma arriva dopo,
    // per chi resta su questa pagina perché il PDF si è scaricato come file.
    setTimeout(() => setInviato(true), 0);
  }

  if (inviato) {
    return (
      <div className="rounded-2xl border border-kireo-green/40 bg-kireo-card p-8 text-center">
        <h3 className="py-0.5 font-heading text-lg font-semibold leading-[1.25] text-kireo-light">{T.partito}</h3>
        <p className="mt-2 text-sm text-kireo-muted">{T.partitoDettaglio}</p>
        {conferma}
      </div>
    );
  }

  return (
    <form
      method="post"
      action={azione}
      onSubmit={alSubmit}
      noValidate
      className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8"
    >
      <input type="hidden" name={CAMPO_RITORNO} value={percorso ?? "/"} />
      {/* La riga sopra il bottone promette il link: il campo è quella promessa. */}
      {collegato && emailAccount && <input type="hidden" name={CAMPO_MANDA_LINK} value="si" />}
      {esito && (
        <p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
          {esito}
        </p>
      )}

      {collegato ? (
        <p className="text-sm text-kireo-muted">{emailAccount ? T.conAccesso(emailAccount) : T.conAccessoSenzaEmail}</p>
      ) : (
        <>
          <div>
            <label htmlFor="guida-email" className="mb-1.5 block text-sm font-medium text-kireo-light">
              {T.etichettaEmail}
            </label>
            <input
              id="guida-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrori((p) => ({ ...p, email: undefined }));
              }}
              aria-invalid={Boolean(errori.email)}
              aria-describedby="guida-email-spiega"
              className={`${inputClass} ${fieldBorder(Boolean(errori.email))}`}
              placeholder="nome@esempio.it"
            />
            <p id="guida-email-spiega" className="mt-1.5 text-xs text-kireo-muted">
              {T.spiegaEmail}
            </p>
            {errori.email && <p className="mt-1.5 text-sm text-red-400">{errori.email}</p>}
          </div>

          <div>
            <div className="flex items-start gap-3">
              <input
                id="guida-privacy"
                name="privacy"
                type="checkbox"
                value="si"
                checked={privacy}
                onChange={(e) => {
                  setPrivacy(e.target.checked);
                  setErrori((p) => ({ ...p, privacy: undefined }));
                }}
                aria-invalid={Boolean(errori.privacy)}
                className="mt-1 h-5 w-5 flex-none rounded border-white/20 bg-kireo-dark accent-kireo-green"
              />
              <label htmlFor="guida-privacy" className="text-sm text-kireo-muted">
                Ho letto e accetto la{" "}
                <a href="/privacy" className="text-kireo-orange underline underline-offset-2">
                  Privacy Policy
                </a>
              </label>
            </div>
            {errori.privacy && <p className="mt-1.5 text-sm text-red-400">{errori.privacy}</p>}
          </div>
        </>
      )}

      <Button type="submit" variant="primary" className="w-full">
        {T.bottone}
      </Button>
      {sotto}
    </form>
  );
}
