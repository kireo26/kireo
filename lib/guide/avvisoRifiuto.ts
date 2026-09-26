import type { LivelloGuida } from "./config";

// Cosa legge uno studente quando il cancello delle guide gli ha detto no.
//
// PERCHÉ È UN VALORE IN UN FILE SUO, e non tre rami dentro il JSX: una proprietà
// dichiarata è un test che non c'è ancora, e una frase composta in un `.tsx` non
// si può controllare da uno script Node. Qui si può (`npm run test:guide`).
//
// DOVE ATTERRA CONTA QUANTO COSA DICE. `CardGuida` apre le guide in una scheda
// nuova, quindi un rifiuto della rotta atterra DOVE NON SI ERA — e una scheda
// nuova che dice solo «non puoi» è la peggior forma di un no: per tornare
// indietro va chiusa. Per questo la rotta rimanda alla pagina delle guide
// dell'area, dove le tre card sono già lì con il passo che manca.
//
// IL MOTIVO NON ARRIVA DALL'URL: lo ricalcola la pagina da `statoSblocco`, e
// questa funzione lo riceve già calcolato. Una frase che viaggia in un indirizzo
// è una seconda copia della stessa frase, e chiunque potrebbe fabbricarne una
// terza.
//
// TRE ESITI, NON DUE. «Non ho potuto controllare» è un caso a sé, e il suo testo
// dice che è un problema nostro — la stessa clausola che dicono già il feedback
// finale di un workshop, la revisione di una tappa, la missione e il test senza
// prove. Un testo che indovina è peggio di un testo generico: quando sbaglia,
// afferma una cosa su quello che lo studente ha fatto.
//
// ⚠️ I testi sono voce: questi li ho scritti io e vanno riletti da Mario.

export type GuidaValutata = {
  livello: LivelloGuida;
  titolo: string;
  sbloccata: boolean;
  motivo: string;
};

export function avvisoRifiuto(guide: GuidaValutata[], bloccata?: string, guasto?: string): string | null {
  const g = guide.find((x) => String(x.livello) === bloccata);
  if (!g) return null;

  if (guasto === "1") {
    return "Non siamo riusciti a controllare se questa guida è aperta per te. È un problema nostro, non un giudizio su quello che hai fatto: riprova fra poco.";
  }
  // Nel frattempo si è sbloccata (una missione finita in un'altra scheda, un
  // ricalcolo del profilo): non si dice un no che non c'è più.
  if (g.sbloccata) return null;

  return `«${g.titolo}» non è ancora aperta. ${g.motivo}`;
}
