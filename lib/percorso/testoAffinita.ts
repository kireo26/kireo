import type { OrigineSegnale } from "@/lib/percorso/stato";

// Cosa legge uno studente quando un segnale c'è ma non basta ancora per
// un'affinità — il blocco «Sei a metà strada» in cima alla home.
//
// PERCHÉ È UN VALORE IN UN FILE SUO, e non tre rami dentro il JSX. Fino al
// 20/09 quel blocco dava per scontato che l'unica attività fosse una MISSIONE:
// «Nella missione che hai fatto qualcosa si è già acceso», bottone «Fai
// un'altra missione». Da quando il cancello pretende i tre test prima delle
// missioni, ogni studente attraversa per forza lo stato «test fatti, zero
// missioni» — e lì quel testo racconta una partita che non è mai stata
// giocata. Una frase che afferma una cosa che lo studente non ha fatto è la
// classe di difetto che questa casa insegue da mesi; e una proprietà dichiarata
// è un test che non c'è ancora. Qui il testo è un valore, quindi la proprietà
// si può controllare (`npm run test:affinita`).
//
// TRE ESITI, NON DUE. «Non lo so» è un caso a sé: se la lettura fallisce non si
// nomina né un test né una missione, invece di indovinare quale sia più
// probabile. È la direzione in cui un testo non può mentire — la stessa regola
// del banco, «non ho guardato» non è «non ce n'è».
//
// ⚠️ I testi sono voce: questi li ho adattati io dai due che c'erano, e vanno
// riletti da Mario. La riga della missione è invariata parola per parola.

export type CopiaUnicaAttivita = {
  titolo: string;
  corpo: string;
  cta: string;
  sfiorateTitolo: string;
  sfiorateSottotitolo: string;
};

const TITOLO = "Sei a metà strada.";
const SFIORATE_TITOLO = "Quello che hai già acceso";
// Uno solo per tutti e tre i casi, e senza «prima»: era la stessa specie del
// corpo in formato piccolo — «le piste della tua prima missione» è falso per chi
// ne ha giocate due su aree disgiunte, e «la prima missione dirà» lo sarebbe per
// chi una l'ha già fatta. Un sottotitolo che non nomina la sorgente non può
// diventare falso quando la sorgente cambia.
const SFIORATE_SOTTOTITOLO = "Sono le piste che si sono accese finora: la prossima attività dirà quali reggono.";

export function copiaUnicaAttivita(origine: OrigineSegnale): CopiaUnicaAttivita {
  if (origine === "missione") {
    return {
      titolo: TITOLO,
      corpo:
        "Nella missione che hai fatto qualcosa si è già acceso: lo trovi nel suo riepilogo. Ma quello racconta QUELLA partita. Un'affinità è una cosa che diciamo su di te, e la diciamo solo quando un segnale ritorna in una situazione diversa. Fanne un'altra e cominciamo a metterle in fila.",
      cta: "Fai un'altra missione",
      sfiorateTitolo: SFIORATE_TITOLO,
      sfiorateSottotitolo: SFIORATE_SOTTOTITOLO,
    };
  }

  if (origine === "test") {
    return {
      titolo: TITOLO,
      corpo:
        "Nei test qualcosa si è già acceso: lo trovi nel riepilogo di ognuno. Ma un test racconta come ti vedi. Un'affinità è una cosa che diciamo su di te, e la diciamo solo quando lo stesso segnale ritorna in una situazione dove hai fatto qualcosa, non dove l'hai dichiarato. La prima missione è quella situazione.",
      cta: "Fai una missione",
      sfiorateTitolo: SFIORATE_TITOLO,
      sfiorateSottotitolo: SFIORATE_SOTTOTITOLO,
    };
  }

  // Non lo sappiamo: si parla del segnale, mai di come è nato.
  return {
    titolo: TITOLO,
    corpo:
      "Qualcosa si è già acceso, ma per ora è un segnale solo. Un'affinità è una cosa che diciamo su di te, e la diciamo quando lo stesso segnale ritorna in una situazione diversa. Fanne un'altra e cominciamo a metterle in fila.",
    cta: "Vai alle missioni",
    sfiorateTitolo: SFIORATE_TITOLO,
    sfiorateSottotitolo: SFIORATE_SOTTOTITOLO,
  };
}
