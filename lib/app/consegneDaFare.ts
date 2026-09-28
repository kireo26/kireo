// Le domande di fine diretta a cui uno studente può ancora rispondere.
//
// PERCHÉ ESISTE. La consegna si apre quando la diretta finisce e resta aperta
// due giorni — e fino al 28/09 **non c'era nessuna strada per arrivarci**:
// l'unico link verso `/app/eventi/<id>/live` stava in `CardEvento`, che
// l'Agenda usa solo per gli eventi FUTURI. Una funzione completa, corretta,
// provata, e senza porta. Nessun controllo poteva vederlo: la pagina esiste, la
// rotta risponde, i permessi sono giusti, la finestra funziona. Mancava un
// `href`.
//
// LA REGOLA NON SI RISCRIVE QUI. «La consegna è aperta per me» la sa già
// `statoPortaConsegna`, che è anche quella che spiega i no: una seconda
// versione in SQL sarebbe la seconda definizione della stessa cosa, e
// divergerebbe. La si chiama per evento, ed è sostenibile perché la lista
// candidata è già ridotta alla finestra: zero, uno, raramente due.
//
// DEGRADA VERSO IL NIENTE. Una lettura che fallisce non produce un invito: un
// bottone che porta a una porta chiusa è peggio di nessun bottone. Stesso patto
// di `statoPortaConsegna`, che a quel punto risponde `non_ho_potuto_controllare`.

import type { SupabaseClient } from "@supabase/supabase-js";
import { consegnaAperta, ORE_FINESTRA_CONSEGNA } from "@/lib/live";
import { statoPortaConsegna } from "@/lib/eventi/portaConsegna";

export type ConsegnaDaFare = {
  eventoId: string;
  titolo: string;
  /** Quando la porta si chiude: una scadenza è un fatto, un conto alla rovescia è un numero che invecchia mentre lo si legge. */
  scadenza: string;
};

// La durata di ripiego di una diretta senza `data_fine`, come in lib/live.ts.
const DURATA_DEFAULT_MS = 3 * 60 * 60 * 1000;
const FINESTRA_MS = ORE_FINESTRA_CONSEGNA * 60 * 60 * 1000;

/**
 * Quando la porta si chiude. Esportata perché è il NUMERO che lo studente
 * legge: «puoi rispondere fino al …». Un orario detto a chi legge è una cosa
 * che si prova, non che si deduce — e questo lo si ricava dalla stessa finestra
 * di `consegnaAperta`, che è l'unica definizione.
 */
export function scadenzaConsegna(dataInizio: string, dataFine: string | null): string {
  const fine = dataFine ? new Date(dataFine).getTime() : new Date(dataInizio).getTime() + DURATA_DEFAULT_MS;
  return new Date(fine + FINESTRA_MS).toISOString();
}

type RigaEvento = { id: string; titolo: string; data_inizio: string; data_fine: string | null; domanda_consegna: string | null };

export async function getConsegneDaFare(supabase: SupabaseClient, userId: string): Promise<ConsegnaDaFare[]> {
  try {
    // Si parte dalle iscrizioni, non dagli eventi: una consegna riguarda solo
    // chi c'era, e partire dagli eventi vorrebbe dire scartarne la maggior
    // parte dopo averli letti.
    const { data, error } = await supabase
      .from("iscrizioni_eventi")
      .select("eventi(id, titolo, data_inizio, data_fine, domanda_consegna)")
      .eq("student_id", userId)
      // Solo le dirette finite di recente: la finestra è di due giorni, il
      // margine copre una diretta lunga senza `data_fine`.
      .gte("eventi.data_inizio", new Date(Date.now() - (FINESTRA_MS + DURATA_DEFAULT_MS * 4)).toISOString());

    if (error) {
      console.error("getConsegneDaFare — lettura delle iscrizioni fallita:", error);
      return [];
    }

    const candidati = ((data ?? []) as { eventi: RigaEvento | RigaEvento[] | null }[])
      .map((r) => (Array.isArray(r.eventi) ? r.eventi[0] : r.eventi))
      .filter((e): e is RigaEvento => Boolean(e?.domanda_consegna))
      .filter((e) => consegnaAperta(e.data_inizio, e.data_fine));

    const aperte: ConsegnaDaFare[] = [];
    for (const e of candidati) {
      const porta = await statoPortaConsegna(supabase, { ...e, domanda_consegna: e.domanda_consegna }, userId);
      if (porta.aperta) aperte.push({ eventoId: e.id, titolo: e.titolo, scadenza: scadenzaConsegna(e.data_inizio, e.data_fine) });
    }
    // La più vicina a scadere per prima: è quella che si perde.
    return aperte.sort((a, b) => new Date(a.scadenza).getTime() - new Date(b.scadenza).getTime());
  } catch (e) {
    console.error("getConsegneDaFare — eccezione:", e);
    return [];
  }
}
