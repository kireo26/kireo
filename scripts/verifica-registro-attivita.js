// npm run test:registroattivita — UN REGISTRO DI ATTIVITÀ NON È UN TITOLO DI ACCESSO (10/11)
//
// IL CASO. Fino al 10/11 il cancello delle guide 2 e 3 (`statoSblocco`) leggeva
// in `activity_log` se una guida era «già scaricata», e il client inseriva in
// activity_log tipo, peso e livello a scelta: una riga bastava ad aprire la
// guida 3. La cura (20261211100000 e 110000) ha due metà, e questa guardia le
// tiene tutte e due, più la regola che le unisce (Mario: *quello zero va
// sorvegliato, altrimenti è uno stato di fatto di oggi e non una regola*):
//
//   §1 CHI SCRIVE. Nessun codice inserisce in activity_log: il browser passa da
//      `registra_attivita` (quattro tipi), il server da
//      `registra_apertura_guida_kireo`, e ognuna delle due ha i suoi soli
//      chiamanti. Nel database, solo le funzioni elencate in SCRITTORI_SQL.
//   §2 I PESI. Quelli che il database mette sono quelli di PESI_ATTIVITA e
//      PESO_GUIDA: due copie della stessa tabella, confrontate.
//   §3 CHI LEGGE. Ogni file che legge activity_log (o la sua vista score_aree)
//      è in LETTORI con quello che ne fa, e nessuno dei file che DECIDONO un
//      accesso lo nomina. Un lettore nuovo nasce rosso finché qualcuno non
//      scrive cosa ne fa. Nel database nessuna policy lo legge.
//
// ⚠️ IL LIMITE, DETTO: è lessicale, e sbaglia per difetto. Un lettore che riceve
// le righe da un altro file attraverso una variabile, o un cancello che importa
// un lettore elencato e usa il suo risultato per decidere, non lo vede. Per
// questo LETTORI dice, per ognuno, che cosa ne fa: chi aggiunge un uso che
// decide deve cambiare quella riga, e la riga dice la regola. Con la replica
// (CONN) la parte SQL si legge dal catalogo vero.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { abilitaTypeScript } = require("./banco/ts");
abilitaTypeScript();
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");

const RADICE = path.join(__dirname, "..");
let fatte = 0;
let falliti = 0;
function ok(cond, cosa, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${cosa}`);
  else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio ? `\n      → ${dettaglio}` : ""}`);
  }
}

// I file che leggono activity_log (o score_aree), con quello che ne fanno.
// Nessuno decide un accesso: se un giorno uno lo facesse, è questa riga che va
// cambiata, e cambiarla vuol dire leggere la regola qui sopra.
const LETTORI = {
  "lib/app/attivita.ts": "lo storico e il percorso di «Le mie attività»: racconta, non decide",
  "lib/app/radarData.ts": "il radar della home (score_aree): una somma da mostrare",
};

// I file che decidono se una cosa si apre: non nominano activity_log né score_aree.
const DECIDONO = [
  "lib/guide/statoStudente.ts",
  "lib/guide/config.ts",
  "app/api/guide/[areaSlug]/[livello]/route.ts",
  "lib/percorso/stato.ts",
  "lib/percorso/prossimaTappa.ts",
];

// Le funzioni del database che scrivono activity_log, con il fatto che registrano.
const SCRITTORI_SQL = {
  registra_attivita: "le quattro visite del browser",
  registra_apertura_guida_kireo: "l'apertura di una guida, dal server",
  avanza_fase_workshop: "un progetto workshop concluso",
  certifica_presenza: "una presenza certificata dalla scuola",
  chiudi_diretta_evento: "le presenze certificate alla chiusura di una diretta",
};

// Le chiamate RPC che scrivono activity_log, e i soli file da cui partono.
const CHIAMANTI_RPC = {
  registra_attivita: ["lib/app/activityLog.ts", "app/api/assistente/route.ts"],
  registra_apertura_guida_kireo: ["lib/guide/apertura.ts"],
};

function file(dir) {
  const out = [];
  (function giro(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) giro(p);
      else if (/\.(tsx?|js)$/.test(e.name)) out.push(p);
    }
  })(path.join(RADICE, dir));
  return out;
}
const sorgenti = ["app", "lib", "components", "scripts/banco"].flatMap(file).map((p) => ({
  rel: path.relative(RADICE, p),
  src: senzaCommenti(fs.readFileSync(p, "utf8")),
}));

console.log("§0 · Il lettore legge davvero qualcosa");
ok(sorgenti.length > 300, `file letti: ${sorgenti.length} (troppo pochi = non sta guardando)`);

console.log("\n§1 · Chi scrive activity_log");
const inserti = sorgenti.filter((f) => /from\(\s*["'`]activity_log["'`]\s*\)\s*\.\s*(insert|upsert|update|delete)\b/.test(f.src));
ok(inserti.length === 0, "nessun codice scrive activity_log direttamente", inserti.map((f) => f.rel).join(", "));
for (const [rpc, ammessi] of Object.entries(CHIAMANTI_RPC)) {
  const chi = sorgenti.filter((f) => new RegExp(`["'\`]${rpc}["'\`]`).test(f.src)).map((f) => f.rel);
  ok(chi.length > 0, `${rpc} ha almeno un chiamante [${chi.join(", ")}]`);
  const fuori = chi.filter((c) => !ammessi.includes(c));
  ok(fuori.length === 0, `${rpc} la chiamano solo ${ammessi.join(", ")}`, fuori.join(", "));
}

// Le ultime definizioni delle funzioni, dalle migrazioni in ordine.
const dirMig = path.join(RADICE, "supabase/migrations");
const corpi = new Map();
for (const nome of fs.readdirSync(dirMig).filter((n) => n.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(path.join(dirMig, nome), "utf8");
  for (const m of sql.matchAll(/drop function (?:if exists )?(?:public\.)?([a-z_0-9]+)/gi)) corpi.delete(m[1]);
  const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([^;]*?\)\s*returns[\s\S]*?\$(\w*)\$([\s\S]*?)\$\2\$/gi;
  let m;
  while ((m = re.exec(sql))) corpi.set(m[1], { file: nome, corpo: senzaCommentiSql(m[3]) });
}
ok(corpi.size > 100, `funzioni vive lette dalle migrazioni: ${corpi.size}`);
const scrittori = [...corpi.entries()].filter(([, f]) => /insert\s+into\s+(public\.)?activity_log\b/i.test(f.corpo)).map(([n]) => n);
const scrittoriNonDichiarati = scrittori.filter((n) => !SCRITTORI_SQL[n]);
ok(scrittoriNonDichiarati.length === 0, `nel database scrivono activity_log solo le funzioni dichiarate (${scrittori.length})`, scrittoriNonDichiarati.join(", "));
const dichiaratiMorti = Object.keys(SCRITTORI_SQL).filter((n) => !scrittori.includes(n));
ok(dichiaratiMorti.length === 0, "e ogni funzione dichiarata scrive davvero", dichiaratiMorti.join(", "));

console.log("\n§2 · I pesi del database sono quelli del codice");
const { PESI_ATTIVITA, PESO_GUIDA } = require("@/lib/app/activityLog");
const ra = corpi.get("registra_attivita")?.corpo ?? "";
for (const tipo of ["visita_area", "lettura_articolo", "chat_assistente", "iscrizione_webinar"]) {
  const m = ra.match(new RegExp(`when '${tipo}' then (\\d+)`));
  ok(m && Number(m[1]) === PESI_ATTIVITA[tipo], `${tipo}: ${m?.[1]} nel database, ${PESI_ATTIVITA[tipo]} nel codice`);
}
const fuoriElenco = [...ra.matchAll(/when '([a-z_]+)' then \d+/g)].map((m) => m[1]).filter((t) => !["visita_area", "lettura_articolo", "chat_assistente", "iscrizione_webinar"].includes(t));
ok(fuoriElenco.length === 0, "registra_attivita non accetta altri tipi (download_guida, workshop, presenze)", fuoriElenco.join(", "));
const rg = corpi.get("registra_apertura_guida_kireo")?.corpo ?? "";
const pesiGuida = rg.match(/case p_livello when 1 then (\d+) when 2 then (\d+) else (\d+) end/);
ok(pesiGuida && Number(pesiGuida[1]) === PESO_GUIDA[1] && Number(pesiGuida[2]) === PESO_GUIDA[2] && Number(pesiGuida[3]) === PESO_GUIDA[3],
  `i pesi delle guide nel database (${pesiGuida?.slice(1).join("/")}) sono PESO_GUIDA (${PESO_GUIDA[1]}/${PESO_GUIDA[2]}/${PESO_GUIDA[3]})`);

console.log("\n§3 · Chi legge activity_log, e nessuno per decidere");
const lettori = sorgenti
  .filter((f) => /from\(\s*["'`](activity_log|score_aree)["'`]\s*\)/.test(f.src) && !inserti.includes(f))
  .map((f) => f.rel);
ok(lettori.length >= 2, `lettori trovati: ${lettori.length} [${lettori.join(", ")}]`);
const nonDichiarati = lettori.filter((l) => !LETTORI[l]);
ok(nonDichiarati.length === 0, "ogni lettore è in LETTORI, con quello che ne fa", nonDichiarati.join(", "));
const morti = Object.keys(LETTORI).filter((l) => !lettori.includes(l));
ok(morti.length === 0, "e ogni voce di LETTORI legge davvero", morti.join(", "));
for (const d of DECIDONO) {
  const src = senzaCommenti(fs.readFileSync(path.join(RADICE, d), "utf8"));
  ok(!/activity_log|score_aree/.test(src), `${d} decide un accesso e non nomina activity_log né score_aree`);
  const importa = Object.keys(LETTORI).filter((l) => src.includes(l.replace(/^/, "@/").replace(/\.tsx?$/, "")));
  ok(importa.length === 0, `…e non importa un lettore di activity_log`, importa.join(", "));
}
ok(/from\(\s*["'`]guide_kireo_aperte["'`]\s*\)/.test(senzaCommenti(fs.readFileSync(path.join(RADICE, "lib/guide/statoStudente.ts"), "utf8"))),
  "il cancello delle guide legge guide_kireo_aperte");

// Nessuna policy delle migrazioni legge activity_log o score_aree (fuori dalla
// tabella stessa): la regola vale anche per il database.
const policySospette = [];
for (const nome of fs.readdirSync(dirMig).filter((n) => n.endsWith(".sql"))) {
  const sql = senzaCommentiSql(fs.readFileSync(path.join(dirMig, nome), "utf8"));
  for (const m of sql.matchAll(/create policy (\w+)\s+on\s+(?:public\.)?(\w+)([^;]*);/gi)) {
    if (m[2] !== "activity_log" && /activity_log|score_aree/.test(m[3])) policySospette.push(`${nome}: ${m[1]}`);
  }
}
ok(policySospette.length === 0, "nessuna policy delle migrazioni legge activity_log", policySospette.join(", "));

const CONN = process.env.CONN;
if (!CONN) {
  console.log("  · NON HO GUARDATO la replica (CONN non è impostata): la parte SQL viene solo dalle migrazioni.");
} else {
  const policy = execFileSync("psql", [CONN, "-At", "-c",
    "select tablename || '.' || policyname from pg_policies where tablename <> 'activity_log' and (coalesce(qual,'') ~ '(activity_log|score_aree)' or coalesce(with_check,'') ~ '(activity_log|score_aree)')"], { encoding: "utf8" }).trim();
  ok(policy === "", "sulla replica nessuna policy legge activity_log", policy);
  const vive = execFileSync("psql", [CONN, "-At", "-c",
    "select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f' and p.prosrc ~ '(activity_log|score_aree)' order by 1"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const viveFuori = vive.filter((n) => !SCRITTORI_SQL[n]);
  ok(vive.length >= 3 && viveFuori.length === 0, `sulla replica le funzioni che nominano activity_log sono gli scrittori dichiarati (${vive.length})`, viveFuori.join(", "));
  const ins = execFileSync("psql", [CONN, "-At", "-c",
    "select has_any_column_privilege('authenticated','public.activity_log','INSERT') or has_any_column_privilege('anon','public.activity_log','INSERT')"], { encoding: "utf8" }).trim();
  ok(ins === "f", "sulla replica il client non inserisce in activity_log");
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:registroattivita)`);
process.exit(falliti === 0 ? 0 : 1);
