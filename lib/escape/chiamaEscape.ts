// La cucitura che passano TUTTI E SOLI i revisori di Escape — i tre step aperti
// delle missioni e la consegna di una diretta. Sottile wrapper sul `chiamaJson`
// condiviso: fissa modello e tetto di token, e appende la regola qui sotto.
//
// PERCHÉ È UN FILE SUO, dal 27/09. Stava in `lib/escape/scoring.ts`, che è il
// motore delle MISSIONI: importarlo da lì per giudicare la consegna di un evento
// avrebbe tirato dentro tutto quel motore, e soprattutto avrebbe reso naturale,
// alla persona dopo, ricopiare le tre righe invece di importarle — che è il modo
// in cui nascono due macchine per trasformare un testo in prove. Estratto, non
// copiato: `scoring.ts` importa da qui.

import Anthropic from "@anthropic-ai/sdk";
import { chiamaJson, type EsitoAI } from "@/lib/ai/chiamaJson";

export const MODELLO_ESCAPE = "claude-haiku-4-5"; // stesso modello provato in prod (workshop/assistente)

// CHI LEGGE UNA MOTIVAZIONE DI ESCAPE NON VEDE NESSUN NUMERO, e per un mese i
// revisori hanno parlato del voto che assegnavano. Il 27/09, nel blocco delle
// «aree sfiorate» — che dichiara esso stesso «non portano un punteggio, perché il
// prodotto non gliene mostra uno» — la motivazione diceva «Quello che riduce il
// voto è il margine di nove giorni». Due frasi che si contraddicono a dieci righe
// di distanza sulla stessa schermata, e quella falsa era la nostra.
//
// LA REGOLA STA QUI E NON FRA QUELLE CENTRALI di `chiamaJson`, ed è deliberato:
// nei WORKSHOP un punteggio lo studente lo vede davvero (la barra della fiducia,
// 0-100, e il punteggio d'area del feedback finale). Una regola «non nominare il
// voto» appesa a tutti i revisori sarebbe falsa metà delle volte — e una regola
// falsa dove non serve è una regola che qualcuno toglie.
//
// Forma: una SOSTITUZIONE SVOLTA, che in questo progetto è l'unica che prende
// (vedi «Le sostituzioni funzionano, i principi no»). E a differenza del segno
// tipografico di `ragazz@` qui nominare la parola non è insegnarla: «voto» e
// «punteggio» il modello le usa già da sé.
export const REGOLA_SENZA_VOTO =
  "\n\nCHI LEGGE NON VEDE NESSUN NUMERO: la tua motivazione compare accanto a un'area senza punteggio, e i valori che assegni non escono da qui. Non nominare mai il voto, il punteggio o la valutazione, e non citare le cifre che hai assegnato: di' cosa c'è nel testo. «Quello che riduce il voto è il margine di nove giorni» → «Il margine di nove giorni resta il punto più fragile».";

export function chiamaEscape(
  anthropic: Anthropic,
  system: string,
  user: string,
  diProva: boolean,
  controlloExtra?: (dati: unknown) => string[],
): Promise<EsitoAI> {
  return chiamaJson(anthropic, { model: MODELLO_ESCAPE, maxTokens: 600, system: system + REGOLA_SENZA_VOTO, user, controlloExtra, diProva });
}
