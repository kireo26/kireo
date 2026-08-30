// Il TERZO punto della precondizione: qualcosa che diventa rosso quando
// qualcuno aggiunge una misura e si dimentica di escludere gli account di
// prova.
//
// Senza questo, il secondo punto (le misure depurate) dura fino alla prossima
// query. E il costo di accorgersene tardi è quello che conosciamo: le righe
// sporcate non si distinguono a posteriori, quindi una misura contaminata non
// si ripara — si butta.
//
// COSA CONTROLLA, e cosa no. Scandisce i file di misura e per ognuno chiede:
// nomina una tabella che discende da uno studente? Allora deve dire di sapere
// dei profili di prova, oppure avere una voce di esenzione con la sua ragione.
// È un controllo LESSICALE: non sa se il filtro è nel posto giusto della
// query, sa che c'è. Un controllo che non sa tutto è comunque quello che il 30
// agosto non c'era.
//
// DOVE GUARDA, e perché non ovunque. Gli script di `scripts/`, e i file
// dell'applicazione che usano il CLIENT SERVICE-ROLE. Quel client scavalca la
// RLS, quindi chi lo usa vede le righe di tutti gli studenti: se conta, sta
// misurando. Tutto il resto dell'app legge con la sessione di chi naviga e
// vede solo le proprie righe — non è una misura, e pretendere il predicato lì
// vorrebbe dire riempire questo file di esenzioni, che è la malattia che
// dichiara di voler evitare.
//
// L'ha imparata il 2026-08-31: l'alert di osservabilità viveva dentro
// `app/api/cron/`, e non sembrava una misura perché il mestiere principale di
// quella route è far avanzare le tappe. Ma le sue ultime centoventi righe
// contano righe che discendono da studenti e le mandano per mail a una
// persona — e mandavano i numeri del robot.
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

// Due forme, entrambe prove che il file sa dei profili di prova: la funzione
// (che è la definizione, e si usa in SQL) e la colonna che quella funzione
// legge — da PostgREST il predicato non si può mettere dentro un filtro, e chi
// deve escludere in memoria nomina la colonna. Controllo lessicale, quindi non
// distingue un filtro da un commento: dice che il file l'ha guardata in
// faccia, non che l'ha usata bene.
const PREDICATI = ["e_profilo_di_prova", "di_prova"];

// Non basta che la parola COMPAIA: deve comparire in posizione di codice. Al
// primo tentativo il controllo accettava `includes("di_prova")`, e due file
// passavano per una menzione dentro un commento — un via libera falso è
// peggio di nessun controllo, perché chiude la domanda invece di aprirla.
// Quindi: una chiamata al predicato, oppure la colonna dove la colonna si usa
// (una stringa di select PostgREST, un accesso a campo, un confronto, un
// parametro nominato).
const USI = [
  /e_profilo_di_prova\s*\(/,
  // Niente backtick: `di_prova` fra backtick è prosa in un commento, ed è
  // esattamente il falso via libera che questa lista è nata per chiudere.
  /["']di_prova["']/,
  /\.di_prova\b/,
  /\bdi_prova\s*[:=]/,
  /\bdi_prova\s*(is|=)\s/i,
  /\(\s*di_prova\b/,
];
const sa = (testo) => USI.some((re) => re.test(testo));

// Esenzioni per FILE INTERO, ognuna con la sua ragione — mai per pattern, e
// mai senza dire perché. Stessa regola della whitelist del tripwire: un
// elenco di eccezioni senza motivi è un elenco che cresce.
const ESENTI = new Map([
  [
    "scripts/verifica-completamento-ritiro.sql",
    "Non è una misura: crea i propri studenti finti dentro una transazione, prova undici proprietà e fa ROLLBACK. Non conta niente su nessuno, e le righe che tocca non esistono dopo.",
  ],
  [
    "scripts/banco/robot/gioca.js",
    "È il robot che gioca, non un conteggio: legge le PROPRIE righe per sapere a che punto è il suo percorso. Escludere i profili di prova qui vorrebbe dire escludere se stesso.",
  ],
  [
    "scripts/diagnostica-percorso.sql",
    "Da valutare insieme al primo giro del robot: alcune di queste viste contano quanti studenti hanno fatto cosa, e lì il filtro va messo; altre servono a controllare il robot stesso. Finché il robot non esiste, il file non è ancora stato deciso.",
  ],
]);

// Una sola definizione di «questo file nomina una tabella di studenti»: il
// controllo delle esenzioni orfane ne aveva una sua, che riconosceva solo la
// forma SQL — quindi un'esenzione su un file JS risultava sempre inutile e
// chiedeva di toglierla. Due copie della stessa domanda, e divergevano.
function tabelleNominate(testo) {
  return TABELLE_DI_STUDENTI.filter((t) => new RegExp(`(from|join)\\s+public\\.${t}\\b|\\.from\\("${t}"`).test(testo));
}

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Ricorsiva: le trappole del banco e le route stanno in sottocartelle, e un
// `readdirSync` piatto le salta in silenzio — è già successo, lo stesso
// giorno, con il file di una trappola che nessuno leggeva.
function tuttiIFile(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...tuttiIFile(p, ext));
    else if (ext.some((e) => voce.name.endsWith(e))) out.push(p);
  }
  return out;
}

function fileDiMisura() {
  const candidati = [
    ...tuttiIFile(path.join(ROOT, "scripts"), [".sql", ".js"]),
    // I file dell'applicazione che usano la service-role: sono gli unici che
    // vedono le righe di tutti gli studenti.
    ...tuttiIFile(path.join(ROOT, "app"), [".ts"]).filter((p) => fs.readFileSync(p, "utf8").includes("serviceRole")),
    ...tuttiIFile(path.join(ROOT, "lib"), [".ts"]).filter((p) => fs.readFileSync(p, "utf8").includes("serviceRole")),
  ];
  return candidati
    .map((p) => path.relative(ROOT, p))
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
  const nominate = tabelleNominate(testo);
  if (nominate.length === 0) continue;

  const ragione = ESENTI.get(rel);
  if (ragione) {
    ok(true, `${rel} — esente, con ragione: ${ragione.slice(0, 60)}…`);
    continue;
  }
  ok(
    sa(testo),
    `${rel} legge ${nominate.join(", ")} e ${sa(testo) ? "esclude" : "NON esclude"} i profili di prova` +
      (sa(testo) ? "" : `\n      → aggiungi una condizione con ${PREDICATI[0]}(<colonna dello studente>), oppure escludili leggendo la colonna di_prova, oppure una voce in ESENTI con la ragione.`),
  );
}

// Le esenzioni orfane: un file esentato che non esiste più, o che non nomina
// più nessuna tabella di studenti, lascia in giro un permesso che nessuno ha
// più chiesto — e la volta dopo qualcuno ci si appoggia.
for (const [rel] of ESENTI) {
  const percorso = path.join(ROOT, rel);
  const esiste = fs.existsSync(percorso);
  const serve = esiste && tabelleNominate(fs.readFileSync(percorso, "utf8")).length > 0;
  ok(serve, `l'esenzione di ${rel} serve ancora${serve ? "" : esiste ? " — il file non legge più tabelle di studenti: toglila" : " — il file non esiste più: toglila"}`);
}

// Il predicato deve esistere davvero: un filtro che chiama una funzione
// inesistente fallisce alla prima esecuzione, e in un file SQL che si lancia a
// mano quel fallimento arriva mesi dopo.
const migrazioni = fs.readdirSync(path.join(ROOT, "supabase", "migrations"));
const definito = migrazioni.some((m) => fs.readFileSync(path.join(ROOT, "supabase", "migrations", m), "utf8").includes(`function public.${PREDICATI[0]}(`));
ok(definito, `${PREDICATI[0]} è definito in una migration`);

// IL PRODUTTORE, non solo i lettori. Il 2026-08-31 `guardia_lingua_giorno`
// aveva la colonna, la chiave primaria a due campi e la ragione scritta — e
// nessuno la scriveva: `registra_guardia_lingua` ha un default sul secondo
// parametro, quindi la chiamata vecchia continuava a funzionare senza dire
// niente. Un default retrocompatibile nasconde un collegamento mancante.
const contatore = fs.readFileSync(path.join(ROOT, "lib", "lingua", "contatoreGuardia.ts"), "utf8");
ok(
  /p_di_prova\s*:/.test(contatore),
  "il contatore della guardia PASSA p_di_prova: una separazione non scritta è peggio di una non costruita, perché sembra fatta",
);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(`✗ ${falliti} controlli falliti.`);
  console.error("  Una misura che non esclude gli account di prova non si ripara a posteriori:");
  console.error("  le righe sporcate non si distinguono più. Si butta.\n");
  process.exit(1);
}
console.log("✓ Ogni misura sugli studenti esclude gli account di prova, o dice perché no.\n");
