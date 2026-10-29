import type { EsitoGuida } from "@/lib/guide/scaricamento";

// ⚠️ Testi miei e provvisori (29/10), da rileggere.

export const TESTI_SCARICAMENTO = {
  bottone: "Scarica la guida",
  // Chi ha fatto l'accesso: niente form, e la riga dice dove arriva il link.
  conAccesso: (email: string) => `Ti mandiamo anche il link per riaprirla a ${email}.`,
  conAccessoSenzaEmail: "Il download parte subito.",
  // Chi non ha fatto l'accesso: l'email serve solo a mandargli il link.
  etichettaEmail: "La tua email",
  spiegaEmail: "Ti mandiamo il link per riaprirla quando vuoi. Non la usiamo per altro.",
  erroreEmail: "Inserisci un indirizzo email valido.",
  errorePrivacy: "Per scaricare la guida devi accettare la privacy policy.",
  partito: "Il download è partito",
  partitoDettaglio: "Se non vedi il file, controlla i download del tuo browser.",
} as const;

const ESITI: Record<EsitoGuida, string> = {
  errore: "Non siamo riusciti a preparare la guida: riprova fra un momento.",
  non_disponibile: "Questa guida non è più disponibile.",
  sostituita: "La guida che stavi scaricando è stata sostituita: quella qui sotto è la versione di adesso.",
  dati: "Per scaricare la guida servono un'email valida e l'accettazione della privacy policy.",
};

/** Il testo dell'esito tornato in `?guida=`, o `null` se il valore non è uno dei nostri. */
export function testoEsitoGuida(valore: string | string[] | undefined): string | null {
  const v = Array.isArray(valore) ? valore[0] : valore;
  return v && v in ESITI ? ESITI[v as EsitoGuida] : null;
}
