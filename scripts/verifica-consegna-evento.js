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
//   - il PESO (1,0) e il vincolo che lo limita (Σpeso >= 4 per entrare nelle
//     affinità): il numero è scelto e non misurato, e il giorno in cui qualcuno
//     lo alza deve vedere l'aritmetica accanto;
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

let falliti = 0;
function ok(cond, testo) {
  console.log(`  ${cond ? "✓" : "✗"} ${testo}`);
  if (!cond) falliti++;
}

const leggi = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
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

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
