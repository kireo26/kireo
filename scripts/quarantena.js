// ⏳ LA QUARANTENA: lancia le sonde delle falle note e confronta con l'elenco.
//
// PERCHÉ ESISTE. Una sonda che dimostra una falla non ancora curata non può
// stare in `npm test` — sarebbe un rosso permanente, e «un rosso permanente è
// un rosso che qualcuno spegne». Ma se resta nello scratchpad MUORE LA
// CONOSCENZA, non il rosso: fra tre mesi nessuno saprà più *come* si
// dimostrava quella falla, e la si ritroverà da capo o non la si ritroverà
// affatto.
//
// LA FORMA. Le sonde sono scritte come le proprietà del sistema CURATO —
// asseriscono che il tentativo venga respinto — e vivono in
// `scripts/quarantena/`, dichiarate in `scripts/quarantena/elenco.js` con una
// data, la falla e la cura prevista. Il giorno della cura NON SI SCRIVE NIENTE
// DI NUOVO: si toglie un nome dall'elenco e si verifica che la sonda diventi
// verde.
//
// ⚠️ L'ELENCO SI ACCORCIA, NON SI ALLUNGA IN SILENZIO. Ogni voce dichiara
// quante proprietà sono rosse oggi, e se il numero cambia questo comando lo
// dice — nelle due direzioni, che hanno due significati opposti:
//
//   • MENO rosse → o la falla è stata curata altrove (bene: si promuove la
//     sonda fuori dalla quarantena) o la sonda ha smesso di guardare (male, ed
//     è il caso che nessuno andrebbe a ricontrollare, perché è una buona
//     notizia).
//   • PIÙ rosse → è diventata rossa una delle proprietà «che la cura può
//     rompere»: si è rotto qualcosa di buono.
//
// NON FALLISCE su una falla ancora rossa: è il suo mestiere. Fallisce solo se i
// numeri non corrispondono più a quello che l'elenco dichiara.
//
// COSA SERVE: una replica locale con tutte le migrazioni (istruzioni in testa a
// `scripts/replica-shim.sql`). Senza, DICHIARA di non aver guardato e stampa
// comunque l'elenco — perché l'elenco è la conoscenza, e vale anche senza un
// database. «Zero» e «non ho guardato» non si confondono.
//
// Esecuzione: `npm run quarantena`  (socket: $PGK_SOCK, default /tmp/pgk)

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const { spawnSync } = require("child_process");
const { QUARANTENA } = require("./quarantena/elenco");

const DIR = path.join(__dirname, "quarantena");
const SOCK = process.env.PGK_SOCK ?? "/tmp/pgk";

console.log("\n⏳ QUARANTENA — le falle note, come proprietà del sistema curato\n");

const pronta = spawnSync("pg_isready", ["-h", SOCK, "-q"], { encoding: "utf8" }).status === 0;
if (!pronta) {
  console.log(`  ⚠️ NON HO GUARDATO: nessuna replica su ${SOCK}.`);
  console.log("     Le istruzioni per costruirla sono in testa a scripts/replica-shim.sql.");
  console.log("     L'elenco resta, perché l'elenco è la conoscenza.\n");
}

let discordanze = 0;
for (const v of QUARANTENA) {
  console.log(`── ${v.file}   (${v.data})`);
  console.log(`   falla: ${v.falla}`);
  console.log(`   cura:  ${v.cura}`);

  if (!pronta) {
    console.log(`   esito: non ho guardato — ${v.rosse_attese} proprietà rosse dichiarate\n`);
    continue;
  }

  const r = spawnSync("psql", ["-h", SOCK, "-U", "postgres", "-d", "postgres", "-q", "-f", path.join(DIR, v.file)], {
    encoding: "utf8",
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const m = out.match(/(\d+) ROTTE/);
  if (!m) {
    discordanze++;
    console.log("   esito: ⚠️ la sonda non ha prodotto un riassunto — non si sa quante siano rosse");
    console.log(`          (coda: ${out.trim().split("\n").slice(-3).join(" | ")})\n`);
    continue;
  }
  const rosse = Number(m[1]);
  if (rosse === v.rosse_attese) {
    console.log(`   esito: ✓ ancora ${rosse} rosse, come dichiarato — la falla è ancora lì\n`);
  } else if (rosse < v.rosse_attese) {
    discordanze++;
    console.log(`   esito: ⚠️ ${rosse} rosse invece di ${v.rosse_attese} — O LA FALLA È CURATA (promuovi la sonda`);
    console.log("          fuori dalla quarantena) O LA SONDA HA SMESSO DI GUARDARE. Le due si distinguono");
    console.log("          solo leggendo la tabella delle proprietà.\n");
  } else {
    discordanze++;
    console.log(`   esito: ⚠️ ${rosse} rosse invece di ${v.rosse_attese} — è diventata rossa una proprietà in più,`);
    console.log("          probabilmente una di quelle «che la cura può rompere»: si è rotto qualcosa di buono.\n");
  }
}

if (pronta) {
  console.log(
    discordanze === 0
      ? `Le ${QUARANTENA.length} falle in quarantena sono dove le avevamo lasciate.\n`
      : `⚠️ ${discordanze} voci su ${QUARANTENA.length} non corrispondono a quello che l'elenco dichiara.\n`,
  );
}
process.exit(pronta && discordanze > 0 ? 1 : 0);
