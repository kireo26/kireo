// I testi di /contatti che vivono in più di un posto.
//
// PERCHÉ ESISTE (10/10/2026). La conferma a schermo diceva «ti rispondiamo il
// prima possibile» e l'email di conferma «ti rispondiamo il prima possibile —
// di solito entro un giorno o due»: la stessa promessa detta due volte, e
// detta diversa. Chi legge solo lo schermo riceve meno; chi legge tutti e due
// si chiede quale vale.
//
// La cura di casa per due copie non è tenerle in passo a mano: è che ce ne sia
// una. La promessa sta qui, e la pagina e il template dell'email la montano
// dentro le loro frasi, che restano diverse — l'email si apre con «Abbiamo
// ricevuto il tuo messaggio», lo schermo ha già il titolo che lo dice. Quello
// che deve essere identico è la PROMESSA, non la frase intorno.
//
// ⚠️ È una promessa sui nostri tempi, quindi cambiarla qui la cambia in tutti
// e due i posti: è il senso di questo file. Chi la ritocca sta ritoccando
// quello che un ragazzo e un dirigente leggono, non una stringa.

export type OrigineContatto = "dirigenti" | "scuole" | "enti" | "contatti";

/**
 * Come si chiama quello che è arrivato: su /contatti un MESSAGGIO, sulle tre
 * landing una RICHIESTA. Chi ha chiesto una bozza di convenzione ha fatto una
 * richiesta; chi ha scritto dal modulo ha scritto un messaggio.
 *
 * ⚠️ UNA TABELLA SOLA PER UN FATTO SOLO. La stessa distinzione serve in due
 * punti — l'oggetto dell'email di conferma, e l'oggetto della risposta che
 * Mario manda dalla coda — e due tabelle con la stessa distinzione dentro sono
 * due copie: divergono, è solo questione di quando. Keyed sull'unione esatta,
 * così una quinta origine deve dichiarare il proprio nome invece di prendere
 * quello di default.
 */
export const NOME_RICHIESTA: Record<OrigineContatto, string> = {
  dirigenti: "la tua richiesta",
  scuole: "la tua richiesta",
  enti: "la tua richiesta",
  contatti: "il tuo messaggio",
};

/** L'oggetto dell'email di conferma: la riga più letta dell'email. */
export function oggettoConferma(origine: OrigineContatto): string {
  return `Abbiamo ricevuto ${NOME_RICHIESTA[origine]} — KIREO`;
}

/**
 * Il `mailto:` del bottone «Rispondi» nella coda admin: destinatario, oggetto
 * che richiama il messaggio, e il testo originale citato sotto con lo spazio
 * vuoto sopra per scrivere.
 *
 * ⚠️ PERCHÉ UN `mailto:` E NON UNA RISPOSTA DENTRO KIREO. Un testo scritto da
 * qui partirebbe da `noreply@`, quindi chi lo riceve non potrebbe rispondere a
 * sua volta; o gli si mette un Reply-To, e allora la sua controrisposta
 * arriva in casella, fuori da qui. In tutti e due i casi la coda mostrerebbe
 * quello che abbiamo scritto noi e non quello che ci ha risposto lui: un
 * registro che sembra una conversazione e ne contiene metà. Un archivio che
 * mostra un lato solo di uno scambio è peggio di nessun archivio, perché chi
 * lo apre non sa che manca qualcosa. Così invece lo scambio intero —
 * richiesta, risposta, controrisposta — vive nella casella, in un posto solo.
 *
 * ⚠️ QUANDO VARRÀ LA PENA COSTRUIRLA DENTRO: il giorno in cui la coda la
 * gestisce qualcuno oltre a Mario. Allora «chi ha risposto cosa» serve a due
 * persone e diventa un dato. Scritto qui perché la decisione di oggi non
 * sembri una dimenticanza fra sei mesi.
 */
export function mailtoRisposta(r: {
  origine: string;
  nome: string;
  email: string;
  messaggio: string;
  quando: string;
}): string {
  // ⚠️ IL MESSAGGIO CITATO SI TRONCA DICENDOLO. Un `mailto:` lunghissimo lo
  // troncano i client di posta, ognuno a modo suo: mezzo messaggio davanti a
  // chi risponde, con l'aria di essere intero, è la specie di casa. Qui si
  // taglia a una misura che sta in piedi ovunque e si DICE che è tagliato.
  const MAX_CITATO = 1200;
  const troncato = r.messaggio.length > MAX_CITATO;
  const citato = (troncato ? r.messaggio.slice(0, MAX_CITATO) : r.messaggio)
    .split("\n")
    .map((riga) => `> ${riga}`)
    .join("\n");
  const coda = troncato ? "\n>\n> […] messaggio troncato: il testo completo è nella coda su /admin." : "";
  const corpo = `\n\n---\nIl ${r.quando} ${r.nome} ha scritto:\n\n${citato}${coda}\n`;
  const oggetto = `Re: ${NOME_RICHIESTA[r.origine as OrigineContatto] ?? "la tua richiesta"} a KIREO`;
  return `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
}

/**
 * I tempi di risposta, detti uguale a schermo e nell'email.
 *
 * La versione precisa è anche quella che possiamo mantenere, quindi non c'è
 * ragione di tenerne una annacquata — e «il prima possibile» davanti a una
 * finestra concreta la indebolisce invece di rafforzarla.
 */
export const PROMESSA_RISPOSTA = "Lo leggiamo e ti rispondiamo — di solito entro un giorno o due.";

/**
 * La conferma che compare al posto del modulo, su /contatti.
 *
 * «Messaggio inviato» è la riga che resta identica a com'era: era la bugia più
 * vecchia del prodotto — la pagina la scriveva senza aver mandato niente — e
 * dal 10/10/2026 è vera.
 *
 * ⚠️ DUE TESTI, PERCHÉ L'EMAIL DI CONFERMA PUÒ NON PARTIRE — e il 10/10/2026
 * non è partita. Mario ha mandato un messaggio dalla produzione alle 13:26: la
 * riga è arrivata in coda (quindi il messaggio c'era), e Brevo ha BLOCCATO
 * l'email perché l'IP di Vercel non era fra quelli autorizzati. La pagina gli
 * ha detto comunque «Ti abbiamo mandato un'email di conferma: se non la vedi,
 * controlla la posta indesiderata» — un'affermazione falsa, e per giunta
 * appoggiata a una vera («il messaggio è arrivato») di cui eredita la
 * credibilità: la stessa forma del file di export che scriveva `[]` dove non
 * aveva guardato. E non l'abbiamo solo affermata: l'abbiamo mandato a cercarla
 * nello spam.
 *
 * ⚠️ E IL CASO NON È RARO: gli IP autorizzati su Brevo erano UNDICI, cioè è
 * già successo dieci volte e ogni volta qualcuno ha autorizzato a mano.
 * Finché quell'elenco esiste, un invio fallito è un evento normale.
 *
 * `testoSenzaConferma` NON si scusa e non spiega niente, ed è voluto: dal
 * punto di vista di chi scrive non è successo niente di male — il messaggio è
 * arrivato, qualcuno lo leggerà. L'email era una cortesia, e una cortesia
 * mancata non merita un allarme: «non siamo riusciti a mandarti la conferma»
 * lo farebbe dubitare di una cosa che invece ha funzionato. È la prima volta
 * che la cura di una frase falsa è TOGLIERE mezza frase invece di
 * aggiungerne una — non tutte le reticenze sono bugie, e una promessa che non
 * facciamo non ha bisogno di essere spiegata.
 *
 * La traccia dell'invio fallito serve a noi e sta altrove: la route registra
 * un guasto `email_contatto`, perché quel blocco di Brevo lo abbiamo scoperto
 * solo perché Mario stava guardando.
 */
export const CONFERMA_CONTATTI = {
  titolo: "Messaggio inviato",
  testo: `Grazie! ${PROMESSA_RISPOSTA} Ti abbiamo mandato un'email di conferma: se non la vedi, controlla la posta indesiderata.`,
  testoSenzaConferma: `Grazie! ${PROMESSA_RISPOSTA}`,
};
