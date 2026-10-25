import { NextRequest } from "next/server";
import { registraMisuraLive } from "@/lib/live/misuraLive";

// IL RIQUADRO SEMPLICE, CONTATO (decisione di Mario, 18/10). Quando lo script
// di YouTube non si carica il player torna all'iframe grezzo, e da lì non
// sappiamo se il video parte: la presenza non avanza e la pagina lo dice
// (`TESTO_RIPIEGO` in lib/live/presenza.ts). Questa route esiste per una ragione
// sola: sapere QUANTE VOLTE capita. Senza quel numero la decisione resterebbe
// questa per inerzia; con il numero si può ripensare.
//
// Una riga in `guasti` (specie `misura_avvio_video`) per caricamento di pagina
// che cade nel ripiego. Si scrive solo per chi è iscritto all'evento: la riga
// conta studenti veri davanti a una diretta, non richieste qualunque. È
// best-effort e lato client nessuno aspetta la risposta per dire niente.
export async function POST(request: NextRequest) {
  return registraMisuraLive(request, {
    processo: "live/ripiego",
    specie: "misura_avvio_video",
    motivo: "api_youtube_non_caricata",
    dettaglio: (eventoId) => `evento ${eventoId}`,
  });
}
