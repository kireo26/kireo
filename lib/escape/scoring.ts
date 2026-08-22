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
import { chiamaJson, type EsitoAI } from "@/lib/ai/chiamaJson";
import { componiPerformance, type DescrittoreVoce } from "./componiPerformance";
import type {
  AsseStile,
  Dimensione,
  EscapeMission,
  EvidenceInput,
  LeggiRisposta,
  RevisoreEsito,
  TagAsse,
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
import { materialiLetti, stepDellaMissione, valutaPiano, SLUG_ACQUA, SLUG_CANTIERE, SLUG_CLASSE, SLUG_FILIERA, SLUG_MEDIATECA, SLUG_MUSEO, SLUG_PALCO, SLUG_QUARTIERE, SLUG_SERRA, SLUG_SPORTELLO, SLUG_VIAGGIO } from "./config";

const MODELLO_ESCAPE = "claude-haiku-4-5"; // stesso modello provato in prod (workshop/assistente)

const DIMENSIONI_VALIDE = new Set<Dimensione>(["interest", "performance", "self_efficacy", "curiosity"]);
const AREE_VALIDE = new Set(AREE.map((a) => a.slug));
const ASSI_VALIDI = new Set<AsseStile>(["analitico", "relazionale", "creativo", "operativo"]);
const PESO_MINIMO = 0.01;
// Peso delle prove di STILE dalle missioni: 3-4 volte quelle del test (0,35). È
// il cuore del sistema — le azioni pesano più delle dichiarazioni.
const PESO_STILE_MISSIONE = 1.35;

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
    if (e.asse != null && !ASSI_VALIDI.has(e.asse)) continue;
    const valore = Number.isFinite(e.valore) ? Math.max(0, Math.min(1, e.valore)) : 0;
    const peso = Number.isFinite(e.peso) && e.peso > 0 ? e.peso : PESO_MINIMO;
    const motivazione = (typeof e.motivazione === "string" ? e.motivazione.trim() : "") || "Segnale rilevato durante la missione.";
    // `categoria` è obbligatoria sul tipo: ogni emissione la dichiara al punto di
    // push (garanzia a compile-time), quindi qui non c'è nulla da derivare né da
    // scartare — arriva già valorizzata con `...e`.
    pulite.push({ ...e, asse: e.asse ?? null, valore, peso, motivazione: motivazione.slice(0, 2000) });
  }
  return pulite;
}

// ─────────────────────────────────────────── spec di punteggio per missione

type Pesi = {
  mandato: number; ordinaInt: number; selCur: number; selInt: number;
  budgetInt: number; budgetPerf: number; scartoInt: number; scartoPerf: number;
  // ai: step aperti generici (non-approfondire, interest della proposta).
  // revisore: SOLO il giudizio di competenza del revisore sul testo scritto
  // (performance della proposta) — scorporato da `ai` perché è l'unica misura
  // onesta di competenza per area rimasta dopo il Fix B, deve pesare quanto una
  // casella di budget (Fix A).
  ruoli: number; ai: number; revisore: number; previsione: number; passi: number; esplora: number;
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
  // Ritornano i DESCRITTORI delle voci di punteggio (Fix D): la frase del finale
  // è composta da componiPerformance, ogni clausola vera per costruzione.
  budgetPerformance?: (c: BudgetCtx) => { valore: number; voci: DescrittoreVoce[] };
  pianoPerformance?: (c: PianoCtx) => { valore: number; voci: DescrittoreVoce[] };
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
  scartoInt: 0.5, scartoPerf: 1.3, ruoli: 0.8, ai: 0.5, revisore: 1.4, previsione: 0.5, passi: 0.6, esplora: 0.4,
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
      const desc: DescrittoreVoce[] = [];
      const idx = (id: string) => voci.findIndex((v) => v.id === id);
      const tetto = Number(alloc["tetto"]) || 0;
      const sogliaTetto = letti.has("M4") ? 27000 : 50000;
      max += 2; punti += tetto >= sogliaTetto ? 2 : clamp01(tetto / sogliaTetto) * 2;
      desc.push({ tipo: "soglia", label: "la copertura del tetto", stile: "finanziamento", usato: tetto, soglia: sogliaTetto });
      const voceVincolo = voci.find((v) => v.id === "adeguamento_vincolo");
      if (voceVincolo) {
        const sp = Number(alloc["adeguamento_vincolo"]) || 0;
        const soglia = (voceVincolo.costoIndicativo ?? 30000) * 0.8;
        max += 2; punti += sp >= soglia ? 2 : clamp01(sp / soglia) * 2;
        desc.push({ tipo: "soglia", label: "gli spazi certificati per i minori", stile: "finanziamento", usato: sp, soglia });
      }
      if (letti.has("M7") && voci.some((v) => v.id === "fondo_gestione")) {
        const f = Number(alloc["fondo_gestione"]) || 0;
        max += 1.5; punti += f > 0 ? 1.5 : 0;
        desc.push({ tipo: "appartenenza", label: "il fondo di gestione", presente: f > 0, ordine: idx("fondo_gestione") });
      }
      const { pienezza, equilibrio } = pienezzaEquilibrio(alloc, totale);
      max += 2; punti += pienezza + equilibrio;
      desc.push({ tipo: "aggregato" });
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto la proposta per rigenerare un ex mercato coperto del suo quartiere. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che la proposta enfatizza di più. Per ognuna valuta: performance = quanto la proposta è concreta, coerente col mandato e col vincolo, argomentata su quell'area (0-1); interest = quanto la proposta ci punta (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice, rivolta allo studente. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
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
      const desc: DescrittoreVoce[] = [];
      const idx = (id: string) => voci.findIndex((v) => v.id === id);
      const info = Number(alloc["informare_personale"]) || 0;
      // Fix pavimento: senza M8 il ramo dava +0.4 anche a chi NON informa —
      // un punto per un'azione non avvenuta, che faceva scattare una `buona`
      // vuota sul piano filler (2.0/4=0.5 invece di 2.4/4=0.6). Decidere cosa
      // vale la pena guardare È ciò che la missione misura: non aver cercato M8
      // è una scelta, non un'ingiustizia. Zero.
      if (letti.has("M8")) { max += 1.5; punti += info > 0 ? 1.5 : 0; } else { max += 1; punti += info > 0 ? 1 : 0; }
      desc.push({ tipo: "appartenenza", label: "l'avviso al personale", presente: info > 0, ordine: idx("informare_personale") });
      const verif = Number(alloc["verificare_fatti"]) || 0;
      max += 1; punti += verif > 0 ? 1 : 0;
      desc.push({ tipo: "appartenenza", label: "la verifica dei fatti", presente: verif > 0, ordine: idx("verificare_fatti") });
      if (voci.some((v) => v.id === "rispondere_associazione")) {
        const a = Number(alloc["rispondere_associazione"]) || 0;
        max += 1; punti += a > 0 ? 1 : 0;
        desc.push({ tipo: "appartenenza", label: "la risposta all'associazione", presente: a > 0, ordine: idx("rispondere_associazione") });
      }
      const { pienezza, equilibrio } = pienezzaEquilibrio(alloc, totale);
      max += 2; punti += pienezza + equilibrio;
      desc.push({ tipo: "aggregato" });
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto la risposta pubblica alla crisi di comunicazione di una biblioteca comunale (una decisione impopolare presa e comunicata male). Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che la risposta enfatizza di più. Per ognuna valuta: performance = quanto la risposta è concreta, dice PRIMA cosa cambia per chi legge, ammette un errore concreto, è coerente col mandato e col vincolo (0-1). NON premiare la lunghezza né il linguaggio istituzionale o burocratico. interest = quanto la risposta punta su quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
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
      const desc: DescrittoreVoce[] = [];
      const idx = (id: string) => voci.findIndex((v) => v.id === id);
      const prep = Number(alloc["preparare_spiegazione"]) || 0;
      max += 1.5;
      if (prep <= 0) punti += 0;
      else if (prep > totale / 2) punti += 0.5;
      else punti += 1.5;
      desc.push({ tipo: "appartenenza", label: "la spiegazione per l'open day", presente: prep > 0, ordine: idx("preparare_spiegazione") });
      const mis = Number(alloc["misurare_acqua"]) || 0;
      max += 1; punti += mis > 0 ? 1 : 0;
      desc.push({ tipo: "appartenenza", label: "la misura dell'acqua", presente: mis > 0, ordine: idx("misurare_acqua") });
      if (voci.some((v) => v.id === "correggere_registrazione")) {
        const c = Number(alloc["correggere_registrazione"]) || 0;
        max += 1; punti += c > 0 ? 1 : 0;
        desc.push({ tipo: "appartenenza", label: "la registrazione solo a flusso confermato", presente: c > 0, ordine: idx("correggere_registrazione") });
      }
      if (voci.some((v) => v.id === "spostare_orario")) {
        const s = Number(alloc["spostare_orario"]) || 0;
        max += 1; punti += s > 0 ? 1 : 0;
        desc.push({ tipo: "appartenenza", label: "lo spostamento degli orari", presente: s > 0, ordine: idx("spostare_orario") });
      }
      const { pienezza, equilibrio } = pienezzaEquilibrio(alloc, totale);
      max += 2; punti += pienezza + equilibrio;
      desc.push({ tipo: "aggregato" });
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto la spiegazione di un guasto tecnico: in una serra automatica una sezione secca mentre il sistema dice che è stata irrigata. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che la spiegazione tocca di più. Per ognuna valuta: performance = qualità del RAGIONAMENTO CAUSALE e ONESTÀ sul livello di certezza (0-1). REGOLA IMPORTANTE: premia esplicitamente chi scrive che «non ne è ancora certo» quando non ha raccolto le prove; NON premiare una spiegazione sicura ma non verificata, nemmeno se azzecca la causa. La sicurezza senza prove vale MENO dell'onestà epistemica. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
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
      const desc: DescrittoreVoce[] = [];
      // Nomi corti per la frase sulle dipendenze (i label config sono lunghi).
      const NOMI_CORTI: Record<string, string> = { elettrico: "l'impianto elettrico", copertura: "la copertura dell'angolo nord", controsoffitto: "il controsoffitto antisfondamento", parquet: "il parquet omologato", pvc: "il pavimento in PVC", pompa_calore: "la pompa di calore", accessibilita: "l'accessibilità degli spogliatoi", fondo_imprevisti: "il fondo imprevisti" };
      const nome = (id: string) => NOMI_CORTI[id] ?? step.lavori.find((l) => l.id === id)?.label ?? id;
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      desc.push({ tipo: "limite", usato: soldi, disponibile: budgetSoldi });
      max += 2; punti += giorni <= budgetGiorni ? 2 : clamp01(1 - (giorni - budgetGiorni) / budgetGiorni) * 2;
      desc.push({ tipo: "limite", usato: giorni, disponibile: budgetGiorni, unita: "giorni" });
      max += 1.5; punti += dipendenzeMancanti.length === 0 ? 1.5 : 0;
      const primaViolata = dipendenzeMancanti[0];
      desc.push({ tipo: "dipendenze", rispettato: dipendenzeMancanti.length === 0, coppiaViolata: primaViolata ? { prima: nome(primaViolata.lavoro), dopo: nome(primaViolata.mancanti[0]) } : undefined });
      const essenziali = step.lavori.filter((l) => l.essenziale).map((l) => l.id);
      const incl = essenziali.filter((id) => sel.includes(id)).length;
      max += 2; punti += essenziali.length ? (incl / essenziali.length) * 2 : 0;
      desc.push({ tipo: "appartenenza", label: "i lavori essenziali al collaudo", presente: essenziali.length > 0 && incl === essenziali.length, ordine: step.lavori.findIndex((l) => l.essenziale) });
      if (letti.has("M11")) {
        max += 1; punti += sel.includes("fondo_imprevisti") ? 1 : 0;
        desc.push({ tipo: "appartenenza", label: "il fondo imprevisti", presente: sel.includes("fondo_imprevisti"), ordine: step.lavori.findIndex((l) => l.id === "fondo_imprevisti") });
      }
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il resoconto di un cantiere: la ristrutturazione della palestra della sua scuola, con budget e scadenza rigidi. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che il testo tocca di più. Per ognuna valuta: performance = coerenza tra il piano, i vincoli e la realtà di tempi e dipendenze, e soprattutto ONESTÀ (0-1). REGOLE: premia chi NOMINA esplicitamente ciò che ha lasciato indietro e chi ne paga il prezzo; NON premiare i toni trionfali; se il testo riconosce che il problema viene da anni di rinvii senza usarlo come scusa, premialo. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
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
    budgetPerformance: ({ alloc, voci, letti }) => {
      // Solo presenza/assenza dei compiti giusti: mai il totale dei minuti.
      let punti = 0, max = 0;
      const desc: DescrittoreVoce[] = [];
      const idx = (id: string) => voci.findIndex((v) => v.id === id);
      if (letti.has("M5")) {
        const t = Number(alloc["trasmetti_segnalazione"]) || 0;
        max += 2; punti += t > 0 ? 2 : 0;
        desc.push({ tipo: "appartenenza", label: "la segnalazione al servizio sociale", presente: t > 0, ordine: idx("trasmetti_segnalazione") });
      }
      const kaur = (Number(alloc["protocolla_kaur"]) || 0) + (Number(alloc["compila_kaur"]) || 0);
      max += 1.5; punti += kaur > 0 ? 1.5 : 0;
      desc.push({ tipo: "appartenenza", label: "la domanda di Kaur", presente: kaur > 0, ordine: Math.max(idx("protocolla_kaur"), idx("compila_kaur")) });
      if (letti.has("M12")) {
        const d = Number(alloc["data_per_ciascuno"]) || 0;
        max += 1.5; punti += d > 0 ? 1.5 : 0;
        desc.push({ tipo: "appartenenza", label: "una data per ciascuno", presente: d > 0, ordine: idx("data_per_ciascuno") });
      }
      const mail = Number(alloc["rispondi_mail"]) || 0;
      max += 1; punti += mail > 0 ? 1 : 0;
      desc.push({ tipo: "appartenenza", label: "la risposta alla mail", presente: mail > 0, ordine: idx("rispondi_mail") });
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente, tirocinante in uno sportello di ascolto sociale, ha scritto la risposta a una MAIL ANONIMA: qualcuno che chiede aiuto senza farsi identificare, ha scritto una volta sola e potrebbe non riscrivere. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = la risposta NON chiede informazioni identificative (nome, età, famiglia), tiene aperto il canale e offre un appiglio concreto e raggiungibile (0-1). REGOLA DURA: premia le risposte BREVI, non invadenti, con un contatto raggiungibile; NON premiare le risposte lunghe, protettive o piene di domande, per quanto ben intenzionate. Chi scrive «dimmi chi sei e ti aiutiamo» ha sbagliato pur volendo bene: valutalo basso. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
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
      const desc: DescrittoreVoce[] = [];
      const ord = (id: string) => step.lavori.findIndex((l) => l.id === id);
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      desc.push({ tipo: "limite", usato: soldi, disponibile: budgetSoldi });
      max += 1.5; punti += sel.includes("documentazione") ? 1.5 : 0; // per poter dichiarare senza mentire
      desc.push({ tipo: "appartenenza", label: "la documentazione", presente: sel.includes("documentazione"), ordine: ord("documentazione") });
      if (letti.has("M11")) {
        max += 1; punti += sel.includes("sacchetto") ? 1 : 0; // il guadagno gratuito
        desc.push({ tipo: "appartenenza", label: "l'eliminazione del sacchetto", presente: sel.includes("sacchetto"), ordine: ord("sacchetto") });
      }
      if (letti.has("M7") && letti.has("M8")) {
        max += 1; punti += sel.includes("accessori_europei") ? 1 : 0; // miglior rapporto impatto/costo
        desc.push({ tipo: "appartenenza", label: "gli accessori europei", presente: sel.includes("accessori_europei"), ordine: ord("accessori_europei") });
      }
      const haTessuto = sel.includes("tessuto_alfa") || sel.includes("tessuto_beta");
      max += 1; punti += haTessuto ? 1 : 0; // hai comunque migliorato il materiale
      // Etichetta calcolata: il nome vero del tessuto scelto; se nessuno (voce
      // assente → migliora) l'indefinito, perché non sappiamo quale avrebbe preso.
      const labelTessuto = sel.includes("tessuto_alfa") ? "il tessuto Alfa certificato" : sel.includes("tessuto_beta") ? "il tessuto Beta riciclato" : "un tessuto migliore";
      desc.push({ tipo: "appartenenza", label: labelTessuto, presente: haTessuto, ordine: ord("tessuto_alfa") });
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
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
      return `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto l'ETICHETTA di uno zaino scolastico: cosa è stato cambiato, di quanto, e cosa non è stato fatto. Ogni affermazione dovrebbe essere sostenuta da un dato che ha davvero verificato. ${verificati} Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = ogni affermazione è sostenuta da un dato verificato e non ci sono termini generici né numeri inventati (0-1). REGOLE DURE: PENALIZZA ESPLICITAMENTE le parole «eco», «green», «100% sostenibile», «amico dell'ambiente» e QUALSIASI percentuale o numero NON presente nell'elenco dei numeri verificati (è inventato). PREMIA chi cita solo numeri verificati e chi dichiara cosa è rimasto fuori. Una comunicazione modesta e dimostrabile vale più di una entusiasta. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`;
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
      const desc: DescrittoreVoce[] = [];
      const ord = (id: string) => step.lavori.findIndex((l) => l.id === id);
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      desc.push({ tipo: "limite", usato: soldi, disponibile: budgetSoldi });
      const formatiRipetibili = ["fmt_podcast", "fmt_video", "fmt_pannelli", "fmt_schermi", "fmt_laboratorio"];
      const haRipetibile = formatiRipetibili.some((id) => sel.includes(id));
      max += 2; punti += haRipetibile ? 2 : 0; // il bando chiede un'iniziativa ripetibile senza nuovi fondi
      desc.push({ tipo: "appartenenza", label: "un formato ripetibile", presente: haRipetibile, ordine: step.lavori.findIndex((l) => formatiRipetibili.includes(l.id)) });
      max += 1; punti += sel.includes("accessibilita_sala3") ? 1 : 0; // premiata dal bando
      desc.push({ tipo: "appartenenza", label: "l'accessibilità della Sala 3", presente: sel.includes("accessibilita_sala3"), ordine: ord("accessibilita_sala3") });
      let valore = clamp01(max > 0 ? punti / max : 0.5);
      // Un evento una-tantum (fmt_evento) senza alcun formato ripetibile viola il
      // bando: qualunque cosa d'altro tu abbia messo nel piano, il progetto non è
      // rendicontabile come «ripetibile».
      if (sel.includes("fmt_evento") && !haRipetibile) {
        valore = Math.min(valore, 0.3);
        // Misfit 07 (scelta b): il negativo dell'evento una-tantum si NOMINA solo
        // nella migliora (dove il clamp lo porta sempre), tace nella buona dove il
        // formato ripetibile copre già il positivo. Spinto SOLO quando preso —
        // così non compare mai come «non ti sei appoggiato» in una buona.
        desc.push({ tipo: "negativo", label: "un evento che funziona una volta sola", presente: true });
      }
      return { valore, voci: desc };
    },
    promptProposta: (aree, { letti }) => {
      const registro = letti.has("M6")
        ? "Lo studente HA letto il registro di fabbrica del 1911 e conosce nomi veri delle operaie (es. Teresa B., anni nove, sguattera): PREMIA chi ne cita uno reale nel testo."
        : "Lo studente NON ha letto il registro del 1911: non conosce nomi veri. Non penalizzarlo per non citarne uno, ma non c'è un nome reale da valorizzare.";
      return `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il TESTO DI LANCIO di un museo della seta (max 80 parole) che deve far venire chi non c'è mai stato e tornare chi c'è già stato. ${registro} Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il testo NOMINA una cosa concreta che il visitatore farà o vedrà, è coerente col pubblico scelto e NON usa formule da brochure (0-1). REGOLE DURE: PENALIZZA ESPLICITAMENTE le frasi «un viaggio nel tempo», «un'esperienza unica», «alla scoperta di», «riscoprire le nostre radici» e QUALSIASI linguaggio generico da depliant. PREMIA chi nomina qualcosa di concreto e, se ha letto il registro, chi usa un nome vero delle operaie. Un testo modesto e concreto vale più di uno entusiasta e vuoto. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`;
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
      const desc: DescrittoreVoce[] = [];
      const ord = (id: string) => step.lavori.findIndex((l) => l.id === id);
      // 1) raggiungere davvero il traguardo di risparmio (la barra che si riempie)
      max += 2.5; punti += risparmio >= obiettivo ? 2.5 : clamp01(risparmio / obiettivo) * 2.5;
      desc.push({ tipo: "soglia", label: `il traguardo del ${obiettivo}%`, stile: "livello", usato: risparmio, soglia: obiettivo });
      // 2) tempestività: la tariffa progressiva entra in vigore in 3 mesi, non
      //    serve a un'emergenza che è ora. Contarci sopra è un errore.
      max += 1; punti += sel.includes("tariffa") ? 0 : 1;
      desc.push({ tipo: "negativo", label: "la tariffa d'emergenza", presente: sel.includes("tariffa") });
      // 3) l'acqua «che esce per nessuno» (consumi pubblici) è risparmio a costo
      //    zero e senza colpire un cittadino, ma solo se l'ha scoperto (M8)
      if (letti.has("M8")) {
        max += 1.5; punti += sel.includes("consumi_pubblici") ? 1.5 : 0;
        desc.push({ tipo: "appartenenza", label: "il taglio dei consumi pubblici", presente: sel.includes("consumi_pubblici"), ordine: ord("consumi_pubblici") });
      }
      // 4) la perdita reale del 22% è la leva più grande, ma solo se l'ha misurata (M4)
      if (letti.has("M4")) {
        max += 1.5; punti += sel.includes("riparazione") ? 1.5 : 0;
        desc.push({ tipo: "appartenenza", label: "la riparazione delle perdite", presente: sel.includes("riparazione"), ordine: ord("riparazione") });
      }
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il TESTO di un'ordinanza sindacale per ridurre del 20% i consumi d'acqua durante una siccità, «senza colpire sempre gli stessi». Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = l'ordinanza indica una scadenza e un riesame, cita solo numeri verificati, colpisce un USO (irrigazione, piscine, sprechi pubblici) e non un quartiere, senza allarmismi (0-1). REGOLE: PREMIA chi mette una data e un riesame e chi distingue l'uso dal quartiere; NON premiare gli appelli generici, gli allarmismi né chi colpisce «Colline» come se fosse un colpevole. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
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
    budgetPerformance: ({ alloc, voci, letti, totale }) => {
      let punti = 0, max = 0;
      const desc: DescrittoreVoce[] = [];
      const idx = (id: string) => voci.findIndex((v) => v.id === id);
      // copertura della serata (il programma deve reggere fino ai fuochi)
      // Peso abbassato 1.5→1.0 (Fix D): la pienezza da sola arrivava a 0.60 a
      // materiali minimi (aggregato che tocca la soglia) — ora 0.50, sotto 0.55
      // in ogni configurazione, e le buona vuote della 09 spariscono.
      const { pienezza } = pienezzaEquilibrio(alloc, totale);
      max += 1.0; punti += pienezza * 1.0;
      desc.push({ tipo: "aggregato" });
      // il coro del centro estivo, se scoperto, riempie il buco a costo zero
      if (letti.has("M6")) { const c = Number(alloc["coro_centro"]) || 0; max += 1.5; punti += c > 0 ? 1.5 : 0; desc.push({ tipo: "appartenenza", label: "il coro del centro", presente: c > 0, ordine: idx("coro_centro") }); }
      // la Filarmonica ridotta, se scoperta: salva il gruppo invece di eliminarlo
      if (letti.has("M5")) { const f = Number(alloc["filarmonica_ridotta"]) || 0; max += 1.5; punti += f > 0 ? 1.5 : 0; desc.push({ tipo: "appartenenza", label: "la banda ridotta", presente: f > 0, ordine: idx("filarmonica_ridotta") }); }
      // il momento di spiegazione, se ha letto del 2019
      if (letti.has("M12")) { const r = Number(alloc["ringraziamento"]) || 0; max += 1; punti += r > 0 ? 1 : 0; desc.push({ tipo: "appartenenza", label: "il ringraziamento", presente: r > 0, ordine: idx("ringraziamento") }); }
      // la Filarmonica completa non è eseguibile con 23 elementi
      const completa = (Number(alloc["filarmonica_completa"]) || 0) > 0;
      max += 1; punti += completa ? 0 : 1;
      desc.push({ tipo: "negativo", label: "l'orchestra al completo", presente: completa });
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree, { letti }) => {
      const avviso = letti.has("M12") ? " Lo studente sa cosa successe nel 2019 (la gente si arrabbiò per non essere stata avvisata): PREMIA chi avvisa PRIMA, con chiarezza, invece di far scoprire il cambio in piazza." : "";
      return `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il MESSAGGIO al pubblico di una festa di paese il cui concerto principale è saltato all'ultimo. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il messaggio dice COSA È SUCCESSO senza nasconderlo nella prima frase, dice COSA CI SARÀ in concreto, e non promette ciò che non c'è (0-1). REGOLE DURE: PENALIZZA i giri di parole («per cause di forza maggiore», «un programma ancora più ricco»), l'entusiasmo posticcio e ogni formulazione che nasconda il cambio; PREMIA chi dice la verità subito e nomina una cosa concreta e nuova.${avviso} interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`;
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
      const desc: DescrittoreVoce[] = [];
      const idx = (id: string) => voci.findIndex((v) => v.id === id);
      // parlare uno a uno con chi non partecipa: è il cuore, non un lusso
      const parla = Number(alloc["parlare_uno_a_uno"]) || 0;
      max += 2; punti += parla > 0 ? 2 : 0;
      desc.push({ tipo: "appartenenza", label: "i colloqui uno a uno", presente: parla > 0, ordine: idx("parlare_uno_a_uno") });
      // definire i compiti (se sbloccato): sblocca chi si ferma sul vago
      if (voci.some((v) => v.id === "rifare_piano")) { const r = Number(alloc["rifare_piano"]) || 0; max += 1; punti += r > 0 ? 1 : 0; desc.push({ tipo: "appartenenza", label: "la definizione dei compiti", presente: r > 0, ordine: idx("rifare_piano") }); }
      // dare a Elisa un compito compatibile, se scoperto
      if (voci.some((v) => v.id === "compito_elisa")) { const e = Number(alloc["compito_elisa"]) || 0; max += 1; punti += e > 0 ? 1 : 0; desc.push({ tipo: "appartenenza", label: "un compito per Elisa", presente: e > 0, ordine: idx("compito_elisa") }); }
      // fare tutto da sé: la somma dell'esecuzione non deve mangiare tutte le giornate
      const esec = ["verificare_indirizzi", "scrivere_testi", "fare_mappa", "curare_traduzioni", "impaginare"].reduce((a, id) => a + (Number(alloc[id]) || 0), 0);
      max += 2; punti += esec <= totale * 0.6 ? 2 : clamp01(1 - (esec - totale * 0.6) / (totale * 0.4)) * 2;
      // Negativo con frase propria: «appoggiato a X» non regge su «tutta
      // l'esecuzione» (non ci si appoggia, ci si carica). Override segnalato per
      // la riscrittura testuale.
      const troppa = esec > totale * 0.6;
      desc.push({ tipo: "negativo", label: "tutta l'esecuzione", presente: troppa, testoBuona: "Non ti sei preso tutta l'esecuzione da solo.", testoMigliora: "Ti sei preso tutta l'esecuzione da solo." });
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
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
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto un MESSAGGIO al proprio gruppo di lavoro (sette compagni su un progetto scolastico) per farlo ripartire. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il messaggio assegna cose PRECISE a persone precise con una scadenza, non generalizza, non rimprovera il gruppo in blocco (0-1). REGOLE DURE: PREMIA i messaggi che nominano le persone e i compiti in modo concreto e che lasciano una porta aperta a chi è sparito; PENALIZZA i rimproveri collettivi («ragazzi così non va», «ci impegniamo tutti tranne alcuni»), i toni da comando e le richieste vaghe; NON premiare chi si assume tutto il lavoro. VINCOLO ASSOLUTO: nel campo "motivazione" NON usare MAI le parole «leader», «capo» o «trascinatore», e NON dare etichette alle persone del gruppo (non è un'analisi psicologica): descrivi solo cosa ha fatto lo studente. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
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
      const desc: DescrittoreVoce[] = [];
      const ord = (id: string) => step.lavori.findIndex((l) => l.id === id);
      max += 2; punti += soldi <= budgetSoldi ? 2 : clamp01(1 - (soldi - budgetSoldi) / budgetSoldi) * 2;
      desc.push({ tipo: "limite", usato: soldi, disponibile: budgetSoldi });
      // Nadir: l'ostello accessibile va incluso (se l'accessibilità è nota)
      if (letti.has("M4")) { max += 2; punti += sel.includes("ostello_accessibile") ? 2 : 0; desc.push({ tipo: "appartenenza", label: "l'ostello accessibile", presente: sel.includes("ostello_accessibile"), ordine: ord("ostello_accessibile") }); }
      // Marco: il fondo riservato lo risolve a costo zero (se scoperto)
      if (letti.has("M8")) { max += 1.5; punti += sel.includes("fondo_marco") ? 1.5 : 0; desc.push({ tipo: "appartenenza", label: "il fondo riservato per Marco", presente: sel.includes("fondo_marco"), ordine: ord("fondo_marco") }); }
      // Sara: rientra, con il treno di gruppo o col biglietto singolo
      const treno = sel.includes("treno_gruppo") || sel.includes("treno_singolo");
      max += 1; punti += treno ? 1 : 0;
      desc.push({ tipo: "appartenenza", label: "il rientro in treno di Sara", presente: treno, ordine: Math.max(ord("treno_gruppo"), ord("treno_singolo")) });
      // Chiara: mangia senza glutine, se il costo nascosto è stato scoperto
      if (letti.has("M6")) { max += 1; punti += sel.includes("pasti_glutine") ? 1 : 0; desc.push({ tipo: "appartenenza", label: "i pasti senza glutine", presente: sel.includes("pasti_glutine"), ordine: ord("pasti_glutine") }); }
      return { valore: clamp01(max > 0 ? punti / max : 0.5), voci: desc };
    },
    promptProposta: (aree) =>
      `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto il MESSAGGIO alla classe con le decisioni prese per un viaggio d'istruzione, in cui alcuni compagni hanno esigenze particolari (accessibilità, dieta, budget familiare, orari). Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")}. Per ognuna valuta: performance = il messaggio comunica le decisioni in modo chiaro SENZA esporre le situazioni personali di nessuno, e presenta le scelte come normali, non come favori (0-1). REGOLE — LA PENALIZZAZIONE PIÙ SEVERA DI TUTTE: PENALIZZA PESANTEMENTE (performance vicino a 0) ogni frase che nomini la difficoltà di una persona in modo identificabile («abbiamo cambiato ostello per Nadir», «Marco ha delle difficoltà», «per la dieta di Chiara») e ogni tono da buona azione («siamo riusciti a includere tutti», «nessuno verrà lasciato indietro»). PREMIA chi comunica le scelte come ovvie e chi tratta l'accessibilità come una caratteristica della struttura, non come una concessione a qualcuno. interest = quanto emerge quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Includi anche "giudizio_complessivo", una frase di sintesi sull'intera proposta. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`,
  },
};

// Seam di test (server-only): espone il prompt 4.2 costruito per una missione,
// così i test possono verificare la lista nera e i numeri verificati senza una
// vera chiamata AI. Non usato in produzione.
export function costruisciPromptPropostaPerTest(slug: string, aree: string[], letti: Set<string>): string | null {
  return SPEC[slug]?.promptProposta(aree, { letti }) ?? null;
}

// Seam di test (server-only): espone i descrittori di performance (valore + voci
// + meccanismo) per una missione risolta dalle risposte, così il test di
// proprietà può verificare che ogni clausola composta sia vera contro la
// selezione, senza passare da calcolaEvidenze/AI. Non usato in produzione.
export function descrittoriPerformancePerTest(
  mission: EscapeMission,
  get: LeggiRisposta,
): { valore: number; voci: DescrittoreVoce[]; meccanismo: "piano" | "budget" } | null {
  const spec = SPEC[mission.slug] ?? SPEC[SLUG_QUARTIERE];
  const letti = materialiLetti(get);
  for (const s of stepDellaMissione(mission)) {
    if (s.tipo === "alloca_budget" && spec.budgetPerformance) {
      const p = get(s.id) as PayloadAlloca | undefined;
      const r = spec.budgetPerformance({ alloc: p?.allocazioni ?? {}, voci: s.voci, letti, totale: s.totale });
      return { valore: r.valore, voci: r.voci, meccanismo: "budget" };
    }
    if (s.tipo === "pianifica_lavori" && spec.pianoPerformance) {
      const p = get(s.id) as PayloadLavori | undefined;
      const r = spec.pianoPerformance({ step: s, sel: p?.selezionati ?? [], letti });
      return { valore: r.valore, voci: r.voci, meccanismo: "piano" };
    }
  }
  return null;
}

const PROMPT_RIFLESSIONE = (aree: string[]) =>
  `Sei un analista di orientamento per studenti italiani di 16-19 anni. Leggi la riflessione che uno studente ha scritto DOPO aver completato una missione (dove si è sentito nel suo, dove fuori posto). Individua da 1 a 2 aree — SCEGLIENDO SOLO tra questi slug: ${aree.join(", ")} — che sembrano averlo attratto o messo a suo agio. Per ognuna valuta: curiosity = quanta voglia di esplorare quell'area traspare (0-1); self_efficacy = quanto si è sentito capace su quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","curiosity":0.0,"self_efficacy":0.0,"motivazione":"..."}]}`;

const PROMPT_NON_APPROFONDIRE =
  "Sei un analista di orientamento per studenti italiani di 16-19 anni. Lo studente spiega una cosa che ha scelto di NON approfondire e perché. Valuta quanto è lucido e consapevole del compromesso (0 = non motivato / superficiale, 1 = pienamente consapevole). Rispondi SOLO con JSON: {\"consapevolezza\":0.0,\"motivazione\":\"...\"}. La motivazione: breve, calda, ipotetica, in italiano, rivolta allo studente.";

// ─────────────────────────────────────────── AI helper
// Sottile wrapper sul chiamaJson condiviso: fissa modello e max_tokens di
// Escape, così i tre call-site (non-approfondire, proposta, riflessione)
// ricevono un EsitoAI tipizzato — un fallimento (chiamata o estrazione) è un
// esito, non più un null ambiguo che ingoiava la causa.
function chiamaEscape(anthropic: Anthropic, system: string, user: string): Promise<EsitoAI> {
  return chiamaJson(anthropic, { model: MODELLO_ESCAPE, maxTokens: 600, system, user });
}

// ─────────────────────────────────────────── motore
export async function calcolaEvidenze(
  mission: EscapeMission,
  risposte: Map<string, Payload>,
  anthropic: Anthropic | null,
): Promise<{ evidenze: EvidenceInput[]; revisoreEsito: RevisoreEsito | null }> {
  const evidenze: EvidenceInput[] = [];
  const get: LeggiRisposta = (id) => risposte.get(id);
  const step = stepDellaMissione(mission);
  const spec = SPEC[mission.slug] ?? SPEC[SLUG_QUARTIERE];
  const P = spec.pesi;

  // Esito del revisore della proposta finale (s4_proposta), nei tre stati.
  // Resta null se lo studente non ha scritto la proposta. Persistito su
  // mission_attempt.revisore_esito dal route di finalizzazione.
  let revisoreEsito: RevisoreEsito | null = null;

  const letti = materialiLetti(get);

  // Emette prove di STILE (asse) accanto a quelle d'area. `factor` scala il
  // valore del tag (es. la frazione di ore allocate a una voce). area_slug null:
  // le prove di stile alimentano style_signal, non area_signal.
  const pushAssi = (assi: TagAsse[] | undefined, factor: number, motivazione: string, step_id: string) => {
    if (!assi) return;
    for (const t of assi) {
      const valore = clamp01(t.valore * factor);
      if (valore <= 0) continue;
      evidenze.push({ area_slug: null, categoria: "stile", asse: t.asse, dimensione: "interest", valore, peso: PESO_STILE_MISSIONE, motivazione, step_id });
    }
  };

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
          evidenze.push({ area_slug: null, categoria: "esplorazione", dimensione: "curiosity", valore, peso: P.esplora, motivazione: haM2 ? spec.esploraTesti.conBonus : spec.esploraTesti.base, step_id: s.id });
        }
        for (const id of aperti) {
          const m = s.materiali.find((x) => x.id === id);
          if (m?.assi) pushAssi(m.assi, 1, `Hai aperto «${m.titolo.toLowerCase()}».`, s.id);
        }
        break;
      }

      case "scelta_singola": {
        const p = payload as PayloadSceltaSingola | undefined;
        const opz = s.opzioni.find((o) => o.id === p?.opzioneId);
        if (opz) {
          for (const area of opz.aree) {
            evidenze.push({ categoria: "area", area_slug: area, dimensione: "interest", valore: 0.9, peso: P.mandato, motivazione: `Hai scelto il mandato ${opz.label.split(" — ")[0]}: una dichiarazione di campo.`, step_id: s.id });
          }
          pushAssi(opz.assi, 1, `Hai impostato l'indagine come ${opz.label.split(" — ")[0]}.`, s.id);
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
          // Guardia 1.1: una posizione BASSA non è interesse — metterci qualcosa
          // in fondo è una rinuncia, non un segnale. Emette solo le posizioni alte
          // (valore > 0.5 → circa le prime 3 su 5-6). Non tocca né la performance
          // dell'affidabilità né lo stile (emessi fuori da questo forEach).
          if (valore <= 0.5) return;
          for (const area of el.aree) {
            evidenze.push({ categoria: "area", area_slug: area, dimensione: "interest", valore, peso: P.ordinaInt, motivazione: `Hai messo «${el.label.toLowerCase()}» al ${i + 1}° posto.`, step_id: s.id });
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
          // Fix B: la qualità dell'ordinamento è qualità di missione, non
          // competenza in un'area decisa dalla SPEC (era ordinaPerformance.area).
          evidenze.push({
            area_slug: null,
            categoria: "qualita_missione",
            dimensione: "performance",
            valore: corr,
            peso: spec.ordinaPerformance.peso,
            motivazione: corr >= 0.6 ? "Hai messo i fatti misurati sopra le impressioni e le affermazioni del sistema: è il cuore del metodo." : "L'ordine di affidabilità è ancora da mettere a fuoco: un dato misurato pesa più di ciò che «l'app dice».",
            step_id: s.id,
          });
          // Stile: aver ordinato BENE per affidabilità (misura > stima >
          // interpretazione) è analitico — il segnale dipende dalla correttezza
          // dell'ordine, non dall'aver compilato lo step.
          pushAssi([{ asse: "analitico", valore: corr }], 1, corr >= 0.6 ? "Hai ordinato distinguendo la misura diretta dalla stima vecchia e dall'interpretazione." : "Hai provato a ordinare i fatti per affidabilità.", s.id);
        }
        break;
      }

      case "seleziona_informazioni": {
        const p = payload as PayloadSeleziona | undefined;
        for (const id of p?.selezionati ?? []) {
          const d = s.dossier.find((x) => x.id === id);
          if (!d) continue;
          for (const area of d.aree) {
            evidenze.push({ categoria: "area", area_slug: area, dimensione: "curiosity", valore: 0.8, peso: P.selCur, motivazione: `Hai speso un gettone per «${d.titolo.toLowerCase()}».`, step_id: s.id });
            evidenze.push({ categoria: "area", area_slug: area, dimensione: "interest", valore: 0.4, peso: P.selInt, motivazione: `Un interesse emerso da «${d.titolo.toLowerCase()}», che hai voluto approfondire.`, step_id: s.id });
          }
          pushAssi(d.assi, 1, `Hai voluto approfondire «${d.titolo.toLowerCase()}».`, s.id);
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
            evidenze.push({ categoria: "area", area_slug: area, dimensione: "interest", valore: clamp01(a / maxAlloc), peso: P.budgetInt, motivazione: `Hai investito risorse su «${voce.label.toLowerCase()}».`, step_id: s.id });
          }
          pushAssi(voce.assi, clamp01(a / maxAlloc), `Hai messo le risorse su «${voce.label.toLowerCase()}».`, s.id);
        }
        const r = spec.budgetPerformance?.({ alloc, voci: s.voci, letti, totale: s.totale });
        if (r) {
          // Fix D: la frase è COMPOSTA dai descrittori delle voci (ogni clausola
          // vera per costruzione), non più una stringa cablata. Se non emerge
          // nessuna clausola (solo aggregati), componiPerformance ritorna null e
          // NON si emette la riga (silenzio, Opzione A). Il valore resta usato
          // solo qui (scelta buona/migliora) e per lo stile — non entra in
          // area_signal (area_slug null).
          const testo = componiPerformance(r.valore, r.voci, "budget");
          if (testo) evidenze.push({ area_slug: null, categoria: "qualita_missione", dimensione: "performance", valore: r.valore, peso: P.budgetPerf, motivazione: testo, step_id: s.id });
          // Stile: comporre un piano che sta nei vincoli è operativo (dipende
          // dalla qualità del piano, non dall'aver compilato lo step).
          pushAssi([{ asse: "operativo", valore: r.valore }], 1, "Hai composto un piano che sta nei vincoli.", s.id);
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
            evidenze.push({ categoria: "area", area_slug: area, dimensione: "interest", valore: 0.7, peso: P.budgetInt, motivazione: `Hai messo nel piano «${l.label.toLowerCase()}».`, step_id: s.id });
          }
          pushAssi(l.assi, 1, `Hai messo nel piano «${l.label.toLowerCase()}».`, s.id);
        }
        const rp = spec.pianoPerformance?.({ step: s, sel, letti });
        if (rp) {
          // Fix D: frase composta dai descrittori (vedi il ramo budget sopra),
          // null → silenzio (Opzione A).
          const testo = componiPerformance(rp.valore, rp.voci, "piano");
          if (testo) evidenze.push({ area_slug: null, categoria: "qualita_missione", dimensione: "performance", valore: rp.valore, peso: P.budgetPerf, motivazione: testo, step_id: s.id });
          // Stile: un piano che sta nei vincoli e rispetta le dipendenze è operativo.
          pushAssi([{ asse: "operativo", valore: rp.valore }], 1, "Hai composto un piano che sta nei vincoli.", s.id);
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
            evidenze.push({ categoria: "area", area_slug: area, dimensione: "interest", valore: 0.6, peso: P.scartoInt, motivazione: `Hai scelto di tenere «${o.label.toLowerCase()}»: lo consideri essenziale.`, step_id: s.id });
          }
          pushAssi(o.assi, 1, `Hai scelto di tenere «${o.label.toLowerCase()}».`, s.id);
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
        // Fix B: «hai visto la trappola?» è qualità di missione, non competenza
        // in meccanica/edilizia (era trappola.aree[0], o il fallback hardcoded
        // studi-umanistici-beni-culturali). La scarto-INTEREST resta per opzione tenuta.
        evidenze.push({
          area_slug: null,
          categoria: "qualita_missione",
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
        // Scollegata dal revisore: l'autovalutazione dichiarata è un'azione
        // dello studente (ha mosso il cursore), e va registrata QUI, a questo
        // step, indipendentemente da come andrà poi la proposta. Prima era
        // emessa in coda al case della proposta, gated su propEmesse>0: un
        // revisore fallito la faceva sparire in silenzio insieme a tutto il
        // resto della Stanza 4. Una riga di qualità di missione (area null),
        // non una per area candidata (stessa motivazione ripetuta = gonfiaggio).
        const p = payload as PayloadPrevisione | undefined;
        if (typeof p?.fiducia === "number") {
          const fiducia = clamp01(p.fiducia / 100) * 100;
          evidenze.push({
            area_slug: null,
            categoria: "qualita_missione",
            dimensione: "self_efficacy",
            valore: clamp01(fiducia / 100),
            peso: P.previsione,
            motivazione: `Prima di scrivere ti eri dato una fiducia ${fiducia >= 60 ? "alta" : fiducia >= 40 ? "media" : "prudente"} su questo lavoro.`,
            step_id: s.id,
          });
        }
        break;
      }

      case "decisione_scritta": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();

        if (s.id === "s2_non_approfondire") {
          if (!testo || !anthropic) break;
          // Fix B: nessuna dipendenza dal mandato — questo step ora emette qualità
          // di missione (area null), non ha più bisogno di sapere qual è il mandato.
          const esito = await chiamaEscape(anthropic, PROMPT_NON_APPROFONDIRE, testo);
          if (esito.ok) {
            const parsed = esito.dati as { consapevolezza?: number; motivazione?: string };
            if (typeof parsed.consapevolezza === "number") {
              const v = clamp01(Number(parsed.consapevolezza));
              const mot = parsed.motivazione || "Hai saputo dire perché hai rinunciato a un'informazione: è consapevolezza del tuo metodo.";
              // Fix B: consapevolezza del proprio metodo = qualità di missione, non
              // competenza/autoefficacia nell'area del mandato (era areaMandato).
              evidenze.push({ area_slug: null, categoria: "qualita_missione", dimensione: "self_efficacy", valore: v, peso: P.ai, motivazione: mot, step_id: s.id });
              evidenze.push({ area_slug: null, categoria: "qualita_missione", dimensione: "performance", valore: v, peso: P.ai, motivazione: "Sapere cosa hai deciso di non sapere è parte del mestiere.", step_id: s.id });
            }
          }
          break;
        }

        // Proposta finale (s4_proposta): il revisore. Traccia l'esito nei tre
        // stati (solo per lo step canonico s4_proposta). I casi di guasto
        // (testo scritto ma chiave assente, o chiamata/estrazione fallita) sono
        // 'non_riuscito': la proposta è rimasta non letta per un guasto nostro,
        // non per una scelta dello studente.
        const eProposta = s.id === "s4_proposta";
        if (!testo) break; // lo studente non ha scritto: nessun esito revisore.
        if (!anthropic) {
          if (eProposta) revisoreEsito = "non_riuscito";
          break;
        }
        const esito = await chiamaEscape(anthropic, spec.promptProposta(mission.areeCandidate, { letti }), testo);
        if (!esito.ok) {
          if (eProposta) revisoreEsito = "non_riuscito";
          break;
        }
        // Lo schema del revisore chiede anche "giudizio_complessivo": è
        // DELIBERATAMENTE non letto qui. Non è un consumatore dimenticato — è
        // uno slot per la frase di chiusura che il modello tende a scrivere, in
        // coppia con la riga anti-poscritto di chiamaJson: se ha un posto DENTRO
        // il JSON, non l'appende DOPO la graffa (il poscritto che ruppe il parse
        // in B3). Le motivazioni per-area (mostrate in «Perché lo diciamo») sono
        // già di fatto un giudizio sull'intero testo, quindi mostrare anche
        // questo campo duplicherebbe — utile solo nello stato letto_senza_credito,
        // mai osservato in produzione. Registrato come candidato: se la vista
        // revisore_esiti mostrerà quello stato, si costruirà un consumatore con
        // una frequenza reale in mano, non con un'ipotesi.
        const parsed = esito.dati as { aree?: unknown[] };
        const aree = Array.isArray(parsed.aree) ? parsed.aree : [];
        let propEmesse = 0;
        for (const raw of aree) {
          const a = raw as { area_slug?: string; performance?: number; interest?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const perf = clamp01(Number(a.performance ?? 0));
          const inter = clamp01(Number(a.interest ?? 0));
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `La tua proposta valorizza ${nomeArea(a.area_slug)}.`;
          // Fix A: la performance della proposta è il giudizio del revisore sul
          // testo scritto → peso P.revisore (1.4), non P.ai (0.5). L'interest resta
          // generico → P.ai.
          evidenze.push({ categoria: "area", area_slug: a.area_slug, dimensione: "performance", valore: perf, peso: P.revisore, motivazione: mot, step_id: s.id });
          evidenze.push({ categoria: "area", area_slug: a.area_slug, dimensione: "interest", valore: inter, peso: P.ai, motivazione: "Un interesse al centro della tua proposta.", step_id: s.id });
          propEmesse++;
        }
        // Il revisore ha girato: 'letto' se ha riconosciuto almeno un'area della
        // whitelist, 'letto_senza_credito' se nessuna (proposta fuori tema o
        // troppo scarna). La previsione self_efficacy NON è più qui: è emessa al
        // suo step (previsione_poi_esito), scollegata da questo esito.
        if (eProposta) revisoreEsito = propEmesse > 0 ? "letto" : "letto_senza_credito";
        break;
      }

      case "assegna_ruoli": {
        const p = payload as PayloadAssegna | undefined;
        const ass = p?.assegnazioni ?? {};
        for (const r of s.ruoli) {
          if (ass[r.id] !== "io") continue;
          evidenze.push({ categoria: "area", area_slug: r.area, dimensione: "interest", valore: 0.8, peso: P.ruoli, motivazione: `Ti sei preso «${r.label.toLowerCase()}»: un compito che senti tuo.`, step_id: s.id });
          evidenze.push({ categoria: "area", area_slug: r.area, dimensione: "self_efficacy", valore: 0.8, peso: P.ruoli, motivazione: `Prendendoti «${r.label.toLowerCase()}» hai mostrato di sentirti capace.`, step_id: s.id });
          pushAssi(r.assi, 1, `Ti sei preso «${r.label.toLowerCase()}».`, s.id);
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
            evidenze.push({ categoria: "area", area_slug: c.area, dimensione: "self_efficacy", valore: 0.6, peso: P.ruoli, motivazione: `Ti sei preso «${c.label.toLowerCase()}».`, step_id: s.id });
            pushAssi(c.assi, 1, `Ti sei preso «${c.label.toLowerCase()}».`, s.id);
          }
        }
        for (const seg of spec.assegnaSegnali ?? []) {
          if (ass[seg.compito] === seg.persona && letti.has(seg.richiede)) {
            evidenze.push({ categoria: "area", area_slug: seg.area, dimensione: "performance", valore: 0.9, peso: seg.peso, motivazione: seg.motivazione, step_id: s.id });
            // Mettere la persona giusta al posto giusto è relazionale.
            pushAssi([{ asse: "relazionale", valore: 0.9 }], 1, "Hai messo la persona giusta al posto giusto, con criterio.", s.id);
          }
        }
        // Tenere (quasi) tutto per sé: segnale debole con nota. La valutazione è
        // sul contributo di ciascuno — chi fa tutto lascia gli altri senza.
        if (s.compiti.length > 0 && ioCount >= s.compiti.length - 1) {
          // Fix B: «tenere tutto per sé» è un'osservazione sul metodo, non
          // competenza in scienze-educazione (area cablata) → qualità di missione.
          evidenze.push({ area_slug: null, categoria: "qualita_missione", dimensione: "performance", valore: 0.2, peso: P.scartoPerf, motivazione: "Hai tenuto quasi tutti i compiti per te: così il gruppo non ha un contributo da mostrare, e nemmeno tu.", step_id: s.id });
        }
        break;
      }

      case "riflessione": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();
        if (!testo || !anthropic) break;
        const esito = await chiamaEscape(anthropic, PROMPT_RIFLESSIONE(mission.areeCandidate), testo);
        const parsed = esito.ok ? (esito.dati as { aree?: unknown[] }) : null;
        const aree = Array.isArray(parsed?.aree) ? parsed!.aree : [];
        let emesse = 0;
        let maxSelfEff = 0;
        for (const raw of aree) {
          const a = raw as { area_slug?: string; curiosity?: number; self_efficacy?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `Dalla tua riflessione traspare un legame con ${nomeArea(a.area_slug)}.`;
          // La curiosity ha motivazione DISTINTA per area (generata dall'Aì leggendo
          // la riflessione) → resta ad area.
          evidenze.push({ categoria: "area", area_slug: a.area_slug, dimensione: "curiosity", valore: clamp01(Number(a.curiosity ?? 0)), peso: P.ai, motivazione: mot, step_id: s.id });
          maxSelfEff = Math.max(maxSelfEff, clamp01(Number(a.self_efficacy ?? 0)));
          emesse++;
        }
        // Fix B: la self_efficacy ha motivazione IDENTICA e cablata su tutte le
        // aree («ti sei sentito a tuo agio») — non dice competenza in nessuna →
        // una riga di qualità di missione, senza area (era una per area).
        if (emesse > 0) {
          evidenze.push({ area_slug: null, categoria: "qualita_missione", dimensione: "self_efficacy", valore: maxSelfEff, peso: P.ai, motivazione: "Ti sei sentito a tuo agio mentre ripensavi al percorso.", step_id: s.id });
        }
        break;
      }

      case "pianifica_passi": {
        const p = payload as PayloadPianifica | undefined;
        const scelti = p?.passi ?? [];
        if (scelti.length === 0) break;
        // Stile: l'asse dipende da QUALI passi scegli (uno eseguibile → operativo,
        // uno che coinvolge le persone → relazionale), non dall'aver pianificato.
        for (const id of scelti) {
          const passo = s.passi.find((x) => x.id === id);
          if (passo?.assi) pushAssi(passo.assi, 1, `Hai messo tra i primi passi «${passo.label.toLowerCase()}».`, s.id);
        }
        const ideali = new Set(spec.pianificaIdeali);
        const overlap = scelti.filter((id) => ideali.has(id)).length / s.quanti;
        const bonusOrdine = spec.pianificaIdeali.length > 0 && scelti[0] === spec.pianificaIdeali[0] ? 0.1 : 0;
        const correttezza = clamp01(overlap + bonusOrdine);
        // Fix B: l'ordine dei primi passi è qualità di missione, non competenza
        // nell'area del mandato (era areaMandato / fallback edilizia-architettura).
        evidenze.push({
          area_slug: null,
          categoria: "qualita_missione",
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

  return { evidenze: sanitizzaEvidenze(evidenze), revisoreEsito };
}
