// LA PRESENZA DI UNA DIRETTA, LATO STUDENTE: quando si conta, e cosa gli si dice
// (Mario, 18/10 sera). Valori e funzioni pure, provati da
// `npm run test:diretta1810`: una frase composta in un `.tsx` non si prova da
// uno script.

// ⚠️⚠️ LA PRESENZA COMINCIA QUANDO IL VIDEO PARTE LA PRIMA VOLTA. Il 18/10 per
// venti minuti il player è rimasto nero, e la pagina diceva «presenza in
// rilevamento» mandando battiti: certificavamo una presenza a un video mai
// partito. «Conta solo mentre riproduce» sarebbe la cura sbagliata — una pausa
// di dieci secondi, un buffering, una rete lenta diventerebbero minuti tolti a
// chi era lì, e un cronometro crudele non è una misura più onesta. Il fatto che
// fa la differenza è nominabile e non è un'opinione: il player ha mandato
// almeno un «in riproduzione», oppure no. Dopo quel momento pause e
// caricamenti contano; l'errore ferma tutto, come già faceva.
export function presenzaConta({
  inDiretta,
  videoRotto,
  avviato,
}: {
  inDiretta: boolean;
  videoRotto: boolean;
  avviato: boolean;
}): boolean {
  return inDiretta && !videoRotto && avviato;
}

// Quanti battiti (minuti) servono per la certificazione: lo specchio di
// `ping_attesi_evento` (durata in minuti, almeno 1) e della soglia 0,75 di
// `chiudi_diretta_evento`. Senza una fine non si calcola: `null`.
export const SOGLIA_PRESENZA = 0.75;
export function minutiNecessari(dataInizio: string, dataFine: string | null): number | null {
  if (!dataFine) return null;
  const attesi = Math.max(1, (new Date(dataFine).getTime() - new Date(dataInizio).getTime()) / 60000);
  return Math.ceil(SOGLIA_PRESENZA * attesi - 1e-9);
}

const minuti = (n: number) => (n === 1 ? "1 minuto" : `${n} minuti`);

export type StatoContatore = "sotto" | "raggiunta" | "fermo";

export function statoContatore(contati: number, necessari: number, conta: boolean): StatoContatore {
  if (contati >= necessari) return "raggiunta";
  return conta ? "sotto" : "fermo";
}

// I tre testi del contatore sono di Mario.
// ⚠️ «raggiunta» NON promette le ore: nomina la condizione che manca. Se l'ente
// non chiudesse mai la diretta, «le tue ore sono garantite» sarebbe una cosa
// falsa detta a uno studente, su un numero che finisce in un documento
// scolastico. E «fermo» dice A QUANTO è fermo: un numero che non avanza si
// nota, una parola no.
// ⚠️ IL FERMO HA DUE CAUSE E DUE TESTI (25/10): il video non si vede, oppure si
// vede e non è stato avviato. «Finché il video non si vede» detto a chi guarda la
// miniatura del video era un testo giusto per lo stato accanto, riusato in questo
// — e lo studente non capiva cosa gli si chiedesse. Il secondo è di Mario.
// `causa` è obbligatorio di proposito: un default nasconderebbe il chiamante che
// non lo passa, cioè il difetto di partenza.
export type CausaFermo = "video_non_visibile" | "non_avviato";
export function testoContatore(contati: number, necessari: number, conta: boolean, causa: CausaFermo): string {
  switch (statoContatore(contati, necessari, conta)) {
    case "raggiunta":
      return "Hai raggiunto la soglia di presenza. Le ore vengono riconosciute quando l'organizzatore chiude la diretta.";
    case "fermo":
      return causa === "non_avviato"
        ? `Il conteggio è fermo a ${minuti(contati)}: la presenza comincia quando avvii il video.`
        : `Il conteggio è fermo a ${minuti(contati)}: finché il video non si vede, la presenza non avanza.`;
    default:
      return `Presente da ${minuti(contati)}. Per il riconoscimento ${necessari === 1 ? "ne serve 1" : `ne servono ${necessari}`}.`;
  }
}

// Sotto il minuto non si dice niente: un avviso per quaranta secondi di
// assenza è rumore, e il rumore insegna a ignorare gli avvisi veri.
export const MS_MINIMO_ASSENZA = 60000;

// IL RIENTRO, due casi (testi di Mario). Il secondo non aggiunge niente da
// fare, perché non c'è niente da fare: una riga che suggerisce un rimedio
// inesistente è peggio del silenzio.
// ⚠️ UNA PAROLA CAMBIATA, e va riletta: Mario scriveva «Sei stato fuori 6
// minuti», che è un participio con *essere* in seconda persona — concorda col
// genere di chi legge, e KIREO non lo sa. Al suo posto «Hai passato … fuori da
// qui» (participio con *avere*, invariante). Il resto è suo, parola per parola.
// «Adesso riprende» si dice solo se è vero (il conteggio riparte davvero).
export function testoRientro({
  minutiFuori,
  direttaFinita,
  riprende,
}: {
  minutiFuori: number;
  direttaFinita: boolean;
  riprende: boolean;
}): string | null {
  if (minutiFuori < 1) return null;
  if (direttaFinita) {
    return minutiFuori === 1
      ? "Mentre eri fuori la diretta è finita. L'ultimo minuto non è stato contato."
      : `Mentre eri fuori la diretta è finita. Gli ultimi ${minutiFuori} minuti non sono stati contati.`;
  }
  return `Hai passato ${minuti(minutiFuori)} fuori da qui: in quel tempo la presenza non è stata contata.${riprende ? " Adesso riprende." : ""}`;
}

// ⚠️⚠️ IL RIQUADRO SEMPLICE NON CONTA COME VIDEO PARTITO (decisione di Mario,
// 18/10, che rovescia la mia). Quando lo script di YouTube non si carica la
// pagina mostra un iframe grezzo, che non dice niente: non sappiamo se il video
// parte. Fino al 18/10 lo davamo per partito — «dove non sappiamo, conta».
// La ragione per cui non regge è l'ASIMMETRIA DEL DANNO: darlo per partito può
// certificare ore PCTO, su un documento che una scuola conserva, a qualcuno che
// non ha visto niente — un errore irreversibile e silenzioso. Darlo per non
// partito toglie dei minuti a qualcuno che forse guardava — reversibile, SE
// LA PERSONA LO SA. Quindi la decisione vale solo con questa frase a schermo:
// dove non sappiamo non assumiamo e non tacciamo, diciamo che non sappiamo e
// diamo la cosa da fare. Testo di Mario, parola per parola. E ogni volta che
// capita si registra (`/api/live/ripiego`, specie `misura_avvio_video`): una
// decisione presa senza conoscere la frequenza deve portarsi dietro il modo di
// impararla.
export const TESTO_RIPIEGO =
  "Non riusciamo a sapere se il video è partito, quindi la presenza non avanza. Ricarica la pagina — e se la stai guardando in una finestra in incognito, riaprila in una normale.";

// SOPRA IL PLAYER (testi di Mario). La seconda riga solo sul telefono, dove
// «Guarda su YouTube» sta dentro il video ed è il gesto più naturale quando il
// video non parte.
export const AVVISO_PLAYER =
  "La presenza si conta mentre questa pagina resta aperta e in primo piano. Se apri YouTube o passi a un'altra app, il conteggio si ferma.";
export const AVVISO_PLAYER_TELEFONO = "Anche «Guarda su YouTube», dentro il video, ti porta fuori da qui.";

// ⚠️⚠️ IL BATTITO RESPINTO (25/10). Fino a oggi l'heartbeat buttava via la
// risposta: un 401 — la sessione persa — e un 200 con `ok:false` — la funzione
// che rifiuta — erano indistinguibili da un battito riuscito, e lo studente
// continuava a leggere «In diretta» mentre le sue ore smettevano di esistere.
// Il 25/10 la pagina diceva «Presente da 0 minuti» (cioè contava, lato pagina)
// con i battiti fermi sul database: le richieste partivano ed erano respinte.
// Quattro esiti, e `null` vuol dire «nessun battito ancora mandato».
export type EsitoBattito = "ok" | "sessione_persa" | "rifiutato" | "rete";
export function esitoBattito(status: number | null, corpo: unknown): EsitoBattito {
  if (status === null) return "rete";
  if (status === 401) return "sessione_persa";
  const ok = typeof corpo === "object" && corpo !== null && (corpo as { ok?: unknown }).ok === true;
  return status === 200 && ok ? "ok" : "rifiutato";
}

// ⚠️ IL CONTATORE NON SCENDE, E NON SCRIVE ZERO QUANDO NON HA LETTO (25/10).
// `ping_totali` non diminuisce mai, quindi un valore più basso del precedente non
// viene dalla presenza salvata; e una riga assente, dopo che un battito è
// riuscito, non è «zero minuti»: è una lettura fatta senza sessione (la policy
// `select_own` restituisce zero righe, senza errore). In tutti e due i casi si
// dice che non abbiamo letto — zero è un'affermazione su uno studente, la
// peggiore da fargli mentre sta guardando.
export type LetturaPresenza = { tipo: "valore"; minuti: number } | { tipo: "non_letto" };
export function letturaPresenza({
  dato,
  errore,
  precedente,
  battitoRiuscito,
}: {
  dato: number | null;
  errore: boolean;
  precedente: number | null;
  battitoRiuscito: boolean;
}): LetturaPresenza {
  if (errore) return { tipo: "non_letto" };
  if (dato === null) return battitoRiuscito || (precedente ?? 0) > 0 ? { tipo: "non_letto" } : { tipo: "valore", minuti: 0 };
  if (precedente !== null && dato < precedente) return { tipo: "non_letto" };
  return { tipo: "valore", minuti: dato };
}

// ⚠️ TESTI MIEI E PROVVISORI (25/10): Mario li scrive quando vede la forma.
// Quando non abbiamo letto, il contatore non dice un numero.
export const TESTO_CONTEGGIO_NON_LETTO = "In questo momento non riusciamo a leggere il tuo conteggio.";
// La sessione persa: è l'unico caso in cui c'è una cosa da fare, e la pagina la
// dice con il link per farla. Sostituisce il contatore, perché da qui in poi
// nessun battito viene accettato.
export const TESTO_SESSIONE_PERSA = "Il tuo accesso è scaduto: da questo momento la presenza non viene contata.";
export const ETICHETTA_RIFAI_ACCESSO = "Rifai l'accesso e torna qui";
// Il battito rifiutato senza sessione persa: non sappiamo dire perché, e lo diciamo.
export const TESTO_BATTITO_RIFIUTATO = "La presenza in questo momento non viene registrata, e non dipende da te. Lascia la pagina aperta: riproviamo ogni minuto.";

// LA DOMANDA RIFIUTATA (25/10): «Non è stato possibile inviare la domanda» copriva
// tre cose con tre rimedi diversi. Testi miei e provvisori.
export type CausaRifiutoDomanda = "sessione_persa" | "non_ammessa" | "guasto";
export const TESTO_RIFIUTO_DOMANDA: Record<CausaRifiutoDomanda, string> = {
  sessione_persa: "Il tuo accesso è scaduto, quindi la domanda non è arrivata. Rifai l'accesso e mandala di nuovo.",
  non_ammessa: "Non possiamo accettare questa domanda: le domande si mandano mentre la diretta è aperta, e serve l'iscrizione all'incontro.",
  guasto: "La domanda non è arrivata per un problema nostro, non tuo. Riprova fra un momento.",
};
// 42501 è la RLS che respinge l'insert: con la sessione viva vuol dire che la
// policy non ammette la domanda; senza sessione, che la sessione è persa. Ogni
// altro errore è nostro.
export function causaRifiutoDomanda({ codice, sessioneViva }: { codice: string | null; sessioneViva: boolean }): CausaRifiutoDomanda {
  if (!sessioneViva) return "sessione_persa";
  return codice === "42501" ? "non_ammessa" : "guasto";
}
