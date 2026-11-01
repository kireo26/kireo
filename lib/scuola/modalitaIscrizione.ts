// COME SI ISCRIVE UNA CLASSE A UN EVENTO: le due parole che legge il referente
// (Mario, 01/11).
//
// Fino a oggi le opzioni erano «In presenza (individuale)» e «A distanza
// (gruppo)», e dicevano il contrario di quello che succede: tutti gli incontri
// sono online, e un referente che legge «in presenza» organizza un'aula fisica.
// Quello che distingue i due casi non è dove sta la gente, è CHI MISURA LA
// PRESENZA: ognuno dal proprio account (la misura KIREO, dal collegamento), o un
// collegamento solo per la classe (la certifica la scuola, dal registro). È la
// metà che cambia il lavoro del referente, quindi la riga sotto la scelta la dice.
//
// I valori nel database restano `individuale` e `dad`: una parola con una storia
// non si tocca. Si cambia solo quello che legge una persona, e passa da qui.
// Testi di Mario (proposti il 01/11).
export type ModalitaIscrizione = "individuale" | "dad";

export const MODALITA_ISCRIZIONE: ModalitaIscrizione[] = ["individuale", "dad"];

export const ETICHETTA_MODALITA: Record<ModalitaIscrizione, string> = {
  individuale: "Ognuno dal proprio account",
  dad: "Un collegamento solo per la classe",
};

export const CHI_MISURA_LA_PRESENZA: Record<ModalitaIscrizione, string> = {
  individuale: "La presenza la misura KIREO, dal tempo di collegamento di ciascuno.",
  dad: "La presenza la certifichi tu dopo l'incontro, dal registro presenze.",
};

// L'esito di un'iscrizione con un collegamento solo: nessuna riga per studente
// nasce adesso (la crea la certificazione), quindi non ci sono numeri da dire.
// Mio e provvisorio.
export const TESTO_ESITO_COLLEGAMENTO_UNICO =
  "Classe iscritta con un collegamento solo: dopo l'incontro certifica le presenze dal registro.";
