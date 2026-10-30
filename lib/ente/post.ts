import type { SupabaseClient } from "@supabase/supabase-js";
import { formattaDataOra, formattaOra, giorniDiCalendarioItaliani } from "@/lib/formato";
import { descriviErrore } from "@/lib/erroreSupabase";

// I POST DEGLI ENTI SI PUBBLICANO SUBITO, E KIREO PUÒ TOGLIERLI (Mario, 29/10;
// migrazioni 20261113100000/110000/120000).
//
// ⚠️ IL TETTO NON LIMITA QUANTO UN ENTE PUÒ SCRIVERE: LIMITA QUANTE VOLTE AL
// GIORNO PUÒ INTERROMPERE LO STESSO STUDENTE (Mario). Ogni pubblicazione di un
// ente con un piano a pagamento avvisa tutti i suoi follower: è quello il
// numero che dice se 3 è giusto, non i post in Bacheca. 3 è il numero che
// l'ente leggeva già («al massimo 3 post in attesa»), con un orologio diverso.
// La regola vera sta nel database (`limite_post_nelle_24_ore`,
// `max_post_nelle_24_ore()`); questo è lo specchio per dirlo prima del gesto, e
// `npm run test:bacheca` pretende che i due numeri siano lo stesso.
export const MAX_POST_NELLE_24_ORE = 3;
const FINESTRA_MS = 24 * 60 * 60 * 1000;

/**
 * Da quando l'ente può pubblicare di nuovo, o `null` se può adesso. Contano
 * tutti i post nati nelle ultime 24 ore, anche quelli tolti, come nel
 * database: la loro notifica è già partita.
 */
export function prossimoPostDalle(creatiIl: string[], adesso: Date): Date | null {
  const recenti = creatiIl
    .map((c) => new Date(c).getTime())
    .filter((t) => adesso.getTime() - t < FINESTRA_MS)
    .sort((a, b) => b - a);
  if (recenti.length < MAX_POST_NELLE_24_ORE) return null;
  // Si libera un posto quando esce dalla finestra il più vecchio dei tre più recenti.
  return new Date(recenti[MAX_POST_NELLE_24_ORE - 1] + FINESTRA_MS);
}

// ⚠️ Testi miei e provvisori.
export const TESTI_POST = {
  intestazione: "Compaiono subito nel feed degli studenti che ti seguono. KIREO può toglierne uno che non rispetta il regolamento, e ti scrive perché.",

  // La conferma resta ACCANTO al modulo, che torna vuoto (Mario, 30/10: una
  // conferma al posto del modulo è una porta che si chiude).
  pubblicato: "Post pubblicato",
  pubblicatoDettaglio: "È già nel feed degli studenti che ti seguono.",
  pubblicatoConNotifica: "È già nel feed degli studenti che ti seguono, e ognuno di loro riceve una notifica.",
  bottone: "Pubblica",
  bottoneTetto: "Tetto raggiunto",
  // Il rifiuto del database, quando la pagina non sapeva ancora del tetto (un
  // altro post pubblicato da un'altra finestra): l'ora la dice la pagina, che
  // si rilegge.
  tettoDalDatabase: `Hai già pubblicato ${MAX_POST_NELLE_24_ORE} post nelle ultime 24 ore: qui sopra c'è da quando potrai pubblicare il prossimo.`,
  // I tre testi del link sono di Mario (30/10). La nota dice COSA produce il
  // campo, non solo quale indirizzo è ammesso: un ente che non sa cosa produce
  // un campo lo lascia vuoto.
  etichettaLink: "Link (facoltativo)",
  // ⚠️ «Solo indirizzi che iniziano con https://» è uscita (Mario, 30/10):
  // l'https lo mettiamo noi, e una regola che non si può più infrangere non va
  // scritta, insegna solo che il prodotto è più difficile di com'è.
  notaLink: "Il tuo sito, o un tuo post su Instagram, Facebook o TikTok: sotto il post lo studente trova un bottone che lo apre fuori da KIREO. Il nome del bottone lo scegliamo noi dall'indirizzo.",
  // I tre rossi del link, uno per causa, e la riga dell'https alzato: di Mario
  // (30/10, «lo https lo mettiamo noi»).
  erroreLink: {
    spazio: "L'indirizzo contiene uno spazio.",
    nonIndirizzo: "Non sembra un indirizzo: ci vuole un dominio, come davante.it",
    schemaVietato: "Si possono mettere solo indirizzi di pagine web.",
  },
  linkAlzatoAHttps: "L'abbiamo messo in https.",
  notaFile: "Lo studente lo scarica con un clic. Chi ha il link al file può aprirlo anche fuori da KIREO.",
  motivoNonLetto: "Non siamo riusciti a leggere il motivo: ricarica la pagina.",
} as const;

// ⚠️ LA RIGA DELLA QUOTA È LO STATO DELL'ENTE, NON LA REGOLA (Mario, 30/10:
// «quella riga oggi è una regola; deve diventare lo stato dell'ente», come la
// riga della newsletter). La frase è di Mario: «post» non cambia al plurale e
// «hai pubblicato» non concorda con niente, quindi vale con qualunque numero. Contano tutti i
// post nati nelle 24 ore, anche quelli tolti, come nel database. `null` vuol
// dire che i post non si sono letti: la pagina lo dice, non scrive zero.
export function testoQuotaPost(creatiIl: string[] | null, adesso: Date): string {
  if (creatiIl === null) return "Non siamo riusciti a contare i post delle ultime 24 ore: ricarica la pagina.";
  const n = creatiIl.filter((c) => adesso.getTime() - new Date(c).getTime() < FINESTRA_MS).length;
  return `Hai pubblicato ${Math.min(n, MAX_POST_NELLE_24_ORE)} post su ${MAX_POST_NELLE_24_ORE} nelle ultime 24 ore.`;
}

// A tetto pieno il modulo non sparisce: dice quando si riapre (Mario: «un
// limite senza una data è un guasto; un limite con una data è una regola»).
// Dentro 24 ore il giorno è oggi o domani, in ora italiana.
export function testoTettoRaggiunto(dalle: Date, adesso: Date): string {
  const giorni = giorniDiCalendarioItaliani(adesso, dalle);
  const quando = giorni === 0 ? `dalle ${formattaOra(dalle)} di oggi` : giorni === 1 ? `dalle ${formattaOra(dalle)} di domani` : `dal ${formattaDataOra(dalle)}`;
  return `Hai pubblicato ${MAX_POST_NELLE_24_ORE} post nelle ultime 24 ore. Potrai pubblicarne un altro ${quando}.`;
}

// Gli stati come li legge l'ente. `approvato` e `rifiutato` sono la storia di
// prima del 29/10 (li ha guardati una persona), e restano detti così. Uno
// stato che qui non c'è si mostra col suo nome: dirlo «in approvazione» (com'era
// fino al 29/10) affermava una cosa falsa.
export const ETICHETTA_STATO_POST: Record<string, { label: string; classe: string }> = {
  pubblicato: { label: "Pubblicato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  approvato: { label: "Approvato", classe: "bg-kireo-green/15 text-kireo-green-light" },
  tolto: { label: "Tolto da KIREO", classe: "bg-red-500/15 text-red-300" },
  in_approvazione: { label: "In approvazione", classe: "bg-kireo-orange/15 text-kireo-orange" },
  rifiutato: { label: "Rifiutato", classe: "bg-red-500/15 text-red-300" },
};

export function etichettaStatoPost(stato: string): { label: string; classe: string } {
  return ETICHETTA_STATO_POST[stato] ?? { label: stato, classe: "bg-white/10 text-kireo-light/80" };
}

export type MotiviPost = { motivo_rifiuto: string | null; motivo_rimozione: string | null };

/**
 * I motivi dei post chiesti, letti da `motivi_post_enti` (il client non li
 * legge dalla tabella, 20261113120000). Un id assente vuol dire «non tuo». Se
 * la lettura fallisce restituisce `null`: non letti, che non vuol dire senza
 * motivo.
 */
export async function leggiMotiviPost(supabase: SupabaseClient, ids: string[]): Promise<Map<string, MotiviPost> | null> {
  const motivi = new Map<string, MotiviPost>();
  if (ids.length === 0) return motivi;
  const { data, error } = await supabase.rpc("motivi_post_enti", { p_ids: ids });
  if (error) {
    console.error("[post] motivi_post_enti:", descriviErrore(error));
    return null;
  }
  for (const r of (data ?? []) as Array<{ post_id: string } & MotiviPost>) {
    motivi.set(r.post_id, { motivo_rifiuto: r.motivo_rifiuto, motivo_rimozione: r.motivo_rimozione });
  }
  return motivi;
}

/** La riga del motivo sotto un post, o `null` se non c'è niente da dire. */
export function rigaMotivo(stato: string, motivi: Map<string, MotiviPost> | null, id: string, toltoIl: string | null): string | null {
  if (stato !== "tolto" && stato !== "rifiutato") return null;
  if (motivi === null) return TESTI_POST.motivoNonLetto;
  const m = motivi.get(id);
  if (stato === "tolto") {
    const quando = toltoIl ? ` il ${formattaDataOra(toltoIl)}` : "";
    return m?.motivo_rimozione ? `KIREO ha tolto questo post dal feed${quando}. Motivo: ${m.motivo_rimozione}` : `KIREO ha tolto questo post dal feed${quando}.`;
  }
  return m?.motivo_rifiuto ? `Motivo del rifiuto: ${m.motivo_rifiuto}` : null;
}
