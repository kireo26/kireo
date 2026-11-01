// Cosa legge uno studente (o un docente, per l'iscrizione) quando una sua
// scrittura non riesce. Testi miei e provvisori; la regola è quella di
// `lib/rifiutiScrittura.ts`: «riprova» solo a un guasto.
//
// MISURATO nelle migrazioni il 01/11, superficie per superficie:
//   • ISCRIZIONE A UN EVENTO (`iscrizioni_eventi`, policy
//     `iscrizioni_eventi_insert_own` di 20261004140000, nessun trigger): 23505
//     l'iscrizione c'è già (un'altra finestra) — e allora lo stato voluto è
//     quello vero, si mostra «Iscritto»; 23503 l'evento non c'è più; 42501 con
//     la sessione viva la policy non l'ammette, e dato quello che il bottone
//     manda non c'è un caso noto, quindi è il rifiuto che non sappiamo dire.
//     ANNULLARE: la policy di delete non tocca una presenza già certificata, e
//     risponde zero righe senza errore (il modo 11): si rilegge la riga.
//   • DATA DI NASCITA (`profiles.data_nascita`): 23514 `profiles_eta_minima`,
//     che il modulo controlla prima in ora locale mentre il database conta in
//     UTC — a mezzanotte di un compleanno passa uno e non l'altro.
//   • TELEFONO: nessun vincolo; restano la sessione e il guasto.
//   • SCUOLA (`student_profiles`): `scuola_verificata_non_modificabile` dal
//     trigger `blocco_cambio_scuola_verificato` (la scuola ha verificato mentre
//     la pagina era aperta); 23503 una scuola che il nostro elenco `schools`
//     non ha.
//   • AREE (`student_area_interests`): 23505 un'area già salvata (un'altra
//     finestra).
// E per tutte: zero righe senza errore vuol dire che la scrittura non è
// atterrata, e non si dice «Salvato».

import {
  classeErroreScrittura,
  codiceErrore,
  messaggioErrore,
  TESTO_SESSIONE_PERSA_SCRITTURA,
  testoGuastoScrittura,
  testoRifiutoSconosciutoScrittura,
} from "@/lib/rifiutiScrittura";

type Errore = { code?: unknown; message?: unknown } | null;

function scegli(errore: Errore, sessioneViva: boolean, frase: string, regole: Record<string, string>): string {
  const classe = classeErroreScrittura(errore, sessioneViva);
  if (classe === "sessione") return TESTO_SESSIONE_PERSA_SCRITTURA;
  if (classe === "guasto") return testoGuastoScrittura(frase);
  const chiave = regole[messaggioErrore(errore).trim()] ?? regole[codiceErrore(errore)];
  return chiave ?? testoRifiutoSconosciutoScrittura(frase);
}

/** Un'iscrizione doppia non è un errore: è lo stato che si voleva. */
export function iscrizioneGiaPresente(errore: Errore): boolean {
  return codiceErrore(errore) === "23505";
}

export function testoErroreIscrizione(errore: Errore, sessioneViva: boolean): string {
  return scegli(errore, sessioneViva, "Non siamo riusciti a iscriverti.", {
    "23503": "Questo incontro non c'è più su KIREO: ricarica la pagina.",
  });
}

export const TESTO_ISCRIZIONE_CERTIFICATA =
  "La tua presenza a questo incontro è già certificata: l'iscrizione non si può più annullare.";

export function testoErroreAnnullaIscrizione(errore: Errore, sessioneViva: boolean): string {
  return scegli(errore, sessioneViva, "Non abbiamo potuto annullare l'iscrizione.", {});
}

export function testoErroreDataNascita(errore: Errore, sessioneViva: boolean, etaMinima: number): string {
  return scegli(errore, sessioneViva, "Non abbiamo potuto salvare la data di nascita.", {
    "23514": `Su KIREO è richiesta un'età minima di ${etaMinima} anni: controlla la data inserita.`,
  });
}

export function testoErroreTelefono(errore: Errore, sessioneViva: boolean): string {
  return scegli(errore, sessioneViva, "Non abbiamo potuto salvare il telefono.", {});
}

export function testoErroreScuola(errore: Errore, sessioneViva: boolean): string {
  return scegli(errore, sessioneViva, "Non abbiamo potuto salvare scuola e classe.", {
    scuola_verificata_non_modificabile:
      "Nel frattempo la tua scuola ha verificato la tua appartenenza, e da qui non si cambia più: ricarica la pagina. Se hai cambiato scuola, scrivici da Contatti.",
    "23503": "Questa scuola non risulta nel nostro elenco: scrivici da Contatti dicendoci qual è.",
  });
}

export function testoErroreAree(errore: Errore, sessioneViva: boolean): string {
  return scegli(errore, sessioneViva, "Non abbiamo potuto salvare le aree.", {
    "23505": "Una di queste aree risulta già salvata, forse da un'altra finestra: ricarica la pagina.",
  });
}

/** Una scrittura che non ha toccato nessuna riga, senza errore. */
export const FRASE_NON_ATTERRATA = "Non abbiamo potuto salvare: la modifica non è arrivata.";
export const TESTO_NON_ATTERRATA = testoRifiutoSconosciutoScrittura(FRASE_NON_ATTERRATA);
