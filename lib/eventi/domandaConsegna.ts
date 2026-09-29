// La domanda finale vista dall'ente: in che stato è, e cosa gli si dice.
//
// ═══════════════════════════════════════════════════════════════════════════
// PERCHÉ UN MODULO E NON QUATTRO RAMI DENTRO IL JSX
// ═══════════════════════════════════════════════════════════════════════════
// Una frase composta dentro un `.tsx` non si può provare da uno script Node, e
// una proprietà dichiarata e non provata è un test che non c'è ancora. Qui i
// testi sono VALORI: si importano, si leggono, si controprovano — la stessa
// forma di `portaConsegna.ts` (il gemello lato studente) e di `testoAffinita.ts`.
//
// ═══════════════════════════════════════════════════════════════════════════
// UN RIFIUTO DEVE DIRE DA CHE PARTE SEI, E L'ORA
// ═══════════════════════════════════════════════════════════════════════════
// Il messaggio che c'era fino al 29/09 — «La domanda si pone mentre la diretta è
// aperta: adesso è troppo tardi (o troppo presto)» — ammetteva in una parentesi
// di non sapere da che parte fosse chi lo leggeva. E non sapendolo non diceva né
// cosa fare né quando tornare: le due informazioni per cui un rifiuto esiste.
// Il sistema le ha tutte e due: conosce l'ora, l'inizio e la fine.
//
// Con la finestra larga (dall'approvazione alla fine della diretta) il caso
// «troppo presto» sparisce da solo, e resta solo «è finita»: per questo quel
// testo porta sempre l'ORA della fine, perché sarà l'unico che qualcuno legge.
//
// ⚠️ I TESTI SONO DA RILEGGERE (voce). La sostanza è decisa; le parole no.

import { domandaModificabile, fineDiretta, ORE_FINESTRA_CONSEGNA } from "@/lib/live";
import { formattaDataOra } from "@/lib/formato";

export type StatoDomandaConsegna =
  /** La finestra è aperta e nessuna domanda è stata posta: il buco che prima durava quindici minuti e adesso dura giorni. */
  | "da_scrivere"
  /** La finestra è aperta e la domanda c'è: si può ancora cambiare. */
  | "modificabile"
  /** La diretta è finita senza che nessuno ponesse una domanda: per questo incontro non ci sarà una consegna. */
  | "chiusa_senza_domanda"
  /** La diretta è finita e la domanda c'è: adesso tocca agli studenti. */
  | "chiusa_con_domanda";

export type PannelloDomanda = {
  stato: StatoDomandaConsegna;
  modificabile: boolean;
  /** Quando la finestra si chiude (o si è chiusa): l'istante in cui finisce la diretta. */
  fine: string;
  testo: string;
};

export function statoDomandaConsegna(
  evento: { data_inizio: string; data_fine: string | null; domanda_consegna: string | null },
  ora: Date = new Date(),
): PannelloDomanda {
  const fine = fineDiretta(evento.data_inizio, evento.data_fine);
  const aperta = domandaModificabile(evento.data_inizio, evento.data_fine, ora);
  const haDomanda = Boolean(evento.domanda_consegna);
  const stato: StatoDomandaConsegna = aperta
    ? haDomanda
      ? "modificabile"
      : "da_scrivere"
    : haDomanda
      ? "chiusa_con_domanda"
      : "chiusa_senza_domanda";
  return { stato, modificabile: aperta, fine, testo: testoPannelloDomanda(stato, fine) };
}

export function testoPannelloDomanda(stato: StatoDomandaConsegna, fine: string): string {
  const quando = formattaDataOra(fine, "long");
  switch (stato) {
    // IL BUCO DETTO AD ALTA VOCE. Da quando la domanda si scrive
    // dall'approvazione, esiste un momento in cui l'evento è approvato e la
    // domanda non c'è ancora: prima durava i quindici minuti prima della
    // diretta ed era invisibile, adesso dura giorni.
    case "da_scrivere":
      return `Non hai ancora posto la domanda. Puoi scriverla fin da ora, e cambiarla fino alla fine della diretta: ${quando}.`;
    case "modificabile":
      return `Gli studenti la vedono a diretta conclusa. Puoi ancora cambiarla fino alla fine della diretta: ${quando}.`;
    case "chiusa_con_domanda":
      return `La diretta è finita il ${quando}: la domanda non si può più cambiare. Gli studenti hanno ${ORE_FINESTRA_CONSEGNA} ore per rispondere.`;
    case "chiusa_senza_domanda":
      return `La diretta è finita il ${quando} e non è stata posta nessuna domanda: per questo incontro non ci sarà una consegna.`;
  }
}

// ─────────────────────────── i rifiuti di imposta_domanda_consegna ──────────
// I nomi sono quelli sollevati dalla funzione SQL. `sconosciuto` è il ripiego:
// «Riprova» qui è onesto perché il caso residuo è un guasto (rete, database) —
// non è la frase che il 28/09 abbiamo tolto dall'evento, dove a non andare era
// il DATO e riprovare non poteva cambiare niente.

export type MotivoRifiutoDomanda =
  | "evento_non_approvato"
  | "domanda_non_piu_modificabile"
  | "evento_senza_aree"
  | "non_autorizzato"
  | "sconosciuto";

const MOTIVI: MotivoRifiutoDomanda[] = [
  "evento_non_approvato",
  "domanda_non_piu_modificabile",
  "evento_senza_aree",
  "non_autorizzato",
];

/** Dal messaggio grezzo di PostgREST al motivo. Nessuna corrispondenza = `sconosciuto`. */
export function motivoRifiutoDomanda(messaggio: string): MotivoRifiutoDomanda {
  return MOTIVI.find((m) => messaggio.includes(m)) ?? "sconosciuto";
}

export function testoRifiutoDomanda(motivo: MotivoRifiutoDomanda, fine: string): string {
  switch (motivo) {
    case "evento_non_approvato":
      return "Questo evento non è ancora approvato: la domanda si può scrivere appena KIREO lo approva.";
    // Il caso di corsa: la pagina era aperta e la diretta è finita nel
    // frattempo. Dice l'ora, come il testo del pannello, perché è la stessa
    // notizia arrivata un istante dopo.
    case "domanda_non_piu_modificabile":
      return `La diretta è finita il ${formattaDataOra(fine, "long")}: la domanda non si può più cambiare.`;
    case "evento_senza_aree":
      return "Questo evento non ha nessuna area di orientamento: senza almeno una, la risposta degli studenti non potrebbe portare niente nel loro profilo. Scrivi a KIREO per aggiungerla.";
    case "non_autorizzato":
      return "Non puoi porre la domanda su questo evento.";
    case "sconosciuto":
      return "Non è stato possibile salvare la domanda. Riprova.";
  }
}
