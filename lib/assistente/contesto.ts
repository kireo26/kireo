// QUANTO COSTA UNA CHIAMATA ALL'ASSISTENTE LO DECIDE IL SERVER (Mario, 27/10).
//
// La history arriva dal client a ogni richiesta (non la salviamo da nessuna
// parte), e fino al 27/10 il server la mandava al modello per intero: 20
// messaggi da 2000 caratteri, scritti da chi chiama. Cioè chi chiama decideva
// quanto costava la chiamata. Qui si tiene solo la coda della conversazione
// che sta dentro `MAX_CARATTERI_CONTESTO`, e si comincia sempre da un messaggio
// dello studente (il modello rifiuta una conversazione che comincia con una
// sua risposta).
//
// L'ultimo messaggio resta sempre: è la domanda a cui si risponde, e la route
// lo ha già controllato sotto `MAX_CARATTERI_MESSAGGIO`.
//
// ⚠️ Cosa cambia per chi scrive: in una conversazione lunga l'assistente non
// «vede» più i primi scambi. Con i limiti di oggi ci si arriva solo dopo
// parecchi messaggi lunghi; il numero è scelto, non misurato.
export const MAX_CARATTERI_CONTESTO = 8000;

export type Messaggio = { role: "user" | "assistant"; content: string };

export function tagliaContesto(messaggi: Messaggio[], massimo: number = MAX_CARATTERI_CONTESTO): Messaggio[] {
  if (messaggi.length === 0) return [];
  const tenuti: Messaggio[] = [messaggi[messaggi.length - 1]];
  let totale = tenuti[0].content.length;
  for (let i = messaggi.length - 2; i >= 0; i--) {
    const m = messaggi[i];
    if (totale + m.content.length > massimo) break;
    tenuti.unshift(m);
    totale += m.content.length;
  }
  while (tenuti.length > 1 && tenuti[0].role !== "user") tenuti.shift();
  return tenuti;
}
