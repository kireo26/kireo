// Cosa legge l'organizzatore sulla chiusura di una diretta.
//
// ⚠️ PERCHÉ È UN VALORE E NON TRE RAMI DENTRO IL JSX: una frase composta in un
// `.tsx` non si può provare da uno script Node, e qui le proprietà da tenere
// sono tre e nessuna si vede rileggendo (vedi `npm run test:chiusura`). Stessa
// forma di `lib/contatti/testi.ts`, `lib/guide/avvisoRifiuto.ts`,
// `lib/eventi/portaConsegna.ts`.
//
// ⚠️ LA FORMA «etichetta: numero» È DI MARIO E NON È ESTETICA: toglie l'accordo
// di genere e di numero. «Presenti: 1» e «Presenti: 12» sono la stessa frase con
// una cifra diversa; «1 presenti» è il difetto del giro dei plurali (9 punti
// censiti il 4/10, nessuno gestito). Il controllo pretende esattamente questo:
// cambiando i numeri, il testo deve differire SOLO nelle cifre.
//
// ⚠️ TRE ESITI E NON DUE, ed è il difetto da cui nasce tutto il giro: prima la
// seconda pressione rispondeva «0 nuove certificazioni», che si legge come
// «nessuno si è qualificato» — un'affermazione falsa sugli studenti al posto di
// «l'ho già fatto». Ora il database restituisce `gia_chiusa_il` e le due cose
// hanno due frasi (vedi `20261011100000_chiusura_diretta.sql`).

import { formattaDataOra } from "@/lib/formato";

/** Chi ha chiuso: congelato come `certificata_da_tipo`, perché il ruolo di una persona cambia e il fatto no. */
export type ChiusuraDaTipo = "kireo" | "ente";

/** L'esito di una pressione del bottone. */
export type EsitoChiusura =
  /** Prima chiusura: l'ha fatta chi ha premuto, adesso. */
  | { tipo: "chiusa"; presenti: number; certificati: number }
  /** Era già chiusa — da un'altra sessione, o dall'altro moderatore un istante prima. */
  | { tipo: "gia_chiusa"; presenti: number; quando: string };

/** Lo stato che il server conosce al caricamento della pagina, prima di qualunque pressione. */
export type StatoChiusura =
  | { tipo: "da_chiudere" }
  | { tipo: "chiusa"; quando: string; daTipo: ChiusuraDaTipo };

const CHI: Record<ChiusuraDaTipo, string> = {
  kireo: "da KIREO",
  ente: "dall'organizzatore",
};

/**
 * Lo stato di partenza dalle colonne dell'evento.
 *
 * Il `tipo` arriva dal database come testo libero (il CHECK ammette solo i due
 * valori, ma una `select` non lo sa): un valore che non riconosciamo vale
 * `null`, e allora NON si dichiara una chiusura di cui non si sa dire l'autore —
 * meglio il bottone, che al massimo produce un «era già chiusa» onesto, che una
 * riga che afferma una cosa a metà.
 */
export function statoChiusura(dati: {
  chiusaIl: string | null;
  chiusaDaTipo: string | null;
}): StatoChiusura {
  if (!dati.chiusaIl) return { tipo: "da_chiudere" };
  if (dati.chiusaDaTipo !== "kireo" && dati.chiusaDaTipo !== "ente") return { tipo: "da_chiudere" };
  return { tipo: "chiusa", quando: dati.chiusaIl, daTipo: dati.chiusaDaTipo };
}

/**
 * Il testo dell'esito di una pressione. I tre casi sono di Mario, parola per
 * parola.
 *
 * L'ora porta l'anno («il 4 ottobre 2026 alle ore 19:20») perché
 * `lib/formato.ts` non ha uno stile giorno+mese senza anno, e aggiungerne uno
 * per una frase vorrebbe dire una seconda definizione di «come KIREO scrive una
 * data».
 */
export function testoEsitoChiusura(esito: EsitoChiusura): string {
  if (esito.tipo === "gia_chiusa") {
    return `Questa diretta era già stata chiusa il ${formattaDataOra(esito.quando, "long")}. Nessuna nuova certificazione.`;
  }
  if (esito.certificati === 0) {
    return `Diretta chiusa. Presenti: ${esito.presenti}. Nessuno ha raggiunto la soglia di presenza.`;
  }
  return `Diretta chiusa. Presenti: ${esito.presenti}. Nuove certificazioni automatiche: ${esito.certificati}.`;
}

/**
 * La riga di stato che prende il posto del bottone su una diretta già chiusa.
 *
 * ⚠️ IL BOTTONE SPARISCE, non diventa disabilitato, ed è una scelta: una volta
 * chiusa, ripremere non può produrre niente — mai, non «non adesso». Un bottone
 * disabilitato dice «qui c'è qualcosa da fare, ma non ora», che è falso; la sua
 * assenza è giusta e però ambigua (sembra una cosa che non ha caricato), quindi
 * la seconda frase spiega perché non c'è.
 *
 * NON DICE NIENTE SULLE CERTIFICAZIONI, e non è una dimenticanza: al
 * caricamento sappiamo QUANDO e DA CHI, non quanti sono stati certificati —
 * quel numero vive in Statistiche → Per evento (`partecipati`), dove l'ente
 * guarda già i numeri. Dirlo qui vorrebbe dire una query in più per una seconda
 * copia di un dato, e su «sono già state certificate» anche una frase falsa nel
 * caso in cui nessuno aveva raggiunto la soglia.
 *
 * ⚠️ TESTO PROVVISORIO, MIO: Mario ha scritto i tre esiti e deve scrivere
 * questo (è l'unico dei quattro che non gli era stato chiesto: «mandami cosa
 * scegli di mostrare al posto del bottone e ti do la frase»).
 */
export function testoStatoChiusura(stato: Extract<StatoChiusura, { tipo: "chiusa" }>): string {
  return `Diretta chiusa il ${formattaDataOra(stato.quando, "long")} ${CHI[stato.daTipo]}. La chiusura si fa una volta sola: qui non c'è più niente da premere.`;
}
