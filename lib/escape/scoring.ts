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
  PayloadEsplora,
  PayloadOrdina,
  PayloadPianifica,
  PayloadPrevisione,
  PayloadScarta,
  PayloadSceltaSingola,
  PayloadSeleziona,
  PayloadTesto,
  VoceBudget,
} from "./tipi";
import { mandatoScelto, materialiLetti, stepDellaMissione, SLUG_MEDIATECA, SLUG_QUARTIERE, SLUG_SERRA } from "./config";

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

type ScoringSpec = {
  pesi: Pesi;
  esploraTesti: { conBonus: string; base: string };
  pianificaIdeali: string[];
  ordinaPerformance?: { area: string; peso: number };
  budgetPerformance: (c: BudgetCtx) => { valore: number; buona: string; migliora: string };
  promptProposta: (aree: string[]) => string;
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
};

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
        const r = spec.budgetPerformance({ alloc, voci: s.voci, letti, totale: s.totale });
        const areaPerf = areaMandato ?? s.voci.find((v) => (Number(alloc[v.id]) || 0) === maxAlloc)?.aree[0] ?? null;
        if (areaPerf) {
          evidenze.push({ area_slug: areaPerf, dimensione: "performance", valore: r.valore, peso: P.budgetPerf, motivazione: r.valore >= 0.6 ? r.buona : r.migliora, step_id: s.id });
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
        const facciataTenuta = tenuti.some((o) => o.trappola);
        const areaPerf = trappola?.aree[0] ?? "studi-umanistici-beni-culturali";
        evidenze.push({
          area_slug: areaPerf,
          dimensione: "performance",
          valore: facciataTenuta ? Math.min(correttezza, 0.2) : correttezza,
          peso: P.scartoPerf,
          motivazione: facciataTenuta ? "Hai tenuto la scelta che, verificabile alla mano, avrebbe fatto saltare tutto: valeva la pena controllarla prima." : "Hai riconosciuto cosa lasciare andare e cosa proteggere: scelta lucida sotto vincolo.",
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

        const parsed = (await chiamaHaikuJson(anthropic, spec.promptProposta(mission.areeCandidate), testo)) as { aree?: unknown[] } | null;
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
