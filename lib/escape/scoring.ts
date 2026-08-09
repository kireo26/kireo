// KIREO Escape — motore di scoring (SOLO server: importato dal route di
// finalizzazione, mai dal client). Trasforma le risposte autorevoli lette dal
// DB in prove (evidence). Gli step strutturati sono deterministici; i due step
// aperti (decisione, riflessione) passano da Haiku. Un fallimento AI non blocca
// la missione: si emettono comunque le prove strutturate (stessa filosofia dei
// workshop).
//
// Le costanti di peso sono tarate perché UNA missione completa porti l'area
// dominante intorno a confidence ~0.5 (status "emergente") e servano ~2
// missioni per arrivare a "confermata" (soglia 0.66 in ricalcola_area_signal).
// Valori di partenza, da affinare alla validazione live.

import Anthropic from "@anthropic-ai/sdk";
import { getAreaBySlug } from "@/data/aree";
import type {
  EscapeMission,
  EvidenceInput,
  Payload,
  PayloadAlloca,
  PayloadOrdina,
  PayloadPrevisione,
  PayloadScarta,
  PayloadSceltaSingola,
  PayloadSeleziona,
  PayloadTesto,
} from "./tipi";
import { stepDellaMissione } from "./config";

const MODELLO_ESCAPE = "claude-haiku-4-5"; // stesso modello provato in prod (workshop/assistente)

const PESO_INTERESSE = 0.5;
const PESO_CURIOSITA = 0.5;
const PESO_PERFORMANCE = 0.6;
const PESO_DEC_PERFORMANCE = 0.8;
const PESO_DEC_INTERESSE = 0.7;
const PESO_AUTOEFFICACIA = 0.7;
const PESO_RIFLESSIONE = 0.6;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const nomeArea = (slug: string) => getAreaBySlug(slug)?.nome ?? slug;

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
  const step = stepDellaMissione(mission);

  // fiducia dichiarata (step previsione) — usata dalla decisione scritta
  let fiduciaDichiarata = 50;

  for (const s of step) {
    const payload = risposte.get(s.id);
    if (!payload && s.tipo !== "decisione_scritta" && s.tipo !== "riflessione") continue;

    switch (s.tipo) {
      case "scelta_singola": {
        const p = payload as PayloadSceltaSingola | undefined;
        const opz = s.opzioni.find((o) => o.id === p?.opzioneId);
        if (opz) {
          evidenze.push({
            area_slug: opz.areaSlug,
            dimensione: "interest",
            valore: 0.9,
            peso: PESO_INTERESSE,
            motivazione: `Hai letto lo spazio soprattutto in chiave «${opz.label.toLowerCase()}»: un segnale di interesse verso ${nomeArea(opz.areaSlug)}.`,
            step_id: s.id,
          });
        }
        break;
      }

      case "ordina_priorita": {
        const p = payload as PayloadOrdina | undefined;
        const ordine = p?.ordine ?? s.elementi.map((e) => e.id);
        // le prime 3 posizioni contano (valore decrescente per rango)
        const valoriRango = [0.9, 0.7, 0.5];
        ordine.slice(0, 3).forEach((id, i) => {
          const el = s.elementi.find((e) => e.id === id);
          if (!el) return;
          evidenze.push({
            area_slug: el.areaSlug,
            dimensione: "interest",
            valore: valoriRango[i],
            peso: PESO_INTERESSE,
            motivazione: `Hai messo tra le priorità «${el.label.toLowerCase()}»: attrazione verso ${nomeArea(el.areaSlug)}.`,
            step_id: s.id,
          });
        });
        break;
      }

      case "seleziona_informazioni": {
        const p = payload as PayloadSeleziona | undefined;
        for (const id of p?.selezionati ?? []) {
          const d = s.dossier.find((x) => x.id === id);
          if (!d) continue;
          evidenze.push({
            area_slug: d.areaSlug,
            dimensione: "curiosity",
            valore: 0.8,
            peso: PESO_CURIOSITA,
            motivazione: `Hai voluto approfondire «${d.label.toLowerCase()}»: la tua curiosità si è diretta verso ${nomeArea(d.areaSlug)}.`,
            step_id: s.id,
          });
          evidenze.push({
            area_slug: d.areaSlug,
            dimensione: "interest",
            valore: 0.4,
            peso: PESO_INTERESSE * 0.6,
            motivazione: `Interesse verso ${nomeArea(d.areaSlug)}, emerso dai dossier che hai scelto di aprire.`,
            step_id: s.id,
          });
        }
        break;
      }

      case "alloca_budget": {
        const p = payload as PayloadAlloca | undefined;
        const alloc = p?.allocazioni ?? {};
        const speso = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
        const maxAlloc = Math.max(0, ...Object.values(alloc).map((v) => Number(v) || 0));
        if (speso > 0 && maxAlloc > 0) {
          for (const voce of s.voci) {
            const a = Number(alloc[voce.id]) || 0;
            if (a <= 0) continue;
            evidenze.push({
              area_slug: voce.areaSlug,
              dimensione: "interest",
              valore: clamp01(a / maxAlloc),
              peso: PESO_INTERESSE,
              motivazione: `Hai investito risorse su «${voce.label.toLowerCase()}»: interesse concreto verso ${nomeArea(voce.areaSlug)}.`,
              step_id: s.id,
            });
          }
          // performance: pienezza dell'uso del budget × equilibrio (non tutto su una voce)
          const pienezza = clamp01(speso / s.totale);
          const concentrazione = maxAlloc / speso; // 1 = tutto su una voce
          const equilibrio = 1 - Math.max(0, concentrazione - 0.5) / 0.5;
          const perf = clamp01(pienezza * equilibrio);
          const topVoce = s.voci.find((v) => (Number(alloc[v.id]) || 0) === maxAlloc);
          if (topVoce) {
            evidenze.push({
              area_slug: topVoce.areaSlug,
              dimensione: "performance",
              valore: perf,
              peso: PESO_PERFORMANCE,
              motivazione:
                perf >= 0.6
                  ? "Hai distribuito le risorse in modo equilibrato, sfruttando quasi tutto il budget."
                  : "La distribuzione è un po' sbilanciata o lascia budget inutilizzato: c'è margine per bilanciare meglio.",
              step_id: s.id,
            });
          }
        }
        break;
      }

      case "scarta_opzione": {
        const p = payload as PayloadScarta | undefined;
        const scartati = new Set(p?.scartati ?? []);
        const tenuti = s.opzioni.filter((o) => !scartati.has(o.id));
        for (const o of tenuti) {
          evidenze.push({
            area_slug: o.areaSlug,
            dimensione: "interest",
            valore: 0.6,
            peso: PESO_INTERESSE,
            motivazione: `Hai scelto di tenere «${o.label.toLowerCase()}»: lo consideri essenziale (${nomeArea(o.areaSlug)}).`,
            step_id: s.id,
          });
        }
        // performance: quanto ha scartato le opzioni davvero meno essenziali
        const perQualita = [...s.opzioni].sort((a, b) => (a.qualita ?? 0.5) - (b.qualita ?? 0.5));
        const idealiDaScartare = new Set(perQualita.slice(0, s.daScartare).map((o) => o.id));
        const scartatiGiusti = [...scartati].filter((id) => idealiDaScartare.has(id)).length;
        const correttezza = s.daScartare > 0 ? clamp01(scartatiGiusti / s.daScartare) : 0.5;
        const topTenuto = [...tenuti].sort((a, b) => (b.qualita ?? 0.5) - (a.qualita ?? 0.5))[0];
        if (topTenuto) {
          evidenze.push({
            area_slug: topTenuto.areaSlug,
            dimensione: "performance",
            valore: correttezza,
            peso: PESO_PERFORMANCE,
            motivazione:
              correttezza >= 0.6
                ? "Hai rinunciato alle voci meno essenziali tenendo le priorità: scelta lucida sotto vincolo."
                : "Hai tagliato qualcosa di piuttosto essenziale: rivedere cosa è davvero irrinunciabile potrebbe aiutare.",
            step_id: s.id,
          });
        }
        break;
      }

      case "previsione_poi_esito": {
        const p = payload as PayloadPrevisione | undefined;
        if (typeof p?.fiducia === "number") fiduciaDichiarata = clamp01(p.fiducia / 100) * 100;
        // nessuna prova diretta: la self_efficacy viene emessa dalla decisione scritta
        break;
      }

      case "decisione_scritta": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();
        if (!testo || !anthropic) break;
        const system = `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto una proposta per rigenerare uno spazio pubblico abbandonato del suo quartiere. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${mission.areeCandidate.join(", ")} — che la proposta enfatizza di più. Per ognuna valuta: performance = quanto la proposta è concreta e argomentata su quell'area (0-1); interest = quanto la proposta ci punta (0-1). Scrivi una motivazione breve, calda, IPOTETICA e in italiano semplice, rivolta allo studente (es. "Sembra che..."). Rispondi SOLO con JSON valido, nessun altro testo: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`;
        const parsed = (await chiamaHaikuJson(anthropic, system, testo)) as { aree?: unknown[] } | null;
        const aree = Array.isArray(parsed?.aree) ? parsed!.aree : [];
        for (const raw of aree) {
          const a = raw as { area_slug?: string; performance?: number; interest?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const perf = clamp01(Number(a.performance ?? 0));
          const inter = clamp01(Number(a.interest ?? 0));
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `La tua proposta valorizza ${nomeArea(a.area_slug)}.`;
          evidenze.push({ area_slug: a.area_slug, dimensione: "performance", valore: perf, peso: PESO_DEC_PERFORMANCE, motivazione: mot, step_id: s.id });
          evidenze.push({ area_slug: a.area_slug, dimensione: "interest", valore: inter, peso: PESO_DEC_INTERESSE, motivazione: `Interesse verso ${nomeArea(a.area_slug)}, al centro della tua proposta.`, step_id: s.id });
          evidenze.push({
            area_slug: a.area_slug,
            dimensione: "self_efficacy",
            valore: clamp01(fiduciaDichiarata / 100),
            peso: PESO_AUTOEFFICACIA,
            motivazione: `Prima di scrivere ti sei dato una fiducia ${fiduciaDichiarata >= 60 ? "alta" : fiduciaDichiarata >= 40 ? "media" : "prudente"} su questo progetto.`,
            step_id: s.id,
          });
        }
        break;
      }

      case "riflessione": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();
        if (!testo || !anthropic) break;
        const system = `Sei un analista di orientamento per studenti italiani di 16-19 anni. Leggi la riflessione che uno studente ha scritto DOPO aver completato un progetto per il quartiere. Individua da 1 a 2 aree — SCEGLIENDO SOLO tra questi slug: ${mission.areeCandidate.join(", ")} — che sembrano averlo attratto o messo a suo agio. Per ognuna valuta: curiosity = quanta voglia di esplorare quell'area traspare (0-1); self_efficacy = quanto si è sentito capace su quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","curiosity":0.0,"self_efficacy":0.0,"motivazione":"..."}]}`;
        const parsed = (await chiamaHaikuJson(anthropic, system, testo)) as { aree?: unknown[] } | null;
        const aree = Array.isArray(parsed?.aree) ? parsed!.aree : [];
        for (const raw of aree) {
          const a = raw as { area_slug?: string; curiosity?: number; self_efficacy?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `Dalla tua riflessione traspare un legame con ${nomeArea(a.area_slug)}.`;
          evidenze.push({ area_slug: a.area_slug, dimensione: "curiosity", valore: clamp01(Number(a.curiosity ?? 0)), peso: PESO_RIFLESSIONE, motivazione: mot, step_id: s.id });
          evidenze.push({ area_slug: a.area_slug, dimensione: "self_efficacy", valore: clamp01(Number(a.self_efficacy ?? 0)), peso: PESO_RIFLESSIONE, motivazione: `Ti sei sentito a tuo agio con ${nomeArea(a.area_slug)} mentre riflettevi sul percorso.`, step_id: s.id });
        }
        break;
      }
    }
  }

  // scarta prove a peso/valore nullo (difensivo)
  return evidenze.filter((e) => e.peso > 0);
}
