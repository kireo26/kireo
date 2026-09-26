// KIREO — Sezione Guide: config dei contenuti (client-safe: niente fs, niente
// segreti). Ogni area (le 18 di data/aree.ts) ha fino a TRE guide di
// orientamento in PDF, di profondità crescente:
//   1 — Panoramica            (sempre disponibile)
//   2 — Le strade dentro l'area (si sblocca quando l'area si rafforza)
//   3 — Come partire davvero   (si sblocca quando l'area è consolidata)
//
// I PDF sono prodotti a parte (stile KIREO) e vivono in public/guide/<area>/
// <livello>.pdf — serviti staticamente da Vercel, stesso pattern dei kit
// workshop (public/materiali/...). La disponibilità del FILE è dichiarata in
// GUIDE_PRONTE (sotto), non letta con fs: deterministica e indipendente
// dall'ambiente. Questo config descrive le guide che CONCETTUALMENTE esistono,
// i loro titoli, la disponibilità del PDF e la regola di sblocco.
//
// I titoli dei tre livelli sono fissi; i sottotitoli sono generati dal nome
// dell'area, con override opzionali per-area in GUIDE_OVERRIDE (personalizzare
// una guida = aggiungere una riga lì, senza toccare la logica).

import { AREE, getAreaBySlug } from "@/data/aree";

export type LivelloGuida = 1 | 2 | 3;

export type Guida = {
  areaSlug: string;
  livello: LivelloGuida;
  titolo: string;
  sottotitolo: string;
  pdf: string; // URL statico: "/guide/<area>/<livello>.pdf"
};

// Nome fisso di ciascun livello + template del sottotitolo (riceve il nome area).
const LIVELLI: Record<LivelloGuida, { titolo: string; sottotitolo: (nome: string) => string }> = {
  1: { titolo: "Panoramica", sottotitolo: (n) => `Cos'è ${n} e se può fare per te.` },
  2: { titolo: "Le strade dentro l'area", sottotitolo: (n) => `I percorsi e i mestieri dentro ${n}.` },
  3: { titolo: "Come partire davvero", sottotitolo: (n) => `I primi passi concreti per ${n}.` },
};

// Personalizzazioni testuali per-area (vuoto oggi: i template bastano). Esempio:
// "informatica-digitale": { 2: { sottotitolo: "Sviluppo, dati, reti, sicurezza." } }
export const GUIDE_OVERRIDE: Record<string, Partial<Record<LivelloGuida, Partial<Pick<Guida, "titolo" | "sottotitolo">>>>> = {};

const LIVELLI_ORDINE: LivelloGuida[] = [1, 2, 3];

// Le tre guide di un'area (sempre tutte e tre: la disponibilità del PDF è
// un'altra cosa, vedi disponibilita.ts).
export function guideDiArea(areaSlug: string): Guida[] {
  const nome = getAreaBySlug(areaSlug)?.nome ?? areaSlug;
  return LIVELLI_ORDINE.map((livello) => {
    const ov = GUIDE_OVERRIDE[areaSlug]?.[livello];
    return {
      areaSlug,
      livello,
      titolo: ov?.titolo ?? LIVELLI[livello].titolo,
      sottotitolo: ov?.sottotitolo ?? LIVELLI[livello].sottotitolo(nome),
      pdf: percorsoGuida(areaSlug, livello),
    };
  });
}

// Dove vive il PDF di una guida, e la ragione per cui i tre livelli non stanno
// nello stesso posto.
//
// LIVELLO 1 — `public/guide/<area>/1.pdf`, statico, aperto anche da anonimo:
// è il magnete del funnel su /aree/<slug> **e l'indirizzo che finisce nelle
// email di follow-up**. Un'email resta nella casella per sempre e può essere
// inoltrata: quell'URL non si sposta mai più.
//
// LIVELLI 2 e 3 — `content/guide/<area>/<livello>.pdf`, FUORI da public/, letti
// dal server e serviti da /api/guide/<area>/<livello> dietro il cancello.
// Restavano in public/ fino al 2026-09-26, quindi si scaricavano da chiunque
// conoscesse l'indirizzo, anonimo compreso: `statoSblocco` non era un cancello
// ma un bottone in meno. **Non li abbiamo lasciati là con una guardia davanti**
// perché una guardia su un percorso che la CDN può servire da sé è verde in
// ogni prova e assente là fuori — e quello è il difetto che non si vede. Qui
// invece non esiste nessuna copia raggiungibile senza passare dal cancello.
export function percorsoGuida(areaSlug: string, livello: LivelloGuida): string {
  return livello === 1 ? `/guide/${areaSlug}/1.pdf` : `/api/guide/${areaSlug}/${livello}`;
}

export const TUTTE_LE_GUIDE: Guida[] = AREE.flatMap((a) => guideDiArea(a.slug));

// ─────────────────────────────────────────── Disponibilità del PDF (config, non fs)
//
// Quali guide hanno il PDF reale già caricato in public/guide/<area>/<livello>.pdf.
// DELIBERATAMENTE dichiarato qui, non letto con fs.existsSync: su Vercel i file di
// public/ sono serviti dalla CDN ma NON sono garantiti nel filesystem della
// funzione serverless a runtime, quindi una lettura fs sarebbe non deterministica
// in produzione. Rendere una guida disponibile = caricare il PDF nel repo E
// aggiungere/estendere la sua riga qui (una riga, coerente col resto del config).
//
export const GUIDE_PRONTE: Record<string, LivelloGuida[]> = {
  "informatica-digitale": [1, 2, 3], // PDF in public/guide/informatica-digitale/{1,2,3}.pdf
  "salute-professioni-sanitarie": [1, 2, 3],
  "ristorazione-turismo": [1, 2, 3],
  "meccanica-meccatronica": [1, 2, 3],
  "agrifood-ambiente": [1, 2, 3],
  "arte-design-moda": [1, 2, 3],
  "musica-spettacolo": [1, 2, 3],
  "energia-sostenibilita": [1, 2, 3],
  "edilizia-architettura": [1, 2, 3],
  "economia-management": [1, 2, 3],
  "giurisprudenza-pa": [1, 2, 3],
  "mobilita-sostenibile": [1, 2, 3],
  "scienze-educazione": [1, 2, 3],
  "comunicazione-media": [1, 2, 3],
  "scienze-ricerca": [1, 2, 3],
  "sicurezza-difesa": [1, 2, 3],
  "lingue-relazioni-internazionali": [1, 2, 3],
  "studi-umanistici-beni-culturali": [1, 2, 3],
};

export function guidaPronta(areaSlug: string, livello: LivelloGuida): boolean {
  return (GUIDE_PRONTE[areaSlug] ?? []).includes(livello);
}

// Il PERCORSO della Guida 1 di un'area: il PDF reale dove esiste, altrimenti il
// segnaposto generato da /api/guida/<area> — che dice di sé, per iscritto, di
// non essere ancora la guida vera.
//
// PERCHÉ È UNA FUNZIONE SOLA. Questa scelta era scritta a mano in TRE posti (il
// lead-magnet pubblico, il chip «Scarica la guida» in area privata, il
// follow-up via email) con due meccanismi diversi — `guidaPronta` in uno, un
// elenco di slug passato come prop nell'altro — e il terzo se ne era
// dimenticato: l'email mandava il segnaposto a chi aveva appena scaricato la
// guida vera dalla pagina. Un documento che dichiara di non esistere, spedito
// all'indirizzo di una persona, dove resta e da dove può essere inoltrato.
// *Il difetto non era la riga: era che quell'email non la riceve mai nessuno di
// noi, e un percorso che non si attraversa può dire qualunque cosa e restare
// verde per settimane.*
//
// Restituisce un percorso RELATIVO: chi deve mandarlo fuori dal sito lo
// prefissa con SITE_URL. La scelta fra vero e segnaposto invece sta solo qui —
// `npm run test:guide` pretende che i consumatori la chiamino invece di
// riscriverla, in qualunque forma.
export function percorsoGuidaUno(areaSlug: string): string {
  return guidaPronta(areaSlug, 1) ? percorsoGuida(areaSlug, 1) : `/api/guida/${areaSlug}`;
}

// ─────────────────────────────────────────── Regola di sblocco (gate)
//
// ACCESO dal 2026-09-26 (decisione di Mario). Fino a quel giorno valeva
// `false`, e con la bandiera spenta `CardGuida` faceva `gateAttivo && !sbloccata`
// → non bloccava mai, nemmeno visivamente: la regola qui sotto era scritta e non
// governava niente.
//
// ACCENDERE UNA BANDIERA TOGLIE A QUALCUNO QUALCOSA CHE AVEVA IERI, e quella è
// l'unica cosa che un cancello non deve mai fare. Per questo `statoSblocco`
// guarda PRIMA se la guida è già stata scaricata: chi ce l'ha se la tiene. Non è
// cortesia, è la stessa clausola dei cancelli del percorso — *il cancello guarda
// chi entra per la prima volta, non chi rientra* — e non serve nessuna eccezione
// per data, perché il fatto è già nei dati (`activity_log.livello`).
export const GATE_GUIDE_ATTIVO = true;

// Soglie numeriche di BACKUP (tarabili): usate in aggiunta ai segnali d'azione,
// così un'area che si scalda molto sblocca anche senza aver ancora fatto T3/una
// missione. Da ritarare sull'uso reale.
export const SOGLIA_L2_INTEREST = 40;
export const SOGLIA_L3_INTEREST = 65;
export const SOGLIA_CONF_ALTA = 0.8;

export type StatoArea = "emergente" | "confermata" | "da_verificare";

export type SegnaleGuida = {
  status: StatoArea | null; // null = area non ancora in area_signal
  interestScore: number; // 0..100
  confidence: number; // 0..1
  t3Completato: boolean;
  missioniBloccoCompletate: number;
  // I livelli di QUEST'AREA che lo studente ha già aperto, letti da
  // `activity_log` (tipo_attivita='download_guida', colonna `livello`). Servono a
  // due cose distinte: la clausola «una guida già scaricata resta sua» e la
  // sequenza (non si salta l'ordine). Il fatto esisteva già con la granularità
  // giusta — `activity_log` ha un cap DB su `coalesce(livello,0)` scritto apposta
  // perché le tre guide di un'area producano tre righe al giorno invece di una —
  // e nessuno dei due sapeva di averlo mentre progettava di costruirlo.
  giaAperte: LivelloGuida[];
};

// `causa` esiste perché la PAGINA deve sapere quale passo offrire, e la
// differenza fra i due non è di grado: la sequenza si chiude aprendo la guida
// che è già lì, il merito mandando lo studente altrove. Prima quella differenza
// viveva solo dentro `motivo`, cioè in una frase — e l'unico modo di leggerla
// sarebbe stato cercarci una parola dentro, che è il modo in cui un controllo
// smette di funzionare al primo che riscrive il testo.
export type CausaSblocco = "aperta" | "sequenza" | "merito";
export type StatoSblocco = { sbloccata: boolean; motivo: string; causa: CausaSblocco };

// Guida 2 — l'area «si rafforza». Sbloccata se lo studente ha COMPLETATO T3, o
// ≥1 missione del blocco, o l'area è confermata / da_verificare (segnali forti,
// anche se con tensione interna), o supera la soglia d'interesse di backup.
function sbloccoL2(s: SegnaleGuida): StatoSblocco {
  if (s.t3Completato) return { sbloccata: true, motivo: "Sbloccata: hai completato «Più a fondo».", causa: "aperta" };
  if (s.missioniBloccoCompletate >= 1) return { sbloccata: true, motivo: "Sbloccata: hai completato una missione di quest'area.", causa: "aperta" };
  if (s.status === "confermata" || s.status === "da_verificare") return { sbloccata: true, motivo: "Sbloccata: l'area si è rafforzata nel tuo profilo.", causa: "aperta" };
  if (s.interestScore >= SOGLIA_L2_INTEREST) return { sbloccata: true, motivo: "Sbloccata: l'area si sta rafforzando.", causa: "aperta" };
  return { sbloccata: false, motivo: "Si sblocca quando l'area si rafforza — fai «Più a fondo» o prova una missione.", causa: "merito" };
}

// Guida 3 — l'area «si consolida». Sbloccata se l'area è confermata (o
// da_verificare con confidenza alta) E hai completato ≥1 missione del blocco.
// La soglia d'interesse alta resta come backup.
function sbloccoL3(s: SegnaleGuida): StatoSblocco {
  const consolidata = s.status === "confermata" || (s.status === "da_verificare" && s.confidence >= SOGLIA_CONF_ALTA);
  if (consolidata && s.missioniBloccoCompletate >= 1) return { sbloccata: true, motivo: "Sbloccata: area consolidata e missione completata.", causa: "aperta" };
  if (s.interestScore >= SOGLIA_L3_INTEREST && s.missioniBloccoCompletate >= 1) return { sbloccata: true, motivo: "Sbloccata: interesse alto e missione completata.", causa: "aperta" };
  if (!consolidata && s.interestScore < SOGLIA_L3_INTEREST) return { sbloccata: false, motivo: "Si sblocca quando l'area è consolidata e hai completato una missione.", causa: "merito" };
  if (s.missioniBloccoCompletate < 1) return { sbloccata: false, motivo: "Ci sei quasi: manca una missione di quest'area.", causa: "merito" };
  return { sbloccata: false, motivo: "Si sblocca quando l'area è consolidata e hai completato una missione.", causa: "merito" };
}

// L'ORDINE DEI TRE CONTROLLI È LA REGOLA, non un dettaglio di scrittura.
//
//  1. la Panoramica è sempre aperta (anche da anonimo: è il magnete del funnel);
//  2. **una guida già scaricata resta sua** — prima di tutto il resto, perché
//     accendere la bandiera non deve togliere niente a chi ce l'aveva ieri. Sta
//     sopra anche alla sequenza: chi ha preso la 2 quando il cancello era spento,
//     senza aver mai aperto la 1, non deve trovarsela chiusa oggi;
//  3. **la sequenza** (non si salta l'ordine) prima delle condizioni di merito,
//     perché il passo che manca è quello che si può fare subito e gratis: dire
//     «prima leggi la 1» è più utile di «fai una missione», e se si dicessero
//     insieme la persona leggerebbe la seconda.
//
// La sequenza è PER AREA, non globale: aver aperto la 1 di `salute` non apre la 2
// di `informatica`. Chi ha scaricato la 1 da anonimo non risulta averla aperta, e
// va bene così — la riapre da dentro in tre secondi, e l'alternativa sarebbe
// legare un download anonimo a una persona.
//
// LA FRASE CHE DESCRIVE QUESTA REGOLA STA QUI SOTTO, e non nelle due pagine che
// la mostrano — vedi TESTO_SBLOCCO_GUIDE. Chi cambia la regola ce l'ha sotto gli
// occhi: è l'unica cura che funziona su una frase che non si può generare.
export function statoSblocco(livello: LivelloGuida, s: SegnaleGuida): StatoSblocco {
  if (livello === 1) return { sbloccata: true, motivo: "Sempre disponibile.", causa: "aperta" };
  if (s.giaAperte.includes(livello)) return { sbloccata: true, motivo: "L'hai già scaricata: resta tua.", causa: "aperta" };

  const precedente = (livello - 1) as LivelloGuida;
  if (!s.giaAperte.includes(precedente)) {
    return {
      sbloccata: false,
      motivo: `Si apre dopo la Guida ${precedente} di quest'area: aprila e torna qui.`,
      causa: "sequenza",
    };
  }

  return livello === 2 ? sbloccoL2(s) : sbloccoL3(s);
}

// ─────────────────────────────────────────── La frase che descrive la regola
//
// PERCHÉ ESISTE, e perché sta QUI e non nelle pagine. Fino al 2026-09-26 la
// regola era riassunta a mano in DUE punti — l'introduzione di /app/guide e
// quella di /app/guide/<area> — e tutte e due dicevano solo la metà del MERITO
// («si aprono man mano che l'area si rafforza… con "Più a fondo" o con una
// missione»). Quando è arrivata la sequenza, `statoSblocco` è stato aggiornato e
// le due frasi no: la pagina dichiarava una regola e la card un'altra, **e la
// persona che ci è finita dentro aveva fatto la missione**, quindi secondo
// l'introduzione la Guida 2 doveva essere aperta. Non due copie di un testo: due
// DESCRIZIONI della stessa regola, di cui nessuna aggiornata.
//
// NON SI PUÒ GENERARE, e vale la pena sapere perché: questa frase descrive la
// regola in generale, mentre `motivo` parla dello stato di UNO studente. Quindi
// la cura non è derivarla — è (1) farla vivere accanto alla regola, così chi
// tocca l'una vede l'altra, e (2) **non farle enumerare i segnali**. L'elenco dei
// modi di sbloccare ha quattro voci alternative e cambia; la sequenza no. La
// frase dice quello che resta vero e rimanda dove la verità è generata: la card,
// che il suo `motivo` non lo scrive a mano.
//
// `npm run test:guide` pretende che non nomini nessun segnale: il giorno in cui
// qualcuno vuole rimetterli, deve togliere la guardia — cioè deciderlo.
//
// LE DUE PAROLE CHE MARIO HA CAMBIATO RILEGGENDOLA, e la ragione di ognuna:
//   - «una alla volta» → «IN ORDINE». «Una alla volta» si legge anche come *ne
//     puoi tenere aperta una sola*, cioè che aprire la seconda chiude la prima —
//     e per chi guarda tre lucchetti è la lettura più naturale, non la più
//     strana. Non è quello che succede: aperta resta aperta.
//   - «ognuna dice cosa manca» → «ognuna TI dice cosa manca PER APRIRLA». La
//     prima descrive il sistema, la seconda gli dice dove guardare. È la stessa
//     differenza fra un paragrafo e un bottone.
// «Di profondità crescente» resta nelle due introduzioni: è la ragione per cui
// la scala esiste, ed è ciò che rende l'ordine sensato invece che burocratico.
export const TESTO_SBLOCCO_GUIDE =
  "La prima è pronta da subito; le altre si aprono in ordine, e ognuna ti dice cosa manca per aprirla.";
