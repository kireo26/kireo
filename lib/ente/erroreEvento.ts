// Perché la creazione di un evento è stata rifiutata, detto in italiano.
//
// PERCHÉ ESISTE. Il 28/09 un ente ha scritto una data di fine PRIMA di quella
// di inizio: il form ha accettato, il database ha rifiutato per il vincolo
// `eventi_date_order`, e a schermo è comparso «Non è stato possibile inviare
// l'evento. Riprova più tardi.» — sbagliato due volte. Riprovare non può
// funzionare (a non andare è il dato, e resta lo stesso), e non dice quale
// campo. *Un ente vero riprova due volte e poi scrive a Mario.*
//
// LA DISTINZIONE CHE CONTA è fra **il dato non va** e **non ci siamo
// riusciti**, ed è la stessa già tolta dalla consegna: un consiglio falso vale
// meno di nessun consiglio. Un `23514` è una violazione di CHECK, cioè
// Postgres che dice «questa riga non è ammessa»: lì «riprova» è una bugia.
//
// ⚠️ I testi sono voce: questi li ho scritti io e vanno riletti da Mario.

export type ErroreSupabase = { code?: string | null; message?: string | null } | null | undefined;

const QUOTA_REVISIONE = "Hai già 4 eventi in attesa di revisione: attendi l'esito prima di proporne altri.";

// I CHECK che un ente può far scattare compilando il form. Il nome del vincolo
// arriva dentro `message`, quindi si riconosce per nome e non per posizione.
const PER_VINCOLO: { nome: string; testo: string }[] = [
  {
    nome: "eventi_date_order",
    testo: "La data di fine è precedente a quella di inizio: correggila e riprova.",
  },
  {
    nome: "eventi_diretta_proprio_coerente",
    testo:
      "Per trasmettere dal tuo canale servono il link della diretta e tutte le voci della checklist: completale e riprova.",
  },
  {
    nome: "eventi_filone_coerente_con_pubblico",
    testo: "Il filone va indicato solo sui webinar per i docenti, ed è obbligatorio lì: controlla la scelta e riprova.",
  },
];

/**
 * Il messaggio da mostrare. Non dice mai «riprova più tardi» quando a non
 * andare è il dato: il tempo non lo cambia.
 */
export function messaggioErroreEvento(errore: ErroreSupabase): string {
  const messaggio = errore?.message ?? "";
  if (messaggio.includes("troppi_eventi_in_revisione")) return QUOTA_REVISIONE;

  for (const v of PER_VINCOLO) {
    if (messaggio.includes(v.nome)) return v.testo;
  }

  // Un CHECK che non sappiamo nominare resta un problema del DATO: si dice
  // quello che sappiamo — dove guardare, e che riprovare com'è non serve.
  if (errore?.code === "23514") {
    return "Qualcosa nei dati dell'evento non è ammesso: controlla date, link e campi obbligatori. Riprovare così com'è non cambierà l'esito.";
  }

  return "Non è stato possibile inviare l'evento. Se succede ancora, scrivici da Contatti.";
}
