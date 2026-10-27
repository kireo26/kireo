// I LIMITI DEI FILE DI UN ENTE, in un posto solo per il client (27/10).
//
// Fino al 27/10 tipo e dimensione di copertina e guida li controllava solo il
// JavaScript del form, e il bucket `istituzioni-media` non aveva limiti: il
// controllo c'era dove chiunque può toglierlo e mancava dove nessuno può
// (Mario). Ora il bucket ha un tetto di dimensione e un elenco di tipi
// (20261103140000_storage_istituzioni_media_limiti.sql), e questo file dice al
// form gli stessi numeri: `npm run test:statistiche` pretende che coincidano.
//
// ⚠️ Quello che il server NON sa fare: un tetto per tipo di file. Il bucket ha
// un tetto solo (il più grande, quello della guida), quindi «la copertina sotto
// i 5 MB» resta una regola del solo client. E il tipo che il bucket controlla è
// quello DICHIARATO da chi carica (il Content-Type), non il contenuto del file.
export const TIPI_COPERTINA = ["image/jpeg", "image/png", "image/webp"] as const;
export const TIPO_GUIDA = "application/pdf";
export const MAX_COPERTINA_MB = 5;
export const MAX_GUIDA_MB = 20;

export function tipoCopertinaAmmesso(tipo: string): boolean {
  return (TIPI_COPERTINA as readonly string[]).includes(tipo);
}
