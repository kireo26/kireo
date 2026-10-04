// LA FRASE DEL CONTATORE PCTO — singolare, separatore, arrotondamento.
//
// PERCHÉ ESISTE. «1 ore certificate su 90», visto a schermo il 4/10 con un'ora
// sola. Il difetto si vede SOLO sui numeri interi (`0,5 ore` è giusto, `1 ore`
// no), e nella stessa frase ce n'erano altri due che nessuno ha mai visto
// perché nessuno studente ha ancora ore frazionarie: il separatore col punto
// (`{ore}` grezzo in JSX, che la guardia di `test:date` non vede — lì il
// difetto è l'ASSENZA di una formattazione) e il rumore della virgola mobile
// (`1,1 + 2,2` in JS fa `3.3000000000000003`, su colonne a un decimale).
//
// LE DUE METÀ DEL CONTROLLO. Cosa guarda: la frase prodotta dalla funzione
// vera, chiamata con i numeri che il database può davvero produrre. Cosa
// decide: che le due superfici la CHIAMINO invece di riscriverla — senza
// quella metà, la terza copia nasce domani e divergerà come le prime due.
//
// Esecuzione: `npm run test:ore`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./lib/senza-commenti");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();
const { testoOreCertificate, TRAGUARDO_ORE_PCTO } = require("@/lib/app/pcto");

let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
};

const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

console.log("\n═══ La frase delle ore certificate ═══\n");

// ── 1) il singolare, e solo a uno esatto ────────────────────────────────────
// In italiano il singolare lo prende ESATTAMENTE l'uno: lo zero e le frazioni
// prendono il plurale. Non `<= 1`, che è l'errore simmetrico.
console.log("1) Il singolare solo a uno esatto");

ok(testoOreCertificate(1) === "1 ora certificata su 90", `1 → «${testoOreCertificate(1)}»`);
ok(testoOreCertificate(0) === "0 ore certificate su 90", `0 → «${testoOreCertificate(0)}» (lo zero è plurale)`);
ok(testoOreCertificate(0.5) === "0,5 ore certificate su 90", `0,5 → «${testoOreCertificate(0.5)}» (era già giusto)`);
ok(testoOreCertificate(1.5) === "1,5 ore certificate su 90", `1,5 → «${testoOreCertificate(1.5)}»`);
ok(testoOreCertificate(2) === "2 ore certificate su 90", `2 → «${testoOreCertificate(2)}»`);

// ── 2) il separatore italiano ───────────────────────────────────────────────
console.log("\n2) La virgola, non il punto");

for (const n of [0.5, 1.5, 2.5, 12.5]) {
  const t = testoOreCertificate(n);
  ok(!t.includes("."), `${n} → «${t}» senza punto decimale`);
}

// ── 3) il rumore della virgola mobile ───────────────────────────────────────
// I valori veri: colonne `numeric(5,1)` sommate in JavaScript.
console.log("\n3) Il rumore della somma non arriva a schermo");

const rumorosi = [
  [1.1 + 2.2, "3,3"],
  [0.3 + 0.3 + 0.3, "0,9"],
  [0.5 + 0.1, "0,6"],
];
for (const [n, atteso] of rumorosi) {
  const t = testoOreCertificate(n);
  ok(t.startsWith(`${atteso} `), `${n} → «${t}» (atteso «${atteso} …»)`);
  ok(!/\d{4,}/.test(t), `…e nessuna coda di cifre: «${t}»`);
}

// ── 4) IL SINGOLARE SI DECIDE SUL NUMERO MOSTRATO ───────────────────────────
// La trappola di questa funzione. Un valore che arrotondato si stampa «1» deve
// prendere il singolare: se il confronto guardasse il grezzo, la frase
// direbbe «1 ore certificate» — il difetto di partenza, ricreato dalla cura.
console.log("\n4) Il singolare segue il numero come viene mostrato");

for (const n of [0.99, 1.02, 0.9999999999, 1 - Number.EPSILON]) {
  const t = testoOreCertificate(n);
  ok(t === "1 ora certificata su 90", `${n} → «${t}»`);
}
// E il confine: a 0,95 si arrotonda a 1,0 (singolare), a 0,94 a 0,9 (plurale).
ok(testoOreCertificate(0.95) === "1 ora certificata su 90", `0,95 → «${testoOreCertificate(0.95)}»`);
ok(testoOreCertificate(0.94) === "0,9 ore certificate su 90", `0,94 → «${testoOreCertificate(0.94)}»`);

// ── 5) il traguardo non ha una seconda strada ───────────────────────────────
console.log("\n5) Il traguardo passa dallo stesso formattatore");

ok(TRAGUARDO_ORE_PCTO === 90, `il traguardo è ${TRAGUARDO_ORE_PCTO}`);
ok(
  testoOreCertificate(1).endsWith(`su ${TRAGUARDO_ORE_PCTO}`),
  "…e la frase lo legge dalla costante invece di scriverlo a mano",
);

// ── 6) LA METÀ STRUTTURALE: nessuno riscrive la frase ───────────────────────
// Le due superfici la mostrano; nessuna delle due la ricompone. Se nascesse
// una terza copia, divergerebbe come le prime due — che sono rimaste identiche
// per caso, non per un controllo.
console.log("\n6) Le superfici la chiamano, non la riscrivono");

const SUPERFICI = ["components/app/ContatorePCTO.tsx", "app/app/attivita/page.tsx"];
for (const f of SUPERFICI) {
  const src = leggi(f);
  ok(/testoOreCertificate\(/.test(src), `${f} chiama \`testoOreCertificate\``);
}

// Nessun altro file del prodotto compone la frase a mano. Si cerca la coppia
// numero-più-nome, che è la forma del difetto: il nome da solo compare in
// frasi legittime («Le ore certificate compariranno qui»).
const rinate = [];
for (const dir of ["app", "components"]) {
  const pila = [path.join(ROOT, dir)];
  while (pila.length) {
    const corrente = pila.pop();
    for (const voce of fs.readdirSync(corrente, { withFileTypes: true })) {
      const p = path.join(corrente, voce.name);
      if (voce.isDirectory()) pila.push(p);
      else if (voce.name.endsWith(".tsx")) {
        const src = senzaCommenti(fs.readFileSync(p, "utf8"));
        if (/\}\s*ore certificate|\}\s*ora certificata/.test(src)) rinate.push(path.relative(ROOT, p));
      }
    }
  }
}
ok(
  rinate.length === 0,
  rinate.length === 0
    ? "nessun .tsx compone la frase a mano"
    : `la frase è ricomposta a mano in: ${rinate.join(", ")}`,
);

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
