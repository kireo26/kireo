// La presenza si conta sulla DIRETTA, non sulla finestra in cui la pagina
// della diretta è viva.
//
// PERCHÉ ESISTE. Il 4/10, prima diretta vera del progetto: iscrizione alle
// 19:08:24, primo ping alle 19:08:31, evento programmato 19:15 → 19:20,
// quattro ping in tutto. Alle 19:20:15 il sistema ha certificato la presenza —
// e i quattro ping stavano TUTTI prima dell'inizio. `ping_attesi_evento` è la
// durata programmata in minuti (5), la soglia è il 75% (3,75 → 4 ping): la
// soglia è stata raggiunta senza un solo ping dentro la diretta.
//
// Non era una soglia troppo bassa: era il NUMERATORE raccolto su una finestra
// più larga del DENOMINATORE. E la causa è la specie di casa — `statoDiretta`
// dice `in_corso` da quindici minuti prima, con un commento che dichiara di
// servire «solo per decidere COSA MOSTRARE» (ed è giusto), e `PannelloLive`
// usava lo stesso valore per accendere l'heartbeat. Uno specchio scritto per
// una domanda, consumato per un'altra.
//
// La metà database sta in scripts/verifica-finestra-presenza.sql (13 proprietà
// contro una replica locale). Qui c'è la metà client, più la guardia che
// impedisce alle due metà di divergere.
//
// Esecuzione: `npm run test:presenza`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();
const { presenzaRilevabile, statoDiretta, testoAttesaDiretta } = require("@/lib/live");
const { RIPIEGHI_MOTIVAZIONE } = require("@/lib/escape/chiamaEscape");

let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
};

const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const pannello = leggi("components/live/PannelloLive.tsx");
const liveTs = leggi("lib/live.ts");
const migrazione = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20261004130000_presenza_dentro_la_diretta.sql"),
  "utf8",
);

// L'evento del 4/10, con le sue ore vere.
const INIZIO = "2026-10-04T17:15:00Z";
const FINE = "2026-10-04T17:20:00Z";
const ist = (s) => new Date(s);

console.log("\n═══ La presenza si conta sulla diretta ═══\n");

// ── 1) le due finestre, e dove divergono ────────────────────────────────────
console.log("1) Due domande, due funzioni");

ok(
  statoDiretta(INIZIO, FINE, ist("2026-10-04T17:08:31Z")) === "in_corso",
  "sette minuti prima, `statoDiretta` dice già `in_corso` — apposta: chi arriva prima vede il player comparire da sé",
);
ok(
  presenzaRilevabile(INIZIO, FINE, ist("2026-10-04T17:08:31Z")) === false,
  "…e `presenzaRilevabile` dice no. È l'istante esatto del primo ping del 4/10",
);
ok(
  presenzaRilevabile(INIZIO, FINE, ist("2026-10-04T17:15:00Z")) === true,
  "all'inizio esatto la presenza si conta (chi è lì quando comincia era lì)",
);
ok(
  presenzaRilevabile(INIZIO, FINE, ist("2026-10-04T17:19:59Z")) === true,
  "un secondo prima della fine, ancora sì",
);
ok(
  presenzaRilevabile(INIZIO, FINE, ist("2026-10-04T17:20:00Z")) === false,
  "alla fine esatta, no — la finestra si chiude dove la chiude il database",
);
ok(
  presenzaRilevabile(INIZIO, FINE, ist("2026-10-04T17:14:59Z")) === false &&
    statoDiretta(INIZIO, FINE, ist("2026-10-04T17:14:59Z")) === "in_corso",
  "un secondo prima dell'inizio le due divergono: ed è l'unico posto in cui lo fanno",
);

// La chiusura è lo stesso istante per tutte e due: se divergesse LÌ, un ping
// accettato dopo la fine non verrebbe contato da nessuno, o viceversa.
const dopo = ist("2026-10-04T17:25:00Z");
ok(
  presenzaRilevabile(INIZIO, FINE, dopo) === false && statoDiretta(INIZIO, FINE, dopo) === "conclusa",
  "dopo la fine sono d'accordo tutte e due: le due finestre chiudono sullo stesso istante",
);

// ── 2) il ripiego quando data_fine manca ────────────────────────────────────
console.log("\n2) Quando `data_fine` manca");

// Il ripiego è tre ore, come per tutte le sorelle di lib/live.ts e come nel
// database (`coalesce(data_fine, data_inizio + interval '3 hours')`). Se le due
// metà divergessero qui, un ping sarebbe accettato dal server e non mandato dal
// client (o il contrario) in una fascia di ore.
ok(
  presenzaRilevabile(INIZIO, null, ist("2026-10-04T19:00:00Z")) === true,
  "senza `data_fine`, un'ora e tre quarti dopo l'inizio la presenza si conta ancora",
);
ok(
  presenzaRilevabile(INIZIO, null, ist("2026-10-04T20:16:00Z")) === false,
  "…e oltre le tre ore no: lo stesso ripiego delle sorelle",
);
ok(
  presenzaRilevabile(INIZIO, null, ist("2026-10-04T17:10:00Z")) === false,
  "senza `data_fine` il pre-roll resta fuori: il ripiego riguarda la fine, non l'inizio",
);

// ── 3) l'heartbeat non dipende più da `statoDiretta` ────────────────────────
console.log("\n3) Chi accende l'heartbeat");

ok(
  /useHeartbeatDiretta\([^)]*contaLaPresenza/.test(pannello),
  "`PannelloLive` accende l'heartbeat su `contaLaPresenza`",
);
ok(
  /contaLaPresenza\s*=\s*presenzaDaContare\([^)]*\)\s*&&\s*inDiretta/.test(pannello),
  "…e `contaLaPresenza` richiede `inDiretta`, cioè `presenzaRilevabile`",
);
ok(
  /inDiretta\s*=\s*presenzaRilevabile\(dataInizio,\s*dataFine,\s*ora\)/.test(pannello),
  "…che riceve l'ora ricalcolata ogni 30s, non `new Date()` dentro il render",
);
// LA METÀ CHE SI DIMENTICA: che `statoDiretta` da solo non basti più. Senza
// questa, rimettere `stato === "in_corso" && presenzaDaContare(...)` lascerebbe
// verdi le tre di sopra.
const righeHeartbeat = pannello
  .split("\n")
  .filter((r) => r.includes("useHeartbeatDiretta(") && !r.includes("import"));
ok(righeHeartbeat.length === 1, `una sola riga accende l'heartbeat (trovate ${righeHeartbeat.length})`);
ok(
  righeHeartbeat.length === 1 && righeHeartbeat[0].includes("contaLaPresenza"),
  "…e quella riga non si accontenta di `stato`: il difetto del 4/10 era esattamente `stato === \"in_corso\"` da solo",
);

// ── 4) la riga che lo studente legge ────────────────────────────────────────
console.log("\n4) «In diretta» solo quando lo è");

ok(
  /inDiretta \? "In diretta" : testoAttesaDiretta\(dataInizio, ora\)/.test(pannello),
  "nei quindici minuti prima dell'inizio la riga non dice «In diretta», dice l'ORARIO",
);
ok(
  !/"Sta per iniziare"/.test(pannello),
  "e non è tornata la frase senza orario: «Sta per iniziare» dura quindici minuti e non dice quanto manca",
);
ok(
  /inDiretta \? "animate-pulse bg-red-500" : "bg-kireo-muted"/.test(pannello),
  "…e nemmeno il pallino rosso che lampeggia lo dice (un segno fatto di solo colore è un segno in meno, ma un segno falso è peggio)",
);
ok(
  /contaLaPresenza \? " · presenza in rilevamento" : ""/.test(pannello),
  "il rilevamento si dichiara solo mentre c'è: la riga non promette un conteggio che abbiamo fermato",
);

// ── 5) le due metà non devono divergere ─────────────────────────────────────
console.log("\n5) Lo specchio e il vetro");

// La proprietà: la finestra STRETTA, nel database, parte da `data_inizio`
// SENZA sottrazioni. Se qualcuno vi rimettesse i quindici minuti, lo specchio
// client resterebbe stretto e il server tornerebbe largo — e il difetto del
// 4/10 sarebbe di nuovo possibile da una richiesta a mano, senza che niente in
// TypeScript cambiasse.
const corpoStretta = /create or replace function public\.evento_in_diretta[\s\S]*?\$\$;/.exec(migrazione);
ok(corpoStretta !== null, "`evento_in_diretta` è definita nella migrazione");
if (corpoStretta) {
  const corpo = corpoStretta[0];
  ok(
    /now\(\) >= e\.data_inizio\s*$/m.test(corpo),
    "…e parte da `data_inizio` senza sottrazioni: nessun pre-roll nella finestra stretta",
  );
  ok(
    /coalesce\(e\.data_fine, e\.data_inizio \+ interval '3 hours'\)/.test(corpo),
    "…e chiude sullo stesso ripiego di tre ore dello specchio client",
  );
}

// `evento_in_finestra_diretta` NON si tocca: il suo altro chiamante vivo è la
// policy di insert su `domande_live`, e una domanda scritta nel pre-roll è
// legittima. Se questa riga diventa rossa, la cura ha stretto anche una cosa
// che nessuno aveva chiesto di stringere.
ok(
  !/create or replace function public\.evento_in_finestra_diretta/.test(migrazione),
  "la migrazione non ridefinisce `evento_in_finestra_diretta`: la finestra larga resta com'era",
);
ok(
  /if not public\.evento_in_diretta\(p_evento_id\)/.test(migrazione),
  "`ping_presenza_live` guarda la finestra stretta",
);
ok(
  !/evento_in_finestra_diretta\(p_evento_id\)/.test(migrazione),
  "…e non quella larga, da nessuna parte nel suo corpo",
);
ok(
  /raise exception 'evento_non_in_corso'/.test(migrazione),
  "l'eccezione conserva il nome che route e client già trattano come esito atteso",
);

// ── 6) la funzione sta in lib/live.ts, con le sorelle ───────────────────────
console.log("\n6) Dove vive");

ok(
  /export function presenzaRilevabile\(dataInizio: string, dataFine: string \| null, ora: Date = new Date\(\)\)/.test(
    liveTs,
  ),
  "`presenzaRilevabile` ha l'ora iniettabile come le sorelle: si prova con un istante fisso, e nel render non compare una chiamata impura",
);
ok(
  !/presenzaRilevabile/.test(leggi("lib/useHeartbeatDiretta.ts")),
  "l'hook non la richiama da sé: riceve un booleano, e chi sa le date è il pannello",
);

// ── 7) l'attesa ha un orario ────────────────────────────────────────────────
// Il pre-roll dura quindici minuti, e «Sta per iniziare» li copriva tutti: chi
// arriva alle 19:01 per una diretta delle 19:15 leggeva una frase che promette
// «adesso». Un'attesa con un orario è un'attesa; un'attesa senza è un dubbio.
console.log("\n7) L'attesa ha un orario");

ok(
  testoAttesaDiretta(INIZIO, ist("2026-10-04T17:05:00Z")) === "Comincia alle 19:15",
  "l'ora è quella di Roma, non quella della macchina: le 17:15 UTC si leggono «alle 19:15»",
);
ok(
  !/ottobre/.test(testoAttesaDiretta(INIZIO, ist("2026-10-04T17:05:00Z"))),
  "…e quando l'inizio è oggi non si nomina la data: nel pre-roll sarebbe rumore",
);
// Il bordo di mezzanotte: una diretta che comincia alle 00:05 italiane,
// guardata alle 23:52, è DOMANI — «Comincia alle 00:05» da solo farebbe
// credere a un orario già passato.
const DOPO_MEZZANOTTE = "2026-10-05T22:05:00Z"; // 00:05 del 6 ottobre a Roma
ok(
  testoAttesaDiretta(DOPO_MEZZANOTTE, ist("2026-10-05T21:52:00Z")).includes("il 6 ottobre 2026"),
  "il giorno diverso si nomina: altrimenti «alle 00:05» letto alle 23:52 sembra un orario passato",
);
ok(
  testoAttesaDiretta(DOPO_MEZZANOTTE, ist("2026-10-05T21:52:00Z")).endsWith("alle 00:05"),
  "…e l'ora resta in coda, dove la si cerca",
);

// ── 8) la motivazione della prova vive in due posti e non devono divergere ──
// La scrive una funzione SQL (che non può importare TypeScript) e sta anche in
// RIPIEGHI_MOTIVAZIONE, dov'è scritta e sorvegliata la forma. Senza questo
// confronto le due copie divergono: è solo questione di quando.
console.log("\n8) La motivazione: due copie, un confronto");

const migrazioneProfilo = fs.readFileSync(
  path.join(ROOT, "supabase/migrations/20261004160000_presenza_profilo.sql"),
  "utf8",
);
// Spogliato dai commenti per le guardie NEGATIVE: `evento_marcatore` e
// `'interest'` sono proprio le parole che i commenti CITANO per spiegare perché
// non ci sono — leggendo il sorgente grezzo quelle asserzioni sarebbero rosse
// su codice giusto. È la classe del 28/09, e si chiude al LETTORE.
const sqlProfilo = senzaCommentiSql(migrazioneProfilo);
ok(
  typeof RIPIEGHI_MOTIVAZIONE.presenza === "string" && RIPIEGHI_MOTIVAZIONE.presenza.length > 0,
  "la motivazione della presenza sta fra i ripieghi, dove vive la forma",
);
ok(
  migrazioneProfilo.includes(`'${RIPIEGHI_MOTIVAZIONE.presenza}'`),
  `la migrazione scrive ESATTAMENTE quella stringa («${RIPIEGHI_MOTIVAZIONE.presenza}»)`,
);
ok(
  /^Da /.test(RIPIEGHI_MOTIVAZIONE.presenza) && RIPIEGHI_MOTIVAZIONE.presenza.endsWith("."),
  "…e rispetta la forma dei ripieghi: un frammento che comincia per «Da », non una frase intera",
);

// ── 9) le quattro scelte del §2, dove sono strutturali ─────────────────────
console.log("\n9) Le scelte del §2 stanno nel codice, non in un commento");

ok(
  /'curiosity'::public\.escape_dimensione/.test(sqlProfilo) &&
    !/'interest'::public\.escape_dimensione/.test(sqlProfilo),
  "la prova è curiosity e NON interest: nessuna affinità può nascere da una presenza",
);
ok(
  /peso[\s\S]{0,40}0\.5/.test(migrazioneProfilo) || /\n\s+0\.5,/.test(migrazioneProfilo),
  "il peso è 0,5 — sotto una risposta scritta (1,0)",
);
ok(
  /round\(least\(1\.0, v_riga\.ping_totali::numeric \/ v_ping_attesi\), 3\)/.test(migrazioneProfilo),
  "`valore` è la COPERTURA misurata, non una costante: viene da presenze_live e si può ricontare",
);
ok(
  /'presenza'::public\.escape_fonte/.test(migrazioneProfilo),
  "la fonte è `presenza` e non `evento`: seguire una diretta e risponderle sono due fatti",
);
// La scrittura sta DENTRO il ramo che certifica, cioè l'unico che scrive
// 'sistema': la condizione è strutturale, non un filtro da ricordare.
const dentroIlRamo = migrazioneProfilo.indexOf("'presenza'::public.escape_fonte");
const ramoSistema = migrazioneProfilo.indexOf("certificata_da_tipo = 'sistema'");
ok(
  ramoSistema > -1 && dentroIlRamo > ramoSistema,
  "la prova si scrive dopo la certificazione `sistema`, nello stesso ciclo: il discriminante è strutturale",
);
ok(
  /if v_pubblico = 'docenti' then[\s\S]*?attestati[\s\S]*?else[\s\S]*?'presenza'::public\.escape_fonte/.test(
    migrazioneProfilo,
  ),
  "un evento per docenti non ci passa: lì la certificazione produce un attestato, e un docente non ha un profilo d'area",
);

// ── 10) il cap registra quello che scarta, e guarda PRIMA ──────────────────
console.log("\n10) Il cap dice quello che scarta");

ok(
  /credito_area_fuso/.test(migrazioneProfilo),
  "il cap giornaliero registra un guasto con la sua specie, invece di tacere",
);
ok(
  !/evento_marcatore/.test(sqlProfilo),
  "…e non si appoggia a una colonna che non esiste (la prima stesura ne aveva inventata una)",
);
// La domanda si fa PRIMA dell'insert: dopo, `activity_log` non sa da quale
// evento viene una riga, quindi non si saprebbe più quali aree sono state
// soppresse.
// ⚠️ SI ANCORA ALLA QUERY, NON AL NOME. La prima versione di questa
// asserzione cercava `v_aree_studente`, che compare anche nella DICHIARAZIONE
// della variabile in testa alla funzione — quindi misurava quella posizione e
// restava VERDE anche spostando il blocco dopo l'insert. Stessa classe già
// pagata il 27/09 (un'ancora su un nome condiviso con qualcos'altro): la
// controprova l'ha mostrata, rileggerla non l'avrebbe fatto.
const posIndagine = sqlProfilo.indexOf("select array_agg(format('%s:%s', v_riga.user_id");
const posInsert = sqlProfilo.indexOf("insert into public.activity_log");
ok(
  posIndagine > -1 && posInsert > -1 && posIndagine < posInsert,
  "la domanda si fa PRIMA dell'insert: dopo non si saprebbe più QUALI aree sono state soppresse",
);
ok(
  /v_gia_certificato is not true then/.test(migrazioneProfilo),
  "lato scuola la ri-certificazione dello stesso evento non produce un falso allarme",
);

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
