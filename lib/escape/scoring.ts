// KIREO Escape — motore di scoring (SOLO server: importato dal route di
// finalizzazione, mai dal client). Trasforma le risposte autorevoli lette dal
// DB in prove (evidence). Gli step strutturati sono deterministici; i tre step
// aperti (non-approfondire, proposta, riflessione) passano da Haiku. Un
// fallimento AI non blocca la missione: si emettono comunque le prove
// strutturate (stessa filosofia dei workshop).
//
// Pesi tarati (sezione "Taratura" del design v2): step strutturali chiave
// (mandato, budget, scarto) 1,2-1,5; ordinamento 0,8/area; selezione 0,6/area;
// ruoli 0,8; prove da AI 0,5; prove trasversali (area nulla) con parsimonia.
// Una missione completa deve portare l'area dominante a confidence ~0,5
// ("emergente"), non oltre. Valori di partenza, da affinare alla validazione.

import Anthropic from "@anthropic-ai/sdk";
import { AREE, getAreaBySlug } from "@/data/aree";
import type {
  Dimensione,
  EscapeMission,
  EvidenceInput,
  LeggiRisposta,
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
} from "./tipi";
import { mandatoScelto, materialiLetti, stepDellaMissione } from "./config";

const MODELLO_ESCAPE = "claude-haiku-4-5"; // stesso modello provato in prod (workshop/assistente)

const DIMENSIONI_VALIDE = new Set<Dimensione>(["interest", "performance", "self_efficacy", "curiosity"]);
const AREE_VALIDE = new Set(AREE.map((a) => a.slug));
const PESO_MINIMO = 0.01;

// Paracadute finale prima di passare l'array a registra_evidence: garantisce
// che nessuna prova violi i CHECK del DB (valore in [0,1], peso > 0, dimensione
// ed eventuale area_slug validi) — altrimenti una singola prova malformata
// farebbe fallire l'INTERO insert e quindi la finalizzazione. valore e peso
// vengono FORZATI nel range; le prove con dimensione o area_slug non validi
// vengono SCARTATE. Così un output AI malformato degrada a zero prove aperte,
// senza mai bloccare la missione.
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

const PESO_ESPLORA = 0.4; // curiosità trasversale (metodo), parsimonia
const PESO_ORDINA = 0.8; // interesse per area, su 6 voci
const PESO_MANDATO = 1.3; // interesse, decisione di campo
const PESO_SELEZIONA_CUR = 0.6; // curiosità per area toccata
const PESO_SELEZIONA_INT = 0.4; // interesse più debole
const PESO_BUDGET_INT = 0.6; // interesse per voce finanziata
const PESO_BUDGET_PERF = 1.3; // performance (coerenza), step strutturale
const PESO_SCARTO_INT = 0.5; // interesse per voce tenuta
const PESO_SCARTO_PERF = 1.3; // performance, verificabile
const PESO_RUOLI = 0.8; // interesse + autoefficacia sui compiti presi
const PESO_AI = 0.5; // prove da AI (2.2, 4.2, 5.1) — inferenza, vale meno
const PESO_PREVISIONE = 0.5; // autoefficacia dichiarata, applicata alle aree della proposta
const PESO_PASSI = 0.6; // performance, deterministico

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
  const get: LeggiRisposta = (id) => risposte.get(id);
  const step = stepDellaMissione(mission);

  const mandato = mandatoScelto(get);
  const letti = materialiLetti(get);
  const areaMandato = mandato?.aree[0] ?? null; // area su cui appoggiare le prove "di coerenza"

  // fiducia dichiarata (step previsione) — usata dalla decisione scritta
  let fiduciaDichiarata = 50;

  for (const s of step) {
    const payload = risposte.get(s.id);
    const stepAperto = s.tipo === "decisione_scritta" || s.tipo === "riflessione";
    if (!payload && !stepAperto) continue;

    switch (s.tipo) {
      case "esplora_libero": {
        // Curiosità TRASVERSALE (metodo): quanti/quali documenti liberi apre.
        // Area nulla → non alimenta il radar, ma resta trasparente nel "perché".
        const p = payload as PayloadEsplora | undefined;
        const aperti = p?.letti ?? [];
        if (aperti.length > 0) {
          const haM2 = aperti.includes("M2");
          const valore = clamp01(0.3 + 0.18 * aperti.length + (haM2 ? 0.15 : 0));
          evidenze.push({
            area_slug: null,
            dimensione: "curiosity",
            valore,
            peso: PESO_ESPLORA,
            motivazione: haM2
              ? "Hai voluto sentire le voci del quartiere, non solo leggere i numeri: parti dalle persone."
              : "Hai aperto i documenti prima di decidere: parti dai fatti, non dalle impressioni.",
            step_id: s.id,
          });
        }
        break;
      }

      case "scelta_singola": {
        // Il mandato (1.3): dichiarazione di campo, interesse alto e sostenuto.
        const p = payload as PayloadSceltaSingola | undefined;
        const opz = s.opzioni.find((o) => o.id === p?.opzioneId);
        if (opz) {
          for (const area of opz.aree) {
            evidenze.push({
              area_slug: area,
              dimensione: "interest",
              valore: 0.9,
              peso: PESO_MANDATO,
              motivazione: `Hai scelto il mandato ${opz.label.split(" — ")[0]}: una dichiarazione di campo verso ${nomeArea(area)}.`,
              step_id: s.id,
            });
          }
        }
        break;
      }

      case "ordina_priorita": {
        // Le 6 priorità: il vero sondaggio ad ampio spettro. Valore decrescente
        // per posizione (1° = 0,95 … 6° = 0,15), su tutte le aree di ogni voce.
        const p = payload as PayloadOrdina | undefined;
        const ordine = p?.ordine ?? s.elementi.map((e) => e.id);
        const n = Math.max(1, ordine.length - 1);
        ordine.forEach((id, i) => {
          const el = s.elementi.find((e) => e.id === id);
          if (!el) return;
          const valore = clamp01(0.95 - (i / n) * 0.8);
          for (const area of el.aree) {
            evidenze.push({
              area_slug: area,
              dimensione: "interest",
              valore,
              peso: PESO_ORDINA,
              motivazione: `Hai messo «${el.label.toLowerCase()}» al ${i + 1}° posto tra le priorità: attrazione verso ${nomeArea(area)}.`,
              step_id: s.id,
            });
          }
        });
        break;
      }

      case "seleziona_informazioni": {
        // I gettoni spesi: curiosità (0,8) + interesse più debole (0,4) sulle
        // aree dei materiali aperti.
        const p = payload as PayloadSeleziona | undefined;
        for (const id of p?.selezionati ?? []) {
          const d = s.dossier.find((x) => x.id === id);
          if (!d) continue;
          for (const area of d.aree) {
            evidenze.push({
              area_slug: area,
              dimensione: "curiosity",
              valore: 0.8,
              peso: PESO_SELEZIONA_CUR,
              motivazione: `Hai speso un gettone per «${d.titolo.toLowerCase()}»: la tua curiosità si è diretta verso ${nomeArea(area)}.`,
              step_id: s.id,
            });
            evidenze.push({
              area_slug: area,
              dimensione: "interest",
              valore: 0.4,
              peso: PESO_SELEZIONA_INT,
              motivazione: `Interesse verso ${nomeArea(area)}, emerso dagli approfondimenti che hai voluto leggere.`,
              step_id: s.id,
            });
          }
        }
        break;
      }

      case "alloca_budget": {
        // Interesse "concreto" (dove metti i soldi) + performance di coerenza
        // rispetto al vincolo, al tetto e (se sapevi) alla gestione.
        const p = payload as PayloadAlloca | undefined;
        const alloc = p?.allocazioni ?? {};
        const speso = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
        const maxAlloc = Math.max(0, ...Object.values(alloc).map((v) => Number(v) || 0));
        if (speso <= 0 || maxAlloc <= 0) break;

        for (const voce of s.voci) {
          const a = Number(alloc[voce.id]) || 0;
          if (a <= 0) continue;
          for (const area of voce.aree) {
            evidenze.push({
              area_slug: area,
              dimensione: "interest",
              valore: clamp01(a / maxAlloc),
              peso: PESO_BUDGET_INT,
              motivazione: `Hai investito risorse su «${voce.label.toLowerCase()}»: interesse concreto verso ${nomeArea(area)}.`,
              step_id: s.id,
            });
          }
        }

        // performance di coerenza (0..1) come media pesata di segnali oggettivi.
        let punti = 0;
        let max = 0;
        const tetto = Number(alloc["tetto"]) || 0;
        const sogliaTetto = letti.has("M4") ? 27000 : 50000; // per lotti se M4 letto
        max += 2;
        punti += tetto >= sogliaTetto ? 2 : clamp01(tetto / sogliaTetto) * 2;

        const voceVincolo = s.voci.find((v) => v.id === "adeguamento_vincolo");
        if (voceVincolo) {
          const speVincolo = Number(alloc["adeguamento_vincolo"]) || 0;
          const soglia = (voceVincolo.costoIndicativo ?? 30000) * 0.8;
          max += 2;
          punti += speVincolo >= soglia ? 2 : clamp01(speVincolo / soglia) * 2;
        }

        const conosceGestione = letti.has("M7") && s.voci.some((v) => v.id === "fondo_gestione");
        if (conosceGestione) {
          const fondo = Number(alloc["fondo_gestione"]) || 0;
          max += 1.5;
          punti += fondo > 0 ? 1.5 : 0;
        }

        const pienezza = clamp01(speso / s.totale);
        max += 1;
        punti += pienezza;
        const equilibrio = clamp01(1 - Math.max(0, maxAlloc / speso - 0.5) / 0.5);
        max += 1;
        punti += equilibrio;

        const perf = clamp01(max > 0 ? punti / max : 0.5);
        const areaPerf = areaMandato ?? s.voci.find((v) => (Number(alloc[v.id]) || 0) === maxAlloc)?.aree[0] ?? null;
        if (areaPerf) {
          evidenze.push({
            area_slug: areaPerf,
            dimensione: "performance",
            valore: perf,
            peso: PESO_BUDGET_PERF,
            motivazione:
              perf >= 0.6
                ? "Hai retto il colpo del tetto e coperto il vincolo senza dimenticare la sostenibilità: scelte lucide sotto pressione."
                : "La distribuzione lascia scoperto qualcosa di importante (il tetto, il vincolo o la gestione): c'è margine per bilanciare meglio.",
            step_id: s.id,
          });
        }
        break;
      }

      case "scarta_opzione": {
        // Trappola della facciata: tagliarla è la mossa giusta. Interesse solo
        // sulle voci NON-trappola tenute; performance sul patrimonio tutelato.
        const p = payload as PayloadScarta | undefined;
        const scartati = new Set(p?.scartati ?? []);
        const tenuti = s.opzioni.filter((o) => !scartati.has(o.id));
        for (const o of tenuti) {
          if (o.trappola) continue;
          for (const area of o.aree) {
            evidenze.push({
              area_slug: area,
              dimensione: "interest",
              valore: 0.6,
              peso: PESO_SCARTO_INT,
              motivazione: `Hai scelto di tenere «${o.label.toLowerCase()}»: lo consideri essenziale (${nomeArea(area)}).`,
              step_id: s.id,
            });
          }
        }
        // performance: hai scartato le 2 voci meno essenziali (facciata + insegna)?
        const perQualita = [...s.opzioni].sort((a, b) => (a.qualita ?? 0.5) - (b.qualita ?? 0.5));
        const idealiDaScartare = new Set(perQualita.slice(0, s.daScartare).map((o) => o.id));
        const scartatiGiusti = [...scartati].filter((id) => idealiDaScartare.has(id)).length;
        const correttezza = s.daScartare > 0 ? clamp01(scartatiGiusti / s.daScartare) : 0.5;
        const facciataTenuta = tenuti.some((o) => o.trappola);
        const trappola = s.opzioni.find((o) => o.trappola);
        const areaPerf = trappola?.aree[0] ?? "studi-umanistici-beni-culturali";
        evidenze.push({
          area_slug: areaPerf,
          dimensione: "performance",
          valore: correttezza,
          peso: PESO_SCARTO_PERF,
          motivazione: facciataTenuta
            ? "Hai tenuto il rivestimento della facciata: la Soprintendenza l'avrebbe respinto. Il patrimonio dell'edificio andava riconosciuto."
            : "Hai riconosciuto cosa proteggere e cosa lasciare andare: scelta lucida sul valore dell'edificio.",
          step_id: s.id,
        });
        break;
      }

      case "previsione_poi_esito": {
        // SOLO autoefficacia (dichiarata prima dell'esito): nessuna prova qui,
        // il valore viene applicato dalla proposta alle sue aree.
        const p = payload as PayloadPrevisione | undefined;
        if (typeof p?.fiducia === "number") fiduciaDichiarata = clamp01(p.fiducia / 100) * 100;
        break;
      }

      case "decisione_scritta": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();
        if (!testo || !anthropic) break;

        if (s.id === "s2_non_approfondire") {
          // 2.2 — consapevolezza del compromesso: un singolo scalare, applicato
          // all'area primaria del mandato (autoefficacia + performance, peso AI).
          if (!areaMandato) break;
          const system =
            "Sei un analista di orientamento per studenti italiani di 16-19 anni. Lo studente spiega una cosa che ha scelto di NON approfondire e perché. Valuta quanto è lucido e consapevole del compromesso (0 = non motivato / superficiale, 1 = pienamente consapevole). Rispondi SOLO con JSON: {\"consapevolezza\":0.0,\"motivazione\":\"...\"}. La motivazione: breve, calda, ipotetica, in italiano, rivolta allo studente.";
          const parsed = (await chiamaHaikuJson(anthropic, system, testo)) as { consapevolezza?: number; motivazione?: string } | null;
          if (parsed && typeof parsed.consapevolezza === "number") {
            const v = clamp01(Number(parsed.consapevolezza));
            const mot = parsed.motivazione || "Hai saputo dire perché hai rinunciato a un'informazione: è consapevolezza del tuo metodo.";
            evidenze.push({ area_slug: areaMandato, dimensione: "self_efficacy", valore: v, peso: PESO_AI, motivazione: mot, step_id: s.id });
            evidenze.push({ area_slug: areaMandato, dimensione: "performance", valore: v, peso: PESO_AI, motivazione: `Sapere cosa hai deciso di non sapere è parte del mestiere (${nomeArea(areaMandato)}).`, step_id: s.id });
          }
          break;
        }

        // 4.2 — la proposta: performance + interesse (via AI) e autoefficacia
        // (dalla previsione) sulle aree che la proposta enfatizza.
        const system = `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha scritto la proposta per rigenerare un ex mercato coperto del suo quartiere. Individua da 1 a 3 aree — SCEGLIENDO SOLO tra questi slug: ${mission.areeCandidate.join(", ")} — che la proposta enfatizza di più. Per ognuna valuta: performance = quanto la proposta è concreta, coerente col mandato e col vincolo, argomentata su quell'area (0-1); interest = quanto la proposta ci punta (0-1). Motivazione breve, calda, IPOTETICA, in italiano semplice, rivolta allo studente. Rispondi SOLO con JSON valido: {"aree":[{"area_slug":"...","performance":0.0,"interest":0.0,"motivazione":"..."}]}`;
        const parsed = (await chiamaHaikuJson(anthropic, system, testo)) as { aree?: unknown[] } | null;
        const aree = Array.isArray(parsed?.aree) ? parsed!.aree : [];
        for (const raw of aree) {
          const a = raw as { area_slug?: string; performance?: number; interest?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const perf = clamp01(Number(a.performance ?? 0));
          const inter = clamp01(Number(a.interest ?? 0));
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `La tua proposta valorizza ${nomeArea(a.area_slug)}.`;
          evidenze.push({ area_slug: a.area_slug, dimensione: "performance", valore: perf, peso: PESO_AI, motivazione: mot, step_id: s.id });
          evidenze.push({ area_slug: a.area_slug, dimensione: "interest", valore: inter, peso: PESO_AI, motivazione: `Interesse verso ${nomeArea(a.area_slug)}, al centro della tua proposta.`, step_id: s.id });
          evidenze.push({
            area_slug: a.area_slug,
            dimensione: "self_efficacy",
            valore: clamp01(fiduciaDichiarata / 100),
            peso: PESO_PREVISIONE,
            motivazione: `Prima di scrivere ti eri dato una fiducia ${fiduciaDichiarata >= 60 ? "alta" : fiduciaDichiarata >= 40 ? "media" : "prudente"} su questo progetto.`,
            step_id: s.id,
          });
        }
        break;
      }

      case "assegna_ruoli": {
        // Quello che ci si prende è quello che ci si sente di saper fare:
        // interesse + autoefficacia sull'area del compito assegnato a "io".
        const p = payload as PayloadAssegna | undefined;
        const ass = p?.assegnazioni ?? {};
        for (const r of s.ruoli) {
          if (ass[r.id] !== "io") continue;
          evidenze.push({ area_slug: r.area, dimensione: "interest", valore: 0.8, peso: PESO_RUOLI, motivazione: `Ti sei preso «${r.label.toLowerCase()}»: un compito che senti tuo (${nomeArea(r.area)}).`, step_id: s.id });
          evidenze.push({ area_slug: r.area, dimensione: "self_efficacy", valore: 0.8, peso: PESO_RUOLI, motivazione: `Prendendoti «${r.label.toLowerCase()}» hai mostrato di sentirti capace su ${nomeArea(r.area)}.`, step_id: s.id });
        }
        break;
      }

      case "riflessione": {
        const p = payload as PayloadTesto | undefined;
        const testo = p?.testo?.trim();
        if (!testo || !anthropic) break;
        const system = `Sei un analista di orientamento per studenti italiani di 16-19 anni. Leggi la riflessione che uno studente ha scritto DOPO aver completato un progetto per il quartiere (dove si è sentito nel suo, dove fuori posto). Individua da 1 a 2 aree — SCEGLIENDO SOLO tra questi slug: ${mission.areeCandidate.join(", ")} — che sembrano averlo attratto o messo a suo agio. Per ognuna valuta: curiosity = quanta voglia di esplorare quell'area traspare (0-1); self_efficacy = quanto si è sentito capace su quell'area (0-1). Motivazione breve, calda, IPOTETICA, in italiano. Rispondi SOLO JSON: {"aree":[{"area_slug":"...","curiosity":0.0,"self_efficacy":0.0,"motivazione":"..."}]}`;
        const parsed = (await chiamaHaikuJson(anthropic, system, testo)) as { aree?: unknown[] } | null;
        const aree = Array.isArray(parsed?.aree) ? parsed!.aree : [];
        for (const raw of aree) {
          const a = raw as { area_slug?: string; curiosity?: number; self_efficacy?: number; motivazione?: string };
          if (!a.area_slug || !mission.areeCandidate.includes(a.area_slug)) continue;
          const mot = typeof a.motivazione === "string" && a.motivazione ? a.motivazione : `Dalla tua riflessione traspare un legame con ${nomeArea(a.area_slug)}.`;
          evidenze.push({ area_slug: a.area_slug, dimensione: "curiosity", valore: clamp01(Number(a.curiosity ?? 0)), peso: PESO_AI, motivazione: mot, step_id: s.id });
          evidenze.push({ area_slug: a.area_slug, dimensione: "self_efficacy", valore: clamp01(Number(a.self_efficacy ?? 0)), peso: PESO_AI, motivazione: `Ti sei sentito a tuo agio con ${nomeArea(a.area_slug)} mentre ripensavi al percorso.`, step_id: s.id });
        }
        break;
      }

      case "pianifica_passi": {
        // Performance deterministica: i primi tre passi hanno una sequenza
        // sensata (sicurezza e adempimenti prima dell'apertura).
        const p = payload as PayloadPianifica | undefined;
        const scelti = p?.passi ?? [];
        if (scelti.length === 0) break;
        const ideali = new Set(["sicurezza", "convenzione", "lavori"]);
        const overlap = scelti.filter((id) => ideali.has(id)).length / s.quanti;
        const bonusOrdine = scelti[0] === "sicurezza" || scelti[0] === "convenzione" ? 0.1 : 0;
        const correttezza = clamp01(overlap + bonusOrdine);
        const areaPerf = areaMandato ?? "edilizia-architettura";
        evidenze.push({
          area_slug: areaPerf,
          dimensione: "performance",
          valore: correttezza,
          peso: PESO_PASSI,
          motivazione:
            correttezza >= 0.6
              ? "Hai messo in ordine i primi passi con criterio: prima la sicurezza e gli adempimenti, poi l'apertura."
              : "L'ordine dei primi passi salta qualche base (sicurezza, adempimenti): utile ripensarci da dove conviene partire.",
          step_id: s.id,
        });
        break;
      }
    }
  }

  return sanitizzaEvidenze(evidenze);
}
