// Quando questi numeri sono arrivati.
//
// ⚠️ PERCHÉ ESISTE, ed è un vincolo di Mario sulla pagina di moderazione: «deve
// reggere quaranta minuti senza un reload, e deve dire quando si è aggiornata
// l'ultima volta — un numero stantio e uno fresco si somigliano».
//
// È la stessa specie di `zero ≠ non ho guardato`, applicata al TEMPO invece che
// a un insieme: «Presenti ora: 12» è un'affermazione sul presente, e se l'ultimo
// giro di rete è fallito due minuti fa quel 12 è un'affermazione sul passato
// travestita. Chi modera una diretta prende decisioni su quel numero.
//
// ⚠️⚠️ MA UN AVVISO ACCANTO A UN NUMERO NON IMPEDISCE A NESSUNO DI LEGGERE IL
// NUMERO, ed è la correzione di Mario dell'11/10 — la parte che vale più dei
// testi:
//
//     «Un moderatore che guarda lo schermo per due secondi, in mezzo a una
//     diretta, legge "Presenti: 12". Non legge la riga sopra. È quello che
//     fanno tutti con un numero grande e una nota piccola — e noi quella nota
//     la mettiamo proprio nel momento in cui la persona ha meno attenzione da
//     dedicarle. Dopo qualche tentativo fallito di fila, non basta avvisare
//     accanto al numero: deve cambiare il numero.»
//
// Da qui `numeroStantio`: la riga dice, e oltre una soglia il numero stesso si
// degrada. L'unica cosa che la freschezza deve impedire è che a colpo d'occhio
// un numero vecchio somigli a uno fresco.
//
// ⚠️ DUE OROLOGI, E SERVONO TUTTI E DUE. `quando` è il momento in cui i dati
// sono ARRIVATI (si muove solo quando un giro va a buon fine); `adesso` è
// l'ora corrente, e deve avanzare ANCHE quando il giro fallisce — altrimenti
// l'età non cresce e un dato vecchio di due minuti si legge come appena
// arrivato. Per questo nel componente l'orologio ha un intervallo suo, separato
// dal poll: se una `fetch` resta appesa, il poll non ritorna e un `setOra`
// dentro di lui non scatterebbe.

import { formattaOra } from "@/lib/formato";

/** Quanti secondi passano prima di dire l'età invece di «adesso». */
export const SECONDI_FRESCO = 20;

/**
 * Quanti giri falliti di fila prima di degradare il numero.
 *
 * ⚠️ IL NUMERO È SCELTO, NON MISURATO, e il conto da cui viene sta qui perché
 * nessuno lo ritrovi fra sei mesi credendo che qualcuno l'abbia tarato su dei
 * dati. Il poll gira ogni 15 secondi, quindi: un giro fallito è rumore di rete
 * e non deve far lampeggiare niente; tre giri sono **45 secondi** in cui niente
 * è arrivato, cioè dentro il minuto che Mario ha fissato come limite.
 */
export const FALLITI_PRIMA_DI_STANTIO = 3;

/**
 * Oltre questa età il numero si degrada comunque, anche con zero fallimenti.
 *
 * ⚠️ PERCHÉ SERVE ANCHE QUESTA META, e non è prudenza generica: una `fetch` può
 * restare APPESA — nessun errore, nessuna risoluzione — e allora `falliti`
 * resta a 0 mentre l'età cresce senza limite. È esattamente il caso per cui
 * l'orologio ha un intervallo suo, e un degrado basato sui soli fallimenti lo
 * mancherebbe: la riga direbbe «2 minuti fa» accanto a un numero che sembra
 * appena arrivato.
 */
export const SECONDI_STANTIO = 60;

export type Freschezza = {
  /** Quando i dati sono arrivati l'ultima volta, o `null` se non sono ancora arrivati. */
  quando: Date | null;
  /** Quanti giri di fila sono falliti dall'ultimo andato a buon fine. Un successo lo azzera. */
  falliti: number;
};

/** L'età in secondi, o `null` quando non si sa. */
function etaSecondi(quando: Date | null, adesso: Date): number | null {
  if (!quando) return null;
  const s = Math.floor((adesso.getTime() - quando.getTime()) / 1000);
  // Un'età negativa (orologio del browser spostato indietro fra due letture)
  // non si stampa: «aggiornato fra 3 secondi» è peggio di «adesso».
  return s < 0 ? 0 : s;
}

/** «3 secondi», «2 minuti», «1 minuto»: gli accordi ci sono perché l'uno capita. */
function eta(secondi: number): string {
  if (secondi < 60) return `${secondi} second${secondi === 1 ? "o" : "i"}`;
  const minuti = Math.floor(secondi / 60);
  return `${minuti} minut${minuti === 1 ? "o" : "i"}`;
}

/**
 * Il numero a schermo non è più una risposta a «quanti sono ORA»: va degradato,
 * perché a colpo d'occhio non somigli a uno fresco.
 *
 * DUE STRADE IN OR, e sono due guasti diversi: i giri che tornano con un errore
 * (`falliti`) e il giro che non torna affatto (l'età). Vedi le due costanti.
 *
 * FALSO QUANDO NON C'È NIENTE: senza `quando` non esiste nessun numero da
 * degradare — il componente mostra «…», e la riga dice che si è in attesa.
 */
export function numeroStantio(f: Freschezza, adesso: Date = new Date()): boolean {
  if (f.quando === null) return false;
  if (f.falliti >= FALLITI_PRIMA_DI_STANTIO) return true;
  const secondi = etaSecondi(f.quando, adesso);
  return secondi !== null && secondi >= SECONDI_STANTIO;
}

/**
 * La riga da mettere accanto ai numeri. I quattro testi sono di Mario, parola
 * per parola.
 *
 * ⚠️ L'ORA E L'ETÀ STANNO INSIEME perché servono a due domande diverse: l'ora
 * per capire cosa è successo nel frattempo, il «due minuti fa» per decidere se
 * fidarsi.
 *
 *   1. appena aggiornato  → «Aggiornato adesso.» (nessun orologio: «aggiornato
 *      alle 19:07» quando sono le 19:07 è una precisione che non serve)
 *   2. aggiornato         → «Aggiornato alle 19:07, 2 minuti fa.»
 *   3. TENTATIVO FALLITO  → dice che i numeri sono VECCHI e di quanto. È la
 *      differenza fra un numero stantio e uno fresco, che è tutto il punto.
 *   4. primo caricamento  → «In attesa dei dati…»
 *
 * ⚠️ E UN QUINTO CASO CHE NON È NELLA SUA LISTA, mio e provvisorio: niente è
 * ancora arrivato E il tentativo è fallito. «In attesa dei dati…» lì sarebbe una
 * bugia — dice «aspetta» mentre niente sta arrivando — quindi si dice che si è
 * provato. Resta da rileggere.
 */
export function rigaFreschezza(f: Freschezza, adesso: Date = new Date()): string {
  const secondi = etaSecondi(f.quando, adesso);
  if (f.quando === null || secondi === null) {
    return f.falliti > 0
      ? "Non è stato possibile leggere questi dati: non c'è ancora niente da mostrare."
      : "In attesa dei dati…";
  }
  const ora = formattaOra(f.quando);
  if (f.falliti > 0) {
    return `⚠ L'ultimo aggiornamento non è riuscito. Questi numeri sono delle ${ora}, ${eta(secondi)} fa.`;
  }
  if (secondi <= SECONDI_FRESCO) return "Aggiornato adesso.";
  return `Aggiornato alle ${ora}, ${eta(secondi)} fa.`;
}

/**
 * Il testo che accompagna un numero degradato.
 *
 * ⚠️ ESISTE PERCHÉ IL BARRATO NON ARRIVA A TUTTI: una linea sopra una cifra non
 * la vede chi usa un lettore di schermo, e per quella persona il numero
 * resterebbe identico a uno fresco — cioè il difetto, per lei, non sarebbe
 * chiuso affatto. Va reso accanto al numero (`sr-only`), non al posto suo.
 *
 * ⚠️ TESTO PROVVISORIO, MIO: Mario ha chiesto di mandargli il caso per
 * scriverlo.
 */
export const NUMERO_NON_AGGIORNATO = "(non aggiornato)";
