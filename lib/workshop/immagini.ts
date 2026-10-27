// I LIMITI DELLE IMMAGINI DI UN ELABORATO, in un posto solo per il client (27/10).
//
// Il bucket `workshop-consegne` porta gli stessi numeri sul server
// (20261104120000_storage_workshop_consegne_limiti.sql): fino al 27/10 in
// produzione non ne aveva nessuno, perché la migrazione che li scriveva aveva
// `on conflict do nothing` su un bucket che esisteva già. `npm run
// test:statistiche` pretende che questi valori e quelli del bucket coincidano:
// il giorno in cui il form accetta un tipo o una dimensione in più, il bucket
// cambia nello stesso lotto, con una migrazione nuova.
//
// ⚠️ Il tipo che il bucket controlla è quello DICHIARATO da chi carica (il
// Content-Type), non il contenuto del file.
export const BUCKET_IMMAGINI = "workshop-consegne";
export const MAX_IMMAGINE_MB = 5;
export const TIPI_IMMAGINE_CONSENTITI = ["image/png", "image/jpeg"] as const;

export function tipoImmagineAmmesso(tipo: string): boolean {
  return (TIPI_IMMAGINE_CONSENTITI as readonly string[]).includes(tipo);
}
