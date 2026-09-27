// La consegna di una diretta: l'ente pone una domanda durante il webinar, lo
// studente risponde in KIREO, e quella risposta diventa una prova d'area.
// Server-only (il prompt e il peso non vanno nel bundle client, stesso principio
// anti-gaming di lib/escape/scoring.ts).
//
// ═══ IL GIUDIZIO PASSA DALLA MACCHINA CHE ESISTE ═══
// `chiamaEscape` (lib/escape/chiamaEscape.ts) è la stessa cucitura dei tre step
// aperti delle missioni: stesso modello, stesso tetto di token, stessa regola
// «chi legge non vede nessun numero», stessa guardia sulla lingua e sul registro
// appesa centralmente da `chiamaJson`, stesso ripiego quando il revisore cita una
// cifra che non poteva sapere. Non c'è un secondo modo di trasformare un testo in
// prove: c'è un prompt in più che passa dal primo.
//
// ═══ UNA DIMENSIONE SOLA, E NON È UNA SEMPLIFICAZIONE ═══
// Emette `performance` e nient'altro. `interest` sarebbe un'affermazione che il
// materiale non sostiene: che quell'area INTERESSI lo studente non lo dice il
// fatto che abbia risposto a una domanda posta da qualcun altro — l'iscrizione
// all'evento sì, forse, ma l'iscrizione non è una prova (è la stessa regola per
// cui la presenza non produce un segnale d'area, vedi la migrazione). Quello che
// una risposta scritta mostra è COME ragiona su quell'area, e quella dimensione
// ha un nome.
//
// ═══ IL PESO È SCELTO E NON MISURATO ═══
// 1,0 per area riconosciuta. Il vincolo che lo limita: un'area entra nella
// classifica delle affinità a `confidence >= 0,40`, cioè **Σp >= 4** — quindi
// servono QUATTRO consegne sulla stessa area perché da questa strada nasca
// un'affinità. Più di una risposta a un questionario (0,35), molto meno di una
// missione (che da sola porta un'area a confidence 1,000). Il giorno in cui ci
// saranno consegne vere in numero, si guarda quante aree entrano per questa
// strada e si ritara: fino a lì è una scelta, e sta scritto che lo è.

import type Anthropic from "@anthropic-ai/sdk";
import { getAreaBySlug } from "@/data/aree";
import { chiamaEscape } from "@/lib/escape/chiamaEscape";
import { cifreDelTesto, cifreNonCitabili } from "@/lib/escape/cifreCitabili";
import { stringheInJson } from "@/lib/lingua/scansione";

export const PESO_CONSEGNA_EVENTO = 1.0;

/** Quanto resta aperta la consegna dopo la fine della diretta. */
export const ORE_FINESTRA_CONSEGNA = 48;

/** Lunghezza minima della risposta, la stessa del vincolo su consegne_evento. */
export const MIN_CARATTERI_CONSEGNA = 200;
export const MAX_CARATTERI_CONSEGNA = 4000;

export type ProvaConsegna = {
  area_slug: string;
  dimensione: "performance";
  valore: number;
  peso: number;
  motivazione: string;
};

/** Cosa è successo al giudizio, per il messaggio onesto allo studente. */
export type EsitoConsegna =
  | { ok: true; prove: ProvaConsegna[] }
  | { ok: false; motivo: "senza_chiave" | "chiamata" | "forma_non_valida" | "senza_credito" };

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

// Il prompt. La whitelist è quella dell'EVENTO (al massimo due aree, vedi
// eventi_aree): un revisore che nomina un'area fuori da lì viene scartato a valle,
// esattamente come nelle missioni.
//
// `giudizio_complessivo` è chiesto e NON letto, come nei revisori delle missioni:
// è l'esca anti-poscritto — se la frase di chiusura ha un posto DENTRO il JSON, il
// modello non l'appende dopo la graffa (il poscritto che ruppe il parse in B3).
export function promptConsegnaEvento(titoloEvento: string, domanda: string, aree: string[]): string {
  const nomi = aree.map((a) => `${a} (${getAreaBySlug(a)?.nome ?? a})`).join(", ");
  return `Sei un analista di orientamento per studenti italiani di 16-19 anni. Uno studente ha seguito in diretta l'incontro "${titoloEvento}". Alla fine l'organizzatore ha posto una domanda, e lo studente ha risposto per iscritto.

LA DOMANDA POSTA: «${domanda}»

IL TUO MESTIERE: dire se dalla risposta si vede un modo di ragionare su una di queste aree — SCEGLIENDO SOLO tra questi slug: ${nomi}. Per ognuna che riconosci valuta quanto il ragionamento sta in piedi (0 = non risponde alla domanda o non dice niente di verificabile, 1 = risponde con un esempio concreto, un vincolo nominato o una conseguenza che regge).

COSA NON STAI GIUDICANDO. Non le conoscenze: ha visto un webinar, non ha seguito un corso. Non la lunghezza. Non l'eleganza. Quello che conta è se prende posizione su qualcosa di concreto e se quello che scrive si può contestare — una risposta che si potrebbe dare senza aver seguito niente non vale, per bella che sia.

PUOI NON RICONOSCERE NESSUNA AREA, ed è l'esito giusto quando la risposta è fuori tema o troppo generica: rispondi con la lista "aree" VUOTA. Non è un fallimento tuo, ed è meglio di un credito dato a caso.

LA MOTIVAZIONE, per ognuna: una o due frasi, calde, IPOTETICHE, in italiano, rivolte allo studente dandogli del tu. Di' cosa c'è nella sua risposta — se citi qualcosa, citalo con le sue parole. Non nominare mai una cifra che non sta nella sua risposta o nella domanda: un numero inventato su un testo che ha scritto lui gli fa perdere fiducia in tutto il resto.

Rispondi SOLO con JSON valido:
{"aree":[{"area_slug":"...","performance":0.0,"motivazione":"..."}],"giudizio_complessivo":"..."}`;
}

// Legge la risposta del modello. Filtra le aree fuori dalla whitelist
// dell'evento (`scartate` finisce nel log: senza quell'elenco «nessun credito»
// e «aree che l'evento non ammette» sono indistinguibili a valle, e hanno cure
// opposte) e sostituisce una motivazione con una cifra non citabile — dove
// «citabile» qui vuol dire: sta nella risposta dello studente o nella domanda.
export function leggiGiudizioConsegna(
  dati: unknown,
  aree: string[],
  testoStudente: string,
  domanda: string,
): { prove: ProvaConsegna[]; scartate: string[]; chiaveAssente: boolean } {
  const parsed = dati as { aree?: unknown[] };
  const chiaveAssente = !Array.isArray(parsed?.aree);
  const elenco = Array.isArray(parsed?.aree) ? parsed.aree : [];
  const cifreOk = cifreDelTesto(testoStudente, domanda);
  const prove: ProvaConsegna[] = [];
  const scartate: string[] = [];

  for (const raw of elenco) {
    const a = raw as { area_slug?: string; performance?: number; motivazione?: string };
    if (!a.area_slug || !aree.includes(a.area_slug)) {
      scartate.push(a.area_slug ? String(a.area_slug) : "(slug assente)");
      continue;
    }
    if (prove.some((p) => p.area_slug === a.area_slug)) continue; // una prova per area
    const ripiego = `La tua risposta lavora su ${getAreaBySlug(a.area_slug)?.nome ?? a.area_slug}.`;
    const proposta = typeof a.motivazione === "string" && a.motivazione.trim() ? a.motivazione.trim() : ripiego;
    const fuori = cifreNonCitabili(proposta, cifreOk);
    if (fuori.length > 0) {
      console.warn(`Consegna evento — cifra non citabile (${fuori.join(", ")}): motivazione sostituita dal ripiego.`);
    }
    prove.push({
      area_slug: a.area_slug,
      dimensione: "performance",
      valore: clamp01(Number(a.performance ?? 0)),
      peso: PESO_CONSEGNA_EVENTO,
      motivazione: fuori.length > 0 ? ripiego : proposta,
    });
  }

  return { prove, scartate, chiaveAssente };
}

// Giudica una consegna. Il testo arriva SEMPRE dalla lettura autorevole del DB,
// mai dal client (stessa regola delle missioni e dell'elaborato: il testo
// giudicato deve essere quello salvato).
export async function giudicaConsegna(
  anthropic: Anthropic | null,
  titoloEvento: string,
  domanda: string,
  aree: string[],
  testoStudente: string,
  diProva: boolean,
): Promise<EsitoConsegna> {
  if (!anthropic) return { ok: false, motivo: "senza_chiave" };

  const cifreOk = cifreDelTesto(testoStudente, domanda);
  const esito = await chiamaEscape(
    anthropic,
    promptConsegnaEvento(titoloEvento, domanda, aree),
    testoStudente,
    diProva,
    // Come nelle missioni: innesca il secondo tentativo della guardia se la
    // prima risposta contiene una cifra che non torna. Il terminale (la
    // sostituzione con il ripiego) sta in leggiGiudizioConsegna, perché qui si
    // sa che qualcosa non torna, non QUALE frase sostituire.
    (d) => stringheInJson(d).flatMap((t) => cifreNonCitabili(t, cifreOk)),
  );
  if (!esito.ok) return { ok: false, motivo: "chiamata" };

  const { prove, scartate, chiaveAssente } = leggiGiudizioConsegna(esito.dati, aree, testoStudente, domanda);
  // `chiaveAssente` è un guasto NOSTRO (il modello non ha risposto nella forma
  // chiesta); zero prove con la chiave presente è un ESITO del prodotto, e i due
  // meritano messaggi diversi a chi legge. Fra i due modi di restare senza
  // credito — «non ha proposto niente» (risposta generica) e «tutte fuori dalle
  // aree dell'evento» (prompt o whitelist da guardare) — distingue il log: hanno
  // cure opposte e a valle sarebbero indistinguibili.
  if (chiaveAssente) return { ok: false, motivo: "forma_non_valida" };
  if (prove.length === 0) {
    console.warn(
      `Consegna evento senza credito — aree dell'evento (${aree.join(", ")}), proposte scartate: ${scartate.join(", ") || "nessuna proposta"}`,
    );
    return { ok: false, motivo: "senza_credito" };
  }
  return { ok: true, prove };
}
