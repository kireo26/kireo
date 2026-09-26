import type { CausaSblocco, LivelloGuida } from "./config";

// I bottoni in fondo alla pagina di un'area: il passo che manca, non l'elenco
// dei passi possibili.
//
// PERCHÉ ESISTE. La riga in fondo a /app/guide/<area> era fissa — «Scopri
// l'area», «Fai "Più a fondo"», «Prova una missione» — cioè le tre strade del
// MERITO. Ma il passo che ferma una persona sulla sequenza è un altro: aprire la
// guida precedente, che è lì sopra. Quel passo non aveva nessun bottone: era
// nominato solo dentro il testo della card bloccata, e **chi legge un no guarda
// i bottoni, non il paragrafo** (Mario, dopo il primo giro umano sulla pagina).
//
// LA REGOLA DELL'ORDINE È LA STESSA DI `statoSblocco`: quando manca la sequenza
// si mostra SOLO quella. Dire «apri la Panoramica» e «prova una missione»
// insieme fa leggere la seconda, che è il passo dopo e costa un'ora — mentre il
// primo costa un clic. Non è una questione di spazio: due strade offerte insieme
// non sono più informative di una, sono meno usabili.
//
// I BOTTONI DEL MERITO DIPENDONO DAL LIVELLO, e non per simmetria: `sbloccoL3`
// richiede una missione in OGNI suo ramo (`consolidata && missioni>=1`, oppure
// `interest>=65 && missioni>=1`), quindi «Fai "Più a fondo"» non può aprire la
// Guida 3 da solo. Offrirlo lì sarebbe un bottone che non porta dove dice.
//
// PERCHÉ È UNA FUNZIONE PURA IN UN FILE SUO: la scelta si prova da uno script
// Node (`npm run test:guide`), e dentro il JSX non si potrebbe. Stessa ragione di
// `avvisoRifiuto.ts` e `testoAffinita.ts`.

export type GuidaPerPassi = {
  livello: LivelloGuida;
  titolo: string;
  sbloccata: boolean;
  disponibile: boolean;
  causa: CausaSblocco;
};

export type PassoPagina =
  // «apri» NON è un link: aprire una guida deve passare dal gesto che registra
  // l'apertura in `activity_log`, altrimenti la sequenza non avanza mai e la
  // pagina continua a chiedere lo stesso passo. Vedi ApriGuidaButton.
  | { tipo: "apri"; livello: LivelloGuida; etichetta: string }
  | { tipo: "vai"; href: string; etichetta: string };

const SCOPRI = (areaSlug: string): PassoPagina => ({
  tipo: "vai",
  href: `/aree/${areaSlug}`,
  etichetta: "Scopri l'area",
});

const PIU_A_FONDO: PassoPagina = { tipo: "vai", href: "/app/test/piu-a-fondo", etichetta: "Fai «Più a fondo»" };
const MISSIONE: PassoPagina = { tipo: "vai", href: "/app/escape", etichetta: "Prova una missione" };

export function passiPagina(areaSlug: string, guide: GuidaPerPassi[]): PassoPagina[] {
  const prima = [...guide].sort((a, b) => a.livello - b.livello).find((g) => !g.sbloccata);

  // Niente bloccato: la riga torna a essere navigazione, non sblocco.
  if (!prima) return [SCOPRI(areaSlug), PIU_A_FONDO, MISSIONE];

  if (prima.causa === "sequenza") {
    const precedente = guide.find((g) => g.livello === prima.livello - 1);
    // Se il PDF precedente non è ancora pronto, quel passo non si può fare: è un
    // buco di contenuto nostro, e un bottone che promette una strada chiusa è
    // peggio di nessun bottone.
    if (precedente?.disponibile) {
      return [
        { tipo: "apri", livello: precedente.livello, etichetta: `Apri «${precedente.titolo}»` },
        SCOPRI(areaSlug),
      ];
    }
    return [SCOPRI(areaSlug)];
  }

  // Merito. La Guida 2 si apre anche con «Più a fondo»; la 3 no (serve sempre
  // una missione), quindi lì quel bottone non si mostra.
  return prima.livello === 2 ? [PIU_A_FONDO, MISSIONE, SCOPRI(areaSlug)] : [MISSIONE, SCOPRI(areaSlug)];
}
