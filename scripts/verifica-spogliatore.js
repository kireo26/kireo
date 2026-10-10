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
const ok = (cond, msg, extra) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) {
    falliti++;
    if (extra) console.log(`      → ${extra}`);
  }
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

// ── 4) LE ÀNCORE SUI NOMI: un cricchetto, non un avviso ─────────────────────
// Un'àncora `indexOf("nome")` misura la prima occorrenza, e se quel nome
// compare due volte misura quella sbagliata: non un rosso, un VERDE sul pezzo
// di codice sbagliato. `scripts/lib/ancora.js` fa dichiarare il conto, e tiene
// l'elenco delle volte che ci è costato.
//
// ⚠️ NON SI PRETENDE ZERO: le àncore grezze nel repo sono molte e quasi tutte
// innocue, e un rosso su tutte sarebbe un rosso che qualcuno spegne. Si pretende
// che NON CRESCANO: il numero scende quando si passa di lì, e il giorno che
// qualcuno ne aggiunge una nuova il controllo lo dice — che è il momento in cui
// conviene usare l'helper.
//
// Un AVVISO stampato a ogni giro invece di un cricchetto sarebbe la cosa che
// questo progetto togliel da un mese: un numero che nessuno guarda più.
console.log("\n4) Le àncore sui nomi non crescono");
{
  const { censimentoAncore } = require("./lib/ancora");
  // LA LINEA DI BASE SI MISURA, NON SI INDOVINA: questo numero è stato messo a
  // 62 a occhio e l'esecuzione ha detto 68 — la stessa regola che vale per i
  // conti nei testi vale per i tetti nei controlli. Misurato il 5/10, dopo aver
  // convertito le cinque àncore che avevano già morso in
  // `verifica-barra-percorso.js`. Si ABBASSA quando se ne converte un'altra;
  // non si alza.
  //
  // ⚠️ 68 → 67 il 10/10/2026, e NON perché ne sia stata convertita una: il
  // censimento leggeva il sorgente coi commenti, quindi contava anche un
  // `lastIndexOf("…")` CITATO in un commento che spiegava perché quella forma
  // non va usata — il modo 1, un rosso su un file che aveva fatto la cosa
  // giusta. Curato il lettore (`censimentoAncore` spoglia), il numero è
  // scoperto essere 67 da sempre. Chi lo rilegge non deve credere che una
  // conversione sia avvenuta.
  const TETTO = 67;
  const { grezze, perFile } = censimentoAncore(DIR);
  const peggiori = [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  ok(
    grezze <= TETTO,
    `${grezze} àncore grezze su literal (tetto ${TETTO}) — le più dense: ${peggiori.map(([f, n]) => `${f} (${n})`).join(", ")}`,
    grezze > TETTO
      ? "ne è stata aggiunta una nuova: usa `ancora()`/`fetta()` da scripts/lib/ancora.js, che fa dichiarare quante volte quel nome compare"
      : undefined,
  );
  if (grezze < TETTO) {
    console.log(`      → il tetto si può abbassare a ${grezze}: ne sono state convertite ${TETTO - grezze}`);
  }
}

console.log(falliti === 0 ? "\n✅ Lo spogliatore fa quello che dichiara, e ce n'è uno.\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
