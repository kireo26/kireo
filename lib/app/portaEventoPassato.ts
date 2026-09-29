// Cosa c'è dietro la porta di un evento passato, e come si chiama.
//
// ═══════════════════════════════════════════════════════════════════════════
// «RIVEDI L'INCONTRO» PROMETTEVA UNA COSA CHE NON ESISTE
// ═══════════════════════════════════════════════════════════════════════════
// Fino al 29/09 ogni evento passato a cui lo studente era iscritto portava la
// stessa etichetta, «Rivedi l'incontro» — e di là non c'è nessuna registrazione:
// non l'abbiamo mai costruita. Chi la seguiva leggeva «La diretta è terminata.
// Grazie per aver partecipato.» La prima parola prometteva la sola cosa che
// quella pagina non contiene.
//
// L'ETICHETTA ERA FISSA E LA DESTINAZIONE CAMBIAVA: è la stessa specie del
// titolo che ripeteva il messaggio e della motivazione che ripeteva il nome
// dell'area — un testo scritto guardando il posto in cui sta, e non la cosa che
// ci trova chi lo segue.
//
// ═══════════════════════════════════════════════════════════════════════════
// E UNA PORTA CHE SI APRE SU NIENTE È PEGGIO DI NESSUNA PORTA
// ═══════════════════════════════════════════════════════════════════════════
// Chi la segue ha fatto un gesto e ha ricevuto meno di quello che aveva quando
// era fermo, e la volta dopo non la segue più — nemmeno quando di là c'è una
// domanda vera. Quindi la regola è la stessa del blocco in cima alla Home
// (`ConsegneDaFare`, che sparisce quando non c'è niente da fare): niente da
// fare, nessun link. Erano due porte per lo stesso posto e una sola obbediva al
// principio.
//
// ⚠️ IL CASO CHE RESTA IN SILENZIO, ed è una decisione, non una dimenticanza:
// la finestra è chiusa e lo studente non ha mai risposto. Lì NON si scrive «il
// tempo per rispondere è scaduto», perché quel secchio contiene almeno tre
// motivi diversi — il tempo scaduto, il non essersi mai collegati (la porta non
// si era mai aperta per lui), e il caso più frequente di tutti: nessuna domanda
// posta, cioè una cosa di cui non ha mai saputo niente. I tre si distinguono
// solo con `statoPortaConsegna`, che costa quattro letture per evento; dirne uno
// a caso vuol dire affermare una cosa falsa a due studenti su tre, che è la
// specie che stiamo togliendo. Se un domani si vorrà la riga, la strada è
// chiamare quella funzione per gli eventi passati recenti — dove l'unico motivo
// possibile è davvero il tempo scaduto.

import type { SupabaseClient } from "@supabase/supabase-js";

export type PortaEventoPassato = { etichetta: string } | null;

export const ETICHETTA_RISPONDI = "Rispondi alla domanda";
export const ETICHETTA_RIVEDI_RISPOSTA = "Rivedi la tua risposta";

/**
 * L'ordine è la regola. «Ho già risposto» viene per primo perché è quello che la
 * pagina mostra davvero: `statoPortaConsegna` restituisce `gia_consegnata` (e
 * quindi non aperta) a chi ha risposto, quindi i due casi sono già disgiunti per
 * costruzione — ma se un domani non lo fossero, la risposta salvata è la cosa
 * vera dietro la porta, e il campo di scrittura non comparirebbe comunque.
 */
export function portaEventoPassato(opts: { iscritto: boolean; haRisposto: boolean; consegnaAperta: boolean }): PortaEventoPassato {
  // Chi non era iscritto resta senza link e non per prudenza: la pagina lo
  // respingerebbe con «Non risulti iscritto».
  if (!opts.iscritto) return null;
  if (opts.haRisposto) return { etichetta: ETICHETTA_RIVEDI_RISPOSTA };
  if (opts.consegnaAperta) return { etichetta: ETICHETTA_RISPONDI };
  return null;
}

/**
 * Gli eventi, fra questi, a cui lo studente ha già risposto. Una lettura sola
 * per tutta la lista: la RLS di `consegne_evento` restituisce solo le proprie
 * righe, quindi non c'è nessun filtro da riscrivere qui.
 *
 * DEGRADA VERSO IL NIENTE, come ogni lettura di questa famiglia: se fallisce
 * torna un insieme vuoto, e l'effetto è un link in meno — mai un link che porta
 * a una pagina che non ha quello che l'etichetta promette.
 */
export async function getEventiConRisposta(supabase: SupabaseClient, userId: string, eventoIds: string[]): Promise<Set<string>> {
  if (eventoIds.length === 0) return new Set();
  try {
    const { data, error } = await supabase
      .from("consegne_evento")
      .select("evento_id")
      .eq("student_id", userId)
      .in("evento_id", eventoIds);
    if (error) {
      console.error("getEventiConRisposta — lettura delle consegne fallita:", error);
      return new Set();
    }
    return new Set((data ?? []).map((r) => r.evento_id as string));
  } catch (e) {
    console.error("getEventiConRisposta — eccezione:", e);
    return new Set();
  }
}
