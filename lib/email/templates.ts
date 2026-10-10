// Template email transazionali (HTML minimale, inline styles per
// compatibilità coi client di posta — niente CSS esterno, niente dark
// theme del sito: uno sfondo chiaro resta il più leggibile ovunque).
//
// ⚠️ OGNI VALORE INTERPOLATO PASSA DA `esc()`. Fino al 5/10/2026 nessuno ci
// passava, e questi template interpolano stringhe che arrivano dal corpo di una
// richiesta HTTP: `templateFollowUpGuida` era raggiungibile da chiunque senza
// sessione (`/api/guida-email`), quindi il nome e il titolo in grassetto
// potevano scrivere markup arbitrario dentro un'email mandata da
// `noreply@kireo.it` con SPF e DKIM validi — cioè il contenuto visibile di
// un'email autentica a nome nostro lo scriveva chi chiamava.
//
// Non si decide se le stringhe di un utente debbano poter scrivere markup: non
// devono. `npm run test:email` pretende che ogni `${…}` dentro un template
// passi da `esc()` o da un valore di cui si conosce la provenienza — così il
// prossimo template non nasce senza.

import { SITE_URL, EMAIL_PUBBLICA } from "@/lib/site";
import { PROMESSA_RISPOSTA } from "@/lib/contatti/testi";

// Escape per il CONTESTO TESTO e per il CONTESTO ATTRIBUTO insieme: le
// virgolette ci sono apposta, perché gli stessi valori finiscono dentro un
// `href="…"` (vedi `bottone`), e là basta una virgoletta per uscire
// dall'attributo.
export function esc(valore: string | null | undefined): string {
  return String(valore ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ⚠️ UN LINK IN UNA NOSTRA EMAIL È http O https, E NIENT'ALTRO. L'escape
// impedisce di uscire dall'attributo, non di metterci dentro uno schema che
// esegue (`javascript:`) o che apre un'app. Qui si FALLISCE invece di
// degradare: chi compone l'email deve accorgersene e non mandarla, perché un
// bottone rotto in un'email non si corregge dopo l'invio.
export function linkSicuro(href: string): string {
  const pulito = href.trim();
  if (!/^https?:\/\//i.test(pulito)) {
    throw new Error(`link non ammesso in un'email: lo schema deve essere http o https (ricevuto: ${pulito.slice(0, 40)})`);
  }
  return pulito;
}

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
              <td style="padding:0 32px 24px;font-size:12px;color:#9A9890;line-height:1.6;">
                KIREO — Orientamento. Direzione. Futuro. — kireo.it
                <br />
                <a href="${SITE_URL}/disiscrizione" style="color:#9A9890;text-decoration:underline;">Disiscriviti dalle comunicazioni facoltative</a>
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
  return `<a href="${esc(linkSicuro(href))}" style="display:inline-block;margin-top:16px;padding:12px 24px;background-color:#0F6E56;color:#F0EDE8;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;">${esc(testo)}</a>`;
}

type OrigineRichiesta = "dirigenti" | "scuole" | "enti" | "contatti";

const ETICHETTA_ORIGINE: Record<OrigineRichiesta, string> = {
  dirigenti: "Dirigenti Scolastici",
  scuole: "referenti orientamento e docenti",
  enti: "istituzioni formative",
  contatti: "chi ci scrive",
};

// ⚠️ LA FRASE CHE DICEVA «RISPONDI PURE A QUESTA EMAIL», E PERCHÉ NON LA DICE
// PIÙ (10/10/2026). Il mittente è `noreply@kireo.it`, che non riceve: chi
// rispondeva scriveva a una casella muta e non lo scopriva — l'email parte e
// sparisce. Era in TUTTI E DUE i rami, e in quello delle landing dal 25
// luglio: la cura sta sulla classe, non sull'istanza che qualcuno ha notato.
//
// Adesso `inviaEmail` manda un `Reply-To: info@kireo.it`, quindi chi premesse
// «rispondi» passerebbe comunque — ma la frase che lo PROMETTE si scrive dopo
// la prova dal vivo, non prima: se Brevo ignorasse quel campo, un «rispondi a
// questa email» fallirebbe in silenzio, che è la direzione peggiore per una
// cosa che non si può ritirare. Un indirizzo da copiare è vero in ogni caso.
//
// ⚠️ L'INDIRIZZO È TESTO E NON UN LINK, di proposito: `linkSicuro` rifiuta
// ogni schema che non sia http/https — `mailto:` compreso, e c'è
// un'asserzione che lo pretende — perché uno schema che apre un'app in
// un'email nostra è la cosa da cui quella funzione protegge. I client di
// posta linkificano un indirizzo da soli.
const COME_AGGIUNGERE_QUALCOSA = `Se vuoi aggiungere qualcosa, scrivici a ${EMAIL_PUBBLICA}.`;

export function templateConfermaRichiestaContatto(nome: string, origine: OrigineRichiesta): string {
  // Su /contatti la frase delle landing («la tua richiesta di informazioni su
  // KIREO per …») non regge: chi scrive da lì può aver chiesto qualunque cosa.
  // Ramo suo, e la promessa dei tempi arriva da `lib/contatti/testi.ts`, lo
  // stesso posto da cui la prende la conferma a schermo.
  if (origine === "contatti") {
    return involucroEmail(`
      <p>Ciao ${esc(nome)},</p>
      <p>Abbiamo ricevuto il tuo messaggio. ${PROMESSA_RISPOSTA}</p>
      <p>${COME_AGGIUNGERE_QUALCOSA}</p>
      <p>A presto,<br />Il team KIREO</p>
    `);
  }
  return involucroEmail(`
    <p>Ciao ${esc(nome)},</p>
    <p>Abbiamo ricevuto la tua richiesta di informazioni su KIREO per ${ETICHETTA_ORIGINE[origine]}. Ti ricontatteremo entro 24 ore.</p>
    <p>Nel frattempo, se hai altre domande, scrivici a ${EMAIL_PUBBLICA}.</p>
    <p>A presto,<br />Il team KIREO</p>
  `);
}

export function templateNotificaRichiestaContatto(dati: {
  origine: OrigineRichiesta;
  nome: string;
  ruolo: string;
  /** null per origine=contatti: la colonna è nullable, chi scrive può non avere un istituto da dichiarare. */
  istituto: string | null;
  codiceMeccanografico: string | null;
  email: string;
  messaggio: string;
}): string {
  // Il riquadro scappa i suoi due argomenti DENTRO, non fuori: un aiutante
  // che si fa passare valori già scappati è la forma che un giorno qualcuno
  // chiama con un valore grezzo, e `npm run test:email` farebbe bene a
  // gridare — gli argomenti passano crudi e li scappa lui.
  const riga = (etichetta: string, valore: string) =>
    `<tr><td style="padding:4px 0;color:#9A9890;">${esc(etichetta)}</td><td style="padding:4px 0;">${esc(valore)}</td></tr>`;
  return involucroEmail(`
    <p>Nuova richiesta di informazioni da <strong>${esc(dati.origine)}</strong>.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:8px;">
      ${riga("Nome", dati.nome)}
      ${riga("Ruolo", dati.ruolo)}
      ${dati.istituto ? riga("Istituto", dati.istituto) : ""}
      ${dati.codiceMeccanografico ? riga("Codice meccanografico", dati.codiceMeccanografico) : ""}
      ${riga("Email", dati.email)}
    </table>
    <p style="margin-top:16px;color:#9A9890;">Messaggio</p>
    <p style="white-space:pre-wrap;">${esc(dati.messaggio)}</p>
  `);
}

export function templateFollowUpGuida(dati: { nome: string; titoloGuida: string; linkGuida: string }): string {
  return involucroEmail(`
    <p>Ciao${dati.nome ? ` ${esc(dati.nome)}` : ""},</p>
    <p>Ecco il link per riaprire la tua guida quando vuoi: <strong>${esc(dati.titoloGuida)}</strong>.</p>
    ${bottone("Apri la guida", dati.linkGuida)}
    <p style="margin-top:24px;">A presto,<br />Il team KIREO</p>
  `);
}
