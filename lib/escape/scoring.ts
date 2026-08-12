// KIREO Escape — motore di scoring (SOLO server: importato dal route di
// finalizzazione, mai dal client). Trasforma le risposte autorevoli lette dal
// DB in prove (evidence). Gli step strutturati sono deterministici; i tre step
// aperti (non-approfondire, proposta, riflessione) passano da Haiku. Un
// fallimento AI non blocca la missione: si emettono comunque le prove
// strutturate.
//
// Le missioni condividono la STRUTTURA (stessi tipi di step) ma differiscono per
// alcune specifiche di punteggio (pesi, performance del budget, ideali dei
// passi, se l'ordinamento è una gerarchia di affidabilità verificabile, prompt
// AI). Questi bit vivono in SPEC[slug], server-only per anti-gaming: chi legge
// il bundle client non vede quali risposte "pagano". La Missione 01 riproduce
// esattamente i valori della v2.

import Anthropic from "@anthropic-ai/sdk";
import { AREE, getAreaBySlug } from "@/data/aree";
import type {
  Dimensione,
  EscapeMission,
  EvidenceInput,
  LeggiRisposta,
  Mandato,
  Payload,
  PayloadAlloca,
  PayloadAssegna,
  PayloadAssegnaPersone,
  PayloadEsplora,
  PayloadLavori,
  PayloadOrdina,
  PayloadPianifica,
  PayloadPrevisione,
  PayloadScarta,
  PayloadSceltaSingola,
  PayloadSeleziona,
  PayloadTesto,
  StepPianificaLavori,
  VoceBudget,
} from "./tipi";
import { mandatoScelto, materialiLetti, stepDellaMissione, valutaPiano, SLUG_ACQUA, SLUG_CANTIERE, SLUG_CLASSE, SLUG_FILIERA, SLUG_MEDIATECA, SLUG_MUSEO, SLUG_PALCO, SLUG_QUARTIERE, SLUG_SERRA, SLUG_SPORTELLO, SLUG_VIAGGIO } from "./config";

const MODELLO_ESCAPE = "claude-haiku-4-5"; // stesso modello provato in prod (workshop/assistente)

const DIMENSIONI_VALIDE = new Set<Dimensione>(["interest", "performance", "self_efficacy", "curiosity"]);
const AREE_VALIDE = new Set(AREE.map((a) => a.slug));
const PESO_MINIMO = 0.01;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const nomeArea = (slug: string) => getAreaBySlug(slug)?.nome ?? slug;

// Paracadute finale prima di passare l'array a registra_evidence: nessuna prova
// deve violare i CHECK del DB (valore in [0,1], peso > 0, dimensione/area
// validi). valore e peso vengono FORZATI nel range; le prove con dimensione o
// area non valida vengono SCARTATE. Così un output AI malformato degrada a zero
// prove aperte, senza mai bloccare la missione.
function sanitizzaEvidenze(evidenze: EvidenceInput[]): EvidenceInput[] {
  const pulite: EvidenceInput[] = [];
  for (const e of evidenze) {
    if (!DIMENSIONI_VALIDE.has(e.dimensione)) continue;
    if (e.area_slug !== null && !AREE_VALIDE.has(e.area_slug)) continue;
    const valore = Number.isFinite(e.valore) ? Math.max(0, Math.min(1, e.valore)) : 0;
    const peso = Number.isFinite(e.peso) && e.peso > 0 ? e.peso : PESO_MINIMO;
    const motivazione = (typeof e.motivazione === "string" ? e.motivazione.trim() : "") || "Segnale rilevato durante la missione.";
    pulite.push({ ...e, valore, peso, motivazione: motivazione.slice(0, 2000) });
  }
  return pulite;
}

// ─────────────────────────────────────────── spec di punteggio per missione

type Pesi = {
  mandato: number; ordinaInt: number; selCur: number; selInt: number;
  budgetInt: number; budgetPerf: number; scartoInt: number; scartoPerf: number;
  ruoli: number; ai: number; previsione: number; passi: number; esplora: number;
};

type BudgetCtx = { alloc: Record<string, number>; voci: VoceBudget[]; letti: Set<string>; totale: number };

type PianoCtx = { step: StepPianificaLavori; sel: string[]; letti: Set<string> };

// Segnale forte di delega (Missione 10): un abbinamento compito↔persona che,
// SE il materiale è stato letto, vale come performance. Riconosciuto SINGOLARMENTE
// (una prova per ogni abbinamento azzeccato), mai come blocco.
type AssegnaSegnale = { compito: string; persona: string; richiede: string; area: string; peso: number; motivazione: string };

type ScoringSpec = {
  pesi: Pesi;
  esploraTesti: { conBonus: string; base: string };
  pianificaIdeali: string[];
  ordinaPerformance?: { area: string; peso: number };
  budgetPerformance?: (c: BudgetCtx) => { valore: number; buona: string; migliora: string };
  pianoPerformance?: (c: PianoCtx) => { valore: number; buona: string; migliora: string };
  assegnaSegnali?: AssegnaSegnale[];
  promptProposta: (aree: string[], ctx: { letti: Set<string> }) => string;
};

// pienezza (uso del budget) × equilibrio (non tutto su una voce) — comuni.
function pienezzaEquilibrio(alloc: Record<string, number>, totale: number) {
  const speso = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
  const maxAlloc = Math.max(0, ...Object.values(alloc).map((v) => Number(v) || 0));
  const pienezza = clamp01(totale > 0 ? speso / totale : 0);
  const equilibrio = speso > 0 ? clamp01(1 - Math.max(0, maxAlloc / speso - 0.5) / 0.5) : 0;
  return { pienezza, equilibrio };
}

const PESI_BASE: Pesi = {
  mandato: 1.3, ordinaInt: 0.8, selCur: 0.6, selInt: 0.4, budgetInt: 0.6, budgetPerf: 1.3,
  scartoInt: 0.5, scartoPerf: 1.3, ruoli: 0.8, ai: 0.5, previsione: 0.5, passi: 0.6, esplora: 0.4,
};

const SPEC: Record<string, ScoringSpec> = {
  // ── Missione 01 — invariata rispetto alla v2
  [SLUG_QUARTIERE]: {
    pesi: PESI_BASE,
    esploraTesti: {
      conBonus: "Hai voluto sentire le voci del quartiere, non solo leggere i numeri: parti dalle persone.",
      base: "Hai aperto i documenti prima di decidere: parti dai fatti, non dalle impressioni.",
    },
    pianificaIdeali: ["sicurezza", "convenzione", "lavori"],
    budgetPerformance: ({ alloc, voci, letti, totale }) => {
      let punti = 0, max = 0;
      const tetto = Number(alloc["tetto"]) || 0;
      const sogliaTetto = letti.has("M4") ? 27000 : 50000;
      max += 2; punti += tetto >= sogliaTetto ? 2 : clamp01(tetto / sogliaTetto) * 2;
      const voceVincolo = voci.find((v) => v.id === "adeguamento_vincolo");
      if (voceVincolo) {
        const sp = Number(alloc["adeguamento_vincolo"]) || 0;
        const soglia = (voceVincolo.costoIndicativo ?? 30000) * 0.8;
        max += 2; punti += sp >= soglia ? 2 : clamp01(sp / soglia) * 2;
      }
      if (letti.has("M7") && voci.some((v) => v.id === "fondo_gestione")) {
        const f = Number(alloc["fondo_gestione"]) || 0;
        max += 1.5; punti += f > 0 ? 1.5 : 0;
      }
      const { pienezza, equilibrio } = pienezzaEquilibrio(alloc, totale);
      max += 2; punti += pienezza + equilibrio;
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Hai retto il colpo del tetto e coperto il vincolo senza dimenticare la sostenibilità: scelte lucide sotto pressione.",
        migliora: "La distribuzione lascia scoperto qualcosa di importante (il tetto, il vincolo o la gestione): c'è margine per bilanciare meglio.",
      };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto la proposta per rigenerare un ex mercato coperto del suo quartiere. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che la proposta enfatizza di più. Per ognuna valuta: performance = quanto la proposta è concreta, coerente col mandato e col vincolo, argomentata su quell'area (0-1); interest = quanto la proposta ci punta (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice, rivolta allo studente. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },

  // ── Missione 02 — "La crisi della comunicazione"
  [SLUG_MEDIATECA]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.4, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai voluto sentire le voci di chi usa la mediateca, non solo leggere i numeri: parti dalle persone.",
      base: "Hai aperto i documenti prima di rispondere: parti dai fatti, non dalle impressioni.",
    },
    pianificaIdeali: ["assoc", "accessibilita", "comunicazione_interna"],
    budgetPerformance: ({ alloc, voci, letti, totale }) => {
      let punti = 0, max = 0;
      const info = Number(alloc["informare_personale"]) || 0;
      if (letti.has("M8")) { max += 1.5; punti += info > 0 ? 1.5 : 0; } else { max += 1; punti += info > 0 ? 1 : 0.4; }
      const verif = Number(alloc["verificare_fatti"]) || 0;
      max += 1; punti += verif > 0 ? 1 : 0;
      if (voci.some((v) => v.id === "rispondere_associazione")) {
        const a = Number(alloc["rispondere_associazione"]) || 0;
        max += 1; punti += a > 0 ? 1 : 0;
      }
      const { pienezza, equilibrio } = pienezzaEquilibrio(alloc, totale);
      max += 2; punti += pienezza + equilibrio;
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Hai verificato prima di parlare, rispettato la scadenza formale e non hai lasciato il personale all'oscuro: una risposta che regge.",
        migliora: "Qualcosa di importante è rimasto scoperto — verificare i fatti, la scadenza della diffida o informare chi ci lavora: c'è margine per bilanciare meglio.",
      };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto la risposta pubblica alla crisi di comunicazione di una biblioteca comunale (una decisione impopolare presa e comunicata male). Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che la risposta enfatizza di più. Per ognuna valuta: performance = quanto la risposta è concreta, dice PRIMA cosa cambia per chi legge, ammette un errore concreto, è coerente col mandato e col vincolo (0-1). NON premiare la lunghezza né il linguaggio istituzionale o burocratico. interest = quanto la risposta punta su quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },

  // ── Missione 03 — "Il prototipo che non funziona"
  [SLUG_SERRA]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.4, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai guardato il registro delle prove e non solo la scheda: è lì che si nasconde il dato che non torna.",
      base: "Hai osservato prima di ipotizzare: parti da quello che vedi, non da quello che credi.",
    },
    pianificaIdeali: ["flusso", "valvola", "orari"],
    ordinaPerformance: { area: "scienze-ricerca", peso: 1.2 },
    budgetPerformance: ({ alloc, voci, totale }) => {
      let punti = 0, max = 0;
      const prep = Number(alloc["preparare_spiegazione"]) || 0;
      max += 1.5;
      if (prep <= 0) punti += 0;
      else if (prep > totale / 2) punti += 0.5;
      else punti += 1.5;
      const mis = Number(alloc["misurare_acqua"]) || 0;
      max += 1; punti += mis > 0 ? 1 : 0;
      if (voci.some((v) => v.id === "correggere_registrazione")) {
        max += 1; punti += (Number(alloc["correggere_registrazione"]) || 0) > 0 ? 1 : 0;
      }
      if (voci.some((v) => v.id === "spostare_orario")) {
        max += 1; punti += (Number(alloc["spostare_orario"]) || 0) > 0 ? 1 : 0;
      }
      const { pienezza, equilibrio } = pienezzaEquilibrio(alloc, totale);
      max += 2; punti += pienezza + equilibrio;
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Hai speso il tempo a misurare la realtà e a preparare la spiegazione senza trascurare né l'una né l'altra: metodo lucido sotto scadenza.",
        migliora: "Hai lasciato scoperto qualcosa — misurare davvero, o preparare come raccontarlo — oppure ci hai messo tutto senza aver capito la causa.",
      };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto la spiegazione di un guasto tecnico: in una serra automatica una sezione secca mentre il sistema dice che è stata irrigata. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che la spiegazione tocca di più. Per ognuna valuta: performance = qualità del RAGIONAMENTO CAUSALE e ONESTÀ sul livello di certezza (0-1). REGOLA IMPORTANTE: premia esplicitamente chi scrive che «non ne è ancora certo» quando non ha raccolto le prove; NON premiare una spiegazione sicura ma non verificata, nemmeno se azzecca la causa. La sicurezza senza prove vale MENO dell'onestà epistemica. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },

  // ── Missione 04 — "Il cantiere della scuola"
  [SLUG_CANTIERE]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.5, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai voluto sentire chi la palestra la vive ogni giorno, non solo leggere i tecnici: in un cantiere le persone contano.",
      base: "Hai letto i documenti prima di decidere: parti dai fatti, non dalle impressioni.",
    },
    pianificaIdeali: ["registro", "controlli", "accessibilita"],
    pianoPerformance: ({ step, sel, letti }) => {
      const { soldi, giorni, dipendenzeMancanti } = valutaPiano(step, sel);
      const budgetSoldi = step.budgetSoldi ?? Number.POSITIVE_INFINITY;
      const budgetGiorni = step.budgetGiorni ?? Number.POSITIVE_INFINITY;
      let punti = 0, max = 0;
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      max += 2; punti += giorni <= budgetGiorni ? 2 : clamp01(1 - (giorni - budgetGiorni) / budgetGiorni) * 2;
      max += 1.5; punti += dipendenzeMancanti.length === 0 ? 1.5 : 0;
      const essenziali = step.lavori.filter((l) => l.essenziale).map((l) => l.id);
      const incl = essenziali.filter((id) => sel.includes(id)).length;
      max += 2; punti += essenziali.length ? (incl / essenziali.length) * 2 : 0;
      if (letti.has("M11")) { max += 1; punti += sel.includes("fondo_imprevisti") ? 1 : 0; }
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Il tuo piano sta dentro i soldi e i giorni, rispetta le dipendenze e non lascia fuori i lavori senza cui non si riapre: è aritmetica che torna.",
        migliora: "Il piano non chiude: sfora i soldi o i giorni, salta una dipendenza d'ordine, o lascia fuori un lavoro senza cui il collaudo non passa.",
      };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il resoconto di un cantiere: la ristrutturazione della palestra della sua scuola, con budget e scadenza rigidi. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che il testo tocca di più. Per ognuna valuta: performance = coerenza tra il piano, i vincoli e la realtà di tempi e dipendenze, e soprattutto ONESTÀ (0-1). REGOLE: premia chi NOMINA esplicitamente ciò che ha lasciato indietro e chi ne paga il prezzo; NON premiare i toni trionfali; se il testo riconosce che il problema viene da anni di rinvii senza usarlo come scusa, premialo. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },

  // ── Missione 05 — "Il pronto soccorso organizzativo"
  // Requisito di progetto: NESSUN bonus di velocità. La performance del budget
  // (minuti-operatore) NON usa la pienezza né il totale speso: un piano che usa
  // tutti i 210 minuti non vale meno di uno che ne usa 140. Conta solo se i
  // compiti giusti sono presi in carico (>0 minuti).
  [SLUG_SPORTELLO]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.4, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai voluto sentire le voci degli operatori, non solo leggere le richieste: già lì c'erano tre priorità diverse e incompatibili.",
      base: "Hai letto le richieste prima di decidere l'ordine: parti dai fatti, non dall'istinto.",
    },
    pianificaIdeali: ["procedura_anonime", "segnala_ferme", "sociale_alunno"],
    budgetPerformance: ({ alloc, letti }) => {
      // Solo presenza/assenza dei compiti giusti: mai il totale dei minuti.
      let punti = 0, max = 0;
      if (letti.has("M5")) { max += 2; punti += (Number(alloc["trasmetti_segnalazione"]) || 0) > 0 ? 2 : 0; }
      max += 1.5; punti += ((Number(alloc["protocolla_kaur"]) || 0) + (Number(alloc["compila_kaur"]) || 0)) > 0 ? 1.5 : 0;
      if (letti.has("M12")) { max += 1.5; punti += (Number(alloc["data_per_ciascuno"]) || 0) > 0 ? 1.5 : 0; }
      max += 1; punti += (Number(alloc["rispondi_mail"]) || 0) > 0 ? 1 : 0;
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Hai preso in carico ciò che oggi non poteva aspettare — il termine sul minore, la scadenza della domanda, chi non va lasciato senza una data: scelte lucide, senza correre.",
        migliora: "Qualcosa che oggi aveva un termine o una conseguenza è rimasto scoperto. Non è questione di fare in fretta: è questione di cosa hai messo davanti.",
      };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente, tirocinante in uno sportello di ascolto sociale, ha scritto la risposta a una MAIL ANONIMA: qualcuno che chiede aiuto senza farsi identificare, ha scritto una volta sola e potrebbe non riscrivere. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = la risposta NON chiede informazioni identificative (nome, età, famiglia), tiene aperto il canale e offre un appiglio concreto e raggiungibile (0-1). REGOLA DURA: premia le risposte BREVI, non invadenti, con un contatto raggiungibile; NON premiare le risposte lunghe, protettive o piene di domande, per quanto ben intenzionate. Chi scrive «dimmi chi sei e ti aiutiamo» ha sbagliato pur volendo bene: valutalo basso. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },

  // ── Missione 06 — "La filiera trasparente"
  // Stanza 3.1 è un pianifica_lavori a magnitudo singola (centesimi), con una
  // voce a costo NEGATIVO (eliminare il sacchetto: libera 8 cent). Il prompt
  // 4.2 ha una LISTA NERA di parole e riceve i materiali letti per distinguere
  // un numero verificato da uno inventato.
  [SLUG_FILIERA]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.5, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai letto le voci della riunione, non solo i numeri: una di quelle persone stava proponendo qualcosa di illegale.",
      base: "Hai guardato la filiera e i vincoli prima di decidere: parti dai dati, non dagli slogan.",
    },
    pianificaIdeali: ["misura_impatto", "pubblica_dati", "forma_commerciale"],
    pianoPerformance: ({ step, sel, letti }) => {
      const { soldi } = valutaPiano(step, sel); // la voce negativa riduce il totale: gestito nativamente
      const budgetSoldi = step.budgetSoldi ?? Number.POSITIVE_INFINITY;
      let punti = 0, max = 0;
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      max += 1.5; punti += sel.includes("documentazione") ? 1.5 : 0; // per poter dichiarare senza mentire
      if (letti.has("M11")) { max += 1; punti += sel.includes("sacchetto") ? 1 : 0; } // il guadagno gratuito
      if (letti.has("M7") && letti.has("M8")) { max += 1; punti += sel.includes("accessori_europei") ? 1 : 0; } // miglior rapporto impatto/costo
      max += 1; punti += sel.includes("tessuto_alfa") || sel.includes("tessuto_beta") ? 1 : 0; // hai comunque migliorato il materiale
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Hai comprato più impatto possibile con il margine che c'era — sfruttando anche il risparmio del sacchetto — e ti sei tenuto i soldi per documentare ciò che dichiari.",
        migliora: "Il piano sfora il margine, oppure ha comprato il materiale giusto senza lasciare nulla per documentarlo: la cosa giusta che non puoi dimostrare, in questo mestiere, conta poco.",
      };
    },
    promptProposta: (aree, { letti }) => {
      const numeri: string[] = [];
      if (letti.has("M1")) numeri.push("ripartizione impatto: materie prime 48%, trasporti 21%, trasformazione 11%, distribuzione 9%, imballaggio 6%, fine vita 5%");
      if (letti.has("M4")) numeri.push("tessuto: Alfa −34% impatto (certificato), Beta −28% dichiarato ma non verificato");
      if (letti.has("M7")) numeri.push("trasporti: 14% accessori in aereo dalla Cina, 7% filato via nave");
      if (letti.has("M8")) numeri.push("accessori europei: −12% impatto a +0,35 € a zaino");
      if (letti.has("M9")) numeri.push("prodotto smontabile: +0,45 € a zaino");
      if (letti.has("M10")) numeri.push("resistenza: tessuto Alfa 92%, Beta non testato");
      if (letti.has("M11")) numeri.push("eliminare il sacchetto: −4% impatto e −0,08 € (si risparmia)");
      const verificati = numeri.length
        ? `Numeri che lo studente ha EFFETTIVAMENTE verificato e può citare: ${numeri.join("; ")}.`
        : "Lo studente non ha verificato alcun numero specifico: qualsiasi percentuale nel testo è inventata.";
      return `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto l'ETICHETTA di uno zaino scolastico: cosa è stato cambiato, di quanto, e cosa non è stato fatto. Ogni affermazione dovrebbe essere sostenuta da un dato che ha davvero verificato. ${verificati} Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = ogni affermazione è sostenuta da un dato verificato e non ci sono termini generici né numeri inventati (0-1). REGOLE DURE: PENALIZZA ESPLICITAMENTE le parole «eco», «green», «100% sostenibile», «amico dell'ambiente» e QUALSIASI percentuale o numero NON presente nell'elenco dei numeri verificati (è inventato). PREMIA chi cita solo numeri verificati e chi dichiara cosa è rimasto fuori. Una comunicazione modesta e dimostrabile vale più di una entusiasta. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`;
    },
  },

  // ── Missione 07 — "Il museo da reinventare"
  // Stanza 3.1 è un pianifica_lavori a TETTO in euro (18.000 €): il piano deve
  // stare dentro il budget e rispettare il bando (un'iniziativa RIPETIBILE, non
  // un evento una-tantum). Il prompt 4.2 ha una LISTA NERA di formule da depliant
  // e riceve i materiali letti per premiare chi cita un nome vero del registro
  // del 1911 (M6).
  [SLUG_MUSEO]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.5, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai voluto sentire cosa si sono detti i volontari, non solo leggere la collezione: qualcuno in riunione aveva già visto il punto.",
      base: "Hai aperto i documenti prima di decidere: parti dai fatti, non dalle impressioni.",
    },
    pianificaIdeali: ["misurare_ritorni", "digitalizzare_registro", "formare_volontari"],
    pianoPerformance: ({ step, sel }) => {
      const { soldi } = valutaPiano(step, sel);
      const budgetSoldi = step.budgetSoldi ?? Number.POSITIVE_INFINITY;
      let punti = 0, max = 0;
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      const formatiRipetibili = ["fmt_podcast", "fmt_video", "fmt_pannelli", "fmt_schermi", "fmt_laboratorio"];
      const haRipetibile = formatiRipetibili.some((id) => sel.includes(id));
      max += 2; punti += haRipetibile ? 2 : 0; // il bando chiede un'iniziativa ripetibile senza nuovi fondi
      max += 1; punti += sel.includes("accessibilita_sala3") ? 1 : 0; // premiata dal bando
      let valore = clamp01(max > 0 ? punti / max : 0.5);
      // Un evento una-tantum (fmt_evento) senza alcun formato ripetibile viola il
      // bando: qualunque cosa d'altro tu abbia messo nel piano, il progetto non è
      // rendicontabile come «ripetibile».
      if (sel.includes("fmt_evento") && !haRipetibile) valore = Math.min(valore, 0.3);
      return {
        valore,
        buona: "Hai scelto un formato che si ripete senza nuovi fondi, sei rimasto dentro i 18.000 € e non hai dimenticato l'accessibilità che il bando premia: un progetto che regge la rendicontazione.",
        migliora: "Il piano sfora il budget, o punta su un formato che funziona una volta sola: il bando chiede un'iniziativa ripetibile, non un colpo a effetto.",
      };
    },
    promptProposta: (aree, { letti }) => {
      const registro = letti.has("M6")
        ? "Lo studente HA letto il registro di fabbrica del 1911 e conosce nomi veri delle operaie (es. Teresa B., anni nove, sguattera): PREMIA chi ne cita uno reale nel testo."
        : "Lo studente NON ha letto il registro del 1911: non conosce nomi veri. Non penalizzarlo per non citarne uno, ma non c'è un nome reale da valorizzare.";
      return `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il TESTO DI LANCIO di un museo della seta (max 80 parole) che deve far venire chi non c'è mai stato e tornare chi c'è già stato. ${registro} Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il testo NOMINA una cosa concreta che il visitatore farà o vedrà, è coerente col pubblico scelto e NON usa formule da brochure (0-1). REGOLE DURE: PENALIZZA ESPLICITAMENTE le frasi «un viaggio nel tempo», «un'esperienza unica», «alla scoperta di», «riscoprire le nostre radici» e QUALSIASI linguaggio generico da depliant. PREMIA chi nomina qualcosa di concreto e, se ha letto il registro, chi usa un nome vero delle operaie. Un testo modesto e concreto vale più di uno entusiasta e vuoto. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`;
    },
  },

  // ── Missione 08 — "La città senz'acqua"
  // Stanza 1.2 riusa la gerarchia di AFFIDABILITÀ (come Missione 03): l'ordine
  // corretto — un dato misurato sopra una stima vecchia, una stima sopra
  // un'interpretazione — emette performance su scienze-ricerca. Stanza 3.1 è un
  // pianifica_lavori a OBIETTIVO da RAGGIUNGERE (barra che si riempie): la somma
  // dei risparmi deve arrivare a 20 punti; tempo e costo sono secondari.
  [SLUG_ACQUA]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.5, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai voluto sentire le voci del gruppo tecnico, non solo la tabella: attorno a quel tavolo c'era già chi leggeva i numeri in modo opposto.",
      base: "Hai letto i dati prima di decidere: parti dai fatti, non dall'istinto.",
    },
    pianificaIdeali: ["misuratori_permanenti", "pubblica_dati", "mappatura_perdite"],
    ordinaPerformance: { area: "scienze-ricerca", peso: 1.2 },
    pianoPerformance: ({ step, sel, letti }) => {
      const { risparmio } = valutaPiano(step, sel);
      const obiettivo = step.obiettivo ?? 20;
      let punti = 0, max = 0;
      // 1) raggiungere davvero il traguardo di risparmio (la barra che si riempie)
      max += 2.5; punti += risparmio >= obiettivo ? 2.5 : clamp01(risparmio / obiettivo) * 2.5;
      // 2) tempestività: la tariffa progressiva entra in vigore in 3 mesi, non
      //    serve a un'emergenza che è ora. Contarci sopra è un errore.
      max += 1; punti += sel.includes("tariffa") ? 0 : 1;
      // 3) l'acqua «che esce per nessuno» (consumi pubblici) è risparmio a costo
      //    zero e senza colpire un cittadino, ma solo se l'ha scoperto (M8)
      if (letti.has("M8")) { max += 1.5; punti += sel.includes("consumi_pubblici") ? 1.5 : 0; }
      // 4) la perdita reale del 22% è la leva più grande, ma solo se l'ha misurata (M4)
      if (letti.has("M4")) { max += 1.5; punti += sel.includes("riparazione") ? 1.5 : 0; }
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Il tuo pacchetto arriva al 20% con misure che colpiscono l'acqua sprecata, non sempre gli stessi cittadini, e senza appoggiarsi a una tariffa che arriverebbe a emergenza finita.",
        migliora: "Il pacchetto non arriva al traguardo, o ci arriva contando su misure fuori tempo (la tariffa fra tre mesi) o lasciando sul tavolo l'acqua che esce per nessuno e le perdite di rete.",
      };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il TESTO di un'ordinanza sindacale per ridurre del 20% i consumi d'acqua durante una siccità, «senza colpire sempre gli stessi». Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = l'ordinanza indica una scadenza e un riesame, cita solo numeri verificati, colpisce un USO (irrigazione, piscine, sprechi pubblici) e non un quartiere, senza allarmismi (0-1). REGOLE: PREMIA chi mette una data e un riesame e chi distingue l'uso dal quartiere; NON premiare gli appelli generici, gli allarmismi né chi colpisce «Colline» come se fosse un colpevole. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },

  // ── Missione 09 — "Il palco cambia programma"
  // Missione veloce, poca analisi: il programma (alloca_budget in minuti) premia
  // chi copre la serata usando le risorse reali (coro del centro se M6, banda
  // ridotta se M5) e lascia spazio all'annuncio (se M12).
  [SLUG_PALCO]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.4, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Hai voluto sentire le telefonate del pomeriggio, non solo il programma: già lì il direttore diceva due cose opposte nella stessa frase.",
      base: "Hai guardato programma, risorse e budget prima di decidere: parti dai fatti, non dal panico.",
    },
    pianificaIdeali: ["piano_b", "procedura_annunci", "coinvolgere_centro"],
    budgetPerformance: ({ alloc, letti, totale }) => {
      let punti = 0, max = 0;
      // copertura della serata (il programma deve reggere fino ai fuochi)
      const { pienezza } = pienezzaEquilibrio(alloc, totale);
      max += 1.5; punti += pienezza * 1.5;
      // il coro del centro estivo, se scoperto, riempie il buco a costo zero
      if (letti.has("M6")) { max += 1.5; punti += (Number(alloc["coro_centro"]) || 0) > 0 ? 1.5 : 0; }
      // la Filarmonica ridotta, se scoperta: salva il gruppo invece di eliminarlo
      if (letti.has("M5")) { max += 1.5; punti += (Number(alloc["filarmonica_ridotta"]) || 0) > 0 ? 1.5 : 0; }
      // il momento di spiegazione, se ha letto del 2019
      if (letti.has("M12")) { max += 1; punti += (Number(alloc["ringraziamento"]) || 0) > 0 ? 1 : 0; }
      // la Filarmonica completa non è eseguibile con 23 elementi
      max += 1; punti += (Number(alloc["filarmonica_completa"]) || 0) > 0 ? 0 : 1;
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Hai riempito la serata con quello che avevi davvero sottomano — il coro dei ragazzi, la banda che sale lo stesso — e hai lasciato un minuto per spiegare: un programma che sta in piedi con le risorse vere.",
        migliora: "Il programma lascia un buco o si appoggia a qualcosa che non c'è (i 34 elementi, un'ora che il permesso non concede): con le risorse reali si poteva coprire la serata meglio.",
      };
    },
    promptProposta: (aree, { letti }) => {
      const avviso = letti.has("M12") ? " Lo studente sa cosa successe nel 2019 (la gente si arrabbiò per non essere stata avvisata): PREMIA chi avvisa PRIMA, con chiarezza, invece di far scoprire il cambio in piazza." : "";
      return `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il MESSAGGIO al pubblico di una festa di paese il cui concerto principale è saltato all'ultimo. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il messaggio dice COSA È SUCCESSO senza nasconderlo nella prima frase, dice COSA CI SARÀ in concreto, e non promette ciò che non c'è (0-1). REGOLE DURE: PENALIZZA i giri di parole («per cause di forza maggiore», «un programma ancora più ricco»), l'entusiasmo posticcio e ogni formulazione che nasconda il cambio; PREMIA chi dice la verità subito e nomina una cosa concreta e nuova.${avviso} interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`;
    },
  },

  // ── Missione 10 — "La classe che non partecipa"
  // DIVIETO LESSICALE (requisito di progetto): nel prompt del revisore e in ogni
  // testo NON compaiono mai «leader», «capo», «trascinatore» né etichette sulle
  // persone. Cinque abbinamenti compito↔persona (assegnaSegnali) sono segnali
  // forti, riconosciuti uno a uno nello step assegna_persone.
  [SLUG_CLASSE]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.4, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Ti sei fermato su un dettaglio che nessuno aveva notato: in centoquaranta messaggi, una persona non ne ha mai scritto uno. È l'assenza che parla più forte.",
      base: "Hai guardato le schede, la chat e cosa chiede il progetto prima di muoverti: parti dai fatti, non dalle impressioni.",
    },
    pianificaIdeali: ["chiedere_cosa_sa", "scrivere_compiti", "quattrocchi"],
    budgetPerformance: ({ alloc, voci, totale }) => {
      let punti = 0, max = 0;
      // parlare uno a uno con chi non partecipa: è il cuore, non un lusso
      max += 2; punti += (Number(alloc["parlare_uno_a_uno"]) || 0) > 0 ? 2 : 0;
      // definire i compiti (se sbloccato): sblocca chi si ferma sul vago
      if (voci.some((v) => v.id === "rifare_piano")) { max += 1; punti += (Number(alloc["rifare_piano"]) || 0) > 0 ? 1 : 0; }
      // dare a Elisa un compito compatibile, se scoperto
      if (voci.some((v) => v.id === "compito_elisa")) { max += 1; punti += (Number(alloc["compito_elisa"]) || 0) > 0 ? 1 : 0; }
      // fare tutto da sé: la somma dell'esecuzione non deve mangiare tutte le giornate
      const esec = ["verificare_indirizzi", "scrivere_testi", "fare_mappa", "curare_traduzioni", "impaginare"].reduce((a, id) => a + (Number(alloc[id]) || 0), 0);
      max += 2; punti += esec <= totale * 0.6 ? 2 : clamp01(1 - (esec - totale * 0.6) / (totale * 0.4)) * 2;
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Hai messo il tuo tempo dove serviva davvero — parlare con chi non c'è, definire i compiti — invece di prenderti tutta l'esecuzione: così il gruppo ha modo di partecipare.",
        migliora: "Hai concentrato le tue giornate sull'eseguire il lavoro e poco sul far muovere il gruppo: la guida forse esce, ma gli altri restano fermi.",
      };
    },
    assegnaSegnali: [
      { compito: "traduzioni", persona: "amine", richiede: "M4", area: "lingue-relazioni-internazionali", peso: 1.2, motivazione: "Hai dato le traduzioni a chi le sapeva fare in tre lingue: bastava chiederglielo a voce, non in chat." },
      { compito: "impaginazione", persona: "giada", richiede: "M10", area: "scienze-educazione", peso: 1.2, motivazione: "Hai dato a chi si blocca sul vago un compito con confini netti: è così che si sblocca, non motivandola." },
      { compito: "testi", persona: "elisa", richiede: "M5", area: "salute-professioni-sanitarie", peso: 1.2, motivazione: "Hai affidato un lavoro che si fa la mattina e da casa a chi poteva lavorare solo così: un compito costruito sul suo vincolo reale, non contro di esso." },
      { compito: "mappa", persona: "yuri", richiede: "M11", area: "arte-design-moda", peso: 1.2, motivazione: "Hai dato a chi ha troppe idee una cosa sola e concreta da portare a termine: non serviva frenarlo, serviva scegliere per lui." },
      { compito: "indirizzi", persona: "tommaso", richiede: "M7", area: "comunicazione-media", peso: 1.2, motivazione: "Hai rimesso gli indirizzi a chi li aveva già trovati, ma con un metodo diverso: hai corretto il metodo, non la persona." },
    ],
    // NB: nessuna delle parole «leader»/«capo»/«trascinatore» nel prompt, e
    // istruzione esplicita al revisore di non usarle né di etichettare le persone.
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto un MESSAGGIO al proprio gruppo di lavoro (sette compagni su un progetto scolastico) per farlo ripartire. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il messaggio assegna cose PRECISE a persone precise con una scadenza, non generalizza, non rimprovera il gruppo in blocco (0-1). REGOLE DURE: PREMIA i messaggi che nominano le persone e i compiti in modo concreto e che lasciano una porta aperta a chi è sparito; PENALIZZA i rimproveri collettivi («ragazzi così non va», «ci impegniamo tutti tranne alcuni»), i toni da comando e le richieste vaghe; NON premiare chi si assume tutto il lavoro. VINCOLO ASSOLUTO: nel campo "motivazione" NON usare MAI le parole «leader», «capo» o «trascinatore», e NON dare etichette alle persone del gruppo (non è un'analisi psicologica): descrivi solo cosa ha fatto lo studente. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },

  // ── Missione 11 — "Il viaggio impossibile"
  // pianifica_lavori a TETTO in euro, ma il tetto CRESCE se M13 è letto (264→352):
  // la performance usa step.budgetSoldi RISOLTO (il budget effettivo), non un
  // valore nominale. Il revisore ha la penalizzazione più severa delle undici.
  [SLUG_VIAGGIO]: {
    pesi: { ...PESI_BASE, mandato: 1.4, budgetPerf: 1.5, scartoPerf: 1.5, previsione: 1.0, passi: 1.0 },
    esploraTesti: {
      conBonus: "Ti sei fermato sulla frase di Nadir, scritta a penna e ripetuta in corridoio: sta dicendo due volte una cosa che non pensa davvero. È il segnale più importante della missione.",
      base: "Hai guardato preventivo, voci del gruppo e conti prima di decidere: parti dai fatti, non dalle apparenze.",
    },
    pianificaIdeali: ["strutture_accessibili", "fondo_a_tutti", "verificare_accessibilita"],
    pianoPerformance: ({ step, sel, letti }) => {
      const { soldi } = valutaPiano(step, sel);
      const budgetSoldi = step.budgetSoldi ?? Number.POSITIVE_INFINITY; // budget EFFETTIVO (352 se M13, altrimenti 264)
      let punti = 0, max = 0;
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      // Nadir: l'ostello accessibile va incluso (se l'accessibilità è nota)
      if (letti.has("M4")) { max += 2; punti += sel.includes("ostello_accessibile") ? 2 : 0; }
      // Marco: il fondo riservato lo risolve a costo zero (se scoperto)
      if (letti.has("M8")) { max += 1.5; punti += sel.includes("fondo_marco") ? 1.5 : 0; }
      // Sara: rientra, con il treno di gruppo o col biglietto singolo
      max += 1; punti += (sel.includes("treno_gruppo") || sel.includes("treno_singolo")) ? 1 : 0;
      // Chiara: mangia senza glutine, se il costo nascosto è stato scoperto
      if (letti.has("M6")) { max += 1; punti += sel.includes("pasti_glutine") ? 1 : 0; }
      return {
        valore: clamp01(max > 0 ? punti / max : 0.5),
        buona: "Il tuo piano fa venire tutti e ventidue e sta dentro il margine — anche perché hai trovato lo sconto che l'ha allargato: l'accessibilità c'è, Marco è coperto in modo riservato, Sara rientra, Chiara mangia.",
        migliora: "Il piano lascia qualcuno fuori o sfora il margine: manca l'ostello accessibile, o il fondo per Marco, o il rientro di Sara — le cose che decidono chi parte, non quanto è bello il viaggio.",
      };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il MESSAGGIO alla classe con le decisioni prese per un viaggio d'istruzione, in cui alcuni compagni hanno esigenze particolari (accessibilità, dieta, budget familiare, orari). Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il messaggio comunica le decisioni in modo chiaro SENZA esporre le situazioni personali di nessuno, e presenta le scelte come normali, non come favori (0-1). REGOLE — LA PENALIZZAZIONE PIÙ SEVERA DI TUTTE: PENALIZZA PESANTEMENTE (performance vicino a 0) ogni frase che nomini la difficoltà di una persona in modo identificabile («abbiamo cambiato ostello per Nadir», «Marco ha delle difficoltà», «per la dieta di Chiara») e ogni tono da buona azione («siamo riusciti a includere tutti», «nessuno verrà lasciato indietro»). PREMIA chi comunica le scelte come ovvie e chi tratta l'accessibilità come una caratteristica della struttura, non come una concessione a qualcuno. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`,
  },
};

// Seam di test (server-only): espone il prompt 4.2 costruito per una missione,
// così i test possono verificare la lista nera e i numeri verificati senza una
// vera chiamata AI. Non usato in produzione.
export function costruisciPromptPropostaPerTest(slug: string, aree: string[], letti: Set<string>): string | null {
  return SPEC[slug]?.promptProposta(aree, { letti }) ?? null;
}

const PROMPT_RIFLESSIONE = (aree: string[]) =>
  `Sei un analista di orientamento per studenti italiani di 16-19 anni. Leggi la riflessione che uno studente ha scritto DOPO aver completato una missione (dove si è sentito nel suo, dove fuori posto). Individua da 1 a 2 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che sembrano averlo attratto o messo a suo agio. Per ognuna valuta: curiosity = quanta voglia di esplorare quell'area traspare (0-1); self_efficacy = quanto si è sentito capace su quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","curiosity":0.0,"self_efficacy":0.0,"motivazione":"..."}]}`;

const PROMPT_NON_APPROFONDIRE =
  "Sei un analista di orientamento per studenti italiani di 16-19 anni. Lo studente spiega una cosa che ha scelto di NON approfondire e perché. Valuta quanto è lucido e consapevole del compromesso (0 = non motivato / superficiale, 1 = pienamente consapevole). Rispondi SOLO con JSON: {\"consapevolezza\":0.0,\"motivazione\":\"...\"}. La motivazione: breve, calda, ipotetica, in italiano, rivolta allo studente.";

// ─────────────────────────────────────────── AI helper
async function chiamaHaikuJson(anthropic: Anthropic, system: string, user: string): Promise<unknown | null> {
  try {
    const risposta = await anthropic.messages.create({
      model: MODELLO_ESCAPE,
      max_tokens: 600,
      system,
      messages: [{ role: "user", content: user }],
    });
    const testo = risposta.content[0]?.type === "text" ? risposta.content[0].text : "{}";
    return JSON.parse(testo.replace(/```json|```/g, "").trim());
  } catch (errore) {
    console.error("Escape — errore chiamata AI:", errore);
    return null;
  }
}

// ─────────────────────────────────────────── motore
export async function calcolaEvidenze(
  mission: EscapeMission,
  risposte: Map<string, Payload>,
  anthropic: Anthropic | null,
): Promise<EvidenceInput[]> {
  const evidenze: EvidenceInput[] = [];
  const get: LeggiRisposta = (id) => risposte.get(id);
  const step = stepDellaMissione(mission);
  const spec = SPEC[mission.slug] ?? SPEC[SLUG_QUARTIERE];
  const P = spec.pesi;

  const mandato: Mandato | null = mandatoScelto(get);
  const letti = materialiLetti(get);
  const areaMandato = mandato?.aree[0] ?? null;

  let fiduciaDichiarata = 50;

  for (const s of step) {
    const payload = risposte.get(s.id);
    const stepAperto = s.tipo === "decisione_scritta" || s.tipo === "riflessione";
    if (!payload && !stepAperto) continue;

    switch (s.tipo) {
      case "esplora_libero": {
        const p = payload as PayloadEsplora | undefined;
        const aperti = p?.letti ?? [];
        if (aperti.length > 0) {
          const haM2 = aperti.includes("M2");
          const valore = clamp01(0.3 + 0.18 * aperti.length + (haM2 ? 0.15 : 0));
          evidenze.push({ area_slug: null, dimensione: "curiosity", valore, peso: P.esplora, motivazione: haM2 ? spec.esploraTesti.conBonus : spec.esploraTesti.base, step_id: s.id });
        }
        break;
      }

      case "scelta_singola": {
        const p = payload as PayloadSceltaSingola | undefined;
        const opz = s.opzioni.find((o) => o.id === p?.opzioneId);
        if (opz) {
          for (const area of opz.aree) {
            evidenze.push({ area_slug: area, dimensione: "interest", valore: 0.9, peso: P.mandato, motivazione: `Hai scelto il mandato ${opz.label.split(" — ")[0]}: una dichiarazione di campo.`, step_id: s.id });
          }
        }
        break;
      }

      case "ordina_priorita": {
        const p = payload as PayloadOrdina | undefined;
        const ordine = p?.ordine ?? s.elementi.map((e) => e.id);
        const n = Math.max(1, ordine.length - 1);
        ordine.forEach((id, i) => {
          const el = s.elementi.find((e) => e.id === id);
          if (!el) return;
          const valore = clamp01(0.95 - (i / n) * 0.8);
          for (const area of el.aree) {
            evidenze.push({ area_slug: area, dimensione: "interest", valore, peso: P.ordinaInt, motivazione: `Hai messo «${el.label.toLowerCase()}» al ${i + 1}° posto.`, step_id: s.id });
          }
        });
        // performance sull'affidabilità (solo missioni con gerarchia verificabile)
        if (spec.ordinaPerformance && s.elementi.some((e) => typeof e.affidabilita === "number")) {
          const ideale = [...s.elementi].sort((a, b) => (b.affidabilita ?? 0) - (a.affidabilita ?? 0)).map((e) => e.id);
          const idxIdeale = new Map(ideale.map((id, i) => [id, i]));
          const idxStud = new Map(ordine.map((id, i) => [id, i]));
          let somma = 0;
          for (const id of ideale) somma += Math.abs((idxIdeale.get(id) ?? 0) - (idxStud.get(id) ?? 0));
          const nn = ideale.length;
          const maxSomma = Math.max(1, Math.floor((nn * nn) / 2));
          const corr = clamp01(1 - somma / maxSomma);
          evidenze.push({
            area_slug: spec.ordinaPerformance.area,
            dimensione: "performance",
            valore: corr,
            peso: spec.ordinaPerformance.peso,
            motivazione: corr >= 0.6 ? "Hai messo i fatti misurati sopra le impressioni e le affermazioni del sistema: è il cuore del metodo." : "L'ordine di affidabilità è ancora da mettere a fuoco: un dato misurato pesa più di ciò che «l'app dice».",
            step_id: s.id,
          });
        }
        break;
      }

      case "seleziona_informazioni": {
        const p = payload as PayloadSeleziona | undefined;
        for (const id of p?.selezionati ?? []) {
          const d = s.dossier.find((x) => x.id === id);
          if (!d) continue;
          for (const area of d.aree) {
            evidenze.push({ area_slug: area, dimensione: "curiosity", valore: 0.8, peso: P.selCur, motivazione: `Hai speso un gettone per «${d.titolo.toLowerCase()}».`, step_id: s.id });
            evidenze.push({ area_slug: area, dimensione: "interest", valore: 0.4, peso: P.selInt, motivazione: `Un interesse emerso da «${d.titolo.toLowerCase()}», che hai voluto approfondire.`, step_id: s.id });
          }
        }
        break;
      }

      case "alloca_budget": {
        const p = payload as PayloadAlloca | undefined;
        const alloc = p?.allocazioni ?? {};
        const speso = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
        const maxAlloc = Math.max(0, ...Object.values(alloc).map((v) => Number(v) || 0));
        if (speso <= 0 || maxAlloc <= 0) break;
        for (const voce of s.voci) {
          const a = Number(alloc[voce.id]) || 0;
          if (a <= 0) continue;
          for (const area of voce.aree) {
            evidenze.push({ area_slug: area, dimensione: "interest", valore: clamp01(a / maxAlloc), peso: P.budgetInt, motivazione: `Hai investito risorse su «${voce.label.toLowerCase()}».`, step_id: s.id });
          }
        }
        const r = spec.budgetPerformance?.({ alloc, voci: s.voci, letti, totale: s.totale });
        const areaPerf = areaMandato ?? s.voci.find((v) => (Number(alloc[v.id]) || 0) === maxAlloc)?.aree[0] ?? null;
        if (r && areaPerf) {
          evidenze.push({ area_slug: areaPerf, dimensione: "performance", valore: r.valore, peso: P.budgetPerf, motivazione: r.valore >= 0.6 ? r.buona : r.migliora, step_id: s.id });
        }
        break;
      }

      case "pianifica_lavori": {
        // Piano di lavori (Missione 04): interesse su ciò che entra nel piano +
        // performance sull'aritmetica dura (soldi, giorni, dipendenze, lavori
        // essenziali per il collaudo).
        const p = payload as PayloadLavori | undefined;
        const sel = p?.selezionati ?? [];
        if (sel.length === 0) break;
        for (const l of s.lavori) {
          if (!sel.includes(l.id)) continue;
          for (const area of l.aree) {
            evidenze.push({ area_slug: area, dimensione: "interest", valore: 0.7, peso: P.budgetInt, motivazione: `Hai messo nel piano «${l.label.toLowerCase()}».`, step_id: s.id });
          }
        }
        const rp = spec.pianoPerformance?.({ step: s, sel, letti });
        if (rp) {
          const areaPerf = areaMandato ?? "edilizia-architettura";
          evidenze.push({ area_slug: areaPerf, dimensione: "performance", valore: rp.valore, peso: P.budgetPerf, motivazione: rp.valore >= 0.6 ? rp.buona : rp.migliora, step_id: s.id });
        }
        break;
      }

      case "scarta_opzione": {
        const p = payload as PayloadScarta | undefined;
        const scartati = new Set(p?.scartati ?? []);
        const tenuti = s.opzioni.filter((o) => !scartati.has(o.id));
        for (const o of tenuti) {
          if (o.trappola) continue;
          for (const area of o.aree) {
            evidenze.push({ area_slug: area, dimensione: "interest", valore: 0.6, peso: P.scartoInt, motivazione: `Hai scelto di tenere «${o.label.toLowerCase()}»: lo consideri essenziale.`, step_id: s.id });
          }
        }
        const perQualita = [...s.opzioni].sort((a, b) => (a.qualita ?? 0.5) - (b.qualita ?? 0.5));
        const idealiDaScartare = new Set(perQualita.slice(0, s.daScartare).map((o) => o.id));
        const scartatiGiusti = [...scartati].filter((id) => idealiDaScartare.has(id)).length;
        const correttezza = s.daScartare > 0 ? clamp01(scartatiGiusti / s.daScartare) : 0.5;
        const trappola = s.opzioni.find((o) => o.trappola);
        // La trappola scatta quando viene TENUTA (default) o, se
        // `trappolaSeScartata`, quando viene SCARTATA (es. lasciar fuori
        // l'accessibilità nel cantiere).
        const trapScattata = trappola ? (trappola.trappolaSeScartata ? scartati.has(trappola.id) : tenuti.some((o) => o.trappola)) : false;
        const areaPerf = trappola?.aree[0] ?? "studi-umanistici-beni-culturali";
        evidenze.push({
          area_slug: areaPerf,
          dimensione: "performance",
          valore: trapScattata ? Math.min(correttezza, 0.2) : correttezza,
          peso: P.scartoPerf,
          motivazione: trapScattata
            ? (trappola?.trappolaSeScartata
                ? "Hai lasciato fuori qualcosa che sembrava rimandabile e non lo era: verificabile alla mano, poteva far saltare tutto."
                : "Hai tenuto la scelta che, verificabile alla mano, avrebbe fatto saltare tutto: valeva la pena controllarla prima.")
            : "Hai riconosciuto cosa lasciare andare e cosa proteggere: scelta lucida sotto vincolo.",
          step_id: s.id,
        });
        break;
      }

      case "previsione_poi_esito": {
        const p = payload as PayloadPrevisione | undefined;
        if (typeof p?.fiducia === "number") fiduciaDichiarata = clamp01(p.fiducia / 100) * 100;
        break;
      }

      case "decisione_scritta": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();
        if (!testo || !anthropic) break;

        if (s.id === "s2_non_approfondire") {
          if (!areaMandato) break;
          const parsed = (await chiamaHaikuJson(anthropic, PROMPT_NON_APPROFONDIRE, testo)) as { consapevolezza?: number; motivazione?: string } | null;
          if (parsed && typeof parsed.consapevolezza === "number") {
            const v = clamp01(Number(parsed.consapevolezza));
            const mot = parsed.motivazione || "Hai saputo dire perché hai rinunciato a un'informazione: è consapevolezza del tuo metodo.";
            evidenze.push({ area_slug: areaMandato, dimensione: "self_efficacy", valore: v, peso: P.ai, motivazione: mot, step_id: s.id });
            evidenze.push({ area_slug: areaMandato, dimensione: "performance", valore: v, peso: P.ai, motivazione: "Sapere cosa hai deciso di non sapere è parte del mestiere.", step_id: s.id });
          }
          break;
        }

        const parsed = (await chiamaHaikuJson(anthropic, spec.promptProposta(mission.areeCandidate, { letti }), testo)) as { aree?: unknown[] } | null;
        const aree = Array.isArray(parsed?.aree) ? parsed!.aree : [];
        for (const raw of aree) {
          const a = raw as { area_slug?: string; performance?: number; interest?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const perf = clamp01(Number(a.performance ?? 0));
          const inter = clamp01(Number(a.interest ?? 0));
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `La tua proposta valorizza ${nomeArea(a.area_slug)}.`;
          evidenze.push({ area_slug: a.area_slug, dimensione: "performance", valore: perf, peso: P.ai, motivazione: mot, step_id: s.id });
          evidenze.push({ area_slug: a.area_slug, dimensione: "interest", valore: inter, peso: P.ai, motivazione: "Un interesse al centro della tua proposta.", step_id: s.id });
          evidenze.push({ area_slug: a.area_slug, dimensione: "self_efficacy", valore: clamp01(fiduciaDichiarata / 100), peso: P.previsione, motivazione: `Prima di scrivere ti eri dato una fiducia ${fiduciaDichiarata >= 60 ? "alta" : fiduciaDichiarata >= 40 ? "media" : "prudente"} su questo lavoro.`, step_id: s.id });
        }
        break;
      }

      case "assegna_ruoli": {
        const p = payload as PayloadAssegna | undefined;
        const ass = p?.assegnazioni ?? {};
        for (const r of s.ruoli) {
          if (ass[r.id] !== "io") continue;
          evidenze.push({ area_slug: r.area, dimensione: "interest", valore: 0.8, peso: P.ruoli, motivazione: `Ti sei preso «${r.label.toLowerCase()}»: un compito che senti tuo.`, step_id: s.id });
          evidenze.push({ area_slug: r.area, dimensione: "self_efficacy", valore: 0.8, peso: P.ruoli, motivazione: `Prendendoti «${r.label.toLowerCase()}» hai mostrato di sentirti capace.`, step_id: s.id });
        }
        break;
      }

      case "assegna_persone": {
        // Compito→persona (Missione 10). I compiti presi in prima persona ("io")
        // danno un segnale mite di autoefficacia; i cinque abbinamenti
        // compito↔persona giusti (ciascuno condizionato a un materiale letto)
        // valgono come performance e sono riconosciuti UNO A UNO, non in blocco.
        const p = payload as PayloadAssegnaPersone | undefined;
        const ass = p?.assegnazioni ?? {};
        let ioCount = 0;
        for (const c of s.compiti) {
          if (ass[c.id] === "io") {
            ioCount++;
            evidenze.push({ area_slug: c.area, dimensione: "self_efficacy", valore: 0.6, peso: P.ruoli, motivazione: `Ti sei preso «${c.label.toLowerCase()}».`, step_id: s.id });
          }
        }
        for (const seg of spec.assegnaSegnali ?? []) {
          if (ass[seg.compito] === seg.persona && letti.has(seg.richiede)) {
            evidenze.push({ area_slug: seg.area, dimensione: "performance", valore: 0.9, peso: seg.peso, motivazione: seg.motivazione, step_id: s.id });
          }
        }
        // Tenere (quasi) tutto per sé: segnale debole con nota. La valutazione è
        // sul contributo di ciascuno — chi fa tutto lascia gli altri senza.
        if (s.compiti.length > 0 && ioCount >= s.compiti.length - 1) {
          evidenze.push({ area_slug: "scienze-educazione", dimensione: "performance", valore: 0.2, peso: P.scartoPerf, motivazione: "Hai tenuto quasi tutti i compiti per te: così il gruppo non ha un contributo da mostrare, e nemmeno tu.", step_id: s.id });
        }
        break;
      }

      case "riflessione": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();
        if (!testo || !anthropic) break;
        const parsed = (await chiamaHaikuJson(anthropic, PROMPT_RIFLESSIONE(mission.areeCandidate), testo)) as { aree?: unknown[] } | null;
        const aree = Array.isArray(parsed?.aree) ? parsed!.aree : [];
        for (const raw of aree) {
          const a = raw as { area_slug?: string; curiosity?: number; self_efficacy?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `Dalla tua riflessione traspare un legame con ${nomeArea(a.area_slug)}.`;
          evidenze.push({ area_slug: a.area_slug, dimensione: "curiosity", valore: clamp01(Number(a.curiosity ?? 0)), peso: P.ai, motivazione: mot, step_id: s.id });
          evidenze.push({ area_slug: a.area_slug, dimensione: "self_efficacy", valore: clamp01(Number(a.self_efficacy ?? 0)), peso: P.ai, motivazione: "Ti sei sentito a tuo agio mentre ripensavi al percorso.", step_id: s.id });
        }
        break;
      }

      case "pianifica_passi": {
        const p = payload as PayloadPianifica | undefined;
        const scelti = p?.passi ?? [];
        if (scelti.length === 0) break;
        const ideali = new Set(spec.pianificaIdeali);
        const overlap = scelti.filter((id) => ideali.has(id)).length / s.quanti;
        const bonusOrdine = spec.pianificaIdeali.length > 0 && scelti[0] === spec.pianificaIdeali[0] ? 0.1 : 0;
        const correttezza = clamp01(overlap + bonusOrdine);
        const areaPerf = areaMandato ?? "edilizia-architettura";
        evidenze.push({
          area_slug: areaPerf,
          dimensione: "performance",
          valore: correttezza,
          peso: P.passi,
          motivazione: correttezza >= 0.6 ? "Hai messo in ordine i primi passi con criterio: prima le cose che rendono possibili le altre." : "L'ordine dei primi passi salta qualche base: utile ripensarci da dove conviene partire.",
          step_id: s.id,
        });
        break;
      }
    }
  }

  return sanitizzaEvidenze(evidenze);
}
