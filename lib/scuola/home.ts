// La home della scuola: i numeri e le prossime iscrizioni delle classi (01/11,
// passo 4 del capitolo della scuola).
//
// FINO AL 01/11 TRE DIFETTI NELLA STESSA LETTURA [letto nel codice]:
//   • «Eventi con iscrizioni» era la lunghezza di una lista limitata a 5 righe
//     di `iscrizioni_classe_eventi`: mai più di 5, e righe (classi) non eventi;
//   • «Prossime iscrizioni» mostrava anche eventi già passati: erano le ultime
//     iscrizioni create, non le prossime;
//   • un conteggio non letto diventava 0 a schermo.
// Qui si legge tutto, e si decide in una funzione pura: gli eventi DISTINTI
// non ancora finiti (sulla fine effettiva, `eventoNonFinito`), e le prossime
// in ordine di data.

import { eventoNonFinito } from "@/lib/app/eventi";

export const PROSSIME_ISCRIZIONI_MASSIMO = 5;

export type RigaIscrizioneClasse = {
  evento_id: string;
  evento: { titolo: string; data_inizio: string; data_fine: string | null; diretta_chiusa_il: string | null } | null;
  classe: string | null;
};

export type RiepilogoIscrizioni = {
  eventiInProgramma: number;
  prossime: { eventoId: string; titolo: string; dataInizio: string; classe: string | null }[];
};

export function riepilogoIscrizioniClassi(righe: RigaIscrizioneClasse[], ora: Date = new Date()): RiepilogoIscrizioni {
  const vive = righe.filter((r) => r.evento && eventoNonFinito(r.evento, ora));
  const prossime = vive
    .map((r) => ({ eventoId: r.evento_id, titolo: r.evento!.titolo, dataInizio: r.evento!.data_inizio, classe: r.classe }))
    .sort((a, b) => new Date(a.dataInizio).getTime() - new Date(b.dataInizio).getTime() || a.eventoId.localeCompare(b.eventoId))
    .slice(0, PROSSIME_ISCRIZIONI_MASSIMO);
  return { eventiInProgramma: new Set(vive.map((r) => r.evento_id)).size, prossime };
}

// ⚠️ Testi miei e provvisori.
export const TESTI_HOME_SCUOLA = {
  eventiInProgramma: "Eventi in programma con classi iscritte",
  nonLetto: "Non letto: ricarica la pagina.",
  nessunaProssima: "Nessuna classe iscritta a un evento in programma.",
  iscrizioniNonLette: "Non siamo riusciti a leggere le iscrizioni delle classi: ricarica la pagina.",
} as const;
