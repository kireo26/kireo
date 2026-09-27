import { PASSI_PERCORSO, type ChiavePasso } from "./passi";

// LA PROSA DELLA PAGINA DEL PERCORSO, come valore e non come JSX.
//
// Due ragioni, e la seconda è quella che conta. La prima: una frase composta
// dentro un `.tsx` non si può controllare da uno script Node (`testoAffinita.ts`,
// `avvisoRifiuto.ts`, `avvisoAI.ts` stanno qui per lo stesso motivo). La seconda:
// c'è una proprietà da sorvegliare, e non è di stile.
//
// ─────────────────────────────────────────────────────────────────────────────
// LA PAGINA RACCONTA LA FORMA DEL VIAGGIO, NON LE SOGLIE.
//
// «Prima esplori, poi ti metti alla prova, poi lavori su un progetto vero» non
// invecchia. «Le missioni si aprono dopo i tre test» invecchia alla prima
// modifica della regola, e nessuno se ne accorge — perché la pagina non cambia,
// cambia il mondo intorno.
//
// Il 26/09 abbiamo trovato DUE riassunti scritti a mano della regola delle
// guide, tutti e due fermi alla versione di prima. Questa pagina sarebbe il
// terzo, e il più grande. Le condizioni le dicono già le pagine di ciascun
// passo, una per una, GENERATE dalla regola vera (`statoSblocco` per le guide,
// `cancelloMissioni`/`cancelloWorkshop` per gli altri due).
//
// Quindi qui non si nomina nessuna condizione, e `npm run test:percorsopagina`
// lo pretende: la lista `VIETATE` cerca le forme in cui una soglia rientrerebbe
// («dopo i tre test», «servono due guide», «quando hai finito»). È la stessa
// guardia di `TESTO_SBLOCCO_GUIDE`, messa prima invece che dopo.
// ─────────────────────────────────────────────────────────────────────────────

export const TITOLO_PERCORSO = "Il percorso di orientamento KIREO";

export const APERTURA_PERCORSO =
  "Non è un test che ti dice chi sei. È una serie di cose da fare — e tutto quello che KIREO scrive su di te viene solo da quelle.";

// Una voce per ogni passo, e il test pretende che le due liste coincidano nei
// due versi: un passo aggiunto a `PASSI_PERCORSO` senza la sua prosa lascerebbe
// un numero senza frase, e una prosa senza passo sarebbe una frase orfana.
export const PROSA_PASSI: Record<ChiavePasso, { titolo: string; testo: string }> = {
  aree: {
    titolo: "Le aree",
    testo: "Diciotto campi in cui si può lavorare. Qui giri e guardi: nessuno ti chiede niente.",
  },
  guide: {
    titolo: "Le guide",
    testo: "Per ogni area tre documenti, uno più a fondo dell'altro: che cos'è, che strade ci sono dentro, come ci si entra davvero.",
  },
  test: {
    titolo: "I test",
    testo:
      "Tre passaggi. Non hanno voti e non si possono sbagliare: servono a far vedere verso cosa ti giri quando la domanda diventa difficile.",
  },
  missioni: {
    titolo: "Le missioni",
    testo:
      "Una situazione vera, con informazioni incomplete e scelte che costano qualcosa. Quello che decidi qui dice più di quello che dichiari.",
  },
  workshop: {
    titolo: "I workshop",
    testo:
      "Un progetto seguito per settimane, per un cliente che ti risponde e che non è sempre contento. È la parte lunga, ed è quella che somiglia di più a un lavoro.",
  },
};

// L'UNICA RIGA CHE PARLA DELLA REGOLA, e lo fa senza nominare nessuna
// condizione. Se un giorno qualcuno ci aggiunge «dopo i tre test», quello è il
// momento in cui la pagina comincia a invecchiare.
export const CHIUSURA_PERCORSO =
  "Ogni passo si apre quando quello prima ha lasciato qualcosa, e la pagina di ciascuno ti dice cosa manca. Non c'è fretta e non c'è un tempo giusto.";

// I passi con la loro prosa, nell'ordine della costante condivisa.
export function passiConProsa() {
  return PASSI_PERCORSO.map((passo, i) => ({ ...passo, numero: i + 1, ...PROSA_PASSI[passo.chiave] }));
}

// Il testo intero, per il controllo: è su questo che gira la lista delle forme
// vietate, così una soglia non può entrare da nessuna delle sue parti.
export function testoInteroPercorso() {
  return [
    TITOLO_PERCORSO,
    APERTURA_PERCORSO,
    ...passiConProsa().map((p) => `${p.titolo}. ${p.testo}`),
    CHIUSURA_PERCORSO,
  ].join("\n\n");
}
