"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/Button";
import { inputClass, fieldBorder } from "@/lib/formStyles";
import { createClient } from "@/lib/supabase/client";
import { formattaData } from "@/lib/formato";
import {
  TESTI_NEWSLETTER,
  messaggioErroreNewsletter,
  piuGiorni,
  ultimoGiornoDiPartenza,
  type StatoNewsletter,
} from "@/lib/newsletter/regole";

export type NewsletterIniziale = {
  id: string;
  oggetto: string;
  corpo: string;
  giorno: string;
  ultimoGiorno: string;
  stato: StatoNewsletter;
};

// Il form della newsletter (30/10). Scrive solo da `salva_newsletter`: le regole
// (il giorno pieno, una al mese, la quota del piano) le fa rispettare il
// database. Il giorno pieno qui si dice PRIMA del clic, perché il secondo ente
// legga «completo» prima di scrivere e non dopo: `giorniPieni` è letto dalla
// pagina con `giorni_newsletter_pieni`.
export default function NewsletterForm({
  iniziale,
  oggi,
  giorniPieni,
}: {
  iniziale: NewsletterIniziale | null;
  /** Il giorno di oggi in Italia, `AAAA-MM-GG`. */
  oggi: string;
  /** null = non letti: il form non lo nasconde, e il database decide lo stesso. */
  giorniPieni: string[] | null;
}) {
  const router = useRouter();
  const domani = piuGiorni(oggi, 1);
  const [oggetto, setOggetto] = useState(iniziale?.oggetto ?? "");
  const [corpo, setCorpo] = useState(iniziale?.corpo ?? "");
  const [giorno, setGiorno] = useState(iniziale?.giorno ?? "");
  // Un valore non toccato è una proposta nostra: l'ultimo giorno segue il
  // giorno finché l'ente non lo cambia (la regola di `CorreggiOreForm`).
  const [ultimoScritto, setUltimoScritto] = useState<string | null>(iniziale?.ultimoGiorno ?? null);
  const ultimoGiorno = ultimoScritto ?? (giorno ? ultimoGiornoDiPartenza(giorno) : "");
  const [errore, setErrore] = useState<string | null>(null);
  const [inviando, setInviando] = useState<"bozza" | "manda" | null>(null);

  const giornoPieno = giorno !== "" && (giorniPieni ?? []).includes(giorno) && iniziale?.giorno !== giorno;
  const approvata = iniziale?.stato === "approvata";
  const testoCambiato = iniziale !== null && (iniziale.oggetto !== oggetto.trim() || iniziale.corpo !== corpo.trim());

  async function salva(manda: boolean) {
    setErrore(null);
    if (!oggetto.trim() || !corpo.trim() || !giorno) {
      setErrore("Servono l'oggetto, il testo e il giorno.");
      return;
    }
    if (giornoPieno) {
      setErrore(TESTI_NEWSLETTER.giornoPieno(formattaData(giorno, "long")));
      return;
    }
    setInviando(manda ? "manda" : "bozza");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("salva_newsletter", {
        p_id: iniziale?.id ?? null,
        p_oggetto: oggetto,
        p_corpo: corpo,
        p_giorno: giorno,
        p_ultimo_giorno: ultimoGiorno || null,
        p_manda: manda,
      });
      if (error) {
        setErrore(messaggioErroreNewsletter(error.message));
        return;
      }
      // La pagina va alla riga salvata e la conferma lì; il form si svuota
      // perché la pagina lo rimonta con una chiave nuova (`?salvata=`).
      const salvata = (data as { id?: string } | null)?.id;
      router.push(salvata ? `/ente/comunicazioni?salvata=${salvata}#newsletter-${salvata}` : "/ente/comunicazioni");
      router.refresh();
    } catch {
      setErrore(messaggioErroreNewsletter(null));
    } finally {
      setInviando(null);
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5 rounded-2xl border border-white/5 bg-kireo-card p-6 sm:p-8">
      {errore && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{errore}</p>}

      <div>
        <label htmlFor="nl-oggetto" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Oggetto
        </label>
        <input id="nl-oggetto" value={oggetto} maxLength={150} onChange={(e) => setOggetto(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
      </div>

      <div>
        <label htmlFor="nl-corpo" className="mb-1.5 block text-sm font-medium text-kireo-light">
          Testo
        </label>
        <textarea id="nl-corpo" value={corpo} rows={8} onChange={(e) => setCorpo(e.target.value)} className={`${inputClass} ${fieldBorder(false)}`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="nl-giorno" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Giorno di partenza
          </label>
          <input id="nl-giorno" type="date" min={domani} value={giorno} onChange={(e) => setGiorno(e.target.value)} className={`${inputClass} ${fieldBorder(giornoPieno)}`} />
          {giornoPieno && <p className="mt-1.5 text-sm text-red-400">{TESTI_NEWSLETTER.giornoPieno(formattaData(giorno, "long"))}</p>}
          <p className="mt-1.5 text-xs text-kireo-muted">{TESTI_NEWSLETTER.partenza}</p>
        </div>
        <div>
          <label htmlFor="nl-ultimo" className="mb-1.5 block text-sm font-medium text-kireo-light">
            Vale fino al
          </label>
          <input
            id="nl-ultimo"
            type="date"
            min={giorno || domani}
            max={giorno ? piuGiorni(giorno, 13) : undefined}
            value={ultimoGiorno}
            onChange={(e) => setUltimoScritto(e.target.value)}
            className={`${inputClass} ${fieldBorder(false)}`}
          />
        </div>
      </div>
      <p className="text-xs text-kireo-muted">{TESTI_NEWSLETTER.consiglio}</p>
      {giorniPieni === null && (
        <p className="text-xs text-kireo-orange">Non siamo riusciti a leggere i giorni già completi: se ne scegli uno pieno, te lo diciamo al salvataggio.</p>
      )}
      <p className="text-xs text-kireo-muted">{TESTI_NEWSLETTER.approvazione}</p>
      {approvata && testoCambiato && (
        <p className="text-xs text-kireo-orange">Hai cambiato il testo: salvando, la newsletter torna in approvazione. Il giorno resta tuo.</p>
      )}

      <div className="flex flex-wrap gap-3">
        {approvata ? (
          <Button type="button" variant="primary" onClick={() => salva(false)} disabled={inviando !== null}>
            {inviando ? "Un momento…" : "Salva"}
          </Button>
        ) : (
          <>
            <Button type="button" variant="primary" onClick={() => salva(true)} disabled={inviando !== null || giornoPieno}>
              {inviando === "manda" ? "Un momento…" : "Manda in approvazione"}
            </Button>
            {iniziale?.stato !== "in_approvazione" && (
              <Button type="button" variant="outline" onClick={() => salva(false)} disabled={inviando !== null}>
                {inviando === "bozza" ? "Un momento…" : "Salva come bozza"}
              </Button>
            )}
          </>
        )}
        {iniziale && (
          <Link href="/ente/comunicazioni" className="self-center text-sm text-kireo-muted underline underline-offset-2">
            Annulla
          </Link>
        )}
      </div>
    </form>
  );
}
