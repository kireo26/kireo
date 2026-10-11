// Cosa legge l'organizzatore sulla chiusura di una diretta.
//
// ⚠️ PERCHÉ È UN VALORE E NON TRE RAMI DENTRO IL JSX: una frase composta in un
// `.tsx` non si può provare da uno script Node, e qui le proprietà da tenere
// sono tre e nessuna si vede rileggendo (vedi `npm run test:chiusura`). Stessa
// forma di `lib/contatti/testi.ts`, `lib/guide/avvisoRifiuto.ts`,
// `lib/eventi/portaConsegna.ts`.
//
// ⚠️ LA FORMA «etichetta: numero» È DI MARIO E NON È ESTETICA: toglie l'accordo
// di genere e di numero. «Presenti: 1» e «Presenti: 12» sono la stessa frase con
// una cifra diversa; «1 presenti» è il difetto del giro dei plurali (9 punti
// censiti il 4/10, nessuno gestito). Il controllo pretende esattamente questo:
// cambiando i numeri, il testo deve differire SOLO nelle cifre.
//
// ⚠️ TRE ESITI E NON DUE, ed è il difetto da cui nasce tutto il giro: prima la
// seconda pressione rispondeva «0 nuove certificazioni», che si legge come
// «nessuno si è qualificato» — un'affermazione falsa sugli studenti al posto di
// «l'ho già fatto». Ora il database restituisce `gia_chiusa_il` e le due cose
// hanno due frasi (vedi `20261011100000_chiusura_diretta.sql`).
//
// ⚠️⚠️ LA RIGA DI STATO PORTA LA RICEVUTA, NON SOLO LO STATO (correzione di
// Mario, 11/10). La prima stesura diceva soltanto «è chiusa», e con quella il
// conto restava perso com'era: il difetto da cui nasce l'1.1 NON era «non si sa
// se è chiusa» — era che il messaggio verde con presenti e certificazioni viveva
// soltanto nello stato React di chi aveva premuto, e un F5 lo cancellava.
//
// Quindi la coda delle due frasi — l'esito di una pressione e la riga che si
// rilegge fra sei mesi — è LA STESSA, prodotta da `codaRicevuta` in un posto
// solo: sono lo stesso fatto in due momenti, e due copie divergerebbero. La
// sola differenza è la parola «Nuove», che al momento della pressione è vera e
// alla rilettura no, e `npm run test:chiusura` pretende esattamente quello: che
// i due testi coincidano a meno di quella parola.
//
// E LA SECONDA FRASE CHE AVEVO SCRITTO È USCITA («La chiusura si fa una volta
// sola: qui non c'è più niente da premere»), perché la ricevuta la rende
// inutile: *un bottone grigio invita a chiedersi perché; una riga che dice cosa
// è successo no* (Mario). Spiegare l'assenza del bottone serviva solo finché la
// riga non diceva niente.

import { formattaData, formattaDataOra, formattaOra, giorniDiCalendarioItaliani, stessoGiornoItaliano } from "@/lib/formato";

/** Chi ha chiuso: congelato come `certificata_da_tipo`, perché il ruolo di una persona cambia e il fatto no. */
export type ChiusuraDaTipo = "kireo" | "ente";

/** L'esito di una pressione del bottone. */
export type EsitoChiusura =
  /** Prima chiusura: l'ha fatta chi ha premuto, adesso. */
  | { tipo: "chiusa"; presenti: number; certificati: number }
  /** Era già chiusa — da un'altra sessione, o dall'altro moderatore un istante prima. */
  | { tipo: "gia_chiusa"; presenti: number; quando: string };

/** Cosa la chiusura ha prodotto: i due numeri che la riga di stato rilegge. */
export type RicevutaChiusura = { presenti: number; certificati: number };

/** Lo stato che il server conosce al caricamento della pagina, prima di qualunque pressione. */
export type StatoChiusura =
  | { tipo: "da_chiudere" }
  | { tipo: "chiusa"; quando: string; daTipo: ChiusuraDaTipo; ricevuta: RicevutaChiusura | null };

const CHI: Record<ChiusuraDaTipo, string> = {
  kireo: "da KIREO",
  ente: "dall'organizzatore",
};

/**
 * La coda della ricevuta: cosa la chiusura ha prodotto, con la forma «etichetta:
 * numero» che toglie l'accordo.
 *
 * ⚠️ UN POSTO SOLO PER DUE MOMENTI. `nuove` è vero subito dopo la pressione e
 * falso quando la riga si rilegge: è l'unica differenza fra le due frasi, e
 * tenerla qui è il modo di non avere due copie della stessa cosa.
 */
function codaRicevuta(presenti: number, certificati: number, nuove: boolean): string {
  if (certificati === 0) return `Presenti: ${presenti}. Nessuno ha raggiunto la soglia di presenza.`;
  return `Presenti: ${presenti}. ${nuove ? "Nuove certificazioni automatiche" : "Certificazioni automatiche"}: ${certificati}.`;
}

/**
 * Lo stato di partenza dalle colonne dell'evento.
 *
 * Il `tipo` arriva dal database come testo libero (il CHECK ammette solo i due
 * valori, ma una `select` non lo sa): un valore che non riconosciamo vale
 * `null`, e allora NON si dichiara una chiusura di cui non si sa dire l'autore —
 * meglio il bottone, che al massimo produce un «era già chiusa» onesto, che una
 * riga che afferma una cosa a metà.
 *
 * ⚠️ E LA RICEVUTA DEGRADA VERSO IL DIRE MENO: se uno dei due conteggi non
 * arriva, `ricevuta` è `null` e la riga dice soltanto quando e da chi, invece di
 * stampare un numero inventato. Dopo la migrazione dell'11/10 le due colonne
 * sono sempre scritte insieme alla traccia (il CHECK di completezza le tiene
 * tutte e cinque), quindi è un ramo che non si dovrebbe presentare — ma un
 * conteggio è un numero che finisce su un documento di scuola, e lì il ripiego
 * non si indovina.
 */
export function statoChiusura(dati: {
  chiusaIl: string | null;
  chiusaDaTipo: string | null;
  presenti?: number | null;
  certificati?: number | null;
}): StatoChiusura {
  if (!dati.chiusaIl) return { tipo: "da_chiudere" };
  if (dati.chiusaDaTipo !== "kireo" && dati.chiusaDaTipo !== "ente") return { tipo: "da_chiudere" };
  const ricevuta =
    typeof dati.presenti === "number" && typeof dati.certificati === "number"
      ? { presenti: dati.presenti, certificati: dati.certificati }
      : null;
  return { tipo: "chiusa", quando: dati.chiusaIl, daTipo: dati.chiusaDaTipo, ricevuta };
}

/**
 * Il testo dell'esito di una pressione. I tre casi sono di Mario, parola per
 * parola.
 *
 * L'ora porta l'anno («il 4 ottobre 2026 alle ore 19:20») perché
 * `lib/formato.ts` non ha uno stile giorno+mese senza anno, e aggiungerne uno
 * per una frase vorrebbe dire una seconda definizione di «come KIREO scrive una
 * data».
 */
export function testoEsitoChiusura(esito: EsitoChiusura): string {
  if (esito.tipo === "gia_chiusa") {
    return `Questa diretta era già stata chiusa il ${formattaDataOra(esito.quando, "long")}. Nessuna nuova certificazione.`;
  }
  return `Diretta chiusa. ${codaRicevuta(esito.presenti, esito.certificati, true)}`;
}

/**
 * La riga di stato che prende il posto del bottone su una diretta già chiusa.
 *
 * ⚠️ IL BOTTONE SPARISCE, non diventa disabilitato, ed è una scelta confermata
 * da Mario: una volta chiusa, ripremere non può produrre niente — mai, non «non
 * adesso». Un bottone disabilitato dice «qui c'è qualcosa da fare, ma non ora»,
 * che è falso; e la sua assenza non ha bisogno di essere spiegata perché la
 * ricevuta dice cosa è successo.
 *
 * ⚠️ «il» E NON «dal»: una diretta non è chiusa DA un momento, è stata chiusa
 * IN un momento. «Dal» suggerisce uno stato che dura, e qui il fatto è un gesto.
 *
 * L'ora porta l'anno per la stessa ragione dell'esito (vedi sopra).
 *
 * ⚠️ NOMINA IL RUOLO E NON LA RELAZIONE CON CHI LEGGE («da KIREO» /
 * «dall'organizzatore»), perché questa riga la leggono tutti e due e «l'hai
 * chiusa tu» sarebbe falsa per uno dei due — è la stessa ragione per cui questa
 * pagina è una sola invece di due gemelle.
 *
 * ⚠️⚠️ E NON IL NOME DELLA PERSONA — DECISO DA MARIO L'11/10, il ruolo. Lui lo
 * proponeva dove c'è («da Giulia C.»), e la ragione che lo ha chiuso è che il
 * nome comparirebbe per UN RUOLO E NON PER L'ALTRO: `chiusa_da_user` c'è, ma
 * `profiles_select_admin` fa vedere tutti i profili a un admin e nessuna policy
 * fa vedere all'ente il profilo dell'admin che ha chiuso. Sulla pagina
 * costruita apposta perché i due vedano la stessa cosa, «la ricevuta
 * diventerebbe due ricevute diverse dello stesso fatto — il difetto che la
 * pagina gemella doveva evitare, ricostruito dentro una riga». E una policy
 * nuova non si apre per questo: si cura dove il permesso è concesso, non dove
 * la riga è scritta, e qui non c'è niente da curare.
 *
 * ⚠️ LA CONDIZIONE CHE LA RIAPRE, e si può nominare: il giorno in cui un ente
 * ha DUE persone che possono chiudere una diretta, «dall'organizzatore» smette
 * di disambiguare — ed è esattamente il caso per cui esiste l'1.2a (due
 * moderatori ciechi l'uno dell'altro), applicato alla chiusura. Quel nome è di
 * un collega dello stesso ente, quindi si vede senza aprire nessuna policy.
 *
 * ⚠️ E LA DISTINZIONE DA TENERE, perché fra sei mesi la domanda si riapre dalla
 * parte sbagliata: **il nome serve dentro un ruolo, non fra i ruoli.** Il nome
 * dell'admin non diventa necessario mai — all'ente serve sapere che non è stato
 * lui, e «da KIREO» lo dice.
 */
export function testoStatoChiusura(stato: Extract<StatoChiusura, { tipo: "chiusa" }>): string {
  const testa = `Diretta chiusa il ${formattaDataOra(stato.quando, "long")}, ${CHI[stato.daTipo]}.`;
  if (!stato.ricevuta) return testa;
  return `${testa} ${codaRicevuta(stato.ricevuta.presenti, stato.ricevuta.certificati, false)}`;
}

// ─────────────────────────── «LA PAGINA NON SA CHE LA DIRETTA È FINITA» ──────
//
// ⚠️ IL DIFETTO (§4 del giro a schermo di Mario, 11/10/2026): su una diretta
// finita da una settimana la pagina diceva «Presenti ora: 0» — vero e falso
// insieme, perché si legge «a questo incontro non è venuto nessuno» — e accanto
// un bottone identico a quello di una diretta finita da venti minuti. Non due
// difetti: UNO, e la sua cornice è di Mario.
//
// QUATTRO FASI, e solo una ha un numero:
//   • prima           → NESSUN contatore, `testoPrimaDellaDiretta` (11/10, il
//                       quarto stato: vedi sotto)
//   • viva            → «Presenti ora: 12» + la riga di freschezza
//   • finita, non chiusa → NESSUN contatore e NESSUNA freschezza (senza un
//                         numero vivo la freschezza non sorveglia più niente),
//                         al loro posto `testoFinitaNonChiusa`
//   • chiusa          → la ricevuta, che c'era già
//
// ⚠️ PERCHÉ NON UN ALTRO NUMERO al posto del contatore: sarebbe o un doppione
// della ricevuta, o — a diretta finita e non chiusa — un numero che l'ente non
// può calcolare (`presenze_live` non ha policy di lettura per lui, di
// proposito). Stamparci uno zero sarebbe la terza volta in quattro giorni che
// uno zero dice «non c'era niente» dove la verità è «non è questa la domanda».
//
// ⚠️ IL QUARTO STATO, deciso da Mario l'11/10 (era un buco, e l'ho segnalato
// invece di sceglierlo): prima di `data_inizio` il battito non conta PER
// COSTRUZIONE (`20261004130000`), quindi «Presenti ora» lì può valere solo
// zero — e un numero che può avere un solo valore non è un'informazione, è un
// rumore che somiglia a una. Il moderatore che apre la pagina due minuti prima
// legge «nessuno» e sente «non sta funzionando» o «non è venuto nessuno»: due
// cose false, nel momento in cui è più in ansia. «Il contatore esiste solo
// finché può significare qualcosa.»

export type FaseContatore = "prima" | "viva" | "finita_non_chiusa" | "chiusa";

export function faseContatore(dati: {
  dataInizio: string;
  dataFine: string | null;
  chiusa: boolean;
  adesso: Date;
}): FaseContatore {
  if (dati.chiusa) return "chiusa";
  // Lo stesso confine di `evento_in_diretta` (`now() >= data_inizio`): da
  // quell'istante il battito conta, e il contatore può dire qualcosa.
  if (dati.adesso.getTime() < new Date(dati.dataInizio).getTime()) return "prima";
  // Senza una fine la diretta non può finire (e non si può nemmeno chiudere:
  // `chiudi_diretta_evento` lo rifiuta). Resta viva, cioè com'era.
  if (dati.dataFine && dati.adesso.getTime() >= new Date(dati.dataFine).getTime()) return "finita_non_chiusa";
  return "viva";
}

/**
 * Il testo che prende il posto del contatore PRIMA dell'inizio. Di Mario, con
 * la stessa deviazione degli altri due: se l'inizio non è oggi, la data
 * compare per intero («alle 19:15» da solo sembrerebbe di oggi — stessa ragione
 * della riga del tocco e dell'attesa di `lib/live.ts`).
 */
export function testoPrimaDellaDiretta(dataInizio: string, adesso: Date): string {
  const quando = stessoGiornoItaliano(dataInizio, adesso)
    ? `alle ${formattaOra(dataInizio)}`
    : `il ${formattaDataOra(dataInizio, "long")}`;
  return `La diretta comincia ${quando}. I presenti si contano da quel momento.`;
}

/**
 * Il testo che prende il posto del contatore su una diretta finita e non chiusa.
 * Di Mario, con una sola deviazione: la data porta l'anno e «alle ore», perché
 * è il solo stile giorno+ora che `lib/formato.ts` sa scrivere (stessa scelta,
 * stessa ragione, di `testoEsitoChiusura`).
 */
export function testoFinitaNonChiusa(dataFine: string): string {
  return `La diretta è finita il ${formattaDataOra(dataFine, "long")}. Le presenze si contano chiudendola.`;
}

// I giorni in lettere fino a dieci, poi in cifre: «sette giorni fa» si legge,
// «diciannove giorni fa» comincia a non leggersi più. Uno non c'è: per un
// giorno si dice «ieri», e «un giorno fa» sarebbe l'unico caso al singolare.
const GIORNI_IN_LETTERE: Record<number, string> = {
  2: "due",
  3: "tre",
  4: "quattro",
  5: "cinque",
  6: "sei",
  7: "sette",
  8: "otto",
  9: "nove",
  10: "dieci",
};

function quantoTempoFa(giorni: number): string {
  if (giorni === 1) return "ieri";
  return `${GIORNI_IN_LETTERE[giorni] ?? String(giorni)} giorni fa`;
}

/**
 * La riga sopra il bottone quando la diretta è finita in un GIORNO DIVERSO da
 * oggi, oppure `null`. Il bottone resta com'è: la riga fa il lavoro, dice il
 * vero e lascia decidere (Mario, §4b).
 *
 * ⚠️ LA CONDIZIONE NON È UNA SOGLIA A NUMERO TONDO: è il giorno di calendario
 * italiano. È esattamente il momento in cui una chiusura datata oggi diventa
 * straniante, ed è nominabile senza arbitrio.
 *
 * ⚠️ E DICE IL VERO PERCHÉ È STATO MISURATO, non dedotto: la ricevuta di una
 * chiusura tardiva non è falsa — `v_presenti` conta righe storiche, la
 * copertura viene dalla durata PROGRAMMATA, e `diretta_chiusa_il = now()`
 * registra il momento del gesto. Quindi «i presenti e le ore restano quelli di
 * allora, la data del gesto è questa» è letteralmente quello che la funzione fa.
 */
export function avvisoChiusuraTardiva(dataFine: string | null, adesso: Date): string | null {
  if (!dataFine) return null;
  const giorni = giorniDiCalendarioItaliani(dataFine, adesso);
  // Zero è oggi; un numero negativo vorrebbe dire una fine nel futuro, dove
  // il bottone non chiude comunque niente.
  if (giorni < 1) return null;
  const giorno = formattaData(dataFine, "long");
  return (
    `Questa diretta è finita il ${giorno}, ${quantoTempoFa(giorni)}. ` +
    `Se la chiudi adesso, la chiusura risulterà fatta oggi: i presenti e le ore restano quelli del ${giorno}, la data del gesto è questa.`
  );
}
