// La regola «quale iscrizione stai guardando», provata da sola.
//
// PERCHÉ ESISTE. Il 2026-08-31 il robot si è fermato al secondo giro su
// «la tappa non risulta inizializzata». La causa non era sua: due pagine su tre
// cercavano l'iscrizione con `.eq(…).maybeSingle()`, che con due righe **non
// prende la prima, fallisce**. Nessun errore guardato, `iscrizione` vuota,
// `redirect` alla pagina di prima — lo studente clicca «Vai al progetto» e
// torna dov'era, senza una riga nei log.
//
// Righe multiple sono diventate possibili il giorno prima, togliendo
// `unique (workshop_id, student_id)` perché impediva di cambiare ruolo. La
// regressione è arrivata poche ore dopo, e a trovarla è stato l'unico che si è
// iscritto due volte allo stesso workshop.
//
// Esecuzione: `npm run test:iscrizione`.

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
require.extensions[".ts"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { scegliIscrizione, STATI_APRIBILI, PRIORITA_STATI } = require("@/lib/workshop/iscrizioneCorrente");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

console.log("\n═══ Quale iscrizione stai guardando ═══\n");

const riga = (id, stato, created_at) => ({ id, stato, created_at });

// ── il caso reale del 31 agosto ────────────────────────────────────────────
// Il robot: una completata di stamattina, una attiva di adesso.
const caso31 = [riga("nuova", "attivo", "2026-08-31T14:00:00Z"), riga("vecchia", "completato", "2026-08-31T09:00:00Z")];
ok(scegliIscrizione(caso31)?.id === "nuova", "con una completata e una attiva prende l'ATTIVA — è il caso che ha rotto due pagine");
ok(scegliIscrizione(caso31, STATI_APRIBILI)?.id === "nuova", "…e la stessa cosa per le pagine di lavoro");

// L'ordine in cui arrivano non deve contare: la priorità è per stato.
const invertito = [...caso31].reverse();
ok(scegliIscrizione(invertito)?.id === "nuova", "l'ordine delle righe non cambia la scelta: decide lo stato, non l'arrivo");

// ── la catena, anello per anello ───────────────────────────────────────────
ok(scegliIscrizione([riga("c", "completato", "2026-01-01")])?.id === "c", "senza attive apre la completata: il proprio 71/100 si rilegge");
ok(scegliIscrizione([riga("r", "ritirato", "2026-01-01")])?.id === "r", "senza attive né completate resta la lasciata");
ok(scegliIscrizione([]) === null, "e con nessuna riga la risposta è nessuna, non un'eccezione");
ok(scegliIscrizione(null) === null, "…anche quando la lettura è andata storta e non c'è niente da scegliere");

// ── la politica delle pagine di lavoro ─────────────────────────────────────
// Progetto e chat NON si aprono su un'iscrizione lasciata: la pagina del
// workshop la accoglie con il pannello che offre di riprenderla.
ok(scegliIscrizione([riga("r", "ritirato", "2026-01-01")], STATI_APRIBILI) === null, "progetto e chat non si aprono su un'iscrizione lasciata");
ok(scegliIscrizione([riga("r", "ritirato", "2026-01-01")], ["ritirato"])?.id === "r", "…che però la pagina del workshop trova, per proporre di riprenderla");

// ── due righe nello stesso stato ───────────────────────────────────────────
// «attivo» è protetto dall'indice unico parziale, «ritirato» no: chi ha
// lasciato due ruoli diversi ne ha due, e si guarda l'ultima.
const dueLasciate = [riga("vecchia", "ritirato", "2026-03-01"), riga("recente", "ritirato", "2026-07-01")];
ok(scegliIscrizione(dueLasciate)?.id === "recente", "fra due lasciate prende la più recente");

// ── uno stato sconosciuto non deve passare per buono ───────────────────────
ok(scegliIscrizione([riga("x", "boh", "2026-01-01")]) === null, "uno stato che non conosciamo non viene scelto: meglio nessuna che quella sbagliata");

// ── la catena è quella dichiarata ──────────────────────────────────────────
ok(PRIORITA_STATI.join(" → ") === "attivo → completato → ritirato", "la catena scritta nel codice è quella concordata");
ok(STATI_APRIBILI.join(",") === "attivo,completato", "e le pagine di lavoro si fermano al secondo anello");

// ── che le tre pagine la usino davvero ─────────────────────────────────────
// Una regola in un posto solo vale finché nessuno se ne scrive una sua: qui si
// controlla il testo dei tre file, perché è l'unica cosa che si può guardare
// senza una sessione vera.
for (const rel of [
  "app/app/workshop/[slug]/page.tsx",
  "app/app/workshop/[slug]/progetto/page.tsx",
  "app/app/workshop/[slug]/cliente/page.tsx",
]) {
  const testo = fs.readFileSync(path.join(ROOT, rel), "utf8");
  ok(testo.includes("scegliIscrizione"), `${rel.split("/").slice(-2).join("/")}: usa la regola condivisa`);
  ok(
    !/from\("workshop_iscrizioni"\)[\s\S]{0,400}?maybeSingle\(\)/.test(testo),
    `${rel.split("/").slice(-2).join("/")}: nessun maybeSingle() su workshop_iscrizioni — è quello che falliva su due righe`,
  );
}

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Una sola regola, e le tre pagine la chiamano.\n");
