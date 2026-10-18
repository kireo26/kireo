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
// arrivato e ha retto la grazia, e la quarta voce spariva solo se la sonda
// aveva risposto — quindi ha girato, e su una
// DIRETTA PROGRAMMATA non ancora cominciata, che era il caso principale.
//
// E IL 18/10 HA RISPOSTO DUE VOLTE IN PIÙ, sullo stesso video: `disattivato`
// prima della cura e `attivo` dopo. Tre risposte, tre cause nominabili. L'unico
// silenzio osservato (`non_controllato`) aveva una ragione ESTERNA: la stessa
// pagina in una finestra in incognito, dove l'IFrame API non si carica perché
// gli script di terze parti sono bloccati (incognito, blocco dei cookie,
// estensioni). Quindi la sonda non è «inaffidabile su una diretta
// programmata»: il suo silenzio ha una causa comune, e il testo la nomina.
//
// ⚠️⚠️ DAL 18/10 SERA LA PERSONA NON DICHIARA PIÙ NIENTE SULL'INCORPORAMENTO
// (Mario). Quella sera «Allow embedding» era attivo alle 12:08, misurato
// «attivo» alle 12:09, e SPENTO alle 17:07 al Go live — e di nuovo a un
// salvataggio in Studio. Il fatto scade fra la dichiarazione e il momento in
// cui serve, quindi una dichiarazione non può coprirlo nemmeno in buona fede.
// Al suo posto la MISURA SI RIPETE: la console del moderatore rifà la sonda
// ogni due minuti a diretta aperta, e il player di ogni studente segnala il
// proprio errore. Dove la sonda del form non ha risposto, l'evento si salva
// `incorporamento_non_verificato`: un fatto su di noi, non una risposta
// dell'ente. La regola di prima resta vera e qui è diventata assoluta: una
// dichiarazione accanto a una misura è peggio di niente.

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


export type TestoSonda = {
  titolo: string;
  dettaglio: string;
  tono: "ok" | "errore" | "incerto";
  // Un link dove si FA la cosa che il testo chiede, quando c'è.
  azione?: { href: string; etichetta: string };
  // Il percorso da seguire DOPO aver aperto il link, reso in coda all'azione
  // («Aprilo qui → in fondo alla pagina…»). Senza un link (nessun id) si rende
  // dopo `aperturaSenzaLink`, così il percorso non resta senza un punto di
  // partenza.
  percorso?: string;
};

// ⚠️ TESTO MIO (Mario ha scritto solo la versione col link): quando non c'è un
// id non c'è un «qui» da aprire, e «Aprilo qui» punterebbe a niente.
export const APERTURA_SENZA_LINK = "Apri la scheda del video su YouTube Studio";

/**
 * Dove si attiva l'incorporamento di UN video: la sua scheda su YouTube
 * Studio. ⚠️ NON «le impostazioni della diretta», che era il testo di prima e
 * mandava nel posto sbagliato: Mario ci è andato il 18/10 e il riquadro
 * «Settings» delle dirette contiene solo l'overlay delle pause. L'opzione sta
 * nella scheda del video, sotto «Mostra altro» → «Licenza e distribuzione».
 * Ci abbiamo perso mezz'ora in due sapendo cosa cercavamo; un ente avrebbe
 * concluso che il problema era suo. L'id ce l'abbiamo già in mano quando
 * scriviamo il testo: si dà il link, non un percorso da seguire a memoria.
 */
export function urlStudioVideo(idVideo: string): string {
  return `https://studio.youtube.com/video/${encodeURIComponent(idVideo)}/edit`;
}

// Testi di Mario (18/10) dove dichiarato. «Un riquadro nero al posto tuo» dice
// la conseguenza invece della regola, che è la forma che in questo progetto
// funziona (la prima stesura diceva «al posto di te»: l'ha riscritta lui).
const TESTI: Record<EsitoSonda, TestoSonda> = {
  attivo: {
    titolo: "L'incorporamento è attivo.",
    dettaglio: "I ragazzi vedranno la diretta dentro KIREO, senza uscire dalla piattaforma.",
    tono: "ok",
  },
  incorporamento_disattivato: {
    titolo: "L'incorporamento è disattivato.",
    // Testo di Mario. I NOMI DELLE VOCI SONO IN DUE LINGUE, e non per scrupolo:
    // lo Studio di Mario — italiano, account italiano — è in INGLESE. La lingua
    // dell'interfaccia è una preferenza di account che nessuno ricorda di aver
    // scelto, quindi un testo con i soli nomi italiani falliva per chiunque
    // l'abbia in inglese. Quattro parole fra parentesi tolgono l'unico modo in
    // cui questo testo può fallire di nuovo. ⚠️ I nomi ITALIANI restano non
    // visti a schermo da nessuno di noi; quelli inglesi sì.
    dettaglio: "Così i ragazzi vedrebbero un riquadro nero al posto tuo.",
    percorso:
      "in fondo alla pagina, «Mostra altro» (Show more) → «Licenza e distribuzione» (License and distribution) → «Consenti incorporamento» (Allow embedding). Poi torna e reincolla il link qui.",
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
    // Testo di Mario (18/10). La causa più comune di questo silenzio è un
    // browser che blocca gli script di YouTube, e chi legge «non abbiamo potuto
    // controllare» non ha nessun motivo di sospettare della propria finestra:
    // un'azione che può compiere, al posto di un'informazione su cui non può
    // fare niente. «Succede spesso», non «quasi sempre»: è la causa che
    // conosciamo, non l'unica.
    dettaglio:
      "Non vuol dire che ci sia un problema: vuol dire che non lo sappiamo. Succede spesso in incognito, dove il nostro controllo non riesce a partire: se è il tuo caso, riapri questa pagina in una finestra normale.",
    tono: "incerto",
  },
};

export function testoSonda(esito: EsitoSonda, idVideo: string | null = null): TestoSonda {
  const testo = TESTI[esito];
  if (esito === "incorporamento_disattivato" && idVideo) {
    return { ...testo, azione: { href: urlStudioVideo(idVideo), etichetta: "Aprilo qui" } };
  }
  return testo;
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
//
// ⚠️⚠️ «LO STIAMO SEGNALANDO A CHI LO TRASMETTE» ERA FALSO FINO AL 18/10: la
// pagina lo diceva allo studente e a chi trasmetteva non arrivava niente — per
// un'ora, durante una diretta vera, con Mario che trasmetteva davanti a nessuno
// credendo che funzionasse. Da allora la frase è VERA PER COSTRUZIONE: compare
// solo se `segnala_player_live` è andata a buon fine, cioè se la console del
// moderatore conta questo studente fra quelli che non vedono. Se la
// segnalazione non riesce, la frase NON si dice — `testoDirettaRotta(false)`.
// ⚠️ La seconda frase («riproviamo da soli…») è mia e va riletta (voce).
export function testoDirettaRotta(segnalato: boolean): { titolo: string; dettaglio: string } {
  const base =
    "Non è colpa tua e non è il tuo collegamento: il video è stato pubblicato in modo che non si possa riprodurre dentro KIREO.";
  const segnalazione = segnalato ? " Lo stiamo segnalando a chi lo trasmette." : "";
  return {
    titolo: "La diretta non si vede qui",
    dettaglio: `${base}${segnalazione} Riproviamo da soli ogni minuto: se il problema si risolve, il video compare qui senza ricaricare. Le domande qui sotto funzionano comunque.`,
  };
}

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
