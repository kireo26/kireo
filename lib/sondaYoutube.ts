// LA SONDA DELL'INCORPORAMENTO — la parte pura.
//
// IL DIFETTO CHE CHIUDE. Fino al 4/10 il form dell'ente faceva dichiarare
// all'ente, con una spunta, che l'incorporamento del suo video era attivo —
// e noi registravamo quella dichiarazione come un fatto. Un ente in buona
// fede la spunta e si sbaglia; un ente di fretta la spunta e basta. In tutti
// e due i casi il prodotto scrive «verificato» e il prezzo lo paga una
// classe, in diretta, quando non c'è più modo di rimediare: al posto del
// video i ragazzi leggono «La riproduzione su altri siti web è stata
// disattivata dal proprietario del video».
//
// È una variante della specie di casa: non una cosa scritta che dichiara uno
// stato diverso dal vero, ma una cosa scritta DA UN TERZO che noi registriamo
// come se l'avessimo verificata. E qui si può misurare: l'IFrame API di
// YouTube risponde con l'errore 101 (o 150, che è lo stesso) quando il
// proprietario ha disattivato l'incorporamento. Nessuna chiave, nessuna
// chiamata a pagamento, nessun account.
//
// QUATTRO ESITI, NON DUE, e il confine fra gli ultimi due è la regola di
// casa `zero ≠ non ho guardato`:
//
//   - `attivo`                      il player ha caricato il video senza errori
//   - `incorporamento_disattivato`  101/150: la cosa esatta che la spunta dichiarava
//   - `non_disponibile`             QUALUNQUE altro errore: il player ha risposto
//                                   e ha detto no (rimosso, privato, id sbagliato,
//                                   non riproducibile). Non sappiamo attribuirlo
//                                   all'incorporamento, ma sappiamo che quel video
//                                   lì dentro non si vede.
//   - `non_controllato`             NESSUNA risposta: l'API non si è caricata, è
//                                   scaduta l'attesa, o non c'era un id da provare.
//                                   Non è «va bene» e non è «è rotto»: è «non ho
//                                   guardato», e si dice.
//
// Un codice di errore che non riconosciamo cade in `non_disponibile` e NON in
// `non_controllato`: un errore ricevuto è una risposta, e metterlo fra i
// silenzi vorrebbe dire dichiarare di non aver guardato una cosa che abbiamo
// guardato. `non_controllato` resta riservato all'assenza di risposta.
//
// LA SONDA HA RISPOSTO SU UN VIDEO VERO, la sera del 4/10 — e questo era il
// ⚠️ che stava qui. Dalla riga in database dopo la prima diretta:
// `incorporamento_sonda = "attivo"` con una checklist di TRE voci. Le due cose
// insieme non si producono per caso — `"attivo"` esiste solo se `onReady` è
// arrivato e ha retto la grazia, e la quarta voce sparisce solo se
// `serveDichiarazioneIncorporamento` ha detto no — quindi ha girato, e su una
// DIRETTA PROGRAMMATA non ancora cominciata, che era il caso principale.
//
// È UN DATO DI UNA RIGA SOLA, quindi la spunta `incorporamento_attivo` non è
// stata rimossa in assoluto: esce dove la sonda ha risposto e torna dove
// non ha potuto. Il segnale da leggere è l'opposto: se i referti «non abbiamo
// potuto controllare» diventano la norma, la sonda su una diretta programmata
// non risponde e il lavoro torna lì, non sulla casella.
//
// LE DUE COSE NON STANNO MAI INSIEME A SCHERMO — una
// dichiarazione accanto a una misura è peggio di niente, perché la prima
// volta che divergono nessuno sa a quale credere. Qui la dichiarazione è il
// RIPIEGO di quando la misura manca, e la misura, quando c'è, vince.

export type EsitoSonda = "attivo" | "incorporamento_disattivato" | "non_disponibile" | "non_controllato";

// Quanto si attende una risposta del player prima di dichiarare di non aver
// potuto controllare. L'errore 101/150 arriva con i metadati, quindi presto:
// otto secondi sono larghi apposta, perché scadere troppo presto su una
// connessione lenta produrrebbe un «non ho guardato» che in realtà era un
// «non ho aspettato».
export const MS_ATTESA_SONDA = 8000;

// Codici dell'IFrame API che dicono esattamente «il proprietario non permette
// la riproduzione in player incorporati». 150 è 101 travestito.
const CODICI_INCORPORAMENTO = [101, 150];

export function esitoDaCodiceErrore(codice: number): EsitoSonda {
  if (CODICI_INCORPORAMENTO.includes(codice)) return "incorporamento_disattivato";
  return "non_disponibile";
}

// Quali esiti rifiutano il link. `non_controllato` NON blocca: rifiutare un
// link buono perché la nostra sonda non si è caricata sarebbe un no dato per
// un difetto nostro.
export function sondaBlocca(esito: EsitoSonda): boolean {
  return esito === "incorporamento_disattivato" || esito === "non_disponibile";
}

// La spunta della checklist esiste SOLO dove la misura non c'è. Vedi la nota
// in testa: mai una dichiarazione accanto a una misura.
export function serveDichiarazioneIncorporamento(esito: EsitoSonda | null): boolean {
  return esito === null || esito === "non_controllato";
}

export type TestoSonda = { titolo: string; dettaglio: string; tono: "ok" | "errore" | "incerto" };

// ⚠️ TESTI DA RILEGGERE (voce). «un riquadro nero al posto di te» è di Mario
// e resta sua parola per parola: dice la conseguenza invece della regola, che
// è la forma che in questo progetto funziona.
const TESTI: Record<EsitoSonda, TestoSonda> = {
  attivo: {
    titolo: "L'incorporamento è attivo.",
    dettaglio: "I ragazzi vedranno la diretta dentro KIREO, senza uscire dalla piattaforma.",
    tono: "ok",
  },
  incorporamento_disattivato: {
    titolo: "L'incorporamento è disattivato.",
    dettaglio:
      "Così i ragazzi vedrebbero un riquadro nero al posto di te. Aprilo da YouTube Studio, nelle impostazioni della diretta, poi incolla di nuovo il link qui.",
    tono: "errore",
  },
  non_disponibile: {
    titolo: "Questo video non si riproduce.",
    dettaglio:
      "Su YouTube risulta rimosso, privato, oppure non riproducibile. Controlla che la visibilità sia \"Non in elenco\": una diretta \"Privata\" non si vede nemmeno dal link.",
    tono: "errore",
  },
  non_controllato: {
    titolo: "Non abbiamo potuto controllare il video da qui.",
    dettaglio:
      "Non vuol dire che ci sia un problema: vuol dire che non lo sappiamo. Controlla tu che l'incorporamento sia attivo e confermalo qui sotto.",
    tono: "incerto",
  },
};

export function testoSonda(esito: EsitoSonda): TestoSonda {
  return TESTI[esito];
}

// ⚠️ TESTO DA RILEGGERE (voce): è quello che legge uno STUDENTE in diretta,
// e lo scrive Mario. Questa è la stesura di servizio perché la pagina non
// resti muta: dice che è rotto, che non è colpa sua, e che quello che può
// fare lo può fare comunque.
//
// Perché la pagina NON dichiara l'evento non seguibile e resta aperta: le
// domande in diretta e la consegna finale funzionano lo stesso, e sono le
// sole cose che da quel momento possono ancora produrre qualcosa. Chiudere
// la pagina toglierebbe anche a lui il modo di dire qualcosa.
export const TESTO_DIRETTA_ROTTA: { titolo: string; dettaglio: string } = {
  titolo: "La diretta non si vede qui",
  dettaglio:
    "Non è colpa tua e non è il tuo collegamento: il video è stato pubblicato in modo che non si possa riprodurre dentro KIREO. Lo stiamo segnalando a chi lo trasmette. Le domande qui sotto funzionano comunque.",
};

// SMETTIAMO DI CONTARE, ed è la parte che conta più del resto. Tenere
// qualcuno su una pagina dove il video non si vede e registrargli una
// presenza è un falso che scriviamo noi: quei ping dicono «era qui a
// seguire» e la persona sta guardando un riquadro nero. Da quei ping escono
// le ore PCTO. Meglio un evento senza presenze di un registro di presenze
// finte: il primo è un guasto, il secondo è una bugia certificata.
//
// I ping GIÀ registrati non si scontano: l'errore può comparire a diretta
// iniziata (un blocco per copyright, il proprietario che cambia
// un'impostazione) e quei minuti erano veri. Si smette in avanti.
export function presenzaDaContare(esito: EsitoSonda | null): boolean {
  if (esito === null) return true;
  return !sondaBlocca(esito);
}
