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
    "scripts/verifica-scrittura-dal-client.sql",
    "Non è una misura: è la rassegna delle policy di scrittura del 4/10. Crea i propri studenti e il proprio ente finti dentro una transazione, PROVA A SCRIVERE le righe che non devono passare (fra cui su evidence, area_signal, presenze_live e student_activities) e fa ROLLBACK. Nomina quelle tabelle perché le sta provando, non perché conti qualcosa su una popolazione di studenti. OTTAVA volta che un controllo lessicale viene letto come una misura da un altro controllo lessicale: la cura resta l'esenzione con la ragione scritta, non il pattern allargato.",
  ],
  [
    "scripts/verifica-completamento-ritiro.sql",
    "Non è una misura: crea i propri studenti finti dentro una transazione, prova undici proprietà e fa ROLLBACK. Non conta niente su nessuno, e le righe che tocca non esistono dopo.",
  ],
  [
    "scripts/verifica-test-senza-prove.sql",
    "Stessa specie di verifica-completamento-ritiro.sql: crea il proprio studente finto e i propri tentativi dentro una transazione, prova sei proprietà e fa ROLLBACK. Non conta niente su nessuno, e le righe che tocca non esistono dopo.",
  ],
  [
    "scripts/verifica-cancelli-percorso.sql",
    "Stessa specie dei due file qui sotto: crea i propri studenti finti e il proprio workshop finto dentro una transazione, prova nove proprietà dei cancelli e fa ROLLBACK. Non conta niente su nessuno.",
  ],
  [
    "scripts/verifica-missione-senza-prove.sql",
    "La gemella del file qui sopra, per le missioni: stesso studente finto dentro una transazione, stesse sei proprietà, stesso ROLLBACK.",
  ],
  [
    "scripts/verifica-consegna-evento.js",
    "Non è una misura: è il controllo della consegna di una diretta. Nomina `evidence` dentro le stringhe di TARATURA con cui prova il giudizio (un client finto, nessuna rete) e dentro le ancore lessicali sulla migrazione. QUARTA volta che un controllo lessicale viene letto come una misura da un altro controllo lessicale (dopo verifica-motore-cron.js il 13/09, verifica-guardie-null.js il 26/09 e verifica-badge-confidence.sql): la cura resta l'esenzione con la ragione scritta, non il pattern allargato.",
  ],
  [
    "scripts/verifica-consegna-evento.sql",
    "Stessa specie: crea il proprio studente finto e il proprio evento dentro una transazione, prova le proprietà della consegna e fa ROLLBACK. Nomina evidence e area_signal perché le sta PROVANDO, non perché conti qualcosa su una popolazione di studenti.",
  ],
  [
    "scripts/verifica-risposte-e-letta.sql",
    "Stessa specie: crea i propri enti e studenti finti dentro una transazione, prova il conteggio delle risposte e la marcatura «letta», e fa ROLLBACK. Legge `evidence` per una ragione sola — verificare che segnare una consegna come letta NON scriva nessuna prova — cioè lo sta provando, non contando su una popolazione.",
  ],
  [
    "scripts/verifica-allarme-evento-senza-aree.sql",
    "Stessa specie ancora: crea il proprio ente finto, i propri studenti e cinque eventi dentro una transazione, chiude le dirette e fa ROLLBACK. Legge activity_log perché deve verificare che il credito arrivi quando l'area c'è e non arrivi quando manca — cioè lo sta PROVANDO, non contando su una popolazione. QUINTA volta che un controllo lessicale viene letto come una misura da un altro controllo lessicale: la cura resta l'esenzione con la ragione scritta.",
  ],
  [
    "scripts/verifica-presenza-profilo.sql",
    "Stessa specie: crea il proprio ente finto, i propri studenti, una scuola e quattro eventi dentro una transazione, prova venticinque proprietà (la policy di insert che non è self-service, la prova della presenza, il cap che registra quello che scarta) e fa ROLLBACK. Legge `evidence`, `area_signal` e `activity_log` perché sono esattamente le tabelle di cui sta provando il comportamento — cioè lo sta PROVANDO, non contando su una popolazione. SETTIMA volta che un controllo lessicale viene letto come una misura da un altro controllo lessicale: la cura resta l'esenzione con la ragione scritta, non il pattern allargato.",
  ],
  [
    "scripts/verifica-finestra-presenza.sql",
    "Stessa specie: crea il proprio ente finto, due studenti e quattro eventi dentro una transazione, prova tredici proprietà della finestra della presenza e fa ROLLBACK. Legge activity_log per una ragione sola — verificare che una seconda chiusura non scriva una seconda riga — cioè lo sta PROVANDO, non contando su una popolazione. SESTA volta che un controllo lessicale viene letto come una misura da un altro controllo lessicale: la cura resta l'esenzione con la ragione scritta, non il pattern allargato.",
  ],
  [
    "scripts/verifica-badge-confidence.sql",
    "Stessa specie: crea il proprio studente finto e le proprie prove dentro una transazione, prova sei proprietà del badge «confermata» e fa ROLLBACK. Nomina area_signal perché la sta PROVANDO, non perché conti qualcosa su una popolazione di studenti.",
  ],
  // ⚠️ LE TRE SONDE IN QUARANTENA (5/10/2026). Stessa specie delle undici
  // sopra, e OTTAVA volta che un controllo lessicale viene letto come una
  // misura da un altro controllo lessicale: la cura resta l'esenzione con la
  // ragione scritta, non il pattern allargato.
  //
  // ⚠️ E UNA COSA DA NOMINARE INVECE DI SISTEMARE: dodici delle quindici voci
  // di questo elenco dicono la stessa frase — «crea la propria fixture dentro
  // una transazione, prova delle proprietà, fa ROLLBACK». Dodici copie della
  // stessa ragione sono la traccia di una REGOLA che manca, non di dodici
  // eccezioni. Non la si scrive qui perché la direzione dell'errore è quella
  // sbagliata: un'esenzione di CLASSE («una sonda che fa rollback») sbaglierebbe
  // verso il VERDE — una misura vera messa in `scripts/` con un `rollback;`
  // dentro passerebbe senza che nessuno se ne accorga — mentre un elenco
  // sbaglia verso il rosso, che si nota. Se un domani si vorrà la regola, la
  // decisione è questa, e va presa sapendolo.
  [
    "scripts/quarantena/tentativo-completato-non-congelato.sql",
    "Sonda in quarantena: crea i propri studenti e due tentativi di missione dentro una transazione, prova otto proprietà (tre rosse di proposito: un tentativo completato non è congelato) e fa ROLLBACK. Legge evidence, area_signal, mission_attempt e step_response perché sono esattamente le tabelle di cui sta provando il comportamento.",
  ],
  [
    "scripts/quarantena/t3-candidate-congelate.sql",
    "Sonda in quarantena: crea il proprio tentativo T3 e la riga sintetica `__t3_frozen__` dentro una transazione, prova che lo studente non la riscriva (rossa di proposito) e fa ROLLBACK. Nomina test_response perché la sta PROVANDO.",
  ],
  [
    "scripts/quarantena/diario-portfolio-attempt-altrui.sql",
    "Sonda in quarantena: crea due studenti con un tentativo ciascuno dentro una transazione, prova che un diario o un portfolio non si appendano al tentativo di un altro (due rosse di proposito) e fa ROLLBACK. Nomina mission_attempt e journal_entry perché le sta PROVANDO.",
  ],
  [
    "scripts/banco/robot/gioca.js",
    "È il robot che gioca, non un conteggio: legge le PROPRIE righe per sapere a che punto è il suo percorso. Escludere i profili di prova qui vorrebbe dire escludere se stesso.",
  ],
  [
    "scripts/banco/robot/giocaTest.js",
    "Stessa specie di gioca.js, con una ragione strutturale in più: qui il client è quello di SESSIONE (chiave anon + login dello studente), quindi la RLS lo tiene già dentro le proprie righe — un filtro sui profili di prova non escluderebbe nessuno, perché non c'è nessun altro da escludere.",
  ],
  [
    "scripts/banco/robot/giocaMissione.js",
    "Come giocaTest.js: il robot gioca la sua missione con il client di sessione, e le righe che legge (mission_attempt, step_response, evidence) sono già solo le sue per RLS. Non conta niente su nessuno.",
  ],
  [
    "scripts/verifica-motore-cron.js",
    "Non tocca nessun database: legge il SORGENTE del cron e cerca una guardia fra due righe. `workshop_fasi_stato` ci compare perché è il nome nella query che sta controllando, non perché la interroghi — è un controllo lessicale scambiato per una misura da un altro controllo lessicale.",
  ],
  [
    "scripts/verifica-guardie-null.js",
    "Stessa specie di verifica-motore-cron.js, e trovata dallo stesso falso positivo: non tocca nessun database — legge le MIGRAZIONI e cerca guardie fragili nei corpi delle funzioni. `evidence` e `workshop_iscrizioni` ci compaiono perché stanno nelle righe di taratura del controllo (le prove che verificano che il pattern riconosca una scrittura), non perché le interroghi. Un controllo lessicale scambiato per una misura da un altro controllo lessicale, la seconda volta.",
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
