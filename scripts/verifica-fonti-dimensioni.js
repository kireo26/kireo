// DA QUALE FONTE NASCE QUALE DIMENSIONE — e la conseguenza, tenuta ferma.
//
// PERCHÉ ESISTE. «Una fonte che non scrive `interest` non potrà mai produrre
// un'affinità» è stata scritta tre volte in tre posti e ignorata tutte e tre le
// volte da chi l'aveva scritta: il 28/09 in `lib/eventi/consegna.ts`, il 28/09
// in `lib/live.ts`, il 4/10 in un messaggio che la enunciava per esteso e sei
// righe sotto sommava pesi come se non valesse. I primi due commenti stavano
// accanto a CHI LEGGE `interest_score` — e chi rompe la regola non tocca chi
// legge: la tocca chi AGGIUNGE UNA SORGENTE.
//
// Quindi la tabella vive in `lib/escape/fonti.ts`, nel punto in cui si scrive
// `fonte → dimensione`, e questo controllo verifica che ogni sorgente scriva
// DAVVERO quello che la tabella dichiara. Una quinta sorgente aggiunta senza
// una riga là dentro diventa rossa; una sorgente che comincia a scrivere una
// dimensione nuova senza aggiornare la tabella, pure.
//
// LE DUE METÀ DEL CONTROLLO: cosa guarda (le dimensioni estratte dai file veri)
// e cosa decide (il confronto con la tabella). La prima si sorveglia da sé —
// sotto una soglia di dimensioni trovate l'estrattore DICHIARA di aver smesso
// di leggere, invece di passare in silenzio su un insieme vuoto.
//
// Esecuzione: `npm run test:fonti`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();
const { DIMENSIONI_PER_FONTE, FONTI_VIVE, scriveInteresse, puoProdurreAffinita } = require("@/lib/escape/fonti");
const { eleggibilePerAffinita, SOGLIA_AFFINITA } = require("@/lib/percorso/stato");

let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
};

const leggiTs = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const leggiSql = (rel) => senzaCommentiSql(fs.readFileSync(path.join(ROOT, rel), "utf8"));

const DIMENSIONI = ["interest", "performance", "self_efficacy", "curiosity"];

// Le dimensioni che un file TypeScript scrive davvero: `dimensione: "X"`.
function dimensioniTs(rel) {
  const src = leggiTs(rel);
  const trovate = new Set();
  for (const m of src.matchAll(/dimensione:\s*"(\w+)"/g)) if (DIMENSIONI.includes(m[1])) trovate.add(m[1]);
  return trovate;
}

// Le dimensioni che una migrazione scrive: `'X'::public.escape_dimensione`.
function dimensioniSql(rel) {
  const src = leggiSql(rel);
  const trovate = new Set();
  for (const m of src.matchAll(/'(\w+)'::public\.escape_dimensione/g)) if (DIMENSIONI.includes(m[1])) trovate.add(m[1]);
  return trovate;
}

// Dove scrive ciascuna fonte viva. È l'unica tabella scritta a mano in questo
// file, e dice DOVE guardare — non COSA aspettarsi: quello lo dice
// DIMENSIONI_PER_FONTE, ed è il confronto a essere il controllo.
const DOVE = {
  mission: { tipo: "ts", file: "lib/escape/scoring.ts" },
  test: { tipo: "ts", file: "lib/test/scoring.ts" },
  evento: { tipo: "ts", file: "lib/eventi/consegna.ts" },
  presenza: { tipo: "sql", file: "supabase/migrations/20261004160000_presenza_profilo.sql" },
};

console.log("\n═══ Fonte → dimensione, e la conseguenza ═══\n");

// ── 1) l'estrattore si sorveglia da sé ──────────────────────────────────────
// Un estrattore che non trova niente rende VERDE ogni confronto su un insieme
// vuoto: è la risposta comoda, e nessuno va a ricontrollare una buona notizia.
console.log("1) L'estrattore dice quanto ha letto");

const lette = {};
for (const fonte of FONTI_VIVE) {
  const d = DOVE[fonte];
  lette[fonte] = d.tipo === "ts" ? dimensioniTs(d.file) : dimensioniSql(d.file);
}
const totaleLette = Object.values(lette).reduce((n, s) => n + s.size, 0);
ok(
  totaleLette >= 6,
  `l'estrattore ha trovato ${totaleLette} dimensioni nelle ${FONTI_VIVE.length} fonti vive (sotto 6 dichiarerebbe di aver smesso di leggere)`,
);
for (const fonte of FONTI_VIVE) {
  ok(lette[fonte].size > 0, `…e almeno una in \`${fonte}\` (${DOVE[fonte].file})`);
}

// ── 2) ogni fonte scrive quello che la tabella dichiara ─────────────────────
console.log("\n2) Quello che la tabella dichiara è quello che il codice scrive");

for (const fonte of FONTI_VIVE) {
  const dichiarate = [...DIMENSIONI_PER_FONTE[fonte]].sort();
  const trovate = [...lette[fonte]].sort();
  ok(
    JSON.stringify(dichiarate) === JSON.stringify(trovate),
    `\`${fonte}\` → dichiarate [${dichiarate.join(", ")}], trovate [${trovate.join(", ")}]`,
  );
}

// ── 3) le due predisposte non hanno scrittori ───────────────────────────────
console.log("\n3) Le predisposte restano senza scrittori");

for (const fonte of ["workshop", "activity"]) {
  ok(
    DIMENSIONI_PER_FONTE[fonte].length === 0,
    `\`${fonte}\` non dichiara nessuna dimensione: il cross-feed è rinviato`,
  );
  ok(
    !FONTI_VIVE.includes(fonte),
    `…e non è fra le fonti vive (il giorno che si accende, è quella riga a cambiare)`,
  );
}

// ── 4) l'enum SQL e le chiavi della tabella sono lo stesso insieme ──────────
// Una fonte aggiunta in SQL e dimenticata qui vorrebbe dire scrivere righe con
// una provenienza che nessuno sa leggere; il contrario, una tabella che parla
// di una fonte che il database rifiuta.
console.log("\n4) L'enum del database e la tabella coincidono");

const migrazioni = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
const valoriEnum = new Set();
for (const f of migrazioni) {
  const src = senzaCommentiSql(fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
  const creazione = /create type public\.escape_fonte as enum \(([^)]*)\)/.exec(src);
  if (creazione) for (const m of creazione[1].matchAll(/'(\w+)'/g)) valoriEnum.add(m[1]);
  for (const m of src.matchAll(/alter type public\.escape_fonte add value if not exists '(\w+)'/g))
    valoriEnum.add(m[1]);
}
ok(valoriEnum.size >= 5, `l'estrattore ha letto ${valoriEnum.size} valori di escape_fonte dalle migrazioni`);

const chiaviTabella = [...Object.keys(DIMENSIONI_PER_FONTE)].sort();
ok(
  JSON.stringify([...valoriEnum].sort()) === JSON.stringify(chiaviTabella),
  `enum [${[...valoriEnum].sort().join(", ")}] = tabella [${chiaviTabella.join(", ")}]`,
);

// ── 5) LA CONSEGUENZA, eseguita invece che affermata ────────────────────────
// `eleggibilePerAffinita` chiede `interest_score !== null`: una fonte che non
// scrive `interest` non lo valorizza, quindi non porta un'area in classifica
// per nessun peso. Qui si esegue il predicato vero, non si ripete la frase.
console.log("\n5) La conseguenza, eseguita");

ok(
  !eleggibilePerAffinita({ confidence: 1, interest_score: null }),
  "confidence massima e interesse nullo: NON eleggibile (è la metà che rende vera la frase)",
);
ok(
  eleggibilePerAffinita({ confidence: SOGLIA_AFFINITA, interest_score: 1 }),
  "…e con un interesse, alla soglia, eleggibile: la barra non è diventata irraggiungibile",
);

for (const fonte of Object.keys(DIMENSIONI_PER_FONTE)) {
  const atteso = DIMENSIONI_PER_FONTE[fonte].includes("interest");
  ok(
    puoProdurreAffinita(fonte) === atteso && scriveInteresse(fonte) === atteso,
    `\`${fonte}\`: ${atteso ? "può" : "NON può"} produrre un'affinità da sola`,
  );
}

const senzaInteresse = Object.keys(DIMENSIONI_PER_FONTE).filter((f) => !scriveInteresse(f));
ok(
  senzaInteresse.includes("evento") && senzaInteresse.includes("presenza"),
  `una consegna e una presenza stanno fra le fonti senza interesse: [${senzaInteresse.join(", ")}]`,
);
ok(
  FONTI_VIVE.filter((f) => scriveInteresse(f)).join(",") === "mission,test",
  "e l'interesse lo scrivono solo i test e le missioni",
);

// ── 6) la conseguenza è SCRITTA dove si scelgono le dimensioni ─────────────
// Non basta che sia vera: deve essere leggibile da chi aggiungerà la quinta
// fonte, che passa da qui e non da chi legge `interest_score`.
console.log("\n6) …e sta scritta dove qualcuno la leggerà");

const fontiTs = fs.readFileSync(path.join(ROOT, "lib/escape/fonti.ts"), "utf8");
ok(
  /non potrà MAI|non potrà mai/.test(fontiTs) && /affinità/.test(fontiTs),
  "la conseguenza è scritta accanto alla tabella, non solo implicita nel codice",
);
ok(
  /DECISIONE DI PRODOTTO/.test(fontiTs),
  "…e dice che cambiarla non è di chi scrive codice: senza quella riga, il prossimo la aggira",
);

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
