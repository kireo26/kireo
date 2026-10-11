// Cosa legge chi preme «Esporta presenze» e non ottiene il file.
//
// ⚠️⚠️ IL DIFETTO DA CUI NASCE (11/10/2026, §4c del giro a schermo di Mario):
// «Non è stato possibile generare l'export.» non distingue *non hai il
// permesso* da *si è rotto qualcosa da noi* — e «chi lo legge alla fine di un
// incontro non sa se insistere, chiedere aiuto, o rinunciare».
//
// ⚠️ LE CAUSE SONO DUE, NON TRE, ED È UNA MISURA. Mario ne nominava tre
// («non ci sono dati», «si è rotto qualcosa», «non hai il permesso»): la prima
// NON è un rifiuto. Un evento senza presenze produce un CSV regolare con una
// sezione che lo dice («Nessuno si è collegato a questa diretta»), ed è il
// disegno del 11/10 sulle sezioni vuote — quindi non esiste un caso «nessun
// dato» in cui il file non esce.
//
// Restano due, e hanno due risposte diverse perché sono due fatti diversi:
//   • LA GUARDIA TI RESPINGE (`non_autorizzato`, 403) → non c'è niente da
//     riprovare: chi legge deve sapere che il problema è un permesso e chi
//     glielo può dare.
//   • SI È ROTTO QUALCOSA DA NOI (tutto il resto, 500) → riprovare può anche
//     funzionare, e soprattutto NON è colpa sua. È il caso in cui per tre mesi
//     abbiamo detto «non hai il permesso» a un referente che il permesso lo
//     aveva.
//
// ⚠️ IL DISCRIMINANTE È IL `message` DELLA RPC, non lo stato HTTP: le funzioni
// alzano `raise exception 'non_autorizzato'`, che PostgREST consegna come
// `message` con `code` P0001. Confrontare la stringa è fragile, e per questo la
// direzione dell'errore è scelta: ciò che NON riconosciamo è trattato come
// NOSTRO (500, con la riga nel log). Sbagliare chiamando «nostro» un rifiuto
// legittimo costa una riga di log in più; sbagliare al contrario rimette in
// piedi il difetto dell'11/10, cioè accusare l'utente di un nostro guasto.
//
// I due testi sono PROVVISORI e miei: Mario ha chiesto di mandargli i casi.

/** Il messaggio con cui le funzioni di export respingono chi non ha il permesso. */
const RIFIUTO_DELLA_GUARDIA = "non_autorizzato";

export type RifiutoExport = {
  /** Il testo che chi ha premuto legge. */
  testo: string;
  stato: 403 | 500;
  /** Vero quando il guasto è nostro: è la condizione che fa scrivere la riga nel log. */
  nostro: boolean;
};

export function rifiutoExport(errore: unknown): RifiutoExport {
  const messaggio =
    typeof errore === "object" && errore !== null && typeof (errore as { message?: unknown }).message === "string"
      ? (errore as { message: string }).message
      : "";

  if (messaggio.includes(RIFIUTO_DELLA_GUARDIA)) {
    return {
      testo:
        "Per scaricare le presenze serve il permesso di certificare le presenze, e il tuo profilo non ce l'ha. Puoi chiederlo al referente della tua scuola, che lo assegna da Staff.",
      stato: 403,
      nostro: false,
    };
  }

  return {
    testo:
      "Non siamo riusciti a generare il file, e non è un problema del tuo profilo né dei dati di questo incontro: è un guasto nostro, e ne abbiamo lasciato traccia. Riprova fra qualche minuto; se succede ancora, scrivici da Contatti.",
    stato: 500,
    nostro: true,
  };
}
