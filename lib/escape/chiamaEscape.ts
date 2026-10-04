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

// IL TETTO DELLA MOTIVAZIONE, e non è una scelta di gusto: 220 è ANCORATO alle
// motivazioni scritte a mano in questo progetto, la forma che consideriamo
// giusta. La più lunga delle venti cablate in `scoring.ts` sta a 150 caratteri,
// le due che hanno aperto il caso a ~380 e ~400. Un tetto sotto i 150 taglierebbe
// testi buoni; sopra i 300 lascerebbe passare i paragrafi. `npm run test:revisore`
// misura il corpus a mano e pretende che il tetto lo contenga: se un giorno una
// motivazione cablata cresce, è il tetto a doversi spiegare, non lei.
//
// PERCHÉ ESISTE. Il 29/09, nella prima lettura umana di un corpus di pagine vere
// (`npm run banco pagine`), il blocco «Aree che stai sfiorando» — il cui titolo
// promette «un segnale c'è, ma è ancora leggero» — conteneva due PARAGRAFI in cui
// il prodotto spiegava a un diciassettenne cosa aveva sbagliato: «Qui hai scelto
// il documento invece che la conversazione. Se l'area ti interessa, è proprio
// perché vedi che questa scelta è stata uno sbaglio». Il posto dice «forse è la
// tua strada» e il testo dice «hai toccato male»: due messaggi opposti nello
// stesso riquadro, e quello che resta addosso è il secondo.
export const MAX_MOTIVAZIONE = 220;

// ⚠️ IL TETTO È UN TERMINALE, NON LA CURA. La cura è `REGOLA_MOTIVAZIONE` qui
// sotto: il prompt, prima del 29/09, chiedeva già una motivazione «breve» — un
// aggettivo senza misura, che non impegna nessuno. Se i ripieghi cominciassero a
// comparire spesso vorrebbe dire che la regola non ha preso, e allora il lavoro è
// sul prompt, non su questo numero.
//
// E SOPRA IL TETTO NON SI TRONCA: una motivazione tagliata a metà frase è un
// giudizio amputato, che è peggio del giudizio intero — al suo posto va il ripiego
// cablato del punto in cui siamo (contestuale e scritto a mano), perché «meglio
// nessuna motivazione che un paragrafo». Il testo scartato finisce nel log per
// intero: è l'unico modo per sapere se il modello è prolisso o se sta giudicando.
export function motivazioneNelLimite(mot: string, ripiego: string, dove: string): string {
  if (mot.length <= MAX_MOTIVAZIONE) return mot;
  console.warn(
    `Motivazione troppo lunga (${dove}): ${mot.length} caratteri su ${MAX_MOTIVAZIONE}, sostituita dal ripiego. Testo scartato: ${mot}`,
  );
  return ripiego;
}

// LA MOTIVAZIONE DICE COSA HA FATTO, MAI COSA HA SBAGLIATO — e la regola porta la
// MISURA invece dell'aggettivo, più due SOSTITUZIONI SVOLTE (in questo progetto
// l'unica forma che prende: vedi «Le sostituzioni funzionano, i principi no»).
// Le due riscritture non sono inventate: sono i due paragrafi veri del 29/09.
//
// Sta qui e non fra le regole centrali di `chiamaJson` per lo stesso motivo di
// `REGOLA_SENZA_VOTO`: nei workshop il revisore ha il mestiere di dire cosa non
// regge — è la sua rubrica — e una regola «non nominare uno sbaglio» appesa a
// tutti sarebbe falsa metà delle volte. Qui no: questo testo compare accanto a
// un'area come spiegazione di un SEGNALE, non come correzione di un compito.
export const REGOLA_MOTIVAZIONE = `\n\nLA MOTIVAZIONE DICE COSA HA FATTO, MAI COSA HA SBAGLIATO. Compare accanto al nome di un'area, come spiegazione del segnale che quell'area ha acceso — non è la correzione di un compito. Al massimo DUE FRASI e ${MAX_MOTIVAZIONE} caratteri: oltre quel limite non viene mostrata affatto, e lo studente resta senza spiegazione. Il soggetto è una cosa che ha fatto o che c'è nel testo, mai una lacuna, uno sbaglio o una mancanza, e non spiegargli cosa dovrebbe capire di sé. «Qui hai scelto il documento invece che la conversazione: se l'area ti interessa, è proprio perché vedi che questa scelta è stata uno sbaglio» → «Hai aperto il documento invece di chiedere a Sofia di spiegare». «L'hai lasciata in piedi perché non c'erano soldi: è una lacuna che emerge dal resoconto, più che una scelta consapevole» → «La caldaia è rimasta in piedi, e il suo costo con lei». E NON NOMINARE L'AREA: il suo nome compare già accanto alla tua frase, quindi ripeterlo la fa leggere due volte. «La tua proposta valorizza Energia & Sostenibilità» → «Hai messo i pannelli prima di sistemare il tetto».`;

// ═══════════════════ LA FORMA DI UN RIPIEGO, E I QUATTRO RIPIEGHI ═══════════════════
//
//     <Nome area> — Da <la cosa che lo studente ha fatto>.
//
// Mai il nome dell'area. Mai un giudizio. Il soggetto è sempre una cosa sua.
//
// PERCHÉ MAI IL NOME. La riga si legge dentro `components/escape/AreeSfiorate.tsx`,
// che rende ogni voce come «**Nome area** — testo»: una motivazione che nomina
// l'area la dice DUE VOLTE nella stessa riga. È la terza volta che una frase
// scritta per stare da sola finisce sotto qualcosa che la ripete — dopo il
// titolo «Risposta consegnata» col messaggio che lo ricopiava (28/09) e il
// ripiego della consegna (29/09). La premessa è verificata dai controlli, non
// data per buona: se un domani `AreeSfiorate` smettesse di prefissare il nome,
// questa regola starebbe gridando su niente.
//
// PERCHÉ UN FRAMMENTO E NON UNA FRASE INTERA. Dopo un trattino «Da…» COMPLETA il
// nome invece di ricominciare. E le motivazioni buone — quelle cablate nei punti
// di scoring — sono frasi intere proprio perché dicono un fatto preciso: un
// ripiego che si traveste da frase intera promette una precisione che non ha.
//
// PERCHÉ STANNO TUTTI QUI, accanto alla regola. Il difetto si è ripresentato tre
// volte perché nominare l'area sembra la cosa premurosa da fare: la prossima
// motivazione che qualcuno scriverà nascerà sbagliata se la regola non è scritta
// accanto. Aggiungerne una vuol dire aggiungere una chiave qui, sotto gli occhi
// della forma — e `npm run test:revisore` legge questi VALORI (non il sorgente)
// e pretende la forma su ognuno.
//
// I TRE DI MEZZO RESTANO DISTINGUIBILI, ed è la cosa da non perdere: ognuno
// nomina il PROPRIO passo (la proposta, la riflessione, la risposta), che è
// l'unica informazione che il nome dell'area non sostituiva.
export const RIPIEGHI_MOTIVAZIONE = {
  // Il terminale delle missioni: nessuno sa quale passo abbia acceso il segnale.
  missione: "Da qualcosa che hai fatto in questa missione.",
  proposta: "Dalla proposta che hai scritto.",
  riflessione: "Dalla riflessione che hai scritto.",
  consegnaEvento: "Da qualcosa che hai scritto nella risposta.",
  // La presenza certificata a una diretta. ⚠️ QUESTA STRINGA VIVE IN DUE POSTI:
  // la scrive `chiudi_diretta_evento` (20261004160000), e una funzione SQL non
  // può importare TypeScript. Sta anche qui perché è il posto in cui la forma è
  // scritta e sorvegliata, e `npm run test:presenza` estrae il letterale dalla
  // migrazione e lo confronta con questo — lo stesso patto già in uso per
  // `TETTO_LETTURE_CONSEGNA` e per i tre slug dei test.
  presenza: "Da un incontro che hai seguito per intero.",
} as const;

export function chiamaEscape(
  anthropic: Anthropic,
  system: string,
  user: string,
  diProva: boolean,
  controlloExtra?: (dati: unknown) => string[],
): Promise<EsitoAI> {
  return chiamaJson(anthropic, {
    model: MODELLO_ESCAPE,
    maxTokens: 600,
    system: system + REGOLA_SENZA_VOTO + REGOLA_MOTIVAZIONE,
    user,
    controlloExtra,
    diProva,
  });
}
