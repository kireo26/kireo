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
// riletti da Mario.
//
// RISCRITTI IL 27/09, e solo in una clausola. Tutti e tre dicevano che
// un'affinità si dichiara «quando il segnale RITORNA in una situazione
// diversa»: era la descrizione della vecchia barra, `attivita_distinte ≥ 2`.
// Dal passaggio a `confidence ≥ 0,40` quella frase è falsa — una missione
// ricca basta da sola — quindi la clausola dice adesso che il segnale deve
// essere abbastanza FORTE. La tesi del prodotto non cambia e si rafforza: le
// prove dei test pesano 0,35 l'una e non arrivano alla soglia, quelle di una
// missione sì. Un testo che descrive una regola è la copia che invecchia nel
// momento in cui la regola si muove, e questi tre erano esattamente quella.

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
        "Nella missione che hai fatto qualcosa si è già acceso: lo trovi nel suo riepilogo. Ma quello racconta QUELLA partita. Un'affinità è una cosa che diciamo su di te, e la diciamo quando il segnale è abbastanza forte da reggere. Quello che hai acceso per ora è leggero: fanne un'altra e cominciamo a metterle in fila.",
      cta: "Fai un'altra missione",
      sfiorateTitolo: SFIORATE_TITOLO,
      sfiorateSottotitolo: SFIORATE_SOTTOTITOLO,
    };
  }

  if (origine === "test") {
    return {
      titolo: TITOLO,
      corpo:
        "Nei test qualcosa si è già acceso: lo trovi nei loro riepiloghi — le aree in due, il tuo modo di lavorare nel terzo. Ma un test racconta come ti vedi, e una risposta a un questionario pesa poco. Un'affinità è una cosa che diciamo su di te, e la diciamo quando il segnale è abbastanza forte: pesa quello che fai, non quello che dichiari. La prima missione è la prima volta che fai qualcosa.",
      cta: "Fai una missione",
      sfiorateTitolo: SFIORATE_TITOLO,
      sfiorateSottotitolo: SFIORATE_SOTTOTITOLO,
    };
  }

  // Non lo sappiamo: si parla del segnale, mai di come è nato.
  return {
    titolo: TITOLO,
    corpo:
      "Qualcosa si è già acceso, ma per ora è leggero. Un'affinità è una cosa che diciamo su di te, e la diciamo quando il segnale è abbastanza forte da reggere. Fanne un'altra e cominciamo a metterle in fila.",
    cta: "Vai alle missioni",
    sfiorateTitolo: SFIORATE_TITOLO,
    sfiorateSottotitolo: SFIORATE_SOTTOTITOLO,
  };
}
