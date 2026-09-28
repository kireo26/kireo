// Il form degli eventi: le date in ordine, e un rifiuto che dice quale.
//
// PERCHÉ ESISTE. Il 28/09, al primo giro con una persona: un ente ha scritto
// una data di fine un mese PRIMA di quella di inizio. Il form ha accettato, il
// database ha rifiutato per il vincolo `eventi_date_order` (che esiste dal
// 12/07 e faceva il suo mestiere), e a schermo è comparso «Non è stato
// possibile inviare l'evento. Riprova più tardi.» — sbagliato due volte:
// riprovare non può funzionare, perché a non andare è il dato, e non dice quale
// campo. *Un ente vero riprova due volte e poi scrive a Mario.*
//
// E LA DOMANDA CHE NE È NATA, con la sua risposta: una data di inizio nel
// PASSATO resta lecita (un ente può caricare un incontro già tenuto), ma allora
// la pagina non deve poi chiedere agli studenti di prenotarsi — e fino a oggi
// lo faceva, perché `getEventiPerArea` non filtra per data e `CardEvento`
// mostrava il bottone comunque.
//
// Esecuzione: `npm run test:evento`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./lib/senza-commenti");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();
const { messaggioErroreEvento } = require("@/lib/ente/erroreEvento");
const { eventoCominciato } = require("@/lib/live");

let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
};

const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const form = leggi("components/ente/CreaEventoForm.tsx");
const card = leggi("components/app/CardEvento.tsx");
const erroreTs = leggi("lib/ente/erroreEvento.ts");

console.log("\n═══ Il form degli eventi ═══\n");

// ── 1) le date in ordine, prima che lo dica il database ─────────────────────
console.log("1) L'ordine delle date");

const iValidate = form.indexOf("function validate()");
const iSubmit = form.indexOf("async function handleSubmit");
ok(iValidate > 0 && iSubmit > iValidate, "il form ha una `validate()` prima del submit");
const corpoValidate = form.slice(iValidate, iSubmit);

ok(
  /new Date\(dataFine\) < new Date\(dataInizio\)/.test(corpoValidate),
  "…che confronta la fine con l'inizio",
);
ok(
  /next\.dataFine = "La fine non può venire prima dell'inizio/.test(corpoValidate),
  "…e mette l'errore sul campo giusto, invece di un messaggio generale che non dice dove guardare",
);

// ── 2) una data nel passato NON è vietata, ma non promette una prenotazione ──
console.log("\n2) Una data di inizio già passata");

ok(
  !/dataInizio\) < new Date\(\)/.test(corpoValidate),
  "non è un errore bloccante: caricare un incontro già tenuto resta lecito",
);
ok(
  /Questa data è già passata/.test(form),
  "…ma il form dice cosa comporta, invece di lasciarlo scoprire dopo",
);

// LA CURA VERA sta sull'EVENTO, non sul form che lo ha creato: vale per uno
// caricato a posteriori e per uno normale il giorno dopo.
ok(/eventoCominciato\(/.test(card), "CardEvento sa se l'evento è già cominciato");
ok(
  /\{cominciato \? null : \(/.test(card) && /<IscrivitiEventoButton/.test(card),
  "…e allora non offre l'iscrizione: prenotarsi per una cosa già iniziata non serve a niente",
);
// «Eri iscritto» era la prima stesura, e l'ha presa il tripwire della lingua
// invariante: un participio con *essere* in seconda persona concorda col genere
// di chi legge. «Avevi un posto» dice la stessa cosa e si legge uguale.
ok(/Avevi un posto/.test(card), "…mentre chi era iscritto continua a vederlo, ora che il bottone non c'è");

// Il comportamento, con un'ora fissa invece dell'orologio della macchina.
const ORA = new Date("2026-10-01T12:00:00.000Z");
ok(eventoCominciato("2026-10-01T11:59:00.000Z", ORA), "un evento iniziato un minuto fa è cominciato");
ok(eventoCominciato("2026-10-01T12:00:00.000Z", ORA), "…e anche uno che inizia in questo istante");
ok(!eventoCominciato("2026-10-01T12:01:00.000Z", ORA), "…uno che inizia fra un minuto no");

// ── 3) il rifiuto dice cosa non va ──────────────────────────────────────────
console.log("\n3) Quando il database rifiuta");

ok(/messaggioErroreEvento\(/.test(form), "il form non compone il messaggio a mano: lo chiede al modulo condiviso");
ok(
  !/Riprova più tardi/.test(form),
  "…e «riprova più tardi» non è più nel form: su un dato che non va è un consiglio falso",
);

const date = messaggioErroreEvento({ code: "23514", message: 'new row violates check constraint "eventi_date_order"' });
ok(/fine è precedente/.test(date), "un `eventi_date_order` dice che la fine viene prima dell'inizio");
ok(!/più tardi/.test(date), "…e non invita ad aspettare");

const quota = messaggioErroreEvento({ code: "P0001", message: "troppi_eventi_in_revisione" });
ok(/4 eventi in attesa/.test(quota), "il fair use resta riconosciuto (era l'unico caso distinto prima di oggi)");

const checkIgnoto = messaggioErroreEvento({ code: "23514", message: 'violates check constraint "eventi_qualcosa_di_nuovo"' });
ok(
  /non cambierà l'esito/.test(checkIgnoto),
  "un CHECK che non sappiamo nominare resta un problema del DATO: si dice che riprovare com'è non serve",
);

const ignoto = messaggioErroreEvento({ code: "08006", message: "connection failure" });
ok(!/non cambierà l'esito/.test(ignoto) && /scrivici da Contatti/.test(ignoto), "…mentre un guasto vero non accusa il dato");
ok(messaggioErroreEvento(null).length > 0, "e un errore assente non produce una stringa vuota a schermo");

// ── 4) i vincoli nominati ESISTONO ──────────────────────────────────────────
//
// Un nome sbagliato qui non fa rumore: il ramo non scatta mai e l'ente legge il
// messaggio generico per sempre. Si controlla contro le migrazioni, che sono la
// sola fonte dei nomi veri.
console.log("\n4) I vincoli nominati esistono davvero");

const MIGR = path.join(ROOT, "supabase", "migrations");
const tutteLeMigrazioni = fs
  .readdirSync(MIGR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => fs.readFileSync(path.join(MIGR, f), "utf8"))
  .join("\n");

const nominati = [...erroreTs.matchAll(/nome: "([a-z_]+)"/g)].map((m) => m[1]);
ok(nominati.length >= 3, `il modulo riconosce ${nominati.length} vincoli per nome`);
const fantasma = nominati.filter((n) => !new RegExp(`constraint ${n}\\b`).test(tutteLeMigrazioni));
ok(
  fantasma.length === 0,
  fantasma.length === 0
    ? "…e ognuno di loro esiste in una migrazione (un nome sbagliato non farebbe rumore: il ramo non scatterebbe mai)"
    : `vincoli nominati che non esistono: ${fantasma.join(", ")}`,
);

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
