// UN ERRORE DEL DATABASE SI LOGGA PER INTERO, NON SOLO IL SUO `message`.
//
// ⚠️⚠️ IL DIFETTO DA CUI NASCE (11/10/2026, §3 del giro a schermo di Mario), e
// la frase è sua:
//
//     «Si conserva la parte dell'errore che dice CHE è andata male, e si butta
//     quella che dice COSA. Il primo pezzo lo sapevamo già — l'utente ha visto
//     un rosso. Il secondo era l'unico che serviva.»
//
// Il caso vero. L'export presenze rispondeva 500 e nel log c'era solo
// «structure of query does not match function result type». Postgres, su quel
// preciso errore, emette SEMPRE anche un `DETAIL` che nomina la colonna, il
// tipo atteso e quello trovato — e quel `DETAIL` arriva fino a noi dentro
// `error.details`. Lo buttavamo via con `error.message ?? error`. Senza quella
// riga sono serviti tre giri di query sul database per ricostruire a mano una
// cosa che il database aveva già detto al primo colpo.
//
// ⚠️ LA CLASSE ERA DI DICIOTTO PUNTI IN QUINDICI FILE, non di uno. Curare la
// sola route che aveva fatto male avrebbe lasciato la classe, e il prossimo
// difetto sarebbe arrivato muto da un altro file — «curane una sola e resta il
// mezzo fix che è peggio di nessuno».
//
// ─────────────────────────────── le due metà, e la seconda si dimentica
//   1. che `descriviErrore` tenga davvero tutti e quattro i campi: si CHIAMA la
//      funzione, non si legge il suo sorgente (una regex su un letterale dice
//      che il campo è nominato, non che arriva nella riga);
//   2. che nessun `console.error` logghi un `.message` nudo: è la metà
//      strutturale, e senza di lei il prossimo punto nasce con il difetto
//      perché `error.message` è la forma che viene in mente.
//
// ⚠️ NESSUNA ESENZIONE, di proposito. `descriviErrore` accetta `unknown` e
// degrada verso il dire qualcosa, quindi non esiste il caso «qui il message è
// tutto quello che c'è»: anche un `Error` di JavaScript ci passa senza perdere
// niente. Una guardia senza eccezioni è più forte di una con un elenco, e un
// elenco di esenzioni è una cosa che qualcuno allarga.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");
const { senzaCommenti } = require("./lib/senza-commenti.js");

const RADICE = join(__dirname, "..");
let fatte = 0;
let falliti = 0;

function ok(condizione, cosa, dettaglio) {
  fatte++;
  if (condizione) {
    console.log(`  ✓ ${cosa}`);
  } else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

// ⚠️ IL SORGENTE SI LEGGE SENZA COMMENTI: questo file vieta una forma, e quella
// forma è esattamente quella che i commenti CITANO per spiegare perché non va
// bene — compresi i commenti di `lib/erroreSupabase.ts`. È il modo 1 dei
// tredici, e si chiude al lettore invece che a ogni asserzione.
function leggi(rel) {
  return senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));
}

function tuttiISorgenti() {
  const fuori = new Set(["node_modules", ".next", ".git", "public", "supabase"]);
  const trovati = [];
  (function cammina(dir) {
    for (const nome of readdirSync(dir)) {
      if (fuori.has(nome)) continue;
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) cammina(p);
      else if (/\.tsx?$/.test(nome)) trovati.push(relative(RADICE, p));
    }
  })(join(RADICE, "app"));
  for (const base of ["lib", "components"]) {
    (function cammina(dir) {
      for (const nome of readdirSync(dir)) {
        if (fuori.has(nome)) continue;
        const p = join(dir, nome);
        if (statSync(p).isDirectory()) cammina(p);
        else if (/\.tsx?$/.test(nome)) trovati.push(relative(RADICE, p));
      }
    })(join(RADICE, base));
  }
  return trovati;
}

// ─────────────────────────────── §1 — la funzione tiene tutti e quattro
console.log("\n§1 — `descriviErrore` non butta via niente\n");

const ts = require("typescript");

function caricaModulo(rel, risolvi) {
  const sorgente = readFileSync(join(RADICE, rel), "utf8");
  const js = ts.transpileModule(sorgente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  new Function("require", "module", "exports", js)(risolvi, modulo, modulo.exports);
  return modulo.exports;
}

const { descriviErrore } = caricaModulo("lib/erroreSupabase.ts", (nome) => {
  throw new Error(`lib/erroreSupabase.ts non deve importare niente (ha chiesto ${nome})`);
});

{
  // L'errore vero dell'11/10, con i campi che PostgREST ci consegna davvero.
  const vero = {
    message: "structure of query does not match function result type",
    details: "Returned type character varying(255) does not match expected type text in column 3.",
    hint: null,
    code: "42804",
  };
  const riga = descriviErrore(vero);
  ok(riga.includes(vero.message), "la riga contiene il `message`");
  ok(
    riga.includes("column 3"),
    "e il `DETAIL`, che è l'unico pezzo che dice QUALE colonna",
    riga,
  );
  ok(riga.includes("42804"), "e lo SQLSTATE, l'unico confrontabile senza leggere una frase", riga);
  ok(!/suggerimento/.test(riga), "un campo vuoto non lascia un'etichetta orfana", riga);
}

{
  const conHint = descriviErrore({
    message: "column eventi.titol does not exist",
    hint: 'Perhaps you meant to reference the column "eventi.titolo".',
    code: "42703",
  });
  ok(conHint.includes("Perhaps you meant"), "quando c'è, arriva anche lo `hint`", conHint);
}

{
  // ⚠️ I CASI DEGRADATI: un helper che su un valore inatteso restituisce una
  // riga vuota è peggio di nessun helper, perché una riga vuota in un log si
  // legge come «non è successo niente».
  ok(descriviErrore(new Error("saltato")).includes("saltato"), "un `Error` di JavaScript non si perde");
  ok(descriviErrore("una stringa").includes("una stringa"), "una stringa passa così com'è");
  ok(descriviErrore(null).trim().length > 0, "`null` produce comunque una riga, non il vuoto");
  ok(descriviErrore(undefined).trim().length > 0, "`undefined` idem");
  const strano = descriviErrore({ qualcosa: "di imprevisto" });
  ok(
    strano.includes("imprevisto") && !strano.includes("[object"),
    "un oggetto senza i quattro campi mostra la sua forma, non «[object Object]»",
    strano,
  );
}

// ─────────────────────────────── §2 — nessun `.message` nudo in un log
console.log("\n§2 — nessun `console.error` logga un `.message` nudo\n");

const sorgenti = tuttiISorgenti();
// ⚠️ LA SOGLIA DICHIARATA: sotto, l'estrattore ha smesso di leggere e ogni
// riga qui sopra sarebbe verde per un insieme vuoto (il modo 2). Al 11/10 i
// file .ts/.tsx di app/lib/components sono oltre 400 e i `console.error` oltre
// 80: una soglia prudente al terzo di quei numeri è già un segnale.
ok(sorgenti.length > 150, `l'estrattore legge i sorgenti (${sorgenti.length} file)`, `${sorgenti.length}`);

// Ogni argomento di un `console.error(...)`: si prende dalla parentesi aperta
// alla chiusa corrispondente, così una chiamata su più righe non sfugge.
function chiamate(src, nome) {
  const trovate = [];
  let i = 0;
  for (;;) {
    const k = src.indexOf(nome + "(", i);
    if (k === -1) break;
    let profondita = 0;
    let j = k + nome.length;
    for (; j < src.length; j++) {
      if (src[j] === "(") profondita++;
      else if (src[j] === ")") {
        profondita--;
        if (profondita === 0) break;
      }
    }
    trovate.push(src.slice(k, j + 1));
    i = j + 1;
  }
  return trovate;
}

// ⚠️⚠️ LA TARATURA, E LA PRIMA VERSIONE GRIDAVA SU TRE LOG GIUSTI. Il divieto
// «nessun `.message` in un console.error» è troppo largo: i tre punti che
// loggano un errore dell'API Anthropic scrivono già `status=`, `type=` e
// `message=`, cioè TUTTO quello che quella forma di errore contiene — non
// stanno buttando niente. Un controllo che grida su una cosa giusta è un
// controllo che qualcuno disattiva.
//
// La proprietà vera non è «non nominare `message`»: è «non tenere SOLO
// `message`». Quindi: una chiamata che logga `x.message` deve loggare anche un
// altro campo DELLO STESSO `x`, oppure passare da `descriviErrore`. Così un log
// Anthropic completo passa, e un `error.message ?? error` di Supabase no.
function soloIlMessage(chiamata) {
  const identificatori = new Set();
  for (const m of chiamata.matchAll(/([A-Za-z_$][\w$]*)\??\.message\b/g)) identificatori.add(m[1]);
  if (identificatori.size === 0) return null;
  for (const id of identificatori) {
    // Un altro campo dello stesso oggetto, nella stessa chiamata.
    const altro = new RegExp(`\\b${id}\\??\\.(?!message\\b)[\\w$]+`).test(chiamata);
    if (!altro) return id;
  }
  return null;
}

let esaminate = 0;
const colpevoli = [];
for (const rel of sorgenti) {
  const src = leggi(rel);
  if (!src.includes("console.error")) continue;
  for (const c of chiamate(src, "console.error")) {
    esaminate++;
    if (c.includes("descriviErrore")) continue;
    const id = soloIlMessage(c);
    if (id) colpevoli.push([rel, `${id}.message — ${c.replace(/\s+/g, " ").slice(0, 100)}`]);
  }
}

ok(esaminate > 30, `e trova le chiamate (${esaminate} \`console.error\` esaminate)`, `${esaminate}`);
ok(
  colpevoli.length === 0,
  "nessuna logga un `.message` senza passare da `descriviErrore`",
  colpevoli.map(([f, c]) => `\n      ${f}: ${c}`).join(""),
);

// ─────────────────────────────── §3 — e la route che ha fatto male
console.log("\n§3 — le due route dell'export, che sono il caso vero\n");

for (const rel of ["app/api/admin/presenze/[id]/route.ts", "app/api/scuola/presenze/[id]/route.ts"]) {
  const src = leggi(rel);
  ok(
    src.includes("descriviErrore"),
    `${rel}: logga l'errore per intero`,
    "è la route da cui è uscito il 500 muto dell'11/10",
  );
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
