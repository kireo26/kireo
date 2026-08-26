// Le cifre che il revisore può citare, e come si riconosce quella che non può.
//
// IL DIFETTO DA CUI NASCE. Nella Missione 04 il revisore ha scritto «la scelta
// di tenere un fondo imprevisti (37.000 euro)». Nel piano di quello studente il
// fondo imprevisti era 15.000; 37.000 era l'avanzo — 240.000 meno 203.000 — che
// il paragrafo sopra usava correttamente proprio come avanzo. Il numero era
// giusto, la scelta a cui veniva attaccato no.
//
// PERCHÉ È UN ARNESE DIVERSO DAGLI ALTRI DUE. Un participio al maschile e una
// parola-verdetto si riconoscono guardando la stringa. Una cifra no: 37.000 è
// una cifra come un'altra, ed è sbagliata solo rispetto a una verità che sta
// altrove. E quella verità il revisore non ce l'ha MAI: riceve il testo dello
// studente e gli slug ammessi, non il piano. Quindi non è che quella volta ha
// sbagliato un numero — nessun numero che cita è mai verificabile, e a valle
// nessuno lo confronta con niente. Il 37.000 è il caso in cui ce ne siamo
// accorti.
//
// LA REGOLA. L'insieme citabile non è una lista scritta a mano per missione (ne
// servirebbero undici, e divergerebbero): si DERIVA, e ha una proprietà che
// vale da sola — il revisore può citare solo quello che lo studente poteva
// sapere. Quattro sorgenti:
//
//   1. il testo dello studente e il suo payload — le voci scelte, gli importi,
//      i minuti, e i numeri che ha scritto lui nella proposta;
//   2. i documenti che ha DAVVERO aperto (materiali di Stanza 1 letti, dossier
//      di Stanza 2 comprati). Un materiale non aperto resta fuori: è il punto
//      della meccanica dei gettoni, e vale anche per chi lo commenta;
//   3. il testo della missione che ha comunque davanti — descrizione, intro
//      delle stanze, consegne, etichette delle voci coi loro costi e durate;
//   4. i RESIDUI del suo stesso piano: totale meno speso, obiettivo meno
//      raggiunto, giorni disponibili meno usati.
//
// La quarta sorgente è una scelta, non un dettaglio. «37.000 euro e 17 giorni
// rimasti» è un paragrafo BUONO — è quello che fa capire allo studente di
// essere stato letto davvero — e nessuno dei due numeri compare da nessuna
// parte: sono differenze. Senza il punto 4 la regola ucciderebbe la frase buona
// insieme a quella falsa. Sono le stesse differenze che il compositore del
// finale calcola già per conto suo, quindi non c'è niente di nuovo da fidarsi:
// sono numeri che il motore conosce.
//
// COSA SI CONTROLLA E COSA NO. Solo i token con almeno due cifre, o seguiti da
// «%». «tre righe» e «i 3 punti» non sono affermazioni falsificabili e sarebbero
// rumore; «6%» sì, ed è per questo che la percentuale entra a prescindere dalla
// lunghezza. I numeri scritti in lettere («centosettantotto») restano fuori: un
// pattern sulle cifre non li vede, e inventarne uno sulle parole aprirebbe una
// classe di falsi positivi per un guadagno che non abbiamo mai osservato.

import { valutaPiano } from "@/lib/escape/config";
import type { EscapeMission, Payload, PayloadAlloca, PayloadLavori, StepAllocaBudget, StepPianificaLavori } from "@/lib/escape/tipi";

// Un token numerico nel testo: gruppi di migliaia col punto («240.000»),
// decimali con la virgola («4,00»), o cifre nude. La percentuale si riconosce
// dal simbolo che segue.
const TOKEN_NUMERO = /(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)(\s*%)?/g;

// Forma canonica di un numero, così «240.000», «240000» e «240.000,00» sono lo
// stesso elemento dell'insieme.
function canonico(grezzo: string): string | null {
  const senzaMigliaia = grezzo.replace(/\.(?=\d{3}\b)/g, "");
  const n = Number(senzaMigliaia.replace(",", "."));
  return Number.isFinite(n) ? String(n) : null;
}

type Token = { canonico: string; grezzo: string; daControllare: boolean };

function tokenDi(testo: string): Token[] {
  const out: Token[] = [];
  for (const m of String(testo ?? "").matchAll(TOKEN_NUMERO)) {
    const c = canonico(m[1]);
    if (c === null) continue;
    const cifre = m[1].replace(/\D/g, "").length;
    out.push({ canonico: c, grezzo: m[0].trim(), daControllare: cifre >= 2 || Boolean(m[2]) });
  }
  return out;
}

// Raccolta ricorsiva. L'unico caso speciale è il MATERIALE (un oggetto con `id`
// e `contenuto`): il titolo si vede sempre nell'elenco, il contenuto solo se lo
// studente l'ha aperto. Tutto il resto della missione è testo che ha davanti in
// ogni caso, quindi si scende senza condizioni — e una struttura di step nuova
// entra da sola, senza che nessuno debba ricordarsi di aggiungerla qui.
function raccogli(valore: unknown, letti: Set<string>, dentro: Set<string>): void {
  if (valore === null || valore === undefined) return;
  if (typeof valore === "number") {
    if (Number.isFinite(valore)) dentro.add(String(valore));
    return;
  }
  if (typeof valore === "string") {
    for (const t of tokenDi(valore)) dentro.add(t.canonico);
    return;
  }
  if (Array.isArray(valore)) {
    for (const v of valore) raccogli(v, letti, dentro);
    return;
  }
  if (typeof valore !== "object") return;

  const o = valore as Record<string, unknown>;
  const eMateriale = typeof o.id === "string" && typeof o.contenuto === "string";
  for (const [chiave, v] of Object.entries(o)) {
    if (eMateriale && (chiave === "contenuto" || chiave === "estratti") && !letti.has(o.id as string)) continue;
    raccogli(v, letti, dentro);
  }
}

// I residui del piano dello studente: differenze che il motore conosce e che
// lui vede a schermo mentre compone (le barre dicono quanto resta).
function residui(mission: EscapeMission, risposte: Map<string, Payload>, dentro: Set<string>): void {
  const step = mission.stanze.flatMap((s) => s.step).find((s) => s.id === "s3_budget");
  if (!step) return;
  const aggiungi = (n: number) => { if (Number.isFinite(n)) dentro.add(String(n)); };

  if (step.tipo === "alloca_budget") {
    const s = step as StepAllocaBudget;
    const alloc = (risposte.get("s3_budget") as PayloadAlloca | undefined)?.allocazioni ?? {};
    const speso = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
    aggiungi(speso);
    aggiungi(s.totale - speso);
  } else if (step.tipo === "pianifica_lavori") {
    const s = step as StepPianificaLavori;
    const sel = (risposte.get("s3_budget") as PayloadLavori | undefined)?.selezionati ?? [];
    const { soldi, giorni, risparmio } = valutaPiano(s, sel);
    aggiungi(soldi); aggiungi(giorni); aggiungi(risparmio);
    if (s.budgetSoldi !== undefined) aggiungi(s.budgetSoldi - soldi);
    if (s.budgetGiorni !== undefined) aggiungi(s.budgetGiorni - giorni);
    if (s.obiettivo !== undefined) aggiungi(s.obiettivo - risparmio);
  }
}

export function insiemeCifreCitabili(mission: EscapeMission, risposte: Map<string, Payload>, letti: Set<string>): Set<string> {
  const dentro = new Set<string>();
  raccogli(mission, letti, dentro);
  for (const payload of risposte.values()) raccogli(payload, letti, dentro);
  residui(mission, risposte, dentro);
  return dentro;
}

// I frammenti da correggere: le cifre del testo che non stanno nell'insieme.
// Ritorna la forma GREZZA («37.000 euro» → «37.000»), che è quella che serve a
// chi legge un log o un messaggio d'errore.
export function cifreNonCitabili(testo: string, insieme: Set<string>): string[] {
  return tokenDi(testo)
    .filter((t) => t.daControllare && !insieme.has(t.canonico))
    .map((t) => t.grezzo);
}
