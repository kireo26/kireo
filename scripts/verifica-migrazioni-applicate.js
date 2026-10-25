#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:migrazioni` — il cricchetto sulle migrazioni applicate.
//
// PERCHÉ ESISTE (25/10/2026). In b93f2f5 è stato appeso un `comment on function`
// a 20261027110000, venti minuti dopo che Mario l'aveva applicata. In produzione
// quel commento non c'era (obj_description → null); su una replica ricostruita
// dai file sì. Replica e produzione avevano smesso di dire la stessa cosa, e
// niente lo segnalava — è il modo 4 dei tredici (la prova misura la replica e la
// chiama sistema), con l'aggravante che il divario non lascia traccia da nessuna
// parte. Era già successo una volta (20261011100000, riscritta dopo
// l'applicazione con soli commenti `--`, cioè senza divergenza).
//
// LA SCELTA, fra le due che Mario aveva nominato, e perché:
//   (a) un registro scritto a mano delle migrazioni applicate, con il commit
//       della versione applicata — preciso, e ha un pezzo che può mentire;
//   (b) un blocco su ogni file più vecchio di N giorni — grezzo, e funziona da sé.
// Scelto (a). La (b) non regge su questo repo [verificato su CLAUDE.md]: le
// migrazioni NON si applicano in ordine né con un ritardo costante — al 25/10
// stanno in attesa file del 4/10 accanto a file del 25/10 già applicati — quindi
// N giorni o blocca un file in attesa che va ancora corretto, o lascia libero
// uno applicato ieri. E la (a) dice cosa protegge, la (b) lo farebbe credere.
// Il pezzo che può mentire è il registro stesso (`supabase/migrazioni-applicate.json`):
// lo si sorveglia per quello che si può (il commit esiste, il file c'era a quel
// commit, nessun doppione), e per il resto è dichiarato in testa al registro.
//
// COSA CONFRONTA: il codice, non il file. Si tolgono i commenti `--` e `/* */` e
// si normalizzano gli spazi (il modo 5: un'impronta sul sorgente misura anche
// l'impaginazione). Un commento in più in testa non crea divergenza — non è DDL —
// e non è rosso; un `comment on`, un `grant`, una riga di funzione sì.
// ⚠️ Limite dichiarato, ed è nella direzione sbagliata: lo spogliatore toglie
// anche un `--` dentro una stringa SQL, quindi un ritocco al testo dopo un `--`
// dentro un letterale non si vede. Raro, ed è scritto.
//
// Uso: `node scripts/verifica-migrazioni-applicate.js` (verifica)
//      `node scripts/verifica-migrazioni-applicate.js --registra <prefisso> --fonte "…"`
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { senzaCommentiSql } = require("./lib/senza-commenti");

const ROOT = path.join(__dirname, "..");
const DIR = "supabase/migrations";
const REGISTRO = path.join(ROOT, "supabase/migrazioni-applicate.json");

const codice = (src) => senzaCommentiSql(src).replace(/\s+/g, " ").trim();
function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function aCommit(commit, file) {
  try {
    return git(["show", `${commit}:${DIR}/${file}`]);
  } catch {
    return null;
  }
}

const argv = process.argv.slice(2);
if (argv[0] === "--registra") {
  const prefisso = argv[1];
  const iF = argv.findIndex((a) => a === "--fonte");
  const fonte = iF > 0 ? argv[iF + 1] : null;
  if (!prefisso || !fonte) {
    console.error("Uso: --registra <prefisso> --fonte \"chi l'ha verificata applicata, e come\"");
    process.exit(1);
  }
  const trovati = fs.readdirSync(path.join(ROOT, DIR)).filter((f) => f.startsWith(prefisso));
  if (trovati.length !== 1) {
    console.error(`Il prefisso «${prefisso}» trova ${trovati.length} file: deve trovarne uno.`);
    process.exit(1);
  }
  const file = trovati[0];
  const rel = `${DIR}/${file}`;
  // Si registra solo una versione committata e pulita: il commit è la prova.
  if (git(["status", "--porcelain", "--", rel]).trim()) {
    console.error(`${rel} ha modifiche non committate: si registra la versione che Mario ha applicato, cioè una committata.`);
    process.exit(1);
  }
  const commit = git(["log", "-1", "--format=%h", "--", rel]).trim();
  if (!commit) {
    console.error(`${rel} non è mai stato committato.`);
    process.exit(1);
  }
  const reg = JSON.parse(fs.readFileSync(REGISTRO, "utf8"));
  if (reg.applicate.some((a) => a.file === file)) {
    console.error(`${file} è già registrata: una migrazione applicata non si registra due volte.`);
    process.exit(1);
  }
  reg.applicate.push({ file, commit, fonte });
  reg.applicate.sort((a, b) => a.file.localeCompare(b.file));
  fs.writeFileSync(REGISTRO, JSON.stringify(reg, null, 2) + "\n");
  console.log(`Registrata ${file} al commit ${commit}.`);
  process.exit(0);
}

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

const reg = JSON.parse(fs.readFileSync(REGISTRO, "utf8"));
const presenti = new Set(fs.readdirSync(path.join(ROOT, DIR)).filter((f) => f.endsWith(".sql")));

console.log("\n§1 — il registro sta in piedi\n");
// Soglia dichiarata: sotto dieci il registro si è svuotato, e un cricchetto su
// un insieme vuoto è verde per niente (modo 2).
ok(reg.applicate.length >= 10, "il registro elenca almeno le dieci migrazioni verificate il 25/10", `${reg.applicate.length}`);
const nomi = reg.applicate.map((a) => a.file);
ok(new Set(nomi).size === nomi.length, "nessuna migrazione registrata due volte");
ok(reg.applicate.every((a) => a.file && a.commit && a.fonte), "ogni voce ha file, commit e fonte (chi l'ha vista applicata, e come)");

console.log("\n§2 — nessuna migrazione applicata è cambiata nel codice\n");
for (const a of reg.applicate) {
  if (!presenti.has(a.file)) {
    ok(false, `${a.file}: esiste`, "il file non c'è più: una migrazione applicata non si cancella");
    continue;
  }
  const allora = aCommit(a.commit, a.file);
  if (allora === null) {
    // Non si passa in silenzio: un cricchetto che non può confrontare non sorveglia.
    ok(false, `${a.file}: il commit ${a.commit} si legge`, "commit irraggiungibile o file assente a quel commit — non ho potuto guardare (clone parziale?)");
    continue;
  }
  const ora = fs.readFileSync(path.join(ROOT, DIR, a.file), "utf8");
  const uguale = codice(ora) === codice(allora);
  let dove = "";
  if (!uguale) {
    const x = codice(ora);
    const y = codice(allora);
    let i = 0;
    while (i < x.length && x[i] === y[i]) i++;
    dove = `diverge dal carattere ${i}: ora «…${x.slice(i, i + 80)}…» / applicata «…${y.slice(i, i + 80)}…». Si riporta il file al commit ${a.commit} e il cambiamento va in una migrazione NUOVA`;
  }
  ok(uguale, `${a.file}: il codice è quello applicato (${a.commit})`, dove);
}

console.log("\n§3 — quanto copre\n");
const scoperte = [...presenti].filter((f) => !nomi.includes(f)).length;
console.log(`  · ${reg.applicate.length} migrazioni protette su ${presenti.size}; ${scoperte} non registrate.`);
console.log("    Non vuol dire «non applicate»: vuol dire «non so, e quindi non le proteggo».");

console.log("");
if (falliti) {
  console.log(`✗ ${fatte - falliti}/${fatte} proprietà verificate.`);
  process.exit(1);
}
console.log(`✓ ${fatte}/${fatte} proprietà verificate.`);
