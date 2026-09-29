// La consegna di una diretta: le proprietà che si possono provare senza rete.
//
// PERCHÉ ESISTE. Il pezzo che vale — «una consegna produce una prova d'AREA,
// mai una prova senza area» — ha due metà: una in SQL (tre guardie, provate da
// scripts/verifica-consegna-evento.sql contro una replica) e una qui, nel codice
// che decide cosa arriva a quella funzione. Se il giudizio proponesse un'area che
// l'evento non ha, la funzione solleverebbe e la consegna resterebbe senza
// credito — quindi la whitelist non è una cortesia, è il pezzo che fa la
// differenza fra un credito e un guasto.
//
// E DUE COSE CHE SI DIMENTICANO, sorvegliate perché sono decisioni e non
// dettagli:
//   - il PESO (1,0) e l'aritmetica che lo rende leggibile (Σpeso >= 4 è metà
//     della barra delle affinità: l'altra metà, un interesse non nullo, per
//     questa strada non cade mai — vedi il §13): il numero è scelto e non
//     misurato, e il giorno in cui qualcuno lo alza deve vedere l'aritmetica
//     accanto;
//   - la PRESENZA non produce un segnale d'area, ed è deliberato. La prova è
//     ancorata al NUMERO (Σp >= 4 / confidence 0,40), non a una frase: il 27/09
//     un'ancora fatta di mezza frase trascritta è diventata rossa su un testo
//     giusto appena Mario l'ha riscritta.
//
// Esecuzione: `npm run test:consegna-evento`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");

abilitaTypeScript();

const { consegnaAperta, ORE_FINESTRA_CONSEGNA } = require("@/lib/live");
const {
  promptConsegnaEvento,
  leggiGiudizioConsegna,
  PESO_CONSEGNA_EVENTO,
  MIN_CARATTERI_CONSEGNA,
  MAX_CARATTERI_CONSEGNA,
} = require("@/lib/eventi/consegna");
const { TETTO_LETTURE_CONSEGNA, statoRilettura, testoRilettura, MESSAGGIO_TETTO } = require("@/lib/eventi/rilettura");
const { scadenzaConsegna } = require("@/lib/app/consegneDaFare");
const { eleggibilePerAffinita, SOGLIA_AFFINITA } = require("@/lib/percorso/stato");
const { RIPIEGHI_MOTIVAZIONE } = require("@/lib/escape/chiamaEscape");

let falliti = 0;
function ok(cond, testo) {
  console.log(`  ${cond ? "✓" : "✗"} ${testo}`);
  if (!cond) falliti++;
}

const leggi = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

// UN'ANCORA SU UNA FRASE DEL JSX SI ROMPE AL PRIMO A-CAPO DEL FORMATTATORE, e il
// rosso arriva su un testo GIUSTO. Successo il 28/09: cambiata una frase, il
// formattatore ha spezzato quella accanto su due righe, e un'asserzione
// preesistente è diventata rossa senza che nessuno avesse toccato il suo testo.
// Le ancore di FRASE si cercano quindi su una copia con gli spazi normalizzati;
// quelle di CODICE no, perché lì l'a-capo è informazione.
const frasiDi = (src) => src.replace(/\s+/g, " ");
const MIGRAZIONE = "supabase/migrations/20260927120000_consegna_evento.sql";
const sqlConsegna = leggi(MIGRAZIONE);
const sqlPresenze = leggi("supabase/migrations/20260726110000_diretta_presenze_domande.sql");
const tsLive = leggi("lib/live.ts");
const tsConsegna = leggi("lib/eventi/consegna.ts");

console.log("\n═══ LA CONSEGNA DI UNA DIRETTA ═══\n");

// ─────────────────────────────────────── 1. la finestra
console.log("1. La finestra: si apre a diretta finita, si chiude dopo N ore");

const INIZIO = "2026-10-01T18:00:00.000Z";
const FINE = "2026-10-01T19:00:00.000Z";
const fineMs = new Date(FINE).getTime();
const ORA = (ms) => new Date(ms);

ok(consegnaAperta(INIZIO, FINE, ORA(fineMs - 1)) === false, "un millisecondo prima della fine: chiusa");
ok(consegnaAperta(INIZIO, FINE, ORA(fineMs)) === true, "nell'istante della fine: aperta");
const finestraMs = ORE_FINESTRA_CONSEGNA * 60 * 60 * 1000;
ok(consegnaAperta(INIZIO, FINE, ORA(fineMs + finestraMs - 1)) === true, "un millisecondo prima della scadenza: ancora aperta");
ok(consegnaAperta(INIZIO, FINE, ORA(fineMs + finestraMs)) === false, "nell'istante della scadenza: chiusa");
// data_fine assente: lo stesso ripiego di evento_in_finestra_diretta (3 ore),
// così le due finestre non possono divergere sul significato di «fine».
const fineImplicita = new Date(INIZIO).getTime() + 3 * 60 * 60 * 1000;
ok(consegnaAperta(INIZIO, null, ORA(fineImplicita - 1)) === false, "senza data_fine il ripiego è 3 ore dall'inizio: prima è chiusa");
ok(consegnaAperta(INIZIO, null, ORA(fineImplicita)) === true, "…e da lì è aperta");

// LO SPECCHIO E L'ORIGINALE DEVONO DIRE LO STESSO NUMERO. `lib/live.ts` è
// dichiaratamente uno specchio di `consegna_evento_aperta`: due copie di una
// finestra divergono, e quella che diverge è quella che decide cosa mostrare —
// quindi un campo che appare e un insert che viene rifiutato.
// Le ore che la migrazione dichiara, lette dal suo testo: se ce ne fosse più di
// un valore diverso la finestra non sarebbe una sola cosa.
const oreSql = [...new Set([...sqlConsegna.matchAll(/interval '(\d+) hours'/g)].map((m) => Number(m[1])))];
ok(oreSql.includes(ORE_FINESTRA_CONSEGNA), `la migrazione usa lo stesso numero di ore dello specchio (${ORE_FINESTRA_CONSEGNA})`);
ok(
  new RegExp(`interval '3 hours'`).test(sqlConsegna) && /interval '3 hours'/.test(sqlPresenze),
  "il ripiego «fine assente» è lo stesso delle due finestre (3 ore)",
);

// ─────────────────────────────────────── 2. il prompt e la whitelist
console.log("\n2. Il prompt nomina SOLO le aree dell'evento");

const AREE_EVENTO = ["salute-professioni-sanitarie", "scienze-educazione"];
const prompt = promptConsegnaEvento("Il presidio che non c'è", "Cosa manca al tuo quartiere?", AREE_EVENTO);
for (const a of AREE_EVENTO) ok(prompt.includes(a), `il prompt elenca ${a}`);
ok(!prompt.includes("informatica-digitale"), "…e non elenca un'area che l'evento non ha");
ok(prompt.includes("Cosa manca al tuo quartiere?"), "il prompt porta la domanda posta dall'ente");
ok(prompt.includes("Il presidio che non c'è"), "…e il titolo dell'incontro");
ok(/lista "aree" VUOTA|VUOTA/.test(prompt), "il prompt dice che non riconoscere nessuna area è un esito legittimo");
ok(/webinar, non ha seguito un corso/.test(prompt), "…e che non sta giudicando le conoscenze");
ok(prompt.includes("giudizio_complessivo"), "lo slot esca anti-poscritto c'è, come nei revisori delle missioni");

// ─────────────────────────────────────── 3. il giudizio letto
console.log("\n3. Il giudizio: whitelist, peso, una dimensione sola");

const TESTO = "Nel mio quartiere l'ambulatorio è aperto 2 giorni a settimana e chi non ha la macchina non ci arriva.";
const DOMANDA = "Cosa manca al tuo quartiere?";

const buono = leggiGiudizioConsegna(
  { aree: [{ area_slug: "salute-professioni-sanitarie", performance: 0.8, motivazione: "Hai nominato un vincolo concreto." }] },
  AREE_EVENTO,
  TESTO,
  DOMANDA,
);
ok(buono.prove.length === 1, "un'area riconosciuta → una prova");
ok(buono.prove[0].dimensione === "performance", "…di dimensione performance");
ok(buono.prove.every((p) => p.dimensione === "performance"), "…e NESSUNA prova di interest: risponderà a una domanda posta da altri, non dichiara un interesse");
ok(buono.prove[0].peso === PESO_CONSEGNA_EVENTO, `…con peso ${PESO_CONSEGNA_EVENTO}`);
ok(buono.prove[0].valore === 0.8, "…e il valore del revisore");
ok(buono.chiaveAssente === false, "la chiave «aree» c'era");

const fuori = leggiGiudizioConsegna(
  { aree: [{ area_slug: "informatica-digitale", performance: 0.9, motivazione: "…" }] },
  AREE_EVENTO,
  TESTO,
  DOMANDA,
);
ok(fuori.prove.length === 0, "un'area che l'evento non ha → nessuna prova");
ok(fuori.scartate.includes("informatica-digitale"), "…e lo slug scartato finisce nell'elenco (è il PERCHÉ del «senza credito»)");

const senzaSlug = leggiGiudizioConsegna({ aree: [{ performance: 1 }] }, AREE_EVENTO, TESTO, DOMANDA);
ok(senzaSlug.prove.length === 0 && senzaSlug.scartate.includes("(slug assente)"), "una proposta senza slug è scartata e nominata");

const doppia = leggiGiudizioConsegna(
  {
    aree: [
      { area_slug: "scienze-educazione", performance: 0.5, motivazione: "a" },
      { area_slug: "scienze-educazione", performance: 0.9, motivazione: "b" },
    ],
  },
  AREE_EVENTO,
  TESTO,
  DOMANDA,
);
ok(doppia.prove.length === 1, "due proposte sulla stessa area → una prova sola (mai peso doppio per una consegna)");

const fuoriScala = leggiGiudizioConsegna(
  { aree: [{ area_slug: "scienze-educazione", performance: 7, motivazione: "x" }] },
  AREE_EVENTO,
  TESTO,
  DOMANDA,
);
ok(fuoriScala.prove[0].valore === 1, "un valore fuori scala viene riportato in [0,1] invece di far fallire l'insert");

ok(leggiGiudizioConsegna({}, AREE_EVENTO, TESTO, DOMANDA).chiaveAssente === true, "una risposta senza la chiave «aree» è un guasto NOSTRO, e si distingue");

// LE CIFRE: citabili sono quelle del testo dello studente e della domanda.
const conCifraSua = leggiGiudizioConsegna(
  { aree: [{ area_slug: "salute-professioni-sanitarie", performance: 0.7, motivazione: "I 2 giorni di apertura sono il vincolo che hai visto." }] },
  AREE_EVENTO,
  TESTO,
  DOMANDA,
);
ok(/2 giorni/.test(conCifraSua.prove[0].motivazione), "una cifra che sta nella sua risposta resta nella motivazione");
const conCifraInventata = leggiGiudizioConsegna(
  { aree: [{ area_slug: "salute-professioni-sanitarie", performance: 0.7, motivazione: "Con 4500 euro si risolverebbe." }] },
  AREE_EVENTO,
  TESTO,
  DOMANDA,
);
ok(!/4500/.test(conCifraInventata.prove[0].motivazione), "una cifra che NON sta né nella risposta né nella domanda: la motivazione va al ripiego");
ok(conCifraInventata.prove.length === 1, "…e il credito resta (si sostituisce la frase, non si butta la prova)");

// ─────────────────────────────────────── 4. una macchina sola
console.log("\n4. Il giudizio passa dalla macchina che esiste");

const codiceConsegna = senzaCommenti(tsConsegna);
ok(/from "@\/lib\/escape\/chiamaEscape"/.test(codiceConsegna), "il giudizio importa chiamaEscape");
ok(!/chiamaJson\s*\(/.test(codiceConsegna), "…e NON chiama chiamaJson da sé: una seconda cucitura sarebbe un secondo modo di trasformare un testo in prove");
ok(/cifreNonCitabili/.test(codiceConsegna), "…riusa il controllo sulle cifre invece di riscriverlo");
const codiceScoring = senzaCommenti(leggi("lib/escape/scoring.ts"));
ok(/from "@\/lib\/escape\/chiamaEscape"/.test(codiceScoring), "e anche le missioni importano da lì: una definizione sola");
const codiceChiamata = senzaCommenti(leggi("lib/escape/chiamaEscape.ts"));
ok(/REGOLA_SENZA_VOTO/.test(codiceChiamata), "la regola «chi legge non vede nessun numero» è appesa nella cucitura, quindi vale anche per la consegna");

// ─────────────────────────────────────── 5. mai una prova senza area
console.log("\n5. Mai una prova senza area: la porta è chiusa in tre punti");

const sqlPulito = senzaCommenti(sqlConsegna);
for (const [funzione, dove] of [
  ["imposta_domanda_consegna", "l'ente lo sa nel momento in cui pone la domanda"],
  ["puo_consegnare_evento", "lo studente non vede un campo che non produrrebbe niente"],
  ["registra_evidenze_consegna_evento", "il terminale che nessuno aggira"],
]) {
  const corpo = sqlPulito.slice(sqlPulito.indexOf(`function public.${funzione}`));
  const fine = corpo.indexOf("\n$$;");
  const testoFunzione = fine === -1 ? corpo : corpo.slice(0, fine);
  ok(/eventi_aree/.test(testoFunzione), `${funzione} controlla che l'evento abbia almeno un'area — ${dove}`);
}
ok(
  /raise exception 'evento_senza_aree'/.test(sqlPulito),
  "…e il terminale SOLLEVA invece di filtrare: un filtro silenzioso nasconderebbe un difetto del chiamante",
);
ok(/raise exception 'prova_fuori_aree/.test(sqlPulito), "una prova con l'area di un altro evento solleva, non viene scartata in silenzio");

// LA GUARDIA SULL'ARRAY VUOTO C'È. Non «sta prima del delete»: provato sulla
// replica, spostandola DOPO il delete le prove sopravvivono comunque, perché un
// `raise` dentro la funzione annulla la sottotransazione. Il difetto del 19/09 era
// una guardia ASSENTE — la funzione tornava con SUCCESSO e il profilo si svuotava.
// Un'asserzione sull'ordine sarebbe rossa su un codice che non ha nessun difetto:
// quella che conta è l'esistenza.
const corpoRegistra = sqlPulito.slice(sqlPulito.indexOf("function public.registra_evidenze_consegna_evento"));
ok(/nessuna_prova/.test(corpoRegistra), "la guardia «nessuna prova» esiste (assente, un array vuoto svuoterebbe il profilo riportando successo)");
ok(/delete from public.evidence/.test(corpoRegistra), "…e il delete che ricostruisce le prove c'è (full-recompute, come sulle gemelle)");

// ─────────────────────────────────────── 6. il peso, e la presenza che non lo prende
console.log("\n6. Il peso è scelto, e la presenza NON produce un segnale d'area");

ok(PESO_CONSEGNA_EVENTO === 1.0, "il peso di una consegna è 1,0");
// Ancorato all'ARITMETICA, non a una frase: Σpeso >= 4 è il vincolo che rende
// leggibile il numero, e un'ancora fatta di prosa diventa rossa alla prima
// riscrittura di un testo giusto.
for (const [nome, testo] of [
  [MIGRAZIONE, sqlConsegna],
  ["lib/live.ts", tsLive],
  ["lib/eventi/consegna.ts", tsConsegna],
  // Il posto più importante dei quattro: è QUI che l'heartbeat vive, quindi è qui
  // che la prima persona verrebbe a «collegare» la presenza al profilo.
  ["lib/useHeartbeatDiretta.ts", leggi("lib/useHeartbeatDiretta.ts")],
  ["supabase/migrations/20260726110000_diretta_presenze_domande.sql", sqlPresenze],
]) {
  ok(/0,40/.test(testo) && /Σp(eso)?\s*>=\s*4/.test(testo), `${nome} porta l'aritmetica che limita il peso (confidence 0,40 ⇔ Σpeso >= 4)`);
  // ⚠️ QUI NON CI VA UN DIVIETO LESSICALE SULLA FRASE FALSA, e la prima stesura
  // ce l'aveva messo. La frase «servono quattro consegne perché nasca
  // un'affinità» era scritta in quattro posti il 27/09 ed era falsa in tutti e
  // quattro — ma i file che la correggono devono CITARLA per spiegare perché era
  // sbagliata, e l'aritmetica che qui si pretende vive nei commenti, quindi non
  // si può leggere il sorgente spogliato. Un divieto così è rosso sui testi che
  // fanno la cosa giusta, cioè un controllo che qualcuno disattiva.
  // La conseguenza vera è tenuta ferma dalla §13, che la ESEGUE.
}
ok(
  /scelto e non misurato/i.test(sqlConsegna) && /scelta, e sta scritto che lo è/i.test(tsConsegna),
  "…e dichiara che il numero è scelto, non tarato su dati",
);
ok(/presenza/i.test(tsLive) && /segnale d'area/i.test(tsLive), "lo specchio della finestra dice perché la presenza non diventa un segnale d'area");

// ─────────────────────────────────────── 7. il testo prima del giudizio
console.log("\n7. Il testo si salva prima di essere giudicato");

const route = senzaCommenti(leggi("app/api/eventi/[id]/consegna/route.ts"));
const posInsert = route.indexOf('from("consegne_evento")');
const posGiudica = route.indexOf("giudicaConsegna(");
ok(posInsert !== -1 && posGiudica !== -1 && posInsert < posGiudica, "l'insert del testo viene PRIMA della chiamata al revisore");
ok(/code === "23505"/.test(route), "una seconda consegna non è un errore: si rigiudica il testo già salvato");
ok(/code === "42501"/.test(route), "…e un rifiuto della policy diventa un messaggio che dice quale passo manca");
ok(/statoPortaConsegna/.test(route), "…calcolato dal modulo condiviso, non riscritto qui");
ok(MIN_CARATTERI_CONSEGNA === 200 && MAX_CARATTERI_CONSEGNA === 4000, "i limiti di lunghezza sono quelli del vincolo su consegne_evento");
ok(
  new RegExp(`char_length\\(btrim\\(testo\\)\\) >= ${MIN_CARATTERI_CONSEGNA}`).test(sqlConsegna),
  "…e il minimo in SQL è lo stesso numero (un rifiuto su una lunghezza è il no che si può evitare dicendolo prima)",
);

// ─────────────────────────────────────── 8. le aree vuote: la porta e l'allarme
// Due cose, non una. La PORTA sta dove l'evento nasce (il form), perché è il
// posto in cui il vincolo costa una scelta a chi lo incontra. L'ALLARME sta dove
// il difetto si consuma (la chiusura della diretta), perché restano gli eventi
// già creati e una strada che non abbiamo visto.
console.log("\n8. Un evento per studenti senza aree: chiuso dove nasce, rumoroso dove si consuma");

const form = senzaCommenti(leggi("components/ente/CreaEventoForm.tsx"));
ok(
  /!perDocenti\s*&&\s*aree\.length\s*===\s*0/.test(form),
  "il form pretende almeno un'area su un evento per studenti (e mai su uno per docenti, che non deve averne)",
);
ok(/next\.aree\s*=/.test(form) && /errori\.aree/.test(form), "…e il no si vede accanto alle aree, non solo dentro validate()");
ok(/almeno una/.test(form), "…ed è annunciato nell'etichetta, prima che qualcuno ci sbatta contro");
ok(
  /error:\s*erroreAree/.test(form) && /setAreeNonSalvate/.test(form),
  "l'insert delle aree non ingoia più il proprio errore: l'evento c'è, e chi l'ha creato lo viene a sapere",
);

const ALLARME = "supabase/migrations/20260927130000_allarme_evento_senza_aree.sql";
const sqlAllarme = senzaCommentiSql(leggi(ALLARME));
ok(
  /select count\(\*\) into v_aree_evento from public\.eventi_aree/.test(sqlAllarme),
  "l'allarme conta le AREE, non le righe scritte (row_count è zero anche col cap giornaliero di activity_log: falso allarme)",
);
ok(!/get diagnostics/i.test(sqlAllarme), "…quindi row_count non compare affatto");
ok(
  /v_pubblico is distinct from 'docenti'/.test(sqlAllarme),
  "la condizione è la stessa del ramo che scrive il credito, NULL compreso (`is distinct from`, non `<>`)",
);
ok(/v_certificati > 0/.test(sqlAllarme), "…e suona solo se qualcuno ha davvero perso il credito");
ok(
  /exception when others then[\s\S]{0,400}raise warning/.test(sqlAllarme),
  "l'allarme è best-effort: se non si registra non si porta dietro la certificazione già fatta",
);

// LA TERZA LISTA. `npm run test:banco` tiene insieme le due liste JS (l'ordine e
// le glosse); nessuno finora confrontava le specie scritte dalle MIGRAZIONI con
// quelle che il codice conosce. Una specie che vive solo in SQL verrebbe stampata
// in fondo alla coda senza glossa, e il nome nuovo non aiuterebbe nessuno.
const specieSql = new Set();
for (const f of fs.readdirSync(path.join(ROOT, "supabase/migrations"))) {
  if (!f.endsWith(".sql")) continue;
  const testo = leggi(`supabase/migrations/${f}`);
  for (const m of testo.matchAll(/p_specie\s*=>\s*'([a-z_]+)'/g)) specieSql.add(m[1]);
}
const tsRegistra = leggi("lib/guasti/registra.ts");
const jsBanco = leggi("scripts/banco/guasti.js");
ok(specieSql.size > 0, `l'estrattore vede le specie scritte in SQL (${[...specieSql].join(", ") || "nessuna"})`);
for (const s of specieSql) {
  ok(new RegExp(`\\|\\s*"${s}"`).test(tsRegistra), `la specie SQL «${s}» è fra quelle che il codice conosce (SpecieGuasto)`);
  ok(new RegExp(`"${s}"`).test(jsBanco) && new RegExp(`\\b${s}:`).test(jsBanco), `…e il banco sa dire cosa vuol dire «${s}»`);
}

// ─────────────────────────────────────── 9. i testi, e dove finiscono
// Sono testi, quindi sono decisioni: qui si sorveglia che non tornino alla forma
// da cui sono stati corretti, perché a quella forma ci si torna per abitudine e
// la ragione per cui non va bene non è visibile rileggendo la frase.
console.log("\n9. I quattro testi della consegna, e la riga che dice dove finisce quello che scrive");

const consegnaTsx = senzaCommenti(leggi("components/live/ConsegnaEvento.tsx"));
const consegnaFrasi = frasiDi(consegnaTsx);
const routeTesti = senzaCommenti(leggi("app/api/eventi/[id]/consegna/route.ts"));

// Una consegna pesa ~1,0 → confidence ~0,10, e la barra è 0,40: mandare in home
// a cercare le affinità è mandare a cercare una cosa che non c'è.
ok(!/fra le aree della tua home/.test(routeTesti), "il messaggio di successo NON manda a cercare l'area in home");
ok(/non basta a dire qualcosa su di te/.test(routeTesti), "…e dice che una risposta sola non basta ancora");
// Le due forme corrette il 27/09, vietate e non solo sostituite: un conteggio
// («la prima cosa») diventa falso alla seconda consegna sulla stessa area, e
// un'area al singolare è falsa su un evento che ne ha due. Sono entrambe cose
// che si riscrivono per abitudine, e il motivo per cui non vanno bene non si
// vede rileggendo la frase.
ok(!/la prima cosa che hai scritto/.test(routeTesti), "…e non conta le consegne («la prima cosa» è falsa alla seconda)");
ok(!/su quest'area/.test(routeTesti), "…né nomina una sola area (un evento può averne due)");
// IL TITOLO È PARTE DELLA FRASE. A schermo c'è «Risposta consegnata» e sotto il
// messaggio: la versione del 27/09 ricominciava con le stesse due parole, e chi
// leggeva le leggeva due volte. Le due metà si controllano insieme, perché
// separate nessuna delle due è sbagliata.
ok(/>Risposta consegnata</.test(consegnaTsx), "sopra il messaggio c'è il titolo «Risposta consegnata»");
ok(!/messaggio:\s*\n?\s*"Risposta consegnata/.test(routeTesti), "…e il messaggio non lo ripete: continua da lì invece di ricominciare");
ok(/"Ed è entrata nel tuo profilo/.test(routeTesti), "…attaccandosi al titolo con una frase che senza di lui non starebbe in piedi");

// In un prodotto per minori il silenzio su chi legge non è neutro.
ok(/lo legge (?:solo )?KIREO/.test(consegnaFrasi), "il campo dice che quello che scrive lo legge KIREO");
ok(/organizzato la diretta non lo vede/.test(consegnaFrasi), "…e nomina il terzo su cui si fa la domanda: l'ente");
ok(
  !/legge solo KIREO|solo KIREO/.test(consegnaFrasi),
  "…e NON dice «solo KIREO»: è previsto che il docente dell'orientamento veda le attività dei suoi studenti, e «solo» diventerebbe falso senza che nessuno se ne accorga",
);
// E NON DICE «AFFINITÀ», che è il nome proprio della classifica in home — quella
// in cui una consegna, per scelta, non entra mai. Vietata e non solo sostituita:
// è la parola che viene in mente quando si pensa «profilo», ed è la stessa
// confusione che il 27/09 aveva prodotto il falso «servono quattro consegne».
ok(!/affinit/i.test(consegnaFrasi), "il campo NON nomina le affinità: è il nome di un posto in cui questa strada non entra");
ok(
  /per capire come affronti un problema/.test(consegnaFrasi),
  "…e dice cosa guardiamo davvero, che chiede al ragazzo di ragionare invece di dichiarare cosa gli piace",
);

// «Riprova fra un momento» funzionava solo finché la pagina restava aperta.
ok(!/Riprova fra un momento/.test(routeTesti), "il messaggio di guasto non consiglia più di riprovare e basta");
ok(/farla rileggere/.test(routeTesti), "…dice che si può far rileggere, che è quello che succede davvero");

const rileggi = leggi("components/live/RileggiConsegna.tsx");
const pagLive = senzaCommenti(leggi("app/app/eventi/[id]/live/page.tsx"));
ok(/api\/eventi\/\$\{eventoId\}\/consegna/.test(rileggi), "il bottone della rilettura passa dalla stessa route (nessuna seconda strada)");
ok(/RileggiConsegna/.test(pagLive) && /consegnaAperta\(/.test(pagLive), "la pagina lo mostra solo dentro la finestra");
ok(
  /valutata_il \? null :/.test(pagLive),
  "…e solo su una consegna non valutata (da quando «letta senza credito» viene segnata, quello stato vuol dire una cosa sola)",
);
ok(
  /segna_consegna_letta/.test(routeTesti),
  "il ramo «nessuna area riconosciuta» segna la consegna come letta: altrimenti l'invito a rileggerla sarebbe una porta che riporta sempre allo stesso posto, a pagamento",
);

const domandaTsx = senzaCommenti(leggi("components/ente/DomandaConsegnaForm.tsx"));
const domandaFrasi = frasiDi(domandaTsx);
ok(!/hanno seguito la diretta/.test(domandaFrasi), "il pannello dell'ente non dice più «hanno seguito la diretta» (il cancello chiede un ping)");
ok(/si sono collegati/.test(domandaFrasi), "…dice «si sono collegati», che è quello che succede");
ok(!/hanno seguito la diretta/.test(senzaCommenti(leggi("lib/eventi/portaConsegna.ts"))), "…e lo stesso vale nel testo che legge lo studente");
ok(/resta loro, tu vedi solo che è arrivato/.test(domandaFrasi), "i testi degli studenti non escono da KIREO, e all'ente lo si dice");
ok(
  /non si può rispondere bene restando generici/.test(domandaFrasi),
  "sopra il campo c'è la riga sulla forma della domanda (il placeholder si legge una volta, questa resta)",
);
ok(
  !/quale di questi servizi manca di più/.test(domandaFrasi),
  "l'esempio non è più una domanda d'opinione: a una domanda a cui si risponde senza aver guardato la diretta, la misura di attenzione diventa finta",
);

// ─────────────────────────────────────── 10. il terzo numero per l'ente
console.log("\n10. Il terzo numero sta dove l'ente già guarda");

const sqlVista = senzaCommentiSql(leggi("supabase/migrations/20260927140000_stats_risposte_evento.sql"));
ok(
  /\(select count\(\*\) from public\.consegne_evento ce where ce\.evento_id = e\.id\)/.test(sqlVista),
  "le risposte si contano con una sottoquery scalare",
);
ok(
  !/left join public\.consegne_evento/.test(sqlVista),
  "…e NON con un secondo left join, che moltiplicherebbe le righe e gonfierebbe iscritti e partecipati lasciandoli plausibili",
);
const selectVista = sqlVista.slice(0, sqlVista.indexOf("comment on view"));
ok(!/testo/.test(selectVista), "la vista non nomina mai il testo di una risposta: conta, non elenca");
const paginaStats = senzaCommenti(leggi("app/ente/(dashboard)/statistiche/page.tsx"));
ok(/\{s\.risposte\} risposte/.test(paginaStats), "la pagina mostra il numero in fila con iscritti e partecipati");
ok(/s\.domanda_posta \?/.test(paginaStats), "…e solo dove una domanda è stata posta (uno zero senza domanda sarebbe un fallimento che non c'è stato)");

// ─────────────────────── 11. il tetto delle letture (28/09)
// Ogni pressione del bottone «Fai rileggere la risposta» è una chiamata a
// pagamento. Fino al 28/09 l'unico limite era la finestra di 48 ore: dentro
// quella, premere venti volte era possibile e non costava niente a chi premeva.
console.log("\n11. Il tetto delle letture: quante volte si può far rileggere");

const sqlTetto = senzaCommentiSql(leggi("supabase/migrations/20260928100000_tetto_letture_consegna.sql"));
const routeTetto = senzaCommenti(leggi("app/api/eventi/[id]/consegna/route.ts"));
const pagTetto = senzaCommenti(leggi("app/app/eventi/[id]/live/page.tsx"));

// (a) LA COPIA DEL NUMERO. Il database non può importare TypeScript e la pagina
// non può fare un giro di rete per un intero, quindi le due copie esistono — e
// senza questo confronto esisterebbe una versione del tetto che dice allo
// studente un numero e gliene applica un altro.
const numeroSql = /create or replace function public\.tetto_letture_consegna\(\)[\s\S]*?select\s+(\d+)/.exec(sqlTetto);
ok(numeroSql !== null, "il numero del tetto si legge dalla migrazione");
if (numeroSql) {
  ok(
    Number(numeroSql[1]) === TETTO_LETTURE_CONSEGNA,
    `SQL e TypeScript dicono lo stesso tetto (SQL ${numeroSql[1]}, TS ${TETTO_LETTURE_CONSEGNA})`,
  );
}

// (b) L'INCREMENTO STA NELLA `where`, non in un conteggio letto prima e scritto
// dopo: è quello che chiude la corsa fra due pressioni simultanee al confine.
ok(
  /update public\.consegne_evento[\s\S]*?set letture_tentate = letture_tentate \+ 1[\s\S]*?and letture_tentate < public\.tetto_letture_consegna\(\)/.test(sqlTetto),
  "il tetto è una condizione dentro l'update che incrementa (nessun leggi-poi-scrivi)",
);
ok(/raise exception 'troppe_letture'/.test(sqlTetto), "…e a tetto pieno solleva un motivo con un nome suo");
ok(/if v_student is null then/.test(sqlTetto), "…e una sessione assente non alza il contatore di nessuno");
ok(
  /revoke all on function public\.apri_lettura_consegna\(uuid\) from public, anon;/.test(sqlTetto),
  "la funzione che scrive revoca anon (i default privileges di Supabase la concedono alla nascita)",
);
ok(
  /revoke all on function public\.tetto_letture_consegna\(\) from public, anon, authenticated;/.test(sqlTetto),
  "…e il numero non è chiamabile da fuori: il grant si dà a chi chiama, e da fuori non chiama nessuno",
);

// (c) L'ORDINE È LA PROPRIETÀ: il cancello sta PRIMA della chiamata a pagamento.
// Dentro `registra_evidenze_consegna_evento` i soldi sarebbero già spesi.
const iTetto = routeTetto.indexOf("apri_lettura_consegna");
const iGiudizio = routeTetto.indexOf("giudicaConsegna(");
ok(iTetto > 0 && iGiudizio > 0 && iTetto < iGiudizio, "la route alza il contatore PRIMA di giudicare");
// E se il contatore non si alza non si prosegue: fallire chiuso su una porta che
// protegge una spesa è il verso giusto.
const fraTettoEGiudizio = routeTetto.slice(iTetto, iGiudizio);
ok(/status: 500/.test(fraTettoEGiudizio), "…e un errore del contatore ferma la richiesta invece di lasciar spendere");
ok(/status: 429/.test(fraTettoEGiudizio), "…mentre il tetto pieno risponde 429 (un cancello che morde, non un guasto nostro)");
ok(/troppe_letture/.test(routeTetto), "la route riconosce il motivo del rifiuto e non lo mostra grezzo");

// (d) LA PAGINA non offre un bottone che risponderebbe sempre 429.
ok(/letture_tentate/.test(pagTetto), "la pagina legge il contatore");
ok(/statoRilettura\(/.test(pagTetto), "…e decide con la funzione condivisa invece di riscrivere il confronto");
ok(/rilettura === "si_puo"/.test(pagTetto), "…mostrando il bottone solo quando si può davvero");
ok(/erroreConsegna/.test(pagTetto), "…e una lettura fallita si logga: muta, sarebbe indistinguibile da «non ha consegnato»");

// (e) IL COMPORTAMENTO, non solo le stringhe: il tetto si guarda prima della
// finestra, perché «il tempo è passato» farebbe credere che con più tempo
// sarebbe andata.
ok(statoRilettura(0, true) === "si_puo", "a zero letture, dentro la finestra, si può");
ok(statoRilettura(TETTO_LETTURE_CONSEGNA - 1, true) === "si_puo", "…l'ultima lettura consentita si può ancora");
ok(statoRilettura(TETTO_LETTURE_CONSEGNA, true) === "tetto_pieno", "…al tetto no");
ok(statoRilettura(0, false) === "fuori_finestra", "fuori dalla finestra no");
ok(
  statoRilettura(TETTO_LETTURE_CONSEGNA, false) === "tetto_pieno",
  "…e quando valgono entrambi si dice il tetto, non la finestra (la finestra è incidentale)",
);
ok(
  testoRilettura("tetto_pieno").endsWith("scrivici da") && testoRilettura("fuori_finestra").endsWith("scrivici da"),
  "i due testi finiscono sulla cucitura del link a Contatti (la pagina lo aggiunge, uno script Node non lo può leggere)",
);
ok(
  /provato più volte/.test(MESSAGGIO_TETTO) && /problema nostro/.test(MESSAGGIO_TETTO),
  "il rifiuto dice cosa è successo e che è un problema nostro: la colpa non è di chi ha scritto",
);
ok(
  /messaggioGuasto/.test(routeTetto),
  "all'ultima lettura consentita il messaggio di guasto non invita più a ripremere un bottone che sta sparendo",
);

// (f) L'ESAURIMENTO SI REGISTRA. Lo studente sa che ci abbiamo provato cinque
// volte; noi no — e cinque fallimenti di fila sullo stesso testo sono il segnale
// più forte che qualcosa è rotto da questa parte. Senza, lo scopriremmo solo se
// qualcuno si lamentasse, cioè mai: nessuno scrive a un sito per dire che un
// bottone non ha funzionato.
ok(/specie: "consegna_esaurita"/.test(routeTetto), "l'esaurimento delle letture lascia un guasto con una specie sua");
ok(
  /if \(!ultimaLettura\) return;/.test(routeTetto),
  "…solo all'ultima lettura: una riga per ogni tentativo renderebbe illeggibile proprio quella che conta",
);
// Si registra alla QUINTA, non alla sesta pressione: il rifiuto `troppe_letture`
// arriva solo se lo studente riprova ancora, e un allarme che dipende da un
// gesto in più è un allarme che non suona.
const iTroppe = routeTetto.indexOf("troppe_letture");
const iUltima = routeTetto.indexOf("const ultimaLettura");
ok(iTroppe > 0 && iUltima > iTroppe, "…e non dal ramo che rifiuta la sesta pressione, che dipenderebbe da un gesto in più");
// LA PROPRIETÀ STRUTTURALE: nessun ramo può rispondere «non ci siamo riusciti»
// all'ultima lettura senza lasciare l'allarme. Un ramo nuovo aggiunto domani lo
// perderebbe in silenzio.
const ramiGuasto = [...routeTetto.matchAll(/messaggio: messaggioGuasto/g)].map((m) => m.index);
ok(ramiGuasto.length >= 2, `i rami che rispondono con il messaggio di guasto sono ${ramiGuasto.length}`);
ok(
  ramiGuasto.every((i) => /segnalaEsaurimento\(/.test(routeTetto.slice(Math.max(0, i - 400), i))),
  "…e ognuno di loro segnala l'esaurimento prima di rispondere",
);


// ── 12) LA PORTA: un evento finito dev'essere raggiungibile ────────────────
//
// PERCHÉ. Il 28/09, al primo giro con una persona: la consegna si apre quando
// la diretta finisce e resta aperta due giorni, e **non c'era nessuna strada
// per arrivarci** — l'unico link verso /app/eventi/<id>/live stava in
// `CardEvento`, che l'Agenda usa solo per gli eventi FUTURI. Mario ci è entrato
// solo con l'indirizzo preso dal database.
//
// È UNA SPECIE NUOVA: una funzione completa, corretta, provata, e senza porta.
// Nessun controllo poteva vederla — la pagina esiste, la rotta risponde, i
// permessi sono giusti, la finestra funziona. Mancava un `href`. Quindi qui non
// si prova che il codice sia corretto: si prova che la porta **sia appesa**.
console.log("\n12) La porta verso un evento finito");

const tsConsegne = senzaCommenti(leggi("lib/app/consegneDaFare.ts"));
const tsxBlocco = senzaCommenti(leggi("components/app/ConsegneDaFare.tsx"));
const blocco = frasiDi(tsxBlocco);
const pagHome = senzaCommenti(leggi("app/app/page.tsx"));
const pagAgenda = senzaCommenti(leggi("app/app/agenda/page.tsx"));

// (a) LA REGOLA NON È RISCRITTA. «La consegna è aperta per me» la sa già
// statoPortaConsegna: una seconda versione qui sarebbe la seconda definizione
// della stessa cosa, e divergerebbe.
ok(/statoPortaConsegna\(/.test(tsConsegne), "getConsegneDaFare chiama statoPortaConsegna invece di riscrivere la regola");
ok(/consegnaAperta\(/.test(tsConsegne), "…e usa la finestra condivisa di lib/live");
ok(!/48|ORE_FINESTRA_CONSEGNA\s*=/.test(tsConsegne.replace(/ORE_FINESTRA_CONSEGNA/g, "")), "…senza una seconda copia del numero di ore");
ok(/console\.error/.test(tsConsegne) && /return \[\]/.test(tsConsegne), "una lettura fallita si logga e non produce un invito (un bottone verso una porta chiusa è peggio di nessun bottone)");

// (b) LA PORTA È APPESA, in tutti e due i posti.
for (const [nome, pag] of [["la home", pagHome], ["l'Agenda", pagAgenda]]) {
  ok(/getConsegneDaFare\(/.test(pag), `${nome} chiede le consegne aperte`);
  ok(/<ConsegneDaFare/.test(pag), `…e ${nome} monta il blocco`);
}
ok(/href={`\/app\/eventi\/\$\{[^}]+\}\/live`}/.test(tsxBlocco), "il blocco porta davvero alla pagina dell'incontro");
ok(/consegne\.length === 0/.test(tsxBlocco) && /return null/.test(tsxBlocco), "…e sparisce quando non c'è niente da fare, invece di lasciare un riquadro vuoto");

// (b-bis) CHI HA CHIESTO SI NOMINA. La prima stesura diceva «è stata lasciata
// una domanda»: il passivo nasconde chi, e chi ha chiesto è tutto il punto —
// non è un compito che compare nella pagina, è una persona che aspetta. Quella
// differenza decide se il riquadro somiglia a un dovere o a un invito.
ok(/chi l&apos;ha fatta ti ha lasciato/.test(blocco), "il blocco dice CHI ha lasciato la domanda");
ok(!/è stata lasciata/.test(blocco), "…e non torna al passivo, che nasconde l'unica cosa che rende quel riquadro un invito");

// (c) E LA LISTA DEGLI EVENTI PASSATI non è più un elenco cieco: chi era
// iscritto ha un link, chi non lo era no — la pagina lo respingerebbe, e un
// link che porta a un no è peggio di nessun link. QUALE etichetta porti quel
// link, e quando non debba portarne nessuna, è il §16.
const iPassati = pagAgenda.indexOf("Eventi passati");
const codaAgenda = pagAgenda.slice(iPassati);
ok(iPassati > 0, "l'Agenda ha una sezione «Eventi passati»");
ok(/href={`\/app\/eventi\/\$\{[^}]+\}\/live`}/.test(codaAgenda), "…e un evento passato porta alla sua pagina");
ok(/iscritto: Boolean\(iscrizioni\[/.test(codaAgenda), "…solo per chi era iscritto");

// (d) IL COMPORTAMENTO: la scadenza che lo studente legge è la stessa finestra
// che il database applica, non un numero scritto accanto.
const INIZIO_C = "2026-10-01T18:00:00.000Z";
const FINE_C = "2026-10-01T19:00:00.000Z";
const atteso = new Date(new Date(FINE_C).getTime() + ORE_FINESTRA_CONSEGNA * 3600_000).toISOString();
ok(scadenzaConsegna(INIZIO_C, FINE_C) === atteso, "la scadenza mostrata è la fine della diretta più la finestra");
ok(
  scadenzaConsegna(INIZIO_C, null) === new Date(new Date(INIZIO_C).getTime() + 3 * 3600_000 + ORE_FINESTRA_CONSEGNA * 3600_000).toISOString(),
  "…e senza data_fine usa la stessa durata di ripiego di lib/live (3 ore), non un'altra",
);
ok(
  consegnaAperta(INIZIO_C, FINE_C, new Date(new Date(atteso).getTime() - 1000)) &&
    !consegnaAperta(INIZIO_C, FINE_C, new Date(new Date(atteso).getTime() + 1000)),
  "…e al momento che annuncia la porta si chiude davvero: la scadenza detta e quella applicata sono la stessa",
);


// ── 13) UNA CONSEGNA NON ENTRA NELLA CLASSIFICA, E NON È IL PESO ────────────
//
// La domanda di Mario il 28/09, dopo la sua prima consegna vera: la riga in
// `area_signal` era interest **null**, performance 100, confidence 0,100. E
// `eleggibilePerAffinita` chiede DUE cose — `confidence >= SOGLIA_AFFINITA` **e**
// `interest_score !== null`. Quindi un'area sostenuta solo da consegne non entra
// in classifica mai: la confidence sale, l'interesse resta nullo, la seconda
// condizione non cade.
//
// È UNA SCELTA, non un effetto collaterale: il prompt chiede `performance` e
// nient'altro, e la ragione sta in testa a lib/eventi/consegna.ts (che un'area
// INTERESSI non lo dice il fatto di aver risposto a una domanda posta da
// qualcun altro). Quello che era sbagliato è come la conseguenza era descritta.
//
// Qui si tiene ferma la conseguenza VERA, eseguendola: se un domani si volesse
// cambiarla, si cambia il prodotto e questo controllo lo dice.
console.log("\n13) Una consegna nel profilo, non nella classifica");

const confDi = (n) => Math.min(1, (n * PESO_CONSEGNA_EVENTO) / 10);
ok(PESO_CONSEGNA_EVENTO > 0 && SOGLIA_AFFINITA > 0, `peso ${PESO_CONSEGNA_EVENTO}, barra ${SOGLIA_AFFINITA}`);
ok(
  confDi(4) >= SOGLIA_AFFINITA,
  "quattro consegne portano la confidence ALLA barra…",
);
ok(
  [1, 4, 10, 100].every((n) => !eleggibilePerAffinita({ confidence: confDi(n), interest_score: null, performance_score: 100 })),
  "…e l'area non entra comunque, per nessun numero: la barra chiede anche un interesse, che questa strada non produce",
);
ok(
  eleggibilePerAffinita({ confidence: SOGLIA_AFFINITA, interest_score: 30 }),
  "…mentre con un interesse da un'altra parte la stessa confidence basta (è la seconda condizione, non la prima, a fermarla)",
);
// La dimensione è UNA, e il prompt è il posto in cui lo si vede.
ok(!/interest/i.test(prompt), "il prompt non chiede interesse: è quello che rende la conseguenza sopra una scelta e non una svista");
ok(/"performance"/.test(tsConsegna), "…e il tipo della prova ammette solo performance");

// ── 14) IL RIPIEGO NON RIPETE IL NOME DELL'AREA ─────────────────────────────
//
// Fino al 29/09 il ripiego della motivazione era «La tua risposta lavora su
// <Nome area>.», e la riga si legge dentro `AreeSfiorate`, che rende ogni voce
// come «**Nome area** — <frase>»: il nome usciva due volte nella stessa riga. La
// stessa ripetizione già corretta il 28/09 fra il titolo «Risposta consegnata» e
// il messaggio che lo ricopiava.
//
// Conta di più dal 29/09, per la stessa ragione del ripiego delle missioni: con
// il tetto di `MAX_MOTIVAZIONE` i ripieghi compaiono più spesso.
//
// DALLO STESSO GIORNO IL TESTO NON STA PIÙ QUI: i quattro ripieghi vivono
// insieme in `lib/escape/chiamaEscape.ts`, sotto la FORMA che devono rispettare
// — e la forma la tiene ferma `npm run test:revisore`, che li importa tutti e
// quattro. Qui resta la metà che quel controllo non può vedere: che sia proprio
// QUESTO punto a usare la voce giusta delle quattro, e non un'altra. Una frase
// riscritta a mano qui (o la chiave sbagliata) passerebbe là senza un rosso.
console.log("\n14) Il ripiego della motivazione, e il nome dell'area");

ok(
  /RIPIEGHI_MOTIVAZIONE\.consegnaEvento/.test(tsConsegna),
  `il ripiego viene dal posto in cui sta la forma, non riscritto qui: «${RIPIEGHI_MOTIVAZIONE.consegnaEvento}»`,
);
ok(!/const ripiego = ["'`]/.test(tsConsegna), "…e non c'è un letterale scritto a mano al suo posto");
ok(/risposta/i.test(RIPIEGHI_MOTIVAZIONE.consegnaEvento), "…e quella voce nomina il PROPRIO passo (la risposta), non un altro");
// LA PREMESSA SI VERIFICA: la proprietà sopra vale solo perché il componente
// prefissa già il nome. Se smettesse, staremmo gridando su niente.
ok(
  /\{v\.nome\}<\/span> — \{v\.testo\}/.test(leggi("components/escape/AreeSfiorate.tsx")),
  "premessa: AreeSfiorate rende «Nome area — testo», quindi nominare l'area nel ripiego la ripete",
);
// E che questa motivazione arrivi DAVVERO là non è dedotto: la lettura non
// filtra su `fonte`, e una consegna pesa più di una risposta di test.
//
// L'ANCORA È IL CORPO DI `motivazioniPiuPesanti`, non il file: altrove in
// stato.ts un `.eq("fonte", …)` c'è ed è legittimo (serve a `origine`, cioè a
// dire se il ritratto nasce dai test o da una missione). Guardando tutto il file
// questa asserzione era rossa su codice giusto — presa dal controllo stesso
// prima del commit, che è il modo in cui si scopre una taratura larga.
const statoTs = senzaCommenti(leggi("lib/percorso/stato.ts"));
const iMot = statoTs.indexOf("async function motivazioniPiuPesanti");
const corpoMot = iMot === -1 ? "" : statoTs.slice(iMot, statoTs.indexOf("\n}", iMot));
ok(iMot !== -1 && !/\.eq\("fonte"/.test(corpoMot), "…e la lettura delle motivazioni non filtra su `fonte`: una consegna può essere la più pesante e comparire lì");

// ── 15) LA FINESTRA DELLA DOMANDA ───────────────────────────────────────────
//
// Il 29/09 alle 12:23 l'ente ha premuto «Poni la domanda» quindici minuti prima
// della sua diretta e ha letto «adesso è troppo tardi (o troppo presto)». La
// finestra era `evento_in_finestra_diretta`: trenta minuti per un evento di un
// quarto d'ora, quindici dei quali l'ente li passa IN ONDA A PARLARE.
//
// Nessun controllo poteva trovarlo: la finestra funzionava, la guardia era
// corretta, il messaggio compariva quando doveva. Era giusta la macchina e
// sbagliato il momento in cui chiedeva una cosa a una persona. Quello che si può
// sorvegliare è il DOPO: che la finestra resti larga, che le altre due non si
// allarghino con lei, e che il rifiuto dica da che parte sei.
console.log("\n15) La domanda si scrive con calma, non in onda");

const { domandaModificabile, fineDiretta } = require("@/lib/live");
const {
  statoDomandaConsegna,
  testoPannelloDomanda,
  motivoRifiutoDomanda,
  testoRifiutoDomanda,
} = require("@/lib/eventi/domandaConsegna");

const INIZIO_D = "2026-10-01T13:00:00.000Z";
const FINE_D = "2026-10-01T13:15:00.000Z";
const tFine = new Date(FINE_D).getTime();
const quandoD = (delta) => new Date(tFine + delta);

// (a) IL COMPORTAMENTO. Giorni prima è scrivibile: è tutto il punto.
ok(domandaModificabile(INIZIO_D, FINE_D, new Date(tFine - 9 * 24 * 3600_000)), "nove giorni prima la domanda si può già scrivere");
ok(domandaModificabile(INIZIO_D, FINE_D, quandoD(-1000)), "…e un secondo prima della fine si può ancora cambiare");
ok(!domandaModificabile(INIZIO_D, FINE_D, quandoD(0)), "…alla fine della diretta no");
ok(fineDiretta(INIZIO_D, FINE_D) === FINE_D, "la fine della diretta è data_fine quando c'è");
ok(
  fineDiretta(INIZIO_D, null) === new Date(new Date(INIZIO_D).getTime() + 3 * 3600_000).toISOString(),
  "…e senza data_fine è la stessa durata di ripiego delle altre due finestre (3 ore), non un'altra",
);

// LE DUE FINESTRE SONO ADIACENTI E DISGIUNTE, ed è la proprietà che tiene in
// piedi la promessa della migrazione precedente: una domanda non cambia MAI
// sotto a chi sta già rispondendo. Si prova sull'istante di confine, non a
// parole.
for (const delta of [-1000, 0]) {
  const mod = domandaModificabile(INIZIO_D, FINE_D, quandoD(delta));
  const cons = consegnaAperta(INIZIO_D, FINE_D, quandoD(delta));
  ok(mod !== cons, `a ${delta}ms dalla fine, esattamente una delle due finestre è aperta (domanda ${mod}, consegna ${cons})`);
}
ok(
  !domandaModificabile(INIZIO_D, null, new Date(new Date(fineDiretta(INIZIO_D, null)).getTime())) &&
    consegnaAperta(INIZIO_D, null, new Date(new Date(fineDiretta(INIZIO_D, null)).getTime())),
  "…e il confine coincide anche senza data_fine",
);

// (b) LA MIGRAZIONE. Le altre due finestre non si allargano con questa: una
// domanda del pubblico e un battito di presenza fuori dalla diretta non sono la
// stessa cosa di una domanda finale preparata il giorno prima.
const sqlFinestra = senzaCommentiSql(leggi("supabase/migrations/20260929120000_finestra_domanda_consegna.sql"));
ok(/create or replace function public\.domanda_consegna_modificabile/.test(sqlFinestra), "la migrazione crea la finestra della domanda");
ok(
  /now\(\) < coalesce\(e\.data_fine, e\.data_inizio \+ interval '3 hours'\)/.test(sqlFinestra) && /e\.stato = 'approvato'/.test(sqlFinestra),
  "…dall'approvazione alla fine della diretta",
);
ok(/public\.domanda_consegna_modificabile\(p_evento_id\)/.test(sqlFinestra), "imposta_domanda_consegna usa la finestra nuova");
ok(!/evento_in_finestra_diretta/.test(sqlFinestra), "…e non passa più da quella stretta della diretta");
ok(
  !/create or replace function public\.evento_in_finestra_diretta/.test(sqlFinestra) &&
    !/create or replace function public\.ping_presenza_live/.test(sqlFinestra) &&
    !/create policy domande_live/.test(sqlFinestra),
  "…e gli altri due chiamanti della finestra stretta restano intatti",
);
// ⚠️ QUANDO GLI STUDENTI LA VEDONO NON CAMBIA: scriverla prima non vuol dire
// mostrarla prima.
// La NOMINA (in un `comment on function`, che è codice e non un commento) per
// dire dove si tocca con questa; quello che non deve fare è RIDEFINIRLA.
ok(
  !/create or replace function public\.consegna_evento_aperta/.test(sqlFinestra),
  "la finestra della CONSEGNA non viene ridefinita: gli studenti la vedono a diretta conclusa, come prima",
);
ok(
  /imposta_domanda_consegna\(p_evento_id uuid, p_domanda text\)/.test(sqlFinestra),
  "la firma resta (uuid, text): un parametro in più creerebbe un secondo overload invece di sostituirla",
);
for (const eccezione of ["evento_non_approvato", "domanda_non_piu_modificabile"]) {
  ok(new RegExp(`raise exception '${eccezione}'`).test(sqlFinestra), `…e i due rifiuti sono distinti: ${eccezione}`);
}
ok(
  /revoke all on function public\.domanda_consegna_modificabile\(uuid\) from public, anon/.test(sqlFinestra),
  "la funzione nuova revoca anon (i default privileges di Supabase la concedono a tutti)",
);

// (c) I TESTI. Un rifiuto deve dire da che parte sei E l'ora: il sistema le ha
// tutte e due. La parentesi che ammetteva di non saperlo non deve tornare.
const QUANDO_D = "1 ottobre 2026 alle ore 15:15"; // formattaDataOra(FINE_D, "long"), zona Roma
for (const stato of ["da_scrivere", "modificabile", "chiusa_con_domanda", "chiusa_senza_domanda"]) {
  ok(testoPannelloDomanda(stato, FINE_D).includes(QUANDO_D), `«${stato}» dice l'ora della fine della diretta`);
}
ok(/troppo tardi/.test(testoPannelloDomanda("chiusa_con_domanda", FINE_D)) === false, "…e nessuno dei testi torna a «troppo tardi»");
// SENZA COMMENTI, perché i due file CITANO il messaggio vecchio per spiegare
// perché era sbagliato: una guardia negativa letta sul sorgente grezzo grida
// sul testo che la rispetta (presa da questo controllo stesso, al primo giro).
const tsxDomanda = senzaCommenti(leggi("components/ente/DomandaConsegnaForm.tsx"));
const repoTesti = [senzaCommenti(leggi("lib/eventi/domandaConsegna.ts")), tsxDomanda].join("\n");
ok(!/adesso è troppo tardi \(o troppo presto\)/.test(repoTesti), "la parentesi che ammetteva di non sapere da che parte sei non esiste più");

// IL BUCO DETTO AD ALTA VOCE: approvato, e la domanda non c'è ancora. Prima
// durava quindici minuti ed era invisibile, adesso dura giorni.
const daScrivere = statoDomandaConsegna({ data_inizio: INIZIO_D, data_fine: FINE_D, domanda_consegna: null }, quandoD(-3 * 24 * 3600_000));
ok(daScrivere.stato === "da_scrivere" && daScrivere.modificabile, "tre giorni prima e senza domanda: «da scrivere»");
ok(/non hai ancora posto la domanda/i.test(daScrivere.testo), "…e il pannello lo dice, invece di lasciare il buco in silenzio");
const dimenticata = statoDomandaConsegna({ data_inizio: INIZIO_D, data_fine: FINE_D, domanda_consegna: null }, quandoD(3600_000));
ok(dimenticata.stato === "chiusa_senza_domanda" && !dimenticata.modificabile, "a diretta finita e senza domanda: chiusa");
ok(/non ci sarà una consegna/.test(dimenticata.testo), "…e lo dice, perché è la conseguenza vera di essersene dimenticati");
const posta = statoDomandaConsegna({ data_inizio: INIZIO_D, data_fine: FINE_D, domanda_consegna: "Una domanda vera." }, quandoD(-60_000));
ok(posta.stato === "modificabile" && /cambiarla/.test(posta.testo), "un minuto prima della fine la domanda posta si può ancora cambiare");

// (d) IL RIFIUTO, dal messaggio grezzo di PostgREST al testo.
ok(motivoRifiutoDomanda('… raise exception "domanda_non_piu_modificabile" …') === "domanda_non_piu_modificabile", "il motivo si riconosce dal messaggio");
ok(motivoRifiutoDomanda("qualcosa di mai visto") === "sconosciuto", "…e uno mai visto cade sul ripiego invece di indovinare");
ok(testoRifiutoDomanda("domanda_non_piu_modificabile", FINE_D).includes(QUANDO_D), "…e il rifiuto della corsa dice l'ora della fine");
ok(/non è ancora approvato/.test(testoRifiutoDomanda("evento_non_approvato", FINE_D)), "…e quello dell'evento non approvato dice cosa aspettare");

// (e) IL COLLEGAMENTO. Il form non riscrive i rami: li chiede al modulo, e per
// dire l'ora ha bisogno delle date — che le due pagine devono passargli.
ok(/statoDomandaConsegna\(/.test(tsxDomanda) && /testoRifiutoDomanda\(/.test(tsxDomanda), "il form chiede stato e rifiuti al modulo");
ok(!/setErrore\("La domanda si pone/.test(tsxDomanda), "…invece di riscriverseli dentro");
ok(/dataInizio/.test(tsxDomanda) && /dataFine/.test(tsxDomanda), "…e riceve le date, senza cui non potrebbe dire l'ora");
const tsxControllo = senzaCommenti(leggi("components/ente/ControlloDirettaEvento.tsx"));
ok(/dataInizio={dataInizio}/.test(tsxControllo) && /dataFine={dataFine}/.test(tsxControllo), "il pannello gliele passa");
for (const [nome, file] of [
  ["/ente/eventi", "app/ente/(dashboard)/eventi/page.tsx"],
  ["/admin", "app/admin/page.tsx"],
]) {
  const src = senzaCommenti(leggi(file));
  ok(/dataInizio={e\.data_inizio}/.test(src) && /dataFine={e\.data_fine}/.test(src), `${nome} passa le date al pannello`);
}

// ── 16) L'ETICHETTA DICE COSA C'È DIETRO ────────────────────────────────────
//
// «Rivedi l'incontro» prometteva una registrazione che non esiste e non abbiamo
// mai costruito: di là c'è la consegna, o la risposta già data, o nulla. Stessa
// specie del titolo che ripeteva il messaggio — un testo scritto guardando il
// posto in cui sta e non la cosa che ci trova chi lo segue.
//
// E LA RIGA CHE CONTA PIÙ DELLE ALTRE DUE: una porta che si apre su «La diretta
// è terminata» è peggio di nessuna porta. Chi la segue ha fatto un gesto e ha
// ricevuto meno di quello che aveva da fermo, e la volta dopo non la segue più —
// nemmeno quando di là c'è una domanda vera.
console.log("\n16) L'etichetta di un evento passato");

const {
  portaEventoPassato,
  getEventiConRisposta,
  ETICHETTA_RISPONDI,
  ETICHETTA_RIVEDI_RISPOSTA,
} = require("@/lib/app/portaEventoPassato");

ok(portaEventoPassato({ iscritto: false, haRisposto: false, consegnaAperta: true }) === null, "chi non era iscritto non ha link");
ok(
  portaEventoPassato({ iscritto: true, haRisposto: false, consegnaAperta: true })?.etichetta === ETICHETTA_RISPONDI,
  `consegna aperta e nessuna risposta: «${ETICHETTA_RISPONDI}»`,
);
ok(
  portaEventoPassato({ iscritto: true, haRisposto: true, consegnaAperta: false })?.etichetta === ETICHETTA_RIVEDI_RISPOSTA,
  `già risposto: «${ETICHETTA_RIVEDI_RISPOSTA}»`,
);
ok(portaEventoPassato({ iscritto: true, haRisposto: false, consegnaAperta: false }) === null, "niente da fare: nessun link");
ok(
  portaEventoPassato({ iscritto: true, haRisposto: true, consegnaAperta: true })?.etichetta === ETICHETTA_RIVEDI_RISPOSTA,
  "…e se fossero vere tutte e due vince la risposta salvata, che è quello che la pagina mostra davvero",
);
// NESSUNA ETICHETTA PROMETTE UNA REGISTRAZIONE. Non c'è, non l'abbiamo mai
// costruita, e la prima parola di quella vecchia era l'unica cosa che di là non
// si trova.
for (const e of [ETICHETTA_RISPONDI, ETICHETTA_RIVEDI_RISPOSTA]) {
  ok(!/rivedi l'incontro/i.test(e) && !/registrazione|replay/i.test(e), `«${e}» non promette una registrazione`);
}
// Senza commenti: il JSX dell'Agenda CITA l'etichetta vecchia per dire perché
// non c'è più.
ok(!/Rivedi l&apos;incontro|Rivedi l'incontro/.test(pagAgenda), "…e l'etichetta vecchia non è rimasta nell'Agenda");

// IL COLLEGAMENTO: l'Agenda non riscrive né l'etichetta né la regola. Quali
// consegne siano APERTE lo sa già `getConsegneDaFare`, che la pagina chiama
// comunque: ricalcolarlo qui sarebbe la seconda definizione della stessa cosa.
ok(/portaEventoPassato\(/.test(pagAgenda), "l'Agenda chiede l'etichetta al modulo");
ok(/getEventiConRisposta\(/.test(pagAgenda), "…e chi ha già risposto con una lettura sola");
ok(/consegneDaFare\.map\(\(c\) => c\.eventoId\)/.test(pagAgenda), "…e quali consegne sono aperte lo riusa da getConsegneDaFare invece di ricalcolarlo");
ok(!/Rispondi alla domanda|Rivedi la tua risposta/.test(pagAgenda), "…e i testi non sono ricopiati nel JSX");

(async () => {
  // LA LETTURA DEGRADA VERSO IL NIENTE: un link in meno, mai un link che porta
  // a una pagina che non ha quello che l'etichetta promette.
  const chain = (risposta) => {
    const c = { from: () => c, select: () => c, eq: () => c, in: () => c, then: (res) => res(risposta) };
    return c;
  };
  const con = await getEventiConRisposta(chain({ data: [{ evento_id: "e1" }], error: null }), "u1", ["e1", "e2"]);
  ok(con.has("e1") && !con.has("e2"), "getEventiConRisposta restituisce solo gli eventi con una risposta");
  const rotta = await getEventiConRisposta(chain({ data: null, error: { message: "boom" } }), "u1", ["e1"]);
  ok(rotta.size === 0, "…e una lettura fallita non inventa una risposta: insieme vuoto, quindi nessun link");
  ok((await getEventiConRisposta(chain({ data: [], error: null }), "u1", [])).size === 0, "…e con zero eventi non interroga nemmeno");

  console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
  process.exit(falliti === 0 ? 0 : 1);
})();
