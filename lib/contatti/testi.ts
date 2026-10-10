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
 * Quello che è arrivato: su /contatti un MESSAGGIO, sulle tre landing una
 * RICHIESTA. Chi ha chiesto una bozza di convenzione ha fatto una richiesta;
 * chi ha scritto dal modulo ha scritto un messaggio.
 *
 * ⚠️ UNA TABELLA SOLA PER UN FATTO SOLO. La stessa distinzione serve in
 * QUATTRO punti — l'oggetto dell'email di conferma, l'oggetto della risposta
 * che Mario manda dalla coda, il titolo della conferma a schermo e il PRONOME
 * con cui la promessa dei tempi riprende la cosa — e quattro tabelle con la
 * stessa distinzione dentro sono quattro copie: divergono, è solo questione di
 * quando. Keyed sull'unione esatta, così una quinta origine deve dichiarare i
 * propri tre campi invece di prendere quelli di default.
 *
 * ⚠️ `pronome` esiste perché la promessa è UNA e il pronome con cui comincia
 * non può esserlo: «Lo leggiamo» dopo «Messaggio inviato» va, dopo «Richiesta
 * inviata» no. Senza, l'unica alternativa era togliere il «leggiamo» a tutti e
 * quattro — cioè perdere la cosa che quella frase dice davvero, che qualcuno
 * lo legge.
 */
export const COSA_E_ARRIVATO: Record<
  OrigineContatto,
  { nome: string; pronome: string; titoloConferma: string }
> = {
  dirigenti: { nome: "la tua richiesta", pronome: "La", titoloConferma: "Richiesta inviata" },
  scuole: { nome: "la tua richiesta", pronome: "La", titoloConferma: "Richiesta inviata" },
  enti: { nome: "la tua richiesta", pronome: "La", titoloConferma: "Richiesta inviata" },
  contatti: { nome: "il tuo messaggio", pronome: "Lo", titoloConferma: "Messaggio inviato" },
};

/** L'oggetto dell'email di conferma: la riga più letta dell'email. */
export function oggettoConferma(origine: OrigineContatto): string {
  return `Abbiamo ricevuto ${COSA_E_ARRIVATO[origine].nome} — KIREO`;
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
  //
  // ⚠️ E LA NOTA DEL TRONCAMENTO LA LEGGE CHI RICEVE, NON CHI COMPONE. Fino al
  // 10/10/2026 diceva «il testo completo è nella coda su /admin»: una frase
  // scritta per Mario, recapitata a un estraneo, con un riferimento a una
  // coda interna e a un indirizzo che non può aprire. **In un `mailto:` non
  // esiste la distinzione fra nota per chi compone e testo per chi riceve:
  // tutto quello che ci scrivi parte.** La riga nuova va bene per tutti e due
  // — innocua se Mario la lascia, e lui sa dove sta il testo intero.
  const MAX_CITATO = 1200;
  const troncato = r.messaggio.length > MAX_CITATO;
  const citato = (troncato ? r.messaggio.slice(0, MAX_CITATO) : r.messaggio)
    .split("\n")
    .map((riga) => `> ${riga}`)
    .join("\n");
  const coda = troncato ? "\n>\n> […] (qui la citazione è accorciata)" : "";
  const corpo = `\n\n---\nIl ${r.quando} ${r.nome} ha scritto:\n\n${citato}${coda}\n`;
  const oggetto = `Re: ${COSA_E_ARRIVATO[r.origine as OrigineContatto]?.nome ?? "la tua richiesta"} a KIREO`;
  return `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(oggetto)}&body=${encodeURIComponent(corpo)}`;
}

/**
 * LA FINESTRA DEI TEMPI: l'unico pezzo che deve essere identico in tutti e
 * sei i posti in cui una promessa di risposta arriva a qualcuno (quattro
 * conferme a schermo, due rami dell'email di conferma).
 *
 * ⚠️ ERANO DUE PROMESSE DIVERSE PER LA STESSA COSA, e non potevano essere
 * vere tutte e due (10/10/2026): le landing dicevano «Ti risponderemo entro
 * 24 ore» e /contatti «di solito entro un giorno o due». La stessa persona
 * può vederle tutte e due — un dirigente che scrive da /dirigenti e un mese
 * dopo da /contatti. **Mario ha deciso: si allinea tutto alla seconda.**
 * «Entro 24 ore» è una promessa rigida fatta da un progetto di una persona
 * sola, e la prima volta che un messaggio arriva il venerdì sera è già rotta
 * senza che nessuno se ne accorga, perché nessuno conta le ore. *Una promessa
 * che non si decide di mantenere è solo una promessa che non sappiamo di aver
 * rotto.*
 *
 * Se un giorno diventerà un impegno diverso — per esempio 24 ore vere, prese
 * davvero con le scuole — si cambia QUI, e cambia in tutti e sei.
 */
const FINESTRA_RISPOSTA = "di solito entro un giorno o due";

/**
 * La promessa dei tempi, detta uguale a schermo e nell'email.
 *
 * ⚠️ È UNA FUNZIONE E NON UNA COSTANTE per una ragione sola: il pronome.
 * «Lo leggiamo» regge dopo «Messaggio inviato» e dopo «Abbiamo ricevuto il
 * tuo messaggio»; dopo «Richiesta inviata» il pronome è «La». La finestra
 * resta una, il pronome viene da `COSA_E_ARRIVATO` — che è la stessa tabella
 * da cui vengono il nome e il titolo, quindi non c'è una seconda lista da
 * tenere in passo.
 *
 * La versione precisa è anche quella che possiamo mantenere, quindi non c'è
 * ragione di tenerne una annacquata — e «il prima possibile» davanti a una
 * finestra concreta la indebolisce invece di rafforzarla.
 */
export function promessaRisposta(origine: OrigineContatto): string {
  return `${COSA_E_ARRIVATO[origine].pronome} leggiamo e ti rispondiamo — ${FINESTRA_RISPOSTA}.`;
}

/**
 * La conferma che compare al posto del modulo — per TUTTE E QUATTRO le
 * origini, non più una qui e una dentro il componente.
 *
 * ⚠️ UNA FUNZIONE DELL'ORIGINE, E IL COMPONENTE NON LA RICEVE PIÙ COME PROP.
 * La conferma è una funzione pura di `origine`, che il form ha già: passarla
 * da fuori lasciava a una pagina la possibilità di passare quella sbagliata —
 * /contatti che dice «Richiesta inviata», o una landing che nomina un
 * messaggio. Ora una quinta origine deve dichiarare i suoi tre campi in
 * `COSA_E_ARRIVATO` e la conferma esce da sé.
 *
 * «Messaggio inviato» è la riga che resta identica a com'era: era la bugia più
 * vecchia del prodotto — la pagina la scriveva senza aver mandato niente — e
 * dal 10/10/2026 è vera.
 *
 * ⚠️ IL CORPO È UNO PER TUTTE E QUATTRO, e il 10/10 non lo era: le landing
 * dicevano «Controlla anche la posta indesiderata», che PRESUPPONE l'email
 * invece di nominarla — detta a chi non ha ricevuto niente, lo manda a cercare
 * una cosa che non esiste. Lo stesso difetto di /contatti, più mite, quindi la
 * stessa cura: il corpo nomina l'email, e quando non è partita cade insieme a
 * lei. Una cura sull'istanza che qualcuno ha notato avrebbe lasciato la
 * classe.
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
export function confermaPerOrigine(origine: OrigineContatto): {
  titolo: string;
  testo: string;
  testoSenzaConferma: string;
} {
  const promessa = promessaRisposta(origine);
  return {
    titolo: COSA_E_ARRIVATO[origine].titoloConferma,
    testo: `Grazie! ${promessa} Ti abbiamo mandato un'email di conferma: se non la vedi, controlla la posta indesiderata.`,
    testoSenzaConferma: `Grazie! ${promessa}`,
  };
}
