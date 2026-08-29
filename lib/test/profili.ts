// KIREO — I dieci profili di stile, come IPOTESI (Fase 2).
//
// IL NOME NON SI MOSTRA PIÙ. Fino al 29/08 la pagina scriveva «ti sei mosso da
// esploratore»: due problemi in sei parole. Il primo è l'accordo — cinque dei
// dieci nomi sono in -tore e al femminile fanno -trice, e tre sono aggettivi
// dopo «specialista»: otto su dieci concordavano col genere di chi legge, che
// KIREO non conosce. Il secondo è più grosso e non riguarda la grammatica:
// **etichettare una persona** è la cosa che abbiamo passato una settimana a
// togliere dal finale delle missioni. La descrizione fa già tutto il lavoro, e
// in una descrizione uno si riconosce mentre in un'etichetta si sente messo in
// una casella.
//
// Quindi `nome` resta come CHIAVE (il profilo deve pur chiamarsi in qualche
// modo nel codice e nei log) e la pagina mostra solo `comeTiMuovi`, dietro la
// cornice «Da come ti muovi finora, nei test e nelle missioni: …». Le dieci
// descrizioni sono scritte per stare DA SOLE, senza il nome davanti.
//
// Regole di linguaggio vincolanti: il punto cieco è il PREZZO DI UNA QUALITÀ,
// mai un difetto; mai dire che uno è «portato» o «non portato».
//
// Il profilo si calcola da asse dominante e secondario sui punteggi 0-100:
//  - distacco ≥ 12 → profilo dominante (uno dei quattro Specialista);
//  - distacco < 12 → profilo ibrido (una delle sei combinazioni).

import type { AsseStile } from "@/lib/escape/tipi";

export const SOGLIA_DOMINANTE = 12;

export type ProfiloId =
  | "stratega" | "facilitatore" | "esploratore" | "attivatore" | "inventore" | "connettore"
  | "spec_analitico" | "spec_relazionale" | "spec_creativo" | "spec_operativo";

export type Profilo = {
  id: ProfiloId;
  nome: string;
  comeTiMuovi: string; // regge DA SOLA: è l'unica cosa che lo studente legge
  puntoCieco: string;  // prezzo di una qualità, senza giudizio
};

export const PROFILI: Record<ProfiloId, Profilo> = {
  stratega: {
    id: "stratega", nome: "stratega",
    comeTiMuovi: "Guardi bene la situazione e poi decidi. Non ti fermi all'analisi, ma non parti nemmeno senza aver capito.",
    puntoCieco: "Guardare bene prima di decidere ha un prezzo: quando la situazione chiede solo di buttarsi, a volte aspetti un dato in più di quanto serva.",
  },
  facilitatore: {
    id: "facilitatore", nome: "facilitatore",
    comeTiMuovi: "Ascolti, e poi chiarisci. Aiuti gli altri a capire quello che stanno guardando.",
    puntoCieco: "Tenere insieme le persone e i fatti costa tempo: a volte il momento di chiudere e decidere arriva un po' dopo.",
  },
  esploratore: {
    id: "esploratore", nome: "esploratore",
    comeTiMuovi: "Le idee ti vengono in fretta, e poi vuoi vedere se stanno in piedi.",
    puntoCieco: "Verificare ogni idea è una forza: il rovescio è che a volte l'idea buona resta ferma mentre la controlli.",
  },
  attivatore: {
    id: "attivatore", nome: "attivatore",
    comeTiMuovi: "Fai muovere le cose, e ti porti dietro le persone.",
    puntoCieco: "L'energia che sblocca ha un costo: a volte si parte prima di aver capito bene dove si sta andando.",
  },
  inventore: {
    id: "inventore", nome: "inventore",
    comeTiMuovi: "Provi, costruisci, aggiusti. Preferisci un prototipo storto a un piano perfetto.",
    puntoCieco: "Costruire subito è prezioso: il prezzo è che ogni tanto si rifà una cosa che, pensata un attimo di più, si faceva una volta sola.",
  },
  connettore: {
    id: "connettore", nome: "connettore",
    comeTiMuovi: "Leggi le persone e le situazioni, e trovi il modo di farle incontrare.",
    puntoCieco: "Vedere i legami tra le persone è una dote: a volte, per tenerli, si rimanda la decisione netta che pure servirebbe.",
  },
  spec_analitico: {
    id: "spec_analitico", nome: "specialista analitico",
    comeTiMuovi: "Vai a fondo. Ti fermi quando la cosa ti è chiara, non quando è finita.",
    puntoCieco: "Andare a fondo è raro e utile: il prezzo è che a volte «ho capito» arriva dopo il momento in cui bastava «ho deciso».",
  },
  spec_relazionale: {
    id: "spec_relazionale", nome: "specialista relazionale",
    comeTiMuovi: "Le persone sono il tuo campo, prima ancora del contenuto.",
    puntoCieco: "Mettere le persone al centro tiene su un gruppo: a volte il contenuto tecnico va tenuto d'occhio con la stessa cura.",
  },
  spec_creativo: {
    id: "spec_creativo", nome: "specialista creativo",
    comeTiMuovi: "Dove gli altri vedono un muro, tu vedi che si può girarci intorno — e di solito trovi più di un modo.",
    puntoCieco: "Aprire strade nuove è prezioso: il rovescio è che portarne una fino in fondo chiede una pazienza diversa dall'immaginarle.",
  },
  spec_operativo: {
    id: "spec_operativo", nome: "specialista operativo",
    comeTiMuovi: "Porti le cose a destinazione. È la qualità di cui c'è sempre bisogno e che nessuno nota.",
    puntoCieco: "Far arrivare le cose è ciò che tiene in piedi tutto: a volte fermarsi un attimo a chiedersi «è la cosa giusta?» prima di partire ripaga.",
  },
};

// coppia di assi (non ordinata) → profilo ibrido
const IBRIDI: { assi: [AsseStile, AsseStile]; profilo: ProfiloId }[] = [
  { assi: ["analitico", "operativo"], profilo: "stratega" },
  { assi: ["relazionale", "analitico"], profilo: "facilitatore" },
  { assi: ["creativo", "analitico"], profilo: "esploratore" },
  { assi: ["operativo", "relazionale"], profilo: "attivatore" },
  { assi: ["creativo", "operativo"], profilo: "inventore" },
  { assi: ["relazionale", "creativo"], profilo: "connettore" },
];
const SPECIALISTI: Record<AsseStile, ProfiloId> = {
  analitico: "spec_analitico", relazionale: "spec_relazionale", creativo: "spec_creativo", operativo: "spec_operativo",
};

// Dai punteggi 0-100 dei quattro assi al profilo-ipotesi. Distacco ≥ 12 tra
// primo e secondo → specialista; altrimenti ibrido della coppia dominante.
export function assegnaProfilo(punteggi: Record<AsseStile, number>): Profilo {
  const ordinati = (Object.keys(punteggi) as AsseStile[]).sort((a, b) => punteggi[b] - punteggi[a]);
  const [primo, secondo] = ordinati;
  const gap = punteggi[primo] - punteggi[secondo];
  if (gap >= SOGLIA_DOMINANTE) return PROFILI[SPECIALISTI[primo]];
  const ib = IBRIDI.find((x) => x.assi.includes(primo) && x.assi.includes(secondo));
  return PROFILI[ib ? ib.profilo : SPECIALISTI[primo]];
}
