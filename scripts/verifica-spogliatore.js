// Lo spogliatore dei commenti: le sue proprietà, e che ne esista una copia sola.
//
// PERCHÉ ESISTE. Il 27/09 una verifica che pretendeva `cache(` in
// `getPassoCorrente` era VERDE con la `cache()` tolta: trovava la parola nel
// COMMENTO che spiegava perché ci dovesse stare. Da lì `scripts/lib/senza-commenti.js`
// — che però non aveva nessun controllo, mentre le sue proprietà erano dichiarate
// nei commenti. *Una proprietà dichiarata è un test che non c'è ancora*, e questo
// è un file su cui poggiano quasi tutte le guardie lessicali della suite: se
// spoglia troppo, un controllo diventa rosso su codice giusto; se spoglia troppo
// poco, uno diventa verde su codice rotto.
//
// LA DIREZIONE DELL'ERRORE, dichiarata là e verificata qui: al più si perde del
// codice (rosso su codice buono, che si nota subito), mai il contrario.
//
// E LA SECONDA METÀ: che di questo spogliatore ci sia UNA copia. Il 28/09 ce
// n'erano tre — la condivisa più due locali in `verifica-guide.js` e
// `verifica-tetto.js` — e le locali toglievano solo i commenti a riga intera,
// cioè lasciavano passare proprio la forma in cui la citazione di un codice si
// infila più spesso. Due copie divergono, e quella che diverge è sempre quella
// che nessuno rilegge.
//
// Esecuzione: `npm run test:spogliatore`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");

const ROOT = path.join(__dirname, "..");
let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
};

console.log("\n═══ Lo spogliatore dei commenti ═══\n");

// ── 1) le proprietà del lato TypeScript/JavaScript ──────────────────────────
console.log("1) Cosa toglie, e cosa non tocca (JS/TS)");

ok(!/vietata/.test(senzaCommenti("// una forma vietata\nconst x = 1;")), "toglie un commento a riga intera");
ok(
  !/vietata/.test(senzaCommenti("const x = 1; // una forma vietata\n")),
  "…e anche uno a fine riga, che è la forma in cui una citazione si infila più spesso",
);
ok(!/vietata/.test(senzaCommenti("/* una forma\n   vietata */\nconst x = 1;")), "…e un blocco su più righe");
ok(/const x = 1/.test(senzaCommenti("// nota\nconst x = 1; // altra nota\n")), "…lasciando in piedi il codice intorno");

// L'URL è la proprietà dichiarata nel file: senza il `[^:]`, `https://…` dentro
// una stringa verrebbe decapitato e ogni guardia su un indirizzo diventerebbe
// rossa su codice giusto.
ok(
  /https:\/\/kireo\.it\/guide/.test(senzaCommenti('const u = "https://kireo.it/guide/x/1.pdf";')),
  "non decapita un URL dentro una stringa (il `[^:]` davanti allo slash doppio)",
);
// Una rotta che comincia per barra non è un commento: `//api/...` non esiste, ma
// `"/api/guida/"` sì e non deve sparire.
ok(/api\/guida/.test(senzaCommenti('const u = "/api/guida/" + slug;')), "…né una rotta che comincia con una barra sola");

// LA DIREZIONE DELL'ERRORE. Questo è il limite dichiarato: una sequenza `//`
// dentro una stringa viene tolta come se fosse un commento. Si verifica che
// sbagli in quel verso — perdere codice, quindi al più un rosso — e non
// nell'altro.
const conSequenzaInStringa = senzaCommenti('const s = "a // b"; const y = 2;');
ok(!/a \/\/ b/.test(conSequenzaInStringa), "il limite è quello dichiarato: una sequenza // dentro una stringa viene tolta…");
ok(
  conSequenzaInStringa.length < 'const s = "a // b"; const y = 2;'.length,
  "…cioè si PERDE del testo, che rende rossa una guardia su codice buono invece di renderla verde su codice rotto",
);

// I numeri di riga restano, se si spoglia riga per riga: `verifica-log-5xx.js`
// lo fa proprio per questo, e i suoi messaggi puntano alla riga giusta.
const righe = "const a = 1; // nota\nconst b = 2;\n// solo commento\nconst c = 3;".split("\n").map(senzaCommenti);
ok(righe.length === 4, "spogliando riga per riga il numero delle righe non cambia (i messaggi puntano alla riga giusta)");

// ── 2) le proprietà del lato SQL ────────────────────────────────────────────
console.log("\n2) Cosa toglie, e cosa non tocca (SQL)");

ok(!/row_count/.test(senzaCommentiSql("-- non si usa row_count\nselect 1;")), "toglie un commento `--`");
ok(!/row_count/.test(senzaCommentiSql("select 1; -- non si usa row_count")), "…anche a fine riga");
ok(!/row_count/.test(senzaCommentiSql("/* non si usa\n   row_count */\nselect 1;")), "…e un blocco");
ok(/select 1/.test(senzaCommentiSql("-- nota\nselect 1; -- altra nota")), "…lasciando in piedi la query");

// ── 3) di questo spogliatore c'è UNA copia ──────────────────────────────────
console.log("\n3) Nessuna copia locale: una copia sola, in un posto solo");

const DIR = path.join(ROOT, "scripts");
const copie = [];
for (const f of fs.readdirSync(DIR)) {
  if (!f.startsWith("verifica-") || !f.endsWith(".js")) continue;
  const src = fs.readFileSync(path.join(DIR, f), "utf8");
  // Una DEFINIZIONE locale, non un uso: si cerca la forma che dichiara la
  // funzione, in tutte e due le scritture (`function` e costante).
  if (/function\s+senzaCommenti(?:Sql)?\s*\(/.test(src) || /const\s+senzaCommenti(?:Sql)?\s*=\s*\(/.test(src)) copie.push(f);
}
ok(
  copie.length === 0,
  copie.length === 0
    ? "nessun file di verifica definisce il proprio spogliatore: lo importano tutti da scripts/lib"
    : `copie locali trovate in: ${copie.join(", ")} — vanno sostituite con l'import, o divergeranno`,
);

console.log(falliti === 0 ? "\n✅ Lo spogliatore fa quello che dichiara, e ce n'è uno.\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
