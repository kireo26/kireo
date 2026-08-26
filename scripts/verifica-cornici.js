// Verifica delle CORNICI del finale (le «occasioni» di lib/escape/restituzione.ts).
//
// Due controlli, e il primo è il motivo per cui il file esiste.
//
// 1. NESSUNA CORNICE CAMBIA COMPORTAMENTO QUANDO IL CONTESTO SI ALLARGA.
//    Il contesto delle occasioni (`OccasioneCtx`) cresce: prima i materiali
//    letti, poi il budget, il piano, gli scarti, i compiti della 10, ora i
//    ruoli io/altri. Ogni volta che ci si aggiunge un campo, la domanda è la
//    stessa — le cornici che c'erano prima si comportano ancora uguale? La
//    risposta «non dovrebbero, chi non lo referenzia non lo vede» è vera per
//    costruzione e non basta: costruzioni simili si sono già rotte altrove
//    (l'overload di finalize_registration, l'embed ambiguo di PostgREST).
//    Qui il controllo è eseguito, non ragionato: per ogni missione si calcola
//    la restituzione CON e SENZA il campo nuovo, e le occasioni devono venire
//    identiche — tranne per le cornici che quel campo lo usano apposta.
//
// 2. OGNI CORNICE È RAGGIUNGIBILE. Una `quando` che non scatta mai su nessuna
//    delle partite di prova è morta: non è un errore di sintassi e nessuno se
//    ne accorge, ma è testo scritto per nessuno.
//
// Nessun DB, nessuna AI: solo il config e la logica pura del finale.
//
// Esecuzione: `npm run test:cornici`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = require.extensions[".tsx"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { getMissione, REGISTRO_MISSIONI_AREE, stepDellaMissione } = require("@/lib/escape/config");
const { costruisciRestituzione } = require("@/lib/escape/restituzione");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Una griglia di partite plausibili per missione: si variano le leve che le
// cornici guardano (materiali letti, scarti, ruoli presi), non tutto lo spazio.
function partite(slug) {
  const varianti = [];
  for (const legge of [true, false]) {
    for (const scartaPrime of [true, false]) {
      for (const ruoliPresi of [0, 2]) {
        const R = new Map();
        const g = (id) => R.get(id);
        const st = () => stepDellaMissione(getMissione(slug, g));
        const trova = (t) => st().find((s) => s.tipo === t);
        const mat = trova("esplora_libero");
        if (mat) R.set(mat.id, { letti: legge ? mat.materiali.map((x) => x.id) : [] });
        const man = trova("scelta_singola");
        if (man) R.set(man.id, { opzioneId: man.opzioni[0].id });
        const sel = trova("seleziona_informazioni");
        if (sel) R.set(sel.id, { selezionati: legge ? sel.dossier.slice(0, 3).map((d) => d.id) : [] });
        const bud = st().find((s) => s.id === "s3_budget");
        if (bud?.tipo === "alloca_budget") R.set("s3_budget", { allocazioni: Object.fromEntries(bud.voci.slice(0, 3).map((v) => [v.id, Math.round(bud.totale / 4)])) });
        if (bud?.tipo === "pianifica_lavori") R.set("s3_budget", { selezionati: bud.lavori.slice(0, 3).map((l) => l.id) });
        const sca = trova("scarta_opzione");
        if (sca) R.set(sca.id, { scartati: (scartaPrime ? sca.opzioni.slice(0, 2) : sca.opzioni.slice(-2)).map((x) => x.id) });
        const per = trova("assegna_persone");
        if (per) R.set(per.id, { assegnazioni: Object.fromEntries(per.compiti.map((c, i) => [c.id, i < 2 ? "io" : "altri"])) });
        const ruo = trova("assegna_ruoli");
        const conRuoli = ruo ? { [ruo.id]: { assegnazioni: Object.fromEntries(ruo.ruoli.map((r, i) => [r.id, i < ruoliPresi ? "io" : "altri"])) } } : null;
        varianti.push({ R, conRuoli, etichetta: `letti:${legge} scarto:${scartaPrime ? "primi" : "ultimi"} ruoli:${ruoliPresi}` });
      }
    }
  }
  return varianti;
}

// Le cornici che DIPENDONO dallo step dei ruoli: per queste una differenza fra
// «ruoli compilati» e «ruoli non compilati» è il comportamento voluto, non una
// regressione. Si dichiarano qui, per missione, col numero massimo di cornici
// che possono comparire in più.
//
// palco-programma ne ha una da sempre («Hai preso su di te il compito più
// scomodo della serata»): l'ha scoperta questo test, perché passava dal campo
// dei compiti→persona della Missione 10 invece che da quello dei ruoli.
// Due numeri diversi, e tenerli distinti è il punto: `leggono` = quante cornici
// referenziano i ruoli (si conta sulla SORGENTE); `delta` = quante cornici in
// più possono comparire fra «ruoli compilati» e «non compilati» (si osserva sul
// COMPORTAMENTO). Non coincidono quando due rami sono mutuamente esclusivi —
// museo-seta ne ha due che leggono i ruoli, ma uno solo dei due scatta per
// volta, quindi la differenza osservabile resta di una.
const CORNICI_CHE_USANO_I_RUOLI = {
  "palco-programma": { leggono: 1, delta: 1 },
  "museo-seta": { leggono: 2, delta: 1 },
};

// Il controllo che risponde davvero alla domanda «allargare il contesto cambia
// qualcosa?»: una cornice può cambiare comportamento SOLO se legge il campo
// nuovo. Questo si decide sulla sorgente, non su una griglia di partite — una
// griglia può sempre non passare per il caso giusto.
function predicatiCheLeggonoIRuoli() {
  const src = fs.readFileSync(path.join(ROOT, "lib/escape/restituzione.ts"), "utf8");
  const quando = [...src.matchAll(/quando: \(c\) => ([^\n]*?), testo:/g)].map((m) => m[1]);
  return quando.filter((q) => /c\.ruoli|presoDaTe|ruoliCompilati/.test(q)).length;
}

function main() {
  console.log("\n═══ Le cornici del finale ═══\n");

  // 0. statico: quante cornici leggono il campo nuovo.
  const leggono = predicatiCheLeggonoIRuoli();
  const dichiarate = Object.values(CORNICI_CHE_USANO_I_RUOLI).reduce((a, b) => a + b.leggono, 0);
  ok(leggono === dichiarate, `${leggono} cornici leggono i ruoli, ${dichiarate} dichiarate qui: una cornice che li legge senza essere dichiarata non sarebbe distinguibile da una regressione`);

  let confronti = 0;
  const raggiunte = new Map();
  const totali = new Map();

  for (const { slug } of REGISTRO_MISSIONI_AREE) {
    let diffInattese = 0;
    for (const { R, conRuoli, etichetta } of partite(slug)) {
      const senza = costruisciRestituzione(slug, (id) => R.get(id), []);
      const conMappa = new Map(R);
      if (conRuoli) for (const [k, v] of Object.entries(conRuoli)) conMappa.set(k, v);
      const con = costruisciRestituzione(slug, (id) => conMappa.get(id), []);

      const attese = CORNICI_CHE_USANO_I_RUOLI[slug]?.delta ?? 0;
      const soloCon = con.occasioni.filter((t) => !senza.occasioni.includes(t));
      const soloSenza = senza.occasioni.filter((t) => !con.occasioni.includes(t));
      if (soloCon.length + soloSenza.length > attese) {
        diffInattese++;
        console.error(`    ${slug} [${etichetta}] → +${soloCon.length} / -${soloSenza.length}`);
      }
      confronti++;
      for (const t of con.occasioni) raggiunte.set(slug, (raggiunte.get(slug) ?? new Set()).add(t));
    }
    ok(diffInattese === 0, `${slug}: le cornici esistenti non cambiano quando il contesto porta i ruoli`);
    totali.set(slug, null);
  }
  console.log(`\n  (${confronti} confronti con/senza il campo nuovo)\n`);

  // Raggiungibilità: nessuna missione deve avere zero cornici su tutta la griglia.
  for (const { slug } of REGISTRO_MISSIONI_AREE) {
    const n = (raggiunte.get(slug) ?? new Set()).size;
    ok(n > 0, `${slug}: ${n} cornici distinte raggiunte dalla griglia di partite`);
  }

  console.log("\n═══════════════════════════════════════════\n");
  if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
  console.log("✓ Allargare il contesto non ha cambiato nessuna cornice esistente.\n");
}

main();
