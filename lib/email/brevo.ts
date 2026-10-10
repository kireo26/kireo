const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const MITTENTE = { name: "KIREO", email: "noreply@kireo.it" };

export type EsitoInvioEmail = { ok: true } | { ok: false; motivo: string };

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
   * ⚠️ E NON È ANCORA PROVATO DAL VIVO. Che Brevo rispetti questo campo è
   * documentato; che una risposta arrivi davvero in casella lo dice solo una
   * prova, e dal sandbox non si può fare (nessuna `BREVO_API_KEY`, nessuna
   * posta in uscita). Finché la prova non c'è, i template NON dicono
   * «rispondi a questa email»: dicono l'indirizzo. Il Reply-To resta perché è
   * gratis ed è strettamente meglio — chi premesse «rispondi» passerebbe
   * comunque — ma la frase che lo promette si scrive dopo la prova, non
   * prima: se Brevo lo ignorasse, quella frase fallirebbe IN SILENZIO, che è
   * la direzione peggiore in cui può fallire una cosa irreversibile.
   */
  rispondiA?: string;
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
        subject: oggetto,
        htmlContent: html,
      }),
    });

    if (!risposta.ok) {
      const corpo = await risposta.text().catch(() => "");
      console.error(`Errore invio email Brevo (${risposta.status}) a ${destinatario}: ${corpo}`);
      return { ok: false, motivo: "errore_api" };
    }

    return { ok: true };
  } catch (errore) {
    console.error(`Errore di rete nell'invio email Brevo a ${destinatario}:`, errore);
    return { ok: false, motivo: "errore_rete" };
  }
}
