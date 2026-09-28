// Quante volte si può far rileggere una consegna, e cosa si legge quando non si
// può più.
//
// PERCHÉ UN MODULO: la stessa domanda se la fanno in due — la pagina della
// diretta, per decidere se mostrare il bottone, e la route, per rifiutare la
// pressione che arriva comunque. Due copie divergono, e quella che diverge è
// sempre quella che nessuno rilegge.
//
// IL CANCELLO VERO È IN SQL: `apri_lettura_consegna`, che alza il contatore
// dentro la propria `where` e solleva `troppe_letture`. Quello che c'è qui non
// autorizza niente — decide se OFFRIRE il bottone, che è un'altra cosa: un
// controllo in pagina non è un cancello, è un consiglio con un bottone in meno.
//
// LA COPIA DEL NUMERO. `TETTO_LETTURE_CONSEGNA` esiste anche in SQL
// (`tetto_letture_consegna()`, migrazione 20260928100000) perché il database non
// può importare TypeScript e la pagina non può fare un giro di rete per un
// intero. Le due sono tenute ferme da `npm run test:consegna-evento`, che estrae
// il numero dalla migrazione e lo confronta con questo: senza quel confronto
// esisterebbe una versione del tetto che dice allo studente un numero e gliene
// applica un altro.
//
// ⚠️ I testi sono voce: questi li ho scritti io e vanno riletti da Mario.

// ⚠️ SCELTO, NON MISURATO: la prima consegna più quattro riletture. Vedi la
// migrazione per la domanda che lo deciderebbe.
export const TETTO_LETTURE_CONSEGNA = 5;

export type StatoRilettura = "si_puo" | "tetto_pieno" | "fuori_finestra";

// Il tetto si guarda PRIMA della finestra, e non è indifferente: se abbiamo
// provato cinque volte e poi il tempo è scaduto, la cosa vera da dire è che ci
// abbiamo provato — la finestra è incidentale. Detta al contrario, «il tempo è
// passato» farebbe credere che con più tempo sarebbe andata.
export function statoRilettura(lettureTentate: number, finestraAperta: boolean): StatoRilettura {
  if (lettureTentate >= TETTO_LETTURE_CONSEGNA) return "tetto_pieno";
  if (!finestraAperta) return "fuori_finestra";
  return "si_puo";
}

// Le due frasi finiscono su «scrivici da»: il link a /contatti lo aggiunge la
// pagina, perché un <Link> non è un valore che uno script Node possa leggere — e
// un testo che nessuno script può leggere è un testo che invecchia in silenzio.
const TESTI: Record<Exclude<StatoRilettura, "si_puo">, string> = {
  tetto_pieno:
    "Ci abbiamo provato più volte e non siamo riusciti a leggerla. Il testo resta tuo e al sicuro: non è un giudizio su quello che hai scritto, è un problema nostro. Se ti va, scrivici da",
  fuori_finestra:
    "Non siamo riusciti a leggerla, e il tempo per rileggerla è passato. Il testo resta tuo e al sicuro: non è un giudizio su quello che hai scritto, è un problema nostro. Se ti va, scrivici da",
};

export function testoRilettura(stato: Exclude<StatoRilettura, "si_puo">): string {
  return TESTI[stato];
}

// Quello che risponde la route, e serve a DUE momenti con un testo solo: il
// tentativo che fallisce essendo l'ultimo consentito, e le pressioni successive
// che il cancello rifiuta. Sono lo stesso fatto visto un istante prima e un
// istante dopo, quindi due testi diversi sarebbero due copie da tenere allineate
// — e la prima avrebbe detto «puoi farla rileggere da qui» mentre il bottone
// stava sparendo.
export const MESSAGGIO_TETTO =
  "Ci abbiamo provato più volte e non siamo riusciti a leggere la tua risposta. Il testo resta tuo e al sicuro: non è un giudizio su quello che hai scritto, è un problema nostro. Se ti va, scrivici da Contatti.";
