// Un istante che arriva a una persona dentro un FILE (CSV, email, PDF) passa
// da un formattatore con la zona di Roma — e l'elenco dei file non si scrive a
// memoria: si DERIVA.
//
// PERCHÉ ESISTE (11/10/2026). Il CSV delle presenze stampava gli istanti così
// come arrivano da PostgREST — «2026-10-04T15:08:31+00:00», l'ora di Greenwich —
// accanto a ore PCTO, su un documento che una scuola conserva. Un referente
// leggeva 15:08 per un battito delle 17:08. E la colonna era l'unica prova che lo
// studente c'era: con l'ora sbagliata, l'unico dato riconducibile a un'azione
// sua smetteva di esserlo.
//
// `test:date` esiste proprio per questa classe e NON poteva vederlo: vieta
// `toLocale*` fuori da `lib/formato.ts`, cioè guarda le FORMATTAZIONI. Un
// istante stampato com'è non passa da nessuna formattazione — è il modo 3 dei
// tredici, una guardia che lavora su un elenco e tace su quello che l'elenco
// non nomina.
//
// LA FORMA (Mario): l'insieme non si enumera, si deriva — ogni posto in cui un
// istante viene rappresentato per un essere umano — e ogni esclusione si scrive.
//
//   • IL SOVRAINSIEME, strutturale: i file che PRODUCONO un artefatto per una
//     persona fuori da una pagina. Si riconoscono da cosa chiamano —
//     `generaCsv`/`generaCsvSezioni`, `inviaEmail`, i generatori PDF — più i
//     moduli dei template (`lib/email/templates.ts`, `lib/pdf/*.ts`). Il
//     sovrainsieme si stampa, con il conto.
//   • LA PROPRIETÀ: dentro quei file, ogni accesso a un campo-istante
//     (`…_il`, `…_at`, `…_ping`, `data_inizio`, `data_fine`, `created_at`) o
//     sta dentro un formattatore, o sta in una `select`, o è un'esclusione
//     scritta qui sotto con la sua ragione. Un accesso nuovo che non è nessuna
//     delle tre fa diventare rosso il controllo.
//   • IL TERMINALE, a runtime: `lib/csv.ts` LANCIA su una stringa che somiglia a
//     un istante non formattato. Si prova chiamandolo.
//
// ⚠️ I LIMITI, dichiarati: è lessicale, quindi vede un campo dal suo NOME — un
// istante in una variabile chiamata `quando` gli sfugge. Lì resta il terminale
// del CSV, che guarda il VALORE — ⚠️ MA SOLO PER IL CSV. Le altre due superfici
// non hanno un terminale, quindi il varco non è chiuso, è spostato:
//
//     UN ISTANTE CHE ARRIVA A UNA PERSONA IN UN'EMAIL O IN UN PDF, IN UN CAMPO
//     CON UN NOME CHE LA DERIVAZIONE NON RICONOSCE, NON LO PRENDE NESSUNO.
//
// Le difese non si sommano: due guardie con un buco in comune lasciano passare
// la mossa che le attraversa tutte e due (Mario, 11/10). Non si cura oggi; si
// scrive qui perché «lo prende il CSV» non faccia sembrare chiuso anche quello
// che il CSV non tocca. La cura, quando servirà, è un terminale in
// `lib/email/templates.ts` e in `lib/pdf/core.ts` come quello di `lib/csv.ts`.
// E le pagine JSX non stanno nel sovrainsieme:
// lì un istante si rende solo passando da un formattatore, e quello lo guarda
// già `test:date`.
//
// Esecuzione: `npm run test:istanti`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");
const { senzaCommenti } = require("./lib/senza-commenti.js");
const { ancora } = require("./lib/ancora.js");
const ts = require("typescript");

const RADICE = join(__dirname, "..");
let fatte = 0;
let falliti = 0;
function ok(condizione, cosa, dettaglio) {
  fatte++;
  if (condizione) console.log(`  ✓ ${cosa}`);
  else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

function tutti(dir) {
  const out = [];
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) out.push(...tutti(p));
    else if (/\.(ts|tsx)$/.test(nome)) out.push(p);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§1 — il sovrainsieme: chi produce un file per una persona\n");

const PRODUTTORI = /\b(generaCsv|generaCsvSezioni|inviaEmail|generaAttestatoPdf|generaPdfSegnaposto|costruisciPdf)\s*\(/;
const candidati = ["app", "components", "lib"].flatMap((d) => tutti(join(RADICE, d)));
const superfici = candidati
  .filter((p) => {
    const rel = relative(RADICE, p);
    // I MODULI che definiscono il formato (CSV, client email) non sono
    // superfici: non hanno istanti da stampare, hanno il controllo terminale.
    if (rel === "lib/csv.ts" || rel === "lib/email/brevo.ts" || rel === "lib/pdf/core.ts") return false;
    return PRODUTTORI.test(senzaCommenti(readFileSync(p, "utf8"))) || rel === "lib/email/templates.ts" || rel.startsWith("lib/pdf/");
  })
  .map((p) => relative(RADICE, p))
  .sort();

for (const s of superfici) console.log(`     · ${s}`);
// ⚠️ La soglia dichiarata: sotto, l'estrattore non sta leggendo (modo 2). Il
// numero vero all'11/10 è 11 (la prima stesura ne dichiarava 10, ed è stata la
// soglia a dirlo) — dichiarato e non dedotto, così se cresce lo si
// vede e se cala qualcuno deve spiegarlo.
const ATTESE = 11;
ok(superfici.length === ATTESE, `il sovrainsieme ha ${ATTESE} file (CSV, email, PDF)`, `${superfici.length}: se è cambiato, guarda quale e aggiorna il conto`);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§2 — ogni campo-istante in quei file passa da un formattatore\n");

const CAMPO_ISTANTE = /\.(\w*_il|\w*_at|\w*_ping|data_inizio|data_fine|created_at|publishedAt|updatedAt)\b/g;
// Chi può ricevere un campo-istante come argomento: i formattatori (che lo
// rendono nell'ora di Roma) e due funzioni che lo usano per DECIDERE, senza
// stamparlo (`minutiPerExport`/`notaMinuti` guardano se `data_fine` esiste).
const CONSUMATORI = /^(formatta\w*|istantePerExport|minutiPerExport|notaMinuti|notaFinestra)$/;

// La funzione nella cui chiamata sta un punto della riga: si risale fino alla
// prima parentesi aperta non chiusa e si legge il nome davanti.
function chiamataAperta(prima) {
  let profondita = 0;
  for (let i = prima.length - 1; i >= 0; i--) {
    const c = prima[i];
    if (c === ")") profondita++;
    else if (c === "(") {
      if (profondita === 0) return (prima.slice(0, i).match(/([\w$]+)\s*$/) ?? [])[1] ?? null;
      profondita--;
    }
  }
  return null;
}

// Le esclusioni, una per (file, campo), ciascuna con la ragione. Una voce che
// non trova più niente è OBSOLETA e va tolta (si controlla sotto).
const ESCLUSIONI = {
  "app/api/admin/presenze/[id]/route.ts": {
    diretta_chiusa_il: "decide l'esito di una presenza («Sotto la soglia» solo a diretta chiusa), non si stampa",
  },
  "app/api/scuola/presenze/[id]/route.ts": {
    diretta_chiusa_il: "decide l'esito di una presenza («Sotto la soglia» solo a diretta chiusa), non si stampa",
  },
  "app/api/cron/workshop-motore/route.ts": {
    consegnata_at: "si usa per CALCOLARE il raffreddamento, non si stampa",
    created_at: "ordina e porta la data delle domande al prompt del blocco «come hai lavorato», che non la stampa",
    aperta_at: "confina le domande alla loro tappa, non si stampa",
  },
};

let accessi = 0;
const esclusiUsati = new Set();
for (const rel of superfici) {
  const righe = senzaCommenti(readFileSync(join(RADICE, rel), "utf8")).split("\n");
  righe.forEach((riga, i) => {
    for (const m of riga.matchAll(CAMPO_ISTANTE)) {
      accessi++;
      const campo = m[1];
      const prima = riga.slice(0, m.index).replace(/[\w.?!]+$/, "");
      const dentro = chiamataAperta(prima);
      if (dentro && CONSUMATORI.test(dentro)) continue;
      // La chiave di un tipo (`primo_ping: string | null`) non è un accesso.
      if (/^\s*\w+\??:\s*/.test(riga.slice(m.index + 1)) && !/[=(,[]\s*$/.test(prima)) continue;
      const esclusa = ESCLUSIONI[rel]?.[campo];
      if (esclusa) {
        esclusiUsati.add(`${rel}|${campo}`);
        continue;
      }
      ok(false, `${rel}:${i + 1} — «.${campo}» arriva a un file senza formattatore`, riga.trim());
    }
  });
}
ok(accessi > 10, `l'estrattore legge (${accessi} accessi a campi-istante nel sovrainsieme)`, "sotto 10 non sta leggendo");
for (const [rel, campi] of Object.entries(ESCLUSIONI)) {
  for (const campo of Object.keys(campi)) {
    ok(esclusiUsati.has(`${rel}|${campo}`), `l'esclusione ${rel} · ${campo} copre ancora qualcosa`, "obsoleta: toglila");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n§3 — il terminale: un istante grezzo non entra in un CSV\n");

const csv = (() => {
  const js = ts.transpileModule(readFileSync(join(RADICE, "lib/csv.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const m = { exports: {} };
  new Function("require", "module", "exports", js)(() => {
    throw new Error("lib/csv.ts non deve importare niente");
  }, m, m.exports);
  return m.exports;
})();

let lancia = false;
try {
  csv.generaCsvSezioni([{ titolo: "x", intestazioni: ["t"], righe: [["2026-10-04T15:08:31.123+00:00"]], seNonCeNiente: "-" }]);
} catch (e) {
  lancia = e instanceof csv.IstanteGrezzoInCsv;
}
ok(lancia, "un istante ISO grezzo fa LANCIARE il generatore (fallisce a voce alta, non consegna un'ora sbagliata)");
let lanciaDataSola = false;
try {
  csv.generaCsv(["nascita"], [["2008-01-01"]]);
} catch {
  lanciaDataSola = true;
}
ok(!lanciaDataSola, "una data senza ora passa: non ha un fuso da sbagliare");
let lanciaFormattato = false;
try {
  csv.generaCsv(["t"], [["04/10/2026 17:08:31"]]);
} catch {
  lanciaFormattato = true;
}
ok(!lanciaFormattato, "un istante formattato passa");

// I due posti che compongono il CSV delle presenze lo prendono dentro un try,
// o il lancio diventerebbe un 500 grezzo del framework senza traccia (modo 7).
for (const rel of ["app/api/admin/presenze/[id]/route.ts", "app/api/scuola/presenze/[id]/route.ts"]) {
  const src = senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));
  let prima = null;
  try {
    const i = ancora(src, "csv = generaCsvSezioni(", { dove: rel });
    prima = src.slice(Math.max(0, i - 200), i);
  } catch {
    // Un'àncora che non si trova (o è ambigua) è un «non ho guardato»: rosso sotto.
  }
  ok(prima !== null && /try\s*\{/.test(prima), `${rel}: la composizione sta in un try`);
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà verificate.`);
process.exit(falliti === 0 ? 0 : 1);
