// KIREO Escape — costruzione della RESTITUZIONE dell'esito. Non un riassunto:
// quattro momenti in linguaggio ipotetico, senza mai numeri grezzi di
// valore/peso. Logica pura (nessuna AI), calcolata dalle risposte autorevoli
// (step_response) + i segnali d'area aggregati. Usata lato server dalla pagina
// di esito. Mission-aware: il blocco "Cosa hai costruito" e le "occasioni"
// (conseguenze di ciò che non hai letto/scelto) sono per-missione; i blocchi
// "Come hai deciso", "Le ipotesi" e la nota da_verificare sono generici.
// Retro-compatibile: su un tentativo senza i nuovi step i blocchi restano
// null/vuoti.

import type { LeggiRisposta, Mandato, PayloadAlloca, PayloadLavori, PayloadScarta, PayloadSeleziona, StepAllocaBudget, StepPianificaLavori, StepSelezionaInformazioni } from "./tipi";
import { getMissione, mandatoScelto, materialiLetti } from "./config";

export type AreaTop = { slug: string; nome: string; status: "emergente" | "confermata" | "da_verificare" };

export type Restituzione = {
  costruito: string | null;
  metodo: string | null;
  occasioni: string[];
  ipotesi: string | null;
  notaVerifica: string | null;
};

type OccasioneCtx = { letti: Set<string>; alloc?: Record<string, number>; pianoSel?: string[]; scartati?: string[]; mandato: Mandato | null };
type OccasioneRule = { quando: (c: OccasioneCtx) => boolean; testo: string };
type Narrativa = { costruito: (mandato: Mandato, topVoce: string | null) => string; occasioni: OccasioneRule[] };

const elenco = (nomi: string[]) => (nomi.length <= 1 ? nomi[0] ?? "" : `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`);
const facciataTenuta = (c: OccasioneCtx, trapId: string) => c.scartati !== undefined && !c.scartati.includes(trapId);
const scartato = (c: OccasioneCtx, id: string) => c.scartati !== undefined && c.scartati.includes(id);
const nelPiano = (c: OccasioneCtx, id: string) => c.pianoSel?.includes(id) ?? false;
const speso = (c: OccasioneCtx, id: string) => Number(c.alloc?.[id]) || 0;

const NARRATIVA: Record<string, Narrativa> = {
  "progetto-quartiere": {
    costruito: (mandato, topVoce) =>
      `Hai immaginato l'ex mercato come ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Quando hai dovuto distribuire il budget, la fetta più grande è andata a «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => c.alloc !== undefined && !c.letti.has("M4"), testo: "Non hai aperto la perizia strutturale, e il tetto è arrivato quando il budget era già distribuito. Succede: nessuno può sapere tutto. Ma è un'informazione su di te — in questa missione hai preferito muoverti piuttosto che sapere prima." },
      { quando: (c) => facciataTenuta(c, "facciata_pannelli") && c.letti.has("M6"), testo: "Hai proposto di rivestire la facciata anche se la perizia della Soprintendenza, che avevi letto, la dava per tutelata: la domanda sarebbe stata respinta. A volte si sa una cosa e si sceglie lo stesso di correre il rischio." },
      { quando: (c) => facciataTenuta(c, "facciata_pannelli") && !c.letti.has("M6"), testo: "Avresti proposto di coprire la facciata: la Soprintendenza l'avrebbe respinta. Era scritto in un documento che non hai aperto." },
      { quando: (c) => c.alloc !== undefined && c.letti.has("M7") && speso(c, "fondo_gestione") === 0, testo: "Sapevi dei costi di gestione dal terzo anno — l'avevi letto — ma non hai lasciato nulla da parte per coprirli. È il tipo di dettaglio che decide se un progetto regge nel tempo." },
    ],
  },

  "crisi-mediateca": {
    costruito: (mandato, topVoce) =>
      `Hai scelto di trattarla come ${mandato.label} ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Delle cinque giornate, la parte più grande è andata a «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "confermare_spiegare") && !c.letti.has("M4"), testo: "Avresti confermato la decisione così com'era. Il regolamento comunale non lo permette: l'area libera sarebbe scesa al 48%, sotto il minimo del 60%. Era scritto in un documento che non hai aperto." },
      { quando: (c) => facciataTenuta(c, "confermare_spiegare") && c.letti.has("M4"), testo: "Avresti tenuto la decisione così com'era anche sapendo, dal regolamento che avevi letto, che l'area libera scende sotto il minimo di legge. A volte si sa una cosa e si sceglie lo stesso di correre il rischio." },
      { quando: (c) => !c.letti.has("M12"), testo: "Il Comune si è dissociato pubblicamente mentre stavi ancora decidendo. C'era una nota interna che lo annunciava: non l'hai chiesta." },
      { quando: (c) => !c.letti.has("M7"), testo: "C'era una strada che quasi nessuno aveva visto: la mattina la sala è occupata al 18%, il pomeriggio al 94%. Si poteva dividere il tempo invece dello spazio. Il dato c'era, in un documento che non hai aperto." },
      { quando: (c) => c.alloc !== undefined && c.letti.has("M8") && speso(c, "informare_personale") === 0, testo: "Non hai dedicato tempo a informare chi ci lavora, e loro avevano saputo della decisione dal giornale come tutti gli altri." },
    ],
  },

  "guasto-serra": {
    costruito: (mandato, topVoce) =>
      `Sei partito dall'ipotesi ${mandato.label} ${mandato.frase.charAt(0).toLowerCase()}${mandato.frase.slice(1)}` +
      (topVoce ? ` Delle sei ore, ne hai messe di più su «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "raddoppiare") && !c.letti.has("M6"), testo: "Avresti raddoppiato la durata dell'irrigazione. La valvola B, sotto 0,8 bar, non si apre affatto: raddoppiare zero fa zero. Era nel manuale della pompa, che non hai aperto." },
      { quando: (c) => facciataTenuta(c, "raddoppiare") && c.letti.has("M6"), testo: "Avresti raddoppiato la durata dell'irrigazione anche sapendo, dal manuale che avevi letto, che sotto 0,8 bar la valvola non apre: raddoppiare zero fa zero. A volte si legge una cosa e non la si collega al momento giusto." },
      { quando: (c) => !c.letti.has("M12"), testo: "Il contatore segnava un terzo dell'acqua che il sistema dichiarava di aver usato. La prova che i dati non corrispondevano alla realtà era lì, e non l'hai chiesta." },
      { quando: (c) => !(c.letti.has("M4") && c.letti.has("M13")), testo: "C'era una riga di codice che scriveva «irrigato» nell'istante in cui mandava il comando, senza controllare se l'acqua uscisse davvero. Tutto il problema era lì — nel log e nel codice, che non hai letto insieme." },
    ],
  },

  "cantiere-scuola": {
    costruito: (mandato, topVoce) =>
      `Hai aperto il documento con la frase ${mandato.label}.` + (topVoce ? ` Nel tuo piano, il lavoro più impegnativo è stato «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => c.pianoSel !== undefined && !nelPiano(c, "elettrico") && !c.letti.has("M4"), testo: "Il tuo piano stava nei tempi e nel budget, ma l'impianto elettrico era del 1988 e senza rifacimento il collaudo non passa. La palestra non ha riaperto il 12 settembre. C'era una relazione che lo diceva: non l'hai chiesta." },
      { quando: (c) => c.pianoSel !== undefined && !nelPiano(c, "elettrico") && c.letti.has("M4"), testo: "Hai lasciato fuori il rifacimento elettrico anche sapendo, dalla relazione che avevi letto, che senza non si collauda. La palestra non ha riaperto il 12 settembre." },
      { quando: (c) => scartato(c, "accessibilita"), testo: "Hai rimandato l'adeguamento degli spogliatoi. È la scelta che avrebbero fatto in molti. Ma in quell'istituto ci sono quattro studenti che a settembre sono rimasti fuori — e il collaudo poteva rilevarlo comunque." },
      { quando: (c) => c.pianoSel !== undefined && nelPiano(c, "controsoffitto") && !nelPiano(c, "copertura"), testo: "Hai messo un controsoffitto nuovo sotto un tetto che perde da nove anni: la prima pioggia forte se lo riprende. La copertura andava fatta prima." },
      { quando: (c) => !c.letti.has("M13"), testo: "I pannelli del controsoffitto avevano 35 giorni di consegna e nessuno li aveva ordinati. Il ritardo non è nato in cantiere, è nato la prima settimana." },
      { quando: (c) => c.letti.has("M11") && c.pianoSel !== undefined && !nelPiano(c, "fondo_imprevisti"), testo: "Sapevi che una variante in corso d'opera costa venti giorni d'istruttoria, ma non hai lasciato un fondo imprevisti: se qualcosa fosse cambiato, non avevi margine." },
    ],
  },

  "sportello-insieme": {
    costruito: (mandato, topVoce) =>
      `Hai deciso con la regola ${mandato.label}.` + (topVoce ? ` Il tempo più lungo, quando eri stretto, è andato a «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "chiedi_identita"), testo: "Hai risposto alla mail chiedendo chi fosse. È la domanda che verrebbe a chiunque. Ma sei mesi fa era già successo, e quella persona non ha più scritto. C'era una nota che lo spiegava: non l'hai aperta." },
      { quando: (c) => !c.letti.has("M5"), testo: "La segnalazione della scuola andava trasmessa entro 48 ore, ed erano scadute stamattina. Sembrava la richiesta meno urgente delle cinque: era quella con il termine più stretto." },
      { quando: (c) => !c.letti.has("M4") && speso(c, "compila_kaur") > 0, testo: "Hai dedicato tempo a compilare per intero la domanda Kaur. Bastava protocollarla entro le 12: i documenti si potevano integrare in dieci giorni. Era scritto nel regolamento del bando." },
      { quando: (c) => !c.letti.has("M11"), testo: "Il tuo piano contava su tre operatori. Dalle 11 in poi ne restavano due, e una non poteva gestire un colloquio da sola." },
      { quando: (c) => c.letti.has("M7"), testo: "Hai capito che il sig. Muratori non era un impaziente: era uno a cui nessuno aveva detto niente per settantaquattro giorni. Non è una sfumatura da poco." },
    ],
  },

  "filiera-borea": {
    costruito: (mandato, topVoce) =>
      `Sei partito dall'idea ${mandato.label}.` + (topVoce ? ` Nel piano, la voce su cui hai speso di più è stata «${topVoce}».` : ""),
    occasioni: [
      { quando: (c) => facciataTenuta(c, "beta_dichiara"), testo: "Hai scelto Beta e l'hai scritto in etichetta. Costava meno ed era più vicino: sulla carta la scelta migliore. Ma il riciclato non era tracciabile, e la responsabilità di quella frase era di Borea. Due anni fa un concorrente distrusse sessantamila confezioni per lo stesso motivo." },
      { quando: (c) => !(c.letti.has("M7") && c.letti.has("M8")), testo: "Il ventuno per cento dell'impatto stava nei trasporti, e quasi tutto in fibbie e zip che arrivavano dalla Cina in aereo. C'era un fornitore europeo a trentacinque centesimi. Guardavi il tessuto e il guadagno più grande era altrove." },
      { quando: (c) => !c.letti.has("M11"), testo: "Eliminare il sacchetto di plastica avrebbe tolto il quattro per cento d'impatto facendoti risparmiare otto centesimi. Era l'unica cosa gratis della missione." },
      { quando: (c) => !c.letti.has("M12"), testo: "L'ordine ad Alfa andava fatto entro il 15 maggio. Te ne sei accorto quando il commerciale è entrato con il calendario in mano." },
      { quando: (c) => c.pianoSel !== undefined && nelPiano(c, "tessuto_alfa") && !nelPiano(c, "documentazione"), testo: "Hai comprato il materiale migliore e non ti sono rimasti centesimi per documentarlo. Hai fatto la cosa giusta senza poterla provare — che in questo mestiere conta meno di quanto dovrebbe." },
      { quando: (c) => scartato(c, "beta_dichiara") && !scartato(c, "beta_muto"), testo: "Hai scartato la scorciatoia di dichiarare un riciclato che non potevi certificare, e hai tenuto la strada di migliorare senza vantartene. È la risposta più sottile di questa missione: si può migliorare un prodotto senza scriverci sopra cose che non si dimostrano." },
    ],
  },
};

export function costruisciRestituzione(slug: string, get: LeggiRisposta, areeTop: AreaTop[]): Restituzione {
  const mandato = mandatoScelto(get);
  const letti = materialiLetti(get);
  const s3 = get("s3_budget") as (PayloadAlloca & PayloadLavori) | undefined;
  const alloc = s3?.allocazioni; // Stanza 3.1 alloca_budget (Missioni 01-03)
  const pianoSel = s3?.selezionati; // Stanza 3.1 pianifica_lavori (Missione 04)
  const scartati = (get("s3_scarto") as PayloadScarta | undefined)?.scartati;
  const narr = NARRATIVA[slug];

  // Missione risolta: per leggere le voci del budget / i lavori del piano
  // (etichetta della fetta più grande) e i dossier della Stanza 2.
  const mission = getMissione(slug, get);
  const stepBudget = mission?.stanze.flatMap((s) => s.step).find((s) => s.id === "s3_budget") as StepAllocaBudget | StepPianificaLavori | undefined;
  const stepDossier = mission?.stanze.flatMap((s) => s.step).find((s) => s.id === "s2_informazioni") as StepSelezionaInformazioni | undefined;

  // ── 1. Cosa hai costruito
  let costruito: string | null = null;
  if (mandato && narr) {
    let topLabel: string | null = null;
    let topVal = 0;
    if (stepBudget?.tipo === "alloca_budget") {
      for (const v of stepBudget.voci) {
        const a = Number(alloc?.[v.id]) || 0;
        if (a > topVal) { topVal = a; topLabel = v.label.toLowerCase(); }
      }
    } else if (stepBudget?.tipo === "pianifica_lavori") {
      for (const l of stepBudget.lavori) {
        if ((pianoSel?.includes(l.id) ?? false) && l.costo > topVal) { topVal = l.costo; topLabel = l.label.toLowerCase(); }
      }
    }
    costruito = narr.costruito(mandato, topLabel);
  }

  // ── 2. Come hai deciso (focalizzazione vs esplorazione)
  let metodo: string | null = null;
  const selezionati = (get("s2_informazioni") as PayloadSeleziona | undefined)?.selezionati ?? [];
  if (mandato && selezionati.length > 0 && stepDossier) {
    const areeMandato = new Set(mandato.aree);
    const areeToccate = new Set<string>();
    let dentroMandato = 0;
    for (const id of selezionati) {
      const m = stepDossier.dossier.find((d) => d.id === id);
      if (!m) continue;
      m.aree.forEach((a) => areeToccate.add(a));
      if (m.aree.some((a) => areeMandato.has(a))) dentroMandato++;
    }
    if (dentroMandato === selezionati.length) {
      metodo = `Sei andato dritto: i ${selezionati.length} approfondimenti che hai speso erano tutti dentro il tuo campo. Hai preferito approfondire una direzione piuttosto che guardarti intorno — è uno stile, non un difetto.`;
    } else if (areeToccate.size >= 4) {
      metodo = `Hai voluto guardarti intorno: hai distribuito gli approfondimenti su ${areeToccate.size} aree diverse prima di impegnarti. Raccogli molti punti di vista — è uno stile, non una dispersione.`;
    } else {
      metodo = "Hai tenuto insieme la tua direzione e uno sguardo più largo: qualche approfondimento nel tuo campo, qualcuno fuori. Un equilibrio tra concentrarsi e curiosare.";
    }
  }

  // ── 3. Le occasioni (conseguenze)
  const occasioni: string[] = [];
  if (narr) {
    const ctx: OccasioneCtx = { letti, alloc, pianoSel, scartati, mandato };
    for (const r of narr.occasioni) if (r.quando(ctx)) occasioni.push(r.testo);
  }

  // ── 4. Le ipotesi
  let ipotesi: string | null = null;
  if (areeTop.length > 0) {
    const nomi = areeTop.slice(0, 3).map((a) => a.nome);
    ipotesi = `Da come hai messo in ordine le priorità e da dove hai messo le risorse quando eri stretto, le aree che si sono attivate di più sono ${elenco(nomi)}. È un'ipotesi, non un verdetto: serve un'altra missione per capire se regge.`;
  }

  // ── nota da_verificare (autoefficacia≠performance)
  let notaVerifica: string | null = null;
  const daVerificare = areeTop.find((a) => a.status === "da_verificare");
  if (daVerificare) {
    notaVerifica = `Su ${daVerificare.nome} c'è un segnale interessante: la fiducia che ti sei dato e come te la sei cavata davvero non vanno nella stessa direzione. Vale la pena controllare se ti succede spesso — a volte ci si sottovaluta.`;
  }

  return { costruito, metodo, occasioni, ipotesi, notaVerifica };
}
