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

// LE ECCEZIONI DEL TRIGGER DELLE ORE (`20261029100000`): non sono vincoli ma
// `raise exception` con un nome, e il trigger controlla le date PRIMA del
// vincolo `eventi_date_order` — quindi lo stesso fatto arriva con un altro
// nome, e deve dire la stessa cosa. Un elenco a parte perché la guardia le
// cerca in un'altra forma (`raise exception '<nome>'`, non `constraint <nome>`).
const PER_ECCEZIONE: { eccezione: string; testo: string }[] = [
  // Copre anche la fine UGUALE all'inizio (Mario, 26/10: un incontro di durata
  // zero non è un incontro), quindi il testo non dice «precedente». Di Mario.
  {
    eccezione: "fine_non_dopo_inizio",
    testo: "La data di fine deve essere successiva a quella di inizio: correggila e riprova.",
  },
  // ⚠️ Testo mio, provvisorio. Il form la chiede già: qui ci arriva solo una
  // strada che non passa dal form.
  {
    eccezione: "data_fine_obbligatoria",
    testo: "Manca l'orario di fine: serve a calcolare le ore PCTO dell'incontro. Aggiungilo e riprova.",
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
  for (const v of PER_ECCEZIONE) {
    if (messaggio.includes(v.eccezione)) return v.testo;
  }

  // Un CHECK che non sappiamo nominare resta un problema del DATO: si dice
  // quello che sappiamo — dove guardare, e che riprovare com'è non serve.
  if (errore?.code === "23514") {
    return "Qualcosa nei dati dell'evento non è ammesso: controlla date, link e campi obbligatori. Riprovare così com'è non cambierà l'esito.";
  }

  return "Non è stato possibile inviare l'evento. Se succede ancora, scrivici da Contatti.";
}
