const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const MITTENTE = { name: "KIREO", email: "noreply@kireo.it" };

// `messageId` è l'identificativo che Brevo restituisce a un invio accettato
// (30/10): con quello la consegna si cerca nei registri di Brevo. «Accettato»
// non vuol dire «consegnato»: la consegna la sa solo Brevo.
export type EsitoInvioEmail = { ok: true; messageId?: string } | { ok: false; motivo: string };

/**
 * Le opzioni di un invio. Un oggetto invece di due parametri posizionali in
 * coda: `rispondiA` decide se una FRASE dell'email è vera, e un quinto
 * argomento posizionale è il posto in cui un domani qualcuno mette il nome.
 */
export type OpzioniInvioEmail = {
  /** Il nome del destinatario, per l'intestazione. */
  nome?: string;
  /**
   * L'indirizzo dell'header `Reply-To`.
   *
   * ⚠️ PERCHÉ ESISTE (10/10/2026). Il mittente di ogni nostra email è
   * `noreply@kireo.it`, che NON RICEVE — e l'email di conferma di una
   * richiesta di contatto diceva «rispondi pure a questa email». Chi
   * rispondeva scriveva a una casella muta e non lo scopriva: il messaggio
   * parte e sparisce. La promessa di un canale è il pezzo che nessuno
   * verifica, e quella era la terza volta.
   *
   * ✅ PROVATO DAL VIVO L'11/10/2026, da Mario: ha letto in Roundcube l'avviso
   * interno di un messaggio vero e ha premuto «Rispondi» — il messaggio
   * composto parte da `info@kireo.it` e va a chi aveva scritto. Quindi Brevo
   * manda l'header, il client di posta lo usa, e il gesto naturale atterra
   * dove deve. Con quella prova la frase «rispondi pure a questa email» è
   * tornata nel template della conferma.
   *
   * ⚠️ L'ORDINE ERA DELIBERATO, e vale per la prossima promessa di questo
   * tipo: la frase che promette un canale si scrive DOPO la prova, non prima.
   * Un «rispondi a questa email» su un header ignorato fallisce IN SILENZIO —
   * la risposta parte e sparisce — che è la direzione peggiore in cui può
   * fallire una cosa irreversibile. Il Reply-To invece si mette subito: è
   * gratis ed è strettamente meglio, anche senza nessuna frase che lo nomini.
   */
  rispondiA?: string;
  /**
   * Intestazioni in più (30/10, la newsletter: `List-Unsubscribe` e
   * `List-Unsubscribe-Post`, RFC 8058). ⚠️ NON VERIFICATO che Brevo le passi
   * così come sono: dal sandbox la documentazione non si raggiunge. Il link di
   * uscita nel corpo dell'email funziona comunque; queste servono ai client di
   * posta che mostrano «Annulla iscrizione».
   */
  intestazioni?: Record<string, string>;
};

// Client riusabile per l'invio email transazionale via Brevo — server-only,
// legge BREVO_API_KEY da process.env (mai esposta al client, mai in un file
// versionato). Non lancia mai: ogni chiamante riceve un esito tipizzato e
// decide come trattarlo, perché l'invio di un'email non deve mai bloccare
// il flusso che lo richiama (submit di un form, follow-up guida...).
export async function inviaEmail(
  destinatario: string,
  oggetto: string,
  html: string,
  opzioni: OpzioniInvioEmail = {},
): Promise<EsitoInvioEmail> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.error("BREVO_API_KEY non configurata: impossibile inviare email.");
    return { ok: false, motivo: "chiave_mancante" };
  }

  try {
    const risposta = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: MITTENTE,
        to: [{ email: destinatario, name: opzioni.nome || undefined }],
        // `undefined` lo lascia cadere `JSON.stringify`: senza `rispondiA` il
        // corpo è identico a prima.
        replyTo: opzioni.rispondiA ? { email: opzioni.rispondiA } : undefined,
        headers: opzioni.intestazioni && Object.keys(opzioni.intestazioni).length > 0 ? opzioni.intestazioni : undefined,
        subject: oggetto,
        htmlContent: html,
      }),
    });

    if (!risposta.ok) {
      const corpo = await risposta.text().catch(() => "");
      console.error(`Errore invio email Brevo (${risposta.status}) a ${destinatario}: ${corpo}`);
      return { ok: false, motivo: "errore_api" };
    }

    const accettato = (await risposta.json().catch(() => null)) as { messageId?: unknown } | null;
    return { ok: true, messageId: typeof accettato?.messageId === "string" ? accettato.messageId : undefined };
  } catch (errore) {
    console.error(`Errore di rete nell'invio email Brevo a ${destinatario}:`, errore);
    return { ok: false, motivo: "errore_rete" };
  }
}
