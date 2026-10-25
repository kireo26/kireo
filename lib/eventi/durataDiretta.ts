// UNA DIRETTA DI DICIOTTO ORE PASSAVA SENZA CHE NESSUNO FIATASSE (26/10).
//
// Mario ha sbagliato un orario, e lo studente ha letto «Per il riconoscimento
// ne servono 1103». Se succede a chi il prodotto l'ha costruito, succede a un
// ente al primo evento. Non si rifiuta — una diretta lunga può esistere (una
// maratona, una giornata di orientamento) — si FA CONFERMARE: l'ente deve dire
// di sì a un numero che legge, non a un campo che ha riempito di fretta.
//
// La soglia è 4 ore: scelta, non misurata. Le dirette viste finora durano fra
// cinque minuti e un'ora. Una funzione pura, usata dal form di creazione e da
// quello dello spostamento: due copie della soglia divergerebbero.
import { durataLeggibile } from "./orePcto";

export const ORE_DIRETTA_DA_CONFERMARE = 4;

/** Il testo da far confermare, o `null` se la durata non lo chiede (o non si calcola). */
export function avvisoDurataDiretta(inizioMs: number | null, fineMs: number | null): string | null {
  if (inizioMs === null || fineMs === null || !Number.isFinite(inizioMs) || !Number.isFinite(fineMs)) return null;
  const ore = (fineMs - inizioMs) / 3_600_000;
  if (!(ore > ORE_DIRETTA_DA_CONFERMARE)) return null;
  return `Questa diretta durerebbe ${durataLeggibile(ore)}. Se è giusto, confermalo qui sotto; se no, controlla le date.`;
}

export const ETICHETTA_CONFERMA_DURATA = "Sì, la diretta dura davvero così tanto.";
