// Una funzione che chiama solo la service-role non si concede ad `authenticated`.
//
// PERCHÉ ESISTE. Il 19/09 Mario ha fermato una migrazione prima che fosse
// applicata: `registra_guasto` era concessa ad `authenticated, service_role`
// mentre il suo unico chiamante — `lib/guasti/registra.ts` — usa il client
// service-role e basta. Il grant in più non esponeva niente (in lettura si
// arriva solo da admin) ma lasciava a qualunque studente collegato la
// possibilità di scrivere righe arbitrarie nella tabella dei guasti, cioè di
// **far mentire la diagnostica**: precisamente la cosa che quella tabella
// esiste per impedire.
//
// E NON ERA UNA SOLA. Cercando, le RPC chiamate solo attraverso il client
// service-role sono quattro, e su tre il grant ad `authenticated` non lo usa
// nessuno. Una l'aveva copiata dall'altra insieme al commento — che diceva
// «le route girano nella sessione dello studente»: vero della ROUTE, falso
// del CLIENT. È la specie già catalogata in CLAUDE.md, una proprietà scritta
// guardando l'intenzione invece di quello che il codice fa.
//
// COSA CONTROLLA, e perché da due lati che nessuno tiene allineati: i
// chiamanti si leggono da TypeScript (quali file usano SOLO
// `createServiceRoleClient`, e quali `rpc("…")` invocano), i grant si leggono
// dalle migrazioni. Nessuna tabella di accoppiamento scritta a mano: una
// tabella è una cosa da aggiornare, e questo difetto nasce proprio da due
// liste che nessuno aggiorna insieme.
//
// DIREZIONE DELL'ERRORE. Qui un falso NEGATIVO è il pericolo — se
// l'estrattore smette di vedere una RPC, il controllo passa e nessuno lo sa,
// la risposta comoda un piano più in su. Quindi l'estrattore si sorveglia da
// sé: sotto una soglia dichiara di aver smesso di leggere invece di passare
// in silenzio. Un falso POSITIVO costa una voce di esenzione con la ragione
// scritta accanto — mai un pattern allargato, che è il modo in cui un
// controllo smette di controllare.
//
// Esecuzione: `npm run test:grant`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const {
  applica,
  leggiMigrazioni,
  PREDEFINITI,
  aperto,
  taraModello,
  PROVE_TOTALI,
} = require("./lib/permessi-funzioni");

const ROOT = path.join(__dirname, "..");

let falliti = 0;
const ok = (cond, msg) => {
  if (!cond) {
    console.error("  ✗ " + msg);
    falliti++;
  } else {
    console.log("  ✓ " + msg);
  }
};

// Le funzioni che HANNO bisogno del grant ad `authenticated` pur essendo
// chiamate dal codice solo via service-role. Ogni voce porta la ragione: una
// lista di esenzioni senza motivi è una lista che fra sei mesi nessuno sa più
// se sia ancora vera.
const ESENTI = {
  e_profilo_di_prova:
    "predicato di sola lettura, usato anche dagli SQL di diagnostica che Mario " +
    "lancia a mano (scripts/diagnostica-*.sql). Resta una domanda aperta — nell'SQL " +
    "Editor non si gira come `authenticated` — ma è un booleano su un profilo, non " +
    "una scrittura: si toglie quando si tocca quella migrazione per altro.",
};

// ── i chiamanti, dal TypeScript ─────────────────────────────────────────────
function sorgenti(dir, out = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    if (voce.name === "node_modules" || voce.name === ".next" || voce.name === ".git") continue;
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) sorgenti(p, out);
    else if (/\.tsx?$/.test(voce.name)) out.push(p);
  }
  return out;
}

const file = [...sorgenti(path.join(ROOT, "lib")), ...sorgenti(path.join(ROOT, "app"))];

// Un file "solo service-role" usa `createServiceRoleClient` e non costruisce
// mai un client di sessione: se ne usasse tutti e due non si potrebbe dire da
// quale delle due strade parta una `rpc()`, e il controllo direbbe una cosa
// che non sa.
const soloServiceRole = file.filter((f) => {
  const s = fs.readFileSync(f, "utf8");
  return /createServiceRoleClient/.test(s) && !/\bcreateClient\s*\(/.test(s);
});

const chiamate = new Map(); // nome rpc -> file che la chiamano
for (const f of soloServiceRole) {
  const s = fs.readFileSync(f, "utf8");
  for (const m of s.matchAll(/\.rpc\(\s*"([a-z_0-9]+)"/g)) {
    if (!chiamate.has(m[1])) chiamate.set(m[1], []);
    chiamate.get(m[1]).push(path.relative(ROOT, f));
  }
}

console.log("\n═══ Chi chiama con la service-role non si concede ad authenticated ═══\n");

// LA GUARDIA DELL'ESTRATTORE. Se smettesse di riconoscere il client o la
// forma della chiamata, questo file passerebbe verde senza aver guardato
// niente — ed è il modo peggiore di fallire, perché somiglia a un successo.
ok(
  soloServiceRole.length >= 3,
  `i file che usano solo il client service-role sono ${soloServiceRole.length}`,
);
ok(chiamate.size >= 3, `le RPC chiamate solo di lì sono ${chiamate.size}: ${[...chiamate.keys()].sort().join(", ")}`);

// ── i permessi, dalle migrazioni ────────────────────────────────────────────
// IL MODELLO VIVE IN UN POSTO SOLO (scripts/lib/permessi-funzioni.js) perché
// anche `verifica-guardie-null.js` ne ha bisogno, e con due copie quella non
// toccata diverge. Il 26/09 il modello era sbagliato su due fatti insieme
// (PUBLIC nel mazzo, `create or replace` che preserva i privilegi): se fossero
// state due copie, la riparazione ne avrebbe corretta una. Le ragioni, e i due
// fatti verificati su Postgres 16, stanno in testa a quel file.
const permesso = applica(leggiMigrazioni(path.join(ROOT, "supabase", "migrations")));

ok(permesso.size >= 20, `l'estrattore ricostruisce i permessi dalle migrazioni (${permesso.size} funzioni)`);

// ── il confronto ────────────────────────────────────────────────────────────
const larghi = [];
for (const [rpc, chiamanti] of chiamate) {
  if (ESENTI[rpc]) continue;
  const g = permesso.get(rpc);
  // Nessuna riga trovata NON vuol dire «nessun permesso»: vuol dire che la
  // funzione nasce coi default e nessuno li ha tolti. È il caso peggiore, non
  // quello da saltare — ed è precisamente l'errore del modello di ieri.
  const p = g ?? PREDEFINITI();
  if (aperto(p.ruoli)) {
    larghi.push({
      rpc,
      ruoli: [...p.ruoli].filter((r) => r === "anon" || r === "authenticated" || r === "public").sort().join(", "),
      file: p.file,
      chiamanti: chiamanti.join(", "),
    });
  }
}

ok(
  larghi.length === 0,
  larghi.length === 0
    ? "nessuna RPC service-role-only resta eseguibile da un ruolo che non la chiama"
    : larghi
        .map(
          (l) =>
            `${l.rpc} resta eseguibile da «${l.ruoli}» (${l.file}) ma la chiama solo ${l.chiamanti}\n` +
            `      → serve «revoke all on function … from public, anon, authenticated»`,
        )
        .join("\n    "),
);

// Le esenzioni si contano e si nominano: una lista che cresce in silenzio è
// una lista che a un certo punto contiene tutto.
for (const [rpc, motivo] of Object.entries(ESENTI)) {
  if (chiamate.has(rpc)) console.log(`  · esente: ${rpc} — ${motivo.split(".")[0]}.`);
}

// CONTROPROVA. Senza, «zero larghi» direbbe solo che la lista letta era vuota.
// La taratura del modello VIAGGIA COL MODELLO, e la esegue ogni suo lettore: un
// modello che si sposta deve far diventare rossi tutti quelli che lo usano, non
// solo quello che qualcuno ricorda di guardare. Fra le sue prove c'è il caso che
// il modello di ieri sbagliava — una funzione senza nessuna riga di permesso
// deve risultare APERTA, perché i default privileges gliel'hanno data.
const rotte = taraModello();
for (const r of rotte) console.error(`  ✗ taratura modello: ${r}`);
ok(rotte.length === 0, `…e il modello dei permessi riproduce quello che fa Postgres (${PROVE_TOTALI} prove)`);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(
    `✗ ${falliti} controlli falliti.\n` +
      "  Un grant che nessun chiamante usa non espone per forza qualcosa, ma lascia\n" +
      "  scrivere a chi non dovrebbe — e su una tabella di diagnostica vuol dire\n" +
      "  poterla far mentire. O si restringe il grant, o si dichiara l'esenzione\n" +
      "  con la ragione accanto.\n",
  );
  process.exit(1);
}
console.log("✓ Chi scrive con la service-role è l'unico che può chiamare quelle funzioni.\n");
