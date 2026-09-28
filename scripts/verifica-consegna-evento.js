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
const { TETTO_LETTURE_CONSEGNA, statoRilettura, testoRilettura, MESSAGGIO_TETTO } = require("@/lib/eventi/rilettura");

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

// ─────────────────────────────────────── 9. i testi, e dove finiscono
// Sono testi, quindi sono decisioni: qui si sorveglia che non tornino alla forma
// da cui sono stati corretti, perché a quella forma ci si torna per abitudine e
// la ragione per cui non va bene non è visibile rileggendo la frase.
console.log("\n9. I quattro testi della consegna, e la riga che dice dove finisce quello che scrive");

const consegnaTsx = senzaCommenti(leggi("components/live/ConsegnaEvento.tsx"));
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

// In un prodotto per minori il silenzio su chi legge non è neutro.
ok(/lo legge (?:solo )?KIREO/.test(consegnaTsx), "il campo dice che quello che scrive lo legge KIREO");
ok(/organizzato la diretta non lo vede/.test(consegnaTsx), "…e nomina il terzo su cui si fa la domanda: l'ente");
ok(
  !/legge solo KIREO|solo KIREO/.test(consegnaTsx),
  "…e NON dice «solo KIREO»: è previsto che il docente dell'orientamento veda le attività dei suoi studenti, e «solo» diventerebbe falso senza che nessuno se ne accorga",
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
ok(!/hanno seguito la diretta/.test(domandaTsx), "il pannello dell'ente non dice più «hanno seguito la diretta» (il cancello chiede un ping)");
ok(/si sono collegati/.test(domandaTsx), "…dice «si sono collegati», che è quello che succede");
ok(!/hanno seguito la diretta/.test(senzaCommenti(leggi("lib/eventi/portaConsegna.ts"))), "…e lo stesso vale nel testo che legge lo studente");
ok(/resta loro, tu vedi solo che è arrivato/.test(domandaTsx), "i testi degli studenti non escono da KIREO, e all'ente lo si dice");
ok(
  /non si può rispondere bene restando generici/.test(domandaTsx),
  "sopra il campo c'è la riga sulla forma della domanda (il placeholder si legge una volta, questa resta)",
);
ok(
  !/quale di questi servizi manca di più/.test(domandaTsx),
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

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
