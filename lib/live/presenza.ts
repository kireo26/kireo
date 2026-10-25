// LA PRESENZA DI UNA DIRETTA, LATO STUDENTE: quando si conta, e cosa gli si dice
// (Mario, 18/10 sera). Valori e funzioni pure, provati da
// `npm run test:diretta1810`: una frase composta in un `.tsx` non si prova da
// uno script.

import { ORE_FINESTRA_CONSEGNA } from "@/lib/live";

// ⚠️⚠️ LA PRESENZA COMINCIA QUANDO IL VIDEO PARTE LA PRIMA VOLTA. Il 18/10 per
// venti minuti il player è rimasto nero, e la pagina diceva «presenza in
// rilevamento» mandando battiti: certificavamo una presenza a un video mai
// partito. «Conta solo mentre riproduce» sarebbe la cura sbagliata — una pausa
// di dieci secondi, un buffering, una rete lenta diventerebbero minuti tolti a
// chi era lì, e un cronometro crudele non è una misura più onesta. Il fatto che
// fa la differenza è nominabile e non è un'opinione: il player ha mandato
// almeno un «in riproduzione», oppure no. Dopo quel momento pause e
// caricamenti contano; l'errore ferma tutto, come già faceva.
// ⚠️ E FINISCE QUANDO IL VIDEO FINISCE (Mario, 25/10). Lo stesso player che ci
// dice «è partito» ci dice «è finito» (stato 0): non serve un meccanismo nuovo,
// serve ascoltare l'altro capo. Lasciarla correre fino alla fine della finestra
// vorrebbe dire certificare ore su un tempo in cui non si trasmetteva niente, e
// premiare chi lascia la scheda aperta rispetto a chi se ne va alla fine vera.
// Presenza vuol dire che c'era qualcosa a cui essere presenti. È definitivo per
// il caricamento della pagina: rivedere il video registrato non è la diretta.
export function presenzaConta({
  inDiretta,
  videoRotto,
  avviato,
  finito,
}: {
  inDiretta: boolean;
  videoRotto: boolean;
  avviato: boolean;
  finito: boolean;
}): boolean {
  return inDiretta && !videoRotto && avviato && !finito;
}

// Testo di Mario. Senza un numero letto la seconda frase non si dice: «si è
// fermata a 0 minuti» sarebbe un'affermazione su uno studente che non abbiamo
// misurato (la regola del contatore che non scrive zero quando non ha letto).
// Se la soglia era già raggiunta resta detta anche la condizione che manca.
export function testoVideoFinito(contati: number | null, necessari: number | null): string {
  if (contati === null) return "La diretta è finita.";
  const base = `La diretta è finita. La tua presenza si è fermata a ${minuti(contati)}.`;
  return necessari !== null && contati >= necessari
    ? `${base} Le ore vengono riconosciute quando l'organizzatore chiude la diretta.`
    : base;
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

// ⚠️ L'AVVISO DEL RIENTRO SE NE VA (Mario, 25/10): il 25/10 «Hai passato 1
// minuto fuori da qui…» è rimasto a schermo sedici minuti. Un avviso su un fatto
// istantaneo che non se ne va diventa carta da parati — e la volta dopo, quando
// conterà, non lo si nota. Sparisce dopo tre minuti di conteggio ripreso (se il
// conteggio si ferma, il tempo riparte da capo quando riprende). Numero scelto,
// non misurato.
export const MS_DURATA_AVVISO_RIENTRO = 3 * 60000;

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

// I TESTI SONO DI MARIO (25/10).
// Quando non abbiamo letto, il contatore non dice un numero — e non promette che
// la presenza venga registrata, perché in quello stato non lo sappiamo.
export const TESTO_CONTEGGIO_NON_LETTO =
  "Non riusciamo a leggere il tuo conteggio in questo momento. Lascia la pagina aperta: il numero torna appena riusciamo a rileggerlo.";
// ⚠️ «I minuti già contati restano» non è una rifinitura: senza, uno studente
// pensa di aver perso tutto e molla — e mollare è la cosa che gli costa le ore.
// Ed è vera: la riga di `presenze_live` c'è, è la lettura che non la vede.
//
// ⚠️ «È SCADUTO» ERA FALSO (Mario, 25/10). Il caso di test7 non era una
// scadenza: era un «Esci» dello stesso account su un altro dispositivo, con il
// `signOut()` globale (vedi `lib/supabase/uscita.ts`). Da qui non sappiamo
// distinguere «chiuso altrove» da «scaduto davvero» — e il caso di test8 resta
// non spiegato — quindi il testo non dice né l'uno né l'altro: «una spiegazione
// che non abbiamo non si sceglie a caso fra due: si toglie». La forma di Mario
// «Sei uscito da KIREO su un altro dispositivo» non entra anche per un'altra
// ragione: «sei uscito» accorda col genere di chi legge.
export const TESTO_SESSIONE_PERSA =
  "Il tuo accesso qui non è più valido: da adesso la presenza non viene più contata. I minuti già contati restano.";
export const ETICHETTA_RIFAI_ACCESSO = "Rientra e torna alla diretta";
export const TESTO_BATTITO_RIFIUTATO =
  "La presenza in questo momento non viene registrata, e non è colpa tua. I minuti già contati restano. Lascia la pagina aperta: riproviamo ogni minuto.";

// LA DOMANDA RIFIUTATA: quattro cause, quattro rimedi. «Non ammessa» erano due
// (fuori dalla diretta / non iscritto) fuse in una frase: chi legge non sapeva
// quale lo riguardasse, e i rimedi sono opposti. La pagina sa quale dei due è.
// ⚠️ «il testo resta qui» è vero perché la bozza si salva nella scheda
// (sessionStorage) prima del rientro e si ripristina al ritorno: far riscrivere
// una domanda per un errore nostro sarebbe una seconda offesa dopo la prima.
/**
 * ⚠️ CHI VEDE LE DOMANDE IN DIRETTA SI DERIVA DAL PUBBLICO DELL'EVENTO (Mario,
 * 25/10). Fino al 25/10 la frase era una sola — «Solo tu vedi le tue domande:
 * l'organizzatore le riceve, non è una chat pubblica.» — che si smentiva in sei
 * parole, non nominava KIREO, e su un webinar per DOCENTI era falsa: lì
 * `domande_live_organizzatore` mostra all'organizzatore il nome di chi scrive.
 * Una promessa sulla visibilità non si scrive: si deriva da chi vede davvero.
 * Testi di Mario, parola per parola. Nel caso docenti «non sono anonime» sta
 * DAVANTI: chi sta per scrivere qualcosa di scomodo deve incontrarlo subito.
 */
export const VISIBILITA_DOMANDE: Record<"studenti" | "docenti", string> = {
  studenti: "Le tue domande non sono pubbliche: le vedi tu, le riceve chi ha organizzato la diretta, e le legge KIREO.",
  docenti: "Le tue domande non sono pubbliche, ma non sono anonime: chi ha organizzato la diretta vede il tuo nome. Le legge anche KIREO.",
};

export type CausaRifiutoDomanda = "sessione_persa" | "fuori_diretta" | "non_iscritto" | "guasto";
export const TESTO_RIFIUTO_DOMANDA: Record<CausaRifiutoDomanda, string> = {
  sessione_persa: "Il tuo accesso qui non è più valido, quindi la domanda non è arrivata. Rientra e mandala di nuovo: il testo resta qui.",
  fuori_diretta: `La diretta è finita, e le domande si mandano mentre è aperta. Se c'è una domanda finale la trovi qui sotto: hai ${ORE_FINESTRA_CONSEGNA} ore per rispondere.`,
  non_iscritto: "Per mandare una domanda devi essere iscritto a questo incontro.",
  guasto: "La domanda non è arrivata per un problema nostro, non tuo. Riprova fra un momento.",
};
// 42501 è la RLS che respinge l'insert: senza sessione vuol dire sessione persa;
// con la sessione, la policy non ammette la domanda — fuori dalla finestra o
// senza iscrizione, e la pagina sa se la diretta è aperta. Ogni altro errore è
// nostro.
export function causaRifiutoDomanda({
  codice,
  sessioneViva,
  direttaAperta,
}: {
  codice: string | null;
  sessioneViva: boolean;
  direttaAperta: boolean;
}): CausaRifiutoDomanda {
  if (!sessioneViva) return "sessione_persa";
  if (codice !== "42501") return "guasto";
  return direttaAperta ? "non_iscritto" : "fuori_diretta";
}

/**
 * Quanto prima o dopo la fine PROGRAMMATA è arrivato il segnale di fine. È la
 * cosa che rende la riga leggibile: «finito alla fine» e «finito a metà» sono
 * due fatti diversi, e la sola presenza della riga non li distingue. Puro.
 */
export function rispettoAllaFine(dataFine: string | null, adesso: Date): string {
  if (!dataFine) return "l'incontro non ha un orario di fine";
  const minuti = Math.round((adesso.getTime() - new Date(dataFine).getTime()) / 60_000);
  if (minuti === 0) return "alla fine programmata";
  return minuti < 0 ? `${-minuti} min prima della fine programmata` : `${minuti} min dopo la fine programmata`;
}
