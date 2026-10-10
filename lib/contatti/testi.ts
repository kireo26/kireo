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
 * ⚠️ UNA TABELLA SOLA PER UN FATTO SOLO. La stessa distinzione serve in TRE
 * punti — l'oggetto dell'email di conferma, il titolo della conferma a schermo
 * e il PRONOME con cui la promessa dei tempi riprende la cosa — e tre tabelle
 * con la stessa distinzione dentro sono tre copie: divergono, è solo questione
 * di quando. Keyed sull'unione esatta, così una quinta origine deve dichiarare
 * i propri tre campi invece di prendere quelli di default.
 *
 * (Erano quattro: il quarto era l'oggetto della risposta che Mario mandava dal
 * bottone «Rispondi» della coda, uscito il 10/10/2026 insieme al bottone.)
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
 * L'oggetto dell'AVVISO INTERNO, quello che arriva a noi.
 *
 * ⚠️ LO LEGGONO IN DUE, E IL SECONDO NON C'ERA QUANDO È STATO SCRITTO. Per noi
 * è la riga di una coda: dice chi ha scritto e di che si tratta. Ma dall'11/10
 * l'avviso porta un `Reply-To` verso chi ha scritto, quindi premere «rispondi»
 * **fa diventare questa riga l'oggetto di una risposta a lui** — con un «Re: »
 * davanti. Quindi qui non va niente che sia nostro e solo nostro.
 *
 * Il caso vero: diceva «Nuovo messaggio da /contatti — Mario», e `/contatti` è
 * un percorso del sito, che per chi lo riceve non vuol dire niente. Non è una
 * perdita: l'origine sta già nel CORPO dell'avviso e nel badge della coda, e
 * ripeterla nell'oggetto era una cosa in più da leggere per noi e una cosa
 * incomprensibile per lui. (Stessa specie della nota del troncamento: un testo
 * scritto per noi che, cambiando chi lo riceve, è uscito di casa senza che
 * nessuno lo riscrivesse.)
 *
 * ⚠️ GLI ALTRI DUE RAMI PORTANO UNA PAROLA, NON UN IDENTIFICATORE, ed è la
 * ragione per cui restano: «dirigenti» in «Nuova richiesta (dirigenti) da …» si
 * legge come una categoria anche da fuori. La riga che un domani non deve
 * rientrare è un percorso, un id, uno slug — e `npm run test:email` la
 * pretende, su tutti e tre i rami.
 */
export function oggettoNotifica(
  origine: OrigineContatto,
  dati: { nome: string; istituto: string | null },
): string {
  if (origine === "enti") return "Richiesta informazione ente formativo";
  if (origine === "contatti") return `Nuovo messaggio da ${dati.nome}`;
  return `Nuova richiesta (${origine}) da ${dati.istituto ?? dati.nome}`;
}

/*
 * ⚠️ QUI C'ERA `mailtoRisposta`, IL `mailto:` DEL BOTTONE «RISPONDI» DELLA CODA
 * ADMIN, ed è uscita il 10/10/2026 — il giorno dopo essere stata scritta,
 * misurando come Mario lavora davvero invece di come avevamo immaginato.
 *
 * Un `mailto:` apre il programma di posta PREDEFINITO del computer, e quello
 * del Mac di Mario è configurato con il suo indirizzo personale: il bottone
 * costruito per rispondere a nome di KIREO componeva un messaggio da un
 * indirizzo privato verso un dirigente scolastico che aveva scritto a
 * kireo.it. **E un `mailto:` non può scegliere il mittente**: lo decide il
 * programma di posta, non noi — quindi non è un difetto che si aggiusta
 * aggiungendo un parametro.
 *
 * Nessuna guardia poteva prenderlo: non è un difetto del codice, è un difetto
 * del modello che avevamo dell'utente. Avevamo assunto che chi apre la coda
 * abbia `info@kireo.it` nel proprio programma di posta; lui quella casella la
 * legge da webmail, nel browser. L'assunzione non era nemmeno nominata, quindi
 * non c'era niente da verificare.
 *
 * La strada vera è il `Reply-To` sull'avviso che arriva a `info@kireo.it`
 * (`app/api/richiesta-contatto/route.ts`): si risponde da dove si sta
 * leggendo, senza passare da /admin e senza copiare niente. Nella coda resta
 * l'indirizzo di chi ha scritto, `select-all`, per chi vuole scrivere da zero.
 *
 * Non si riscrive. Se un giorno servisse un gesto di risposta dalla coda, la
 * domanda da fare PRIMA è da quale casella parte quello che manda.
 */

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
