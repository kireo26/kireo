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
//
// ⚠️⚠️ LA RIGA DI STATO PORTA LA RICEVUTA, NON SOLO LO STATO (correzione di
// Mario, 11/10). La prima stesura diceva soltanto «è chiusa», e con quella il
// conto restava perso com'era: il difetto da cui nasce l'1.1 NON era «non si sa
// se è chiusa» — era che il messaggio verde con presenti e certificazioni viveva
// soltanto nello stato React di chi aveva premuto, e un F5 lo cancellava.
//
// Quindi la coda delle due frasi — l'esito di una pressione e la riga che si
// rilegge fra sei mesi — è LA STESSA, prodotta da `codaRicevuta` in un posto
// solo: sono lo stesso fatto in due momenti, e due copie divergerebbero. La
// sola differenza è la parola «Nuove», che al momento della pressione è vera e
// alla rilettura no, e `npm run test:chiusura` pretende esattamente quello: che
// i due testi coincidano a meno di quella parola.
//
// E LA SECONDA FRASE CHE AVEVO SCRITTO È USCITA («La chiusura si fa una volta
// sola: qui non c'è più niente da premere»), perché la ricevuta la rende
// inutile: *un bottone grigio invita a chiedersi perché; una riga che dice cosa
// è successo no* (Mario). Spiegare l'assenza del bottone serviva solo finché la
// riga non diceva niente.

import { formattaDataOra } from "@/lib/formato";

/** Chi ha chiuso: congelato come `certificata_da_tipo`, perché il ruolo di una persona cambia e il fatto no. */
export type ChiusuraDaTipo = "kireo" | "ente";

/** L'esito di una pressione del bottone. */
export type EsitoChiusura =
  /** Prima chiusura: l'ha fatta chi ha premuto, adesso. */
  | { tipo: "chiusa"; presenti: number; certificati: number }
  /** Era già chiusa — da un'altra sessione, o dall'altro moderatore un istante prima. */
  | { tipo: "gia_chiusa"; presenti: number; quando: string };

/** Cosa la chiusura ha prodotto: i due numeri che la riga di stato rilegge. */
export type RicevutaChiusura = { presenti: number; certificati: number };

/** Lo stato che il server conosce al caricamento della pagina, prima di qualunque pressione. */
export type StatoChiusura =
  | { tipo: "da_chiudere" }
  | { tipo: "chiusa"; quando: string; daTipo: ChiusuraDaTipo; ricevuta: RicevutaChiusura | null };

const CHI: Record<ChiusuraDaTipo, string> = {
  kireo: "da KIREO",
  ente: "dall'organizzatore",
};

/**
 * La coda della ricevuta: cosa la chiusura ha prodotto, con la forma «etichetta:
 * numero» che toglie l'accordo.
 *
 * ⚠️ UN POSTO SOLO PER DUE MOMENTI. `nuove` è vero subito dopo la pressione e
 * falso quando la riga si rilegge: è l'unica differenza fra le due frasi, e
 * tenerla qui è il modo di non avere due copie della stessa cosa.
 */
function codaRicevuta(presenti: number, certificati: number, nuove: boolean): string {
  if (certificati === 0) return `Presenti: ${presenti}. Nessuno ha raggiunto la soglia di presenza.`;
  return `Presenti: ${presenti}. ${nuove ? "Nuove certificazioni automatiche" : "Certificazioni automatiche"}: ${certificati}.`;
}

/**
 * Lo stato di partenza dalle colonne dell'evento.
 *
 * Il `tipo` arriva dal database come testo libero (il CHECK ammette solo i due
 * valori, ma una `select` non lo sa): un valore che non riconosciamo vale
 * `null`, e allora NON si dichiara una chiusura di cui non si sa dire l'autore —
 * meglio il bottone, che al massimo produce un «era già chiusa» onesto, che una
 * riga che afferma una cosa a metà.
 *
 * ⚠️ E LA RICEVUTA DEGRADA VERSO IL DIRE MENO: se uno dei due conteggi non
 * arriva, `ricevuta` è `null` e la riga dice soltanto quando e da chi, invece di
 * stampare un numero inventato. Dopo la migrazione dell'11/10 le due colonne
 * sono sempre scritte insieme alla traccia (il CHECK di completezza le tiene
 * tutte e cinque), quindi è un ramo che non si dovrebbe presentare — ma un
 * conteggio è un numero che finisce su un documento di scuola, e lì il ripiego
 * non si indovina.
 */
export function statoChiusura(dati: {
  chiusaIl: string | null;
  chiusaDaTipo: string | null;
  presenti?: number | null;
  certificati?: number | null;
}): StatoChiusura {
  if (!dati.chiusaIl) return { tipo: "da_chiudere" };
  if (dati.chiusaDaTipo !== "kireo" && dati.chiusaDaTipo !== "ente") return { tipo: "da_chiudere" };
  const ricevuta =
    typeof dati.presenti === "number" && typeof dati.certificati === "number"
      ? { presenti: dati.presenti, certificati: dati.certificati }
      : null;
  return { tipo: "chiusa", quando: dati.chiusaIl, daTipo: dati.chiusaDaTipo, ricevuta };
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
  return `Diretta chiusa. ${codaRicevuta(esito.presenti, esito.certificati, true)}`;
}

/**
 * La riga di stato che prende il posto del bottone su una diretta già chiusa.
 *
 * ⚠️ IL BOTTONE SPARISCE, non diventa disabilitato, ed è una scelta confermata
 * da Mario: una volta chiusa, ripremere non può produrre niente — mai, non «non
 * adesso». Un bottone disabilitato dice «qui c'è qualcosa da fare, ma non ora»,
 * che è falso; e la sua assenza non ha bisogno di essere spiegata perché la
 * ricevuta dice cosa è successo.
 *
 * ⚠️ «il» E NON «dal»: una diretta non è chiusa DA un momento, è stata chiusa
 * IN un momento. «Dal» suggerisce uno stato che dura, e qui il fatto è un gesto.
 *
 * L'ora porta l'anno per la stessa ragione dell'esito (vedi sopra).
 *
 * ⚠️ NOMINA IL RUOLO E NON LA RELAZIONE CON CHI LEGGE («da KIREO» /
 * «dall'organizzatore»), perché questa riga la leggono tutti e due e «l'hai
 * chiusa tu» sarebbe falsa per uno dei due — è la stessa ragione per cui questa
 * pagina è una sola invece di due gemelle.
 *
 * ⚠️ E NON IL NOME DELLA PERSONA, che Mario proponeva dove c'è: `chiusa_da_user`
 * c'è, ma leggere `profiles.nome` per quell'id NON è possibile in modo
 * simmetrico — `profiles_select_admin` fa vedere tutti i profili a un admin, e
 * nessuna policy fa vedere all'ente il profilo dell'admin che ha chiuso. Quindi
 * il nome comparirebbe per un ruolo e non per l'altro, sulla pagina costruita
 * apposta perché i due vedano la stessa cosa. Aprirla è una policy nuova, cioè
 * una decisione: vedi il rapporto.
 */
export function testoStatoChiusura(stato: Extract<StatoChiusura, { tipo: "chiusa" }>): string {
  const testa = `Diretta chiusa il ${formattaDataOra(stato.quando, "long")}, ${CHI[stato.daTipo]}.`;
  if (!stato.ricevuta) return testa;
  return `${testa} ${codaRicevuta(stato.ricevuta.presenti, stato.ricevuta.certificati, false)}`;
}
