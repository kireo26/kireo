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
const { senzaCommenti } = require("./lib/senza-commenti");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();
const { presenzaRilevabile, statoDiretta } = require("@/lib/live");

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
  /inDiretta \? "In diretta" : "Sta per iniziare"/.test(pannello),
  "nei quindici minuti prima dell'inizio la riga non dice «In diretta»",
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

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
