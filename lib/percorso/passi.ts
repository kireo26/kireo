// I CINQUE PASSI DEL PERCORSO, in ordine, in un posto solo.
//
// PERCHÉ ESISTE. Il 26/09 abbiamo trovato DUE riassunti scritti a mano della
// regola delle guide, tutti e due fermi alla versione di prima: l'introduzione
// di `/app/guide/<area>` e quella dell'indice. Una pagina che spiega il
// percorso intero è il terzo riassunto, e il più grande. La barra laterale che
// mette i passi in fila è il quarto.
//
// Quindi: la PROSA è voce e vive dove si legge (`app/app/percorso/page.tsx`),
// l'ORDINE è un dato e vive qui. Due elenchi di passi in due file divergono al
// primo che ne tocca uno — e il difetto non si vede rileggendo, perché nessuno
// dei due file è sbagliato da solo.
//
// COSA NON STA QUI, di proposito:
//   · le ICONE — sono componenti React, stanno nella barra;
//   · la PROSA di ciascun passo — è voce, sta nella pagina;
//   · le CONDIZIONI di sblocco — le genera la regola vera, una per pagina
//     (`statoSblocco` per le guide, i cancelli per missioni e workshop). Un
//     terzo posto che le nomina è un terzo posto che invecchia.
//
// E NON STANNO QUI NEMMENO «Home» E «Il percorso di orientamento»: sono voci di
// navigazione, non passi del viaggio. La barra le aggiunge in testa al suo
// gruppo; la pagina numera solo questi cinque.

export type ChiavePasso = "aree" | "guide" | "test" | "missioni" | "workshop";

export type PassoPercorso = {
  chiave: ChiavePasso;
  /** La sezione dell'area privata dove quel passo si fa. */
  href: string;
  /** Il nome come lo porta la barra. */
  nome: string;
};

export const PASSI_PERCORSO: readonly PassoPercorso[] = [
  { chiave: "aree", href: "/app/aree", nome: "Aree" },
  { chiave: "guide", href: "/app/guide", nome: "Guide" },
  { chiave: "test", href: "/app/test", nome: "Test" },
  { chiave: "missioni", href: "/app/escape", nome: "Missioni" },
  { chiave: "workshop", href: "/app/workshop", nome: "Workshop" },
];

// Da una destinazione qualunque al passo che la contiene.
//
// Serve per il segno sul passo corrente: `getProssimaTappa` restituisce un href
// preciso (`/app/test/da-dove-parti`, `/app/guide/informatica-digitale`), e la
// barra deve sapere quale VOCE illuminare. Nessun caso speciale: gli href dei
// passi sono prefissi di quelli delle loro pagine interne.
export function passoDiHref(href: string | null | undefined): ChiavePasso | null {
  if (!href) return null;
  return PASSI_PERCORSO.find((p) => href === p.href || href.startsWith(p.href + "/"))?.chiave ?? null;
}
