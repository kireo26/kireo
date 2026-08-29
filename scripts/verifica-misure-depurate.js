// Il TERZO punto della precondizione: qualcosa che diventa rosso quando
// qualcuno aggiunge una misura e si dimentica di escludere gli account di
// prova.
//
// Senza questo, il secondo punto (le misure depurate) dura fino alla prossima
// query. E il costo di accorgersene tardi è quello che conosciamo: le righe
// sporcate non si distinguono a posteriori, quindi una misura contaminata non
// si ripara — si butta.
//
// COSA CONTROLLA, e cosa no. Scandisce i file di misura (SQL e JS che leggono
// il database) e per ognuno chiede: nomina una tabella che discende da uno
// studente? Allora deve contenere il predicato `e_profilo_di_prova`, oppure
// una voce di esenzione con la sua ragione. È un controllo LESSICALE: non sa
// se il filtro è nel posto giusto della query, sa che c'è. Un controllo che
// non sa tutto è comunque quello che il 30 agosto non c'era.
//
// Esecuzione: `npm run test:prova`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

// Le tabelle le cui righe DISCENDONO da uno studente: se una misura le legge,
// sta descrivendo persone, e un account di prova le sporca.
// (Non ci sono `guardia_lingua_giorno` né `revisore_esiti`: quelle descrivono
// il MODELLO, e il robot le arricchisce invece di sporcarle — vedi la
// migration 20260830100000.)
const TABELLE_DI_STUDENTI = [
  "evidence",
  "area_signal",
  "style_signal",
  "mission_attempt",
  "step_response",
  "test_attempt",
  "test_response",
  "activity_log",
  "journal_entry",
  "portfolio_item",
  "workshop_iscrizioni",
  "workshop_elaborati",
  "workshop_fasi_stato",
  "workshop_consegne",
  "workshop_chat_cliente",
  "score_aree",
];

const PREDICATO = "e_profilo_di_prova";

// Esenzioni per FILE INTERO, ognuna con la sua ragione — mai per pattern, e
// mai senza dire perché. Stessa regola della whitelist del tripwire: un
// elenco di eccezioni senza motivi è un elenco che cresce.
const ESENTI = new Map([
  [
    "scripts/diagnostica-percorso.sql",
    "Da valutare insieme al primo giro del robot: alcune di queste viste contano quanti studenti hanno fatto cosa, e lì il filtro va messo; altre servono a controllare il robot stesso. Finché il robot non esiste, il file non è ancora stato deciso.",
  ],
]);

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

function fileDiMisura() {
  const dir = path.join(ROOT, "scripts");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql") || f.endsWith(".js"))
    .map((f) => path.join("scripts", f))
    .filter((rel) => {
      const testo = fs.readFileSync(path.join(ROOT, rel), "utf8");
      // Solo chi legge davvero il database: uno script che nomina una tabella
      // in un commento non è una misura.
      return /from public\.|\.from\(|rest\/v1\//.test(testo);
    });
}

console.log("\n═══ Le misure escludono gli account di prova ═══\n");

const files = fileDiMisura();
ok(files.length > 0, `trovati ${files.length} file che leggono il database`);

for (const rel of files) {
  const testo = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const nominate = TABELLE_DI_STUDENTI.filter((t) => new RegExp(`(from|join)\\s+public\\.${t}\\b|\\.from\\("${t}"`).test(testo));
  if (nominate.length === 0) continue;

  const ragione = ESENTI.get(rel);
  if (ragione) {
    ok(true, `${rel} — esente, con ragione: ${ragione.slice(0, 60)}…`);
    continue;
  }
  ok(
    testo.includes(PREDICATO),
    `${rel} legge ${nominate.join(", ")} e ${testo.includes(PREDICATO) ? "esclude" : "NON esclude"} i profili di prova` +
      (testo.includes(PREDICATO) ? "" : `\n      → aggiungi una condizione con ${PREDICATO}(<colonna dello studente>), oppure una voce in ESENTI con la ragione.`),
  );
}

// Le esenzioni orfane: un file esentato che non esiste più, o che non nomina
// più nessuna tabella di studenti, lascia in giro un permesso che nessuno ha
// più chiesto — e la volta dopo qualcuno ci si appoggia.
for (const [rel] of ESENTI) {
  const percorso = path.join(ROOT, rel);
  const esiste = fs.existsSync(percorso);
  const serve = esiste && TABELLE_DI_STUDENTI.some((t) => new RegExp(`(from|join)\\s+public\\.${t}\\b`).test(fs.readFileSync(percorso, "utf8")));
  ok(serve, `l'esenzione di ${rel} serve ancora${serve ? "" : esiste ? " — il file non legge più tabelle di studenti: toglila" : " — il file non esiste più: toglila"}`);
}

// Il predicato deve esistere davvero: un filtro che chiama una funzione
// inesistente fallisce alla prima esecuzione, e in un file SQL che si lancia a
// mano quel fallimento arriva mesi dopo.
const migrazioni = fs.readdirSync(path.join(ROOT, "supabase", "migrations"));
const definito = migrazioni.some((m) => fs.readFileSync(path.join(ROOT, "supabase", "migrations", m), "utf8").includes(`function public.${PREDICATO}(`));
ok(definito, `${PREDICATO} è definito in una migration`);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(`✗ ${falliti} controlli falliti.`);
  console.error("  Una misura che non esclude gli account di prova non si ripara a posteriori:");
  console.error("  le righe sporcate non si distinguono più. Si butta.\n");
  process.exit(1);
}
console.log("✓ Ogni misura sugli studenti esclude gli account di prova, o dice perché no.\n");
