const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const MITTENTE = { name: "KIREO", email: "noreply@kireo.it" };

export type EsitoInvioEmail = { ok: true } | { ok: false; motivo: string };

// Client riusabile per l'invio email transazionale via Brevo — server-only,
// legge BREVO_API_KEY da process.env (mai esposta al client, mai in un file
// versionato). Non lancia mai: ogni chiamante riceve un esito tipizzato e
// decide come trattarlo, perché l'invio di un'email non deve mai bloccare
// il flusso che lo richiama (submit di un form, follow-up guida...).
export async function inviaEmail(
  destinatario: string,
  oggetto: string,
  html: string,
  nomeDestinatario?: string,
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
        to: [{ email: destinatario, name: nomeDestinatario || undefined }],
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
