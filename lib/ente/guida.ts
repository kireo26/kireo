import { formattaData } from "@/lib/formato";

// UNA GUIDA PUBBLICA PER ENTE (29/10, 20261114100000).
//
// Il prodotto dice «la guida» al singolare dappertutto, e il pannello ne
// accettava quante ne volevi: una seconda caricata diceva «Salvato.», il form
// pubblico ne mostrava una sola, e nessuno l'aveva detto. *Un pannello che
// accetta una cosa che il prodotto non usa dice all'ente una cosa falsa su
// quello che ha appena fatto* (Mario). Da qui:
//   - caricare una guida nuova la rende quella pubblica, e il pannello lo dice
//     PRIMA, nominando quella che smette di esserlo;
//   - smettere di essere pubblica non vuol dire sparire: resta in archivio, con
//     il suo titolo e la sua data, e chi l'ha scaricata resta legato a lei;
//   - un ente che ne ha già due pubbliche (Davante) sceglie lui quale resta,
//     una volta: non una regola, che farebbe sparire un file senza che
//     nessuno l'abbia chiesto.
// ⚠️ Testi miei e provvisori.

export type GuidaPannello = { id: string; titolo: string; pdf_url: string; created_at: string; archiviata_il: string | null };

export const COLONNE_GUIDA_PANNELLO = "id, titolo, pdf_url, created_at, archiviata_il";

export function pubbliche(guide: GuidaPannello[]): GuidaPannello[] {
  return guide.filter((g) => g.archiviata_il === null);
}

export function archiviate(guide: GuidaPannello[]): GuidaPannello[] {
  return guide.filter((g) => g.archiviata_il !== null);
}

/** La riga sopra il bottone «Carica PDF»: cosa succede alla guida di adesso, detto prima. */
export function testoPrimaDelCaricamento(guide: GuidaPannello[]): string {
  const ora = pubbliche(guide);
  if (ora.length === 0) return "La guida che carichi compare sul tuo profilo pubblico, con il bottone per scaricarla.";
  if (ora.length === 1) {
    return `Caricando una guida nuova, «${ora[0].titolo}» smette di essere quella pubblica: resta qui in archivio, e chi l'ha già scaricata la conserva.`;
  }
  return "Caricando una guida nuova, quella diventa la sola pubblica, e le altre vanno in archivio.";
}

/** Quando ce n'è più di una pubblica: la scelta che l'ente fa una volta. `null` se non serve. */
export function testoSceltaNecessaria(guide: GuidaPannello[]): string | null {
  if (pubbliche(guide).length < 2) return null;
  return "Il tuo profilo pubblico ne mostra una sola, la più recente. Scegli quale resta pubblica: le altre vanno in archivio, non spariscono.";
}

export function rigaArchiviata(g: GuidaPannello): string {
  return `Caricata il ${formattaData(g.created_at, "long")}, in archivio dal ${formattaData(g.archiviata_il as string, "long")}.`;
}

export function messaggioScelta(errore: string | null | undefined): string {
  if (errore?.includes("non_autorizzato")) return "Questa guida non è di questo ente.";
  return "Non siamo riusciti a cambiare la guida pubblica: ricarica la pagina e riprova.";
}

/**
 * La riga sotto «Download guida» (29/10): i download si contano da quando
 * abbiamo cominciato a contarli. La data la dice il database
 * (`inizio_conteggio_download_guide()`); se non l'abbiamo letta, la riga non
 * inventa una data e lo dice.
 */
export function sottoDownloadGuida(inizio: string | null | undefined): string {
  if (!inizio) return "Contati da quando registriamo i download: quelli di prima non sono stati registrati.";
  return `Contati dal ${formattaData(inizio, "long")}: i download di prima non sono stati registrati.`;
}
