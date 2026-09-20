import type { SupabaseClient } from "@supabase/supabase-js";

// I due cancelli del percorso, letti dal lato TypeScript.
//
// LA DEFINIZIONE NON È QUI: è in SQL (migrazione 20260920100000), perché le
// iscrizioni si creano dal client e l'unico posto che non si aggira è il
// `with check` di una policy. Questo file non ricalcola niente — chiede.
// Riscrivere qui la condizione «i tre test completati» darebbe due definizioni
// della stessa regola in due lingue diverse, e nessun test potrebbe
// riconciliarle importandole entrambe.
//
// A COSA SERVE, visto che il database rifiuta comunque: a far leggere allo
// studente QUALE PASSO GLI MANCA invece di «errore durante l'iscrizione». È il
// secondo dei tre livelli, e non è un abbellimento: il cancello sbaglia verso
// il chiuso per costruzione (una sottoquery che non trova righe), quindi
// quando dice no è la pagina l'unica cosa che distingue «non ci sei ancora
// arrivato» da «si è rotto qualcosa». Uno che legge il passo che manca lo fa;
// uno che legge «errore» se ne va.
//
// DEGRADA VERSO L'APERTO, al contrario del database. Se la lettura fallisce
// (rete, RPC non ancora migrata) questa funzione risponde `true`: la pagina
// mostra il bottone, lo studente prova, e se il cancello è davvero chiuso è il
// database a dirlo. L'alternativa — nascondere il bottone su un errore di
// rete — direbbe a chi ha tutti i requisiti che non ce li ha, che è la bugia
// peggiore delle due.

export type Cancello = { aperto: boolean; passoMancante: string; cta: string; href: string };

async function predicato(supabase: SupabaseClient, nome: string): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.rpc(nome);
    if (error) {
      console.error(`Errore lettura cancello ${nome}:`, error.message ?? error);
      return null;
    }
    return data === true;
  } catch (errore) {
    console.error(`Errore lettura cancello ${nome} (eccezione):`, errore);
    return null;
  }
}

/** Le missioni si aprono con i tre test completati — o se ne hai già giocata una. */
export async function cancelloMissioni(supabase: SupabaseClient): Promise<Cancello> {
  const [test, gia] = await Promise.all([
    predicato(supabase, "ha_completato_i_tre_test"),
    predicato(supabase, "ha_gia_giocato_una_missione"),
  ]);
  // null = non l'abbiamo potuto leggere: si apre, e sarà il database a dire no.
  const aperto = test !== false || gia !== false;
  return {
    aperto,
    passoMancante:
      "Le missioni si aprono dopo i tre test: servono a dare una direzione a quello che ti proporranno. Sono brevi, e puoi rifarli.",
    cta: "Vai ai test",
    href: "/app/test",
  };
}

/** I workshop si aprono dopo un'esperienza — o se ci sei già stato dentro. */
export async function cancelloWorkshop(supabase: SupabaseClient): Promise<Cancello> {
  const [esperienza, gia] = await Promise.all([
    predicato(supabase, "ha_esperienza_percorso"),
    predicato(supabase, "e_gia_entrato_in_un_workshop"),
  ]);
  const aperto = esperienza !== false || gia !== false;
  return {
    aperto,
    passoMancante:
      "I workshop si aprono dopo una missione: sono lunghi settimane, e conviene arrivarci sapendo già da che parte guardare.",
    cta: "Prova una missione",
    href: "/app/escape",
  };
}
