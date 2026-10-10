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

export type Freschezza = {
  /** Quando i dati sono arrivati l'ultima volta, o `null` se non sono ancora arrivati. */
  quando: Date | null;
  /** L'ultimo tentativo è fallito: il numero a schermo è di `quando`, non di adesso. */
  fallito: boolean;
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
 * La riga da mettere accanto ai numeri.
 *
 * ⚠️ QUATTRO CASI, e il terzo è quello per cui questa funzione esiste:
 *
 *   1. non è ancora arrivato niente → lo dice, invece di tacere e far sembrare
 *      i numeri (che non ci sono) aggiornati;
 *   2. appena arrivato → l'ora, senza un'età che cambia sotto gli occhi;
 *   3. ULTIMO TENTATIVO FALLITO → dice che i numeri sono VECCHI e di quanto. È
 *      la differenza fra un numero stantio e uno fresco, che è tutto il punto;
 *   4. arrivato un po' di tempo fa (il poll gira ogni 15 secondi, quindi oltre
 *      il mezzo minuto qualcosa non sta girando) → l'ora e l'età.
 *
 * ⚠️ TESTO PROVVISORIO, MIO: Mario ha chiesto di mandargli i casi che scelgo.
 */
export function rigaFreschezza(f: Freschezza, adesso: Date = new Date()): string {
  const secondi = etaSecondi(f.quando, adesso);
  if (f.quando === null || secondi === null) {
    return f.fallito
      ? "Non è stato possibile leggere questi dati: non c'è ancora niente da mostrare."
      : "In attesa dei dati…";
  }
  const ora = formattaOra(f.quando);
  if (f.fallito) {
    return `⚠ L'ultimo aggiornamento non è andato a buon fine: questi numeri sono di ${eta(secondi)} fa, delle ${ora}.`;
  }
  if (secondi <= SECONDI_FRESCO) return `Aggiornato alle ${ora}.`;
  return `Aggiornato alle ${ora}, ${eta(secondi)} fa.`;
}
