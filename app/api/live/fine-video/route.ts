import { NextRequest } from "next/server";
import { registraMisuraLive } from "@/lib/live/misuraLive";
import { rispettoAllaFine } from "@/lib/live/presenza";

// ⚠️ L'EVENTO DI FINE, REGISTRATO (Mario, 25/10). Dal 25/10 la presenza si
// ferma quando il player dice «finito» (stato 0). Che una diretta YouTube lo
// mandi davvero quando chi trasmette chiude è DOCUMENTATO, NON OSSERVATO — e se
// non arriva, la funzione degrada al comportamento di prima (la presenza corre
// fino alla fine della finestra) senza nessun errore e nessuna riga. Il
// tredicesimo modo, in produzione: il ripiego è il vecchio comportamento, quindi
// tutto continua a sembrare normale per sempre.
//
// Questa riga non cura niente: serve a far sì che, il giorno della prima
// diretta vera, «si è fermata alla fine» e «non abbiamo mai saputo che era
// finita» siano distinguibili. Una riga per caricamento di pagina che riceve il
// segnale, con quanto prima o dopo la fine programmata è arrivato. L'ASSENZA di
// righe su un evento con presenti è la cosa da leggere: vuol dire che il segnale
// non è arrivato a nessuno (oppure che tutti hanno chiuso la pagina prima).
export async function POST(request: NextRequest) {
  const adesso = new Date();
  return registraMisuraLive(request, {
    processo: "live/fine-video",
    specie: "misura_fine_video",
    motivo: "evento_fine_ricevuto",
    dettaglio: (eventoId, evento) => `evento ${eventoId} · ${rispettoAllaFine(evento?.data_fine ?? null, adesso)}`,
  });
}
