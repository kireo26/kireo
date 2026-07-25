// Template email transazionali (HTML minimale, inline styles per
// compatibilità coi client di posta — niente CSS esterno, niente dark
// theme del sito: uno sfondo chiaro resta il più leggibile ovunque).

function involucroEmail(contenuto: string): string {
  return `<!doctype html>
<html lang="it">
  <body style="margin:0;padding:0;background-color:#F0EDE8;font-family:Arial,Helvetica,sans-serif;color:#2C2C2A;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background-color:#2C2C2A;padding:24px 32px;">
                <span style="font-size:20px;font-weight:700;letter-spacing:0.08em;color:#F0EDE8;">KIREO</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-size:15px;line-height:1.6;">
                ${contenuto}
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;font-size:12px;color:#9A9890;">
                KIREO — Orientamento. Direzione. Futuro. — kireo.it
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function bottone(testo: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:16px;padding:12px 24px;background-color:#0F6E56;color:#F0EDE8;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${testo}</a>`;
}

const ETICHETTA_ORIGINE: Record<"dirigenti" | "scuole", string> = {
  dirigenti: "Dirigenti Scolastici",
  scuole: "referenti orientamento e docenti",
};

export function templateConfermaRichiestaContatto(nome: string, origine: "dirigenti" | "scuole"): string {
  return involucroEmail(`
    <p>Ciao ${nome},</p>
    <p>Abbiamo ricevuto la tua richiesta di informazioni su KIREO per ${ETICHETTA_ORIGINE[origine]}. Ti ricontatteremo entro 24 ore.</p>
    <p>Nel frattempo, se hai altre domande, scrivici pure rispondendo a questa email.</p>
    <p>A presto,<br />Il team KIREO</p>
  `);
}

export function templateNotificaRichiestaContatto(dati: {
  origine: "dirigenti" | "scuole";
  nome: string;
  ruolo: string;
  istituto: string;
  codiceMeccanografico: string | null;
  email: string;
  messaggio: string;
}): string {
  return involucroEmail(`
    <p>Nuova richiesta di informazioni dalla landing <strong>${dati.origine}</strong>.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr><td style="padding:4px 0;color:#9A9890;">Nome</td><td style="padding:4px 0;">${dati.nome}</td></tr>
      <tr><td style="padding:4px 0;color:#9A9890;">Ruolo</td><td style="padding:4px 0;">${dati.ruolo}</td></tr>
      <tr><td style="padding:4px 0;color:#9A9890;">Istituto</td><td style="padding:4px 0;">${dati.istituto}</td></tr>
      <tr><td style="padding:4px 0;color:#9A9890;">Codice meccanografico</td><td style="padding:4px 0;">${dati.codiceMeccanografico ?? "—"}</td></tr>
      <tr><td style="padding:4px 0;color:#9A9890;">Email</td><td style="padding:4px 0;">${dati.email}</td></tr>
    </table>
    <p style="margin-top:16px;color:#9A9890;">Messaggio</p>
    <p style="white-space:pre-wrap;">${dati.messaggio}</p>
  `);
}

export function templateFollowUpGuida(dati: { nome: string; titoloGuida: string; linkGuida: string }): string {
  return involucroEmail(`
    <p>Ciao${dati.nome ? ` ${dati.nome}` : ""},</p>
    <p>Ecco il link per riaprire la tua guida quando vuoi: <strong>${dati.titoloGuida}</strong>.</p>
    ${bottone("Apri la guida", dati.linkGuida)}
    <p style="margin-top:24px;">A presto,<br />Il team KIREO</p>
  `);
}
