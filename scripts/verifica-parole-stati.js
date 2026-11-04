#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// npm run test:stati — ogni stato del database ha le sue parole, e nessun testo
// lo stampa com'è (lib/stati/parole.ts, Mario 03/11).
//
// §1 ogni colonna registrata con un tipo ha, in ogni sua tabella di parole,
//    esattamente i valori del tipo letti dalle migrazioni;
// §2 per ogni colonna, le sue tabelle coprono gli stessi valori, e nessuna
//    parola è il valore grezzo;
// §3 nessun file di app/, components/, lib/ mette uno stato in un testo senza
//    passare da una parola: `${…stato…}`, `{x.stato}`, `?? x.stato`.
//    Lessicale: vede la forma, sbaglia per difetto (uno stato copiato in una
//    variabile dal nome diverso non lo vede);
// §4 sulla replica (CONN): ogni colonna di stato del database (enum o testo con
//    un vincolo) è registrata o esclusa con il perché, e i valori veri sono le
//    chiavi delle sue parole. Senza replica dice che non ha guardato.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();
const S = require(path.join(ROOT, "lib/stati/parole.ts"));

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? `\n      → ${typeof dettaglio === "string" ? dettaglio : JSON.stringify(dettaglio)}` : ""}`);
  }
}
const ordina = (xs) => [...xs].sort();
const uguali = (a, b) => JSON.stringify(ordina(a)) === JSON.stringify(ordina(b));

// I valori dei tipi, dalle migrazioni in ordine.
const dir = path.join(ROOT, "supabase/migrations");
const tipi = new Map();
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  for (const m of s.matchAll(/create type public\.(\w+) as enum \(([^)]*)\)/g)) tipi.set(m[1], [...m[2].matchAll(/'([^']+)'/g)].map((v) => v[1]));
  for (const m of s.matchAll(/alter type public\.(\w+) add value (?:if not exists )?'([^']+)'/g)) {
    if (!tipi.has(m[1])) tipi.set(m[1], []);
    if (!tipi.get(m[1]).includes(m[2])) tipi.get(m[1]).push(m[2]);
  }
}

console.log("\n§1 le parole dei tipi sono i valori delle migrazioni");
const voci = Object.entries(S.PAROLE_DEGLI_STATI);
ok(voci.length >= 10, `colonne registrate: ${voci.length}`);
for (const [colonna, voce] of voci) {
  if (!voce.tipo) continue;
  const valori = tipi.get(voce.tipo);
  ok(Array.isArray(valori) && valori.length >= 2, `${colonna}: il tipo ${voce.tipo} si legge dalle migrazioni`, valori);
  for (const [chi, parole] of Object.entries(voce.parole))
    ok(valori && uguali(Object.keys(parole), valori), `${colonna} (${chi}): una parola per ogni valore, nessuna in più`, { parole: Object.keys(parole), tipo: valori });
}

console.log("\n§2 le tabelle di una colonna coprono gli stessi valori, e non con il valore grezzo");
for (const [colonna, voce] of voci) {
  const insiemi = Object.entries(voce.parole);
  ok(insiemi.length >= 1, `${colonna}: almeno una tabella di parole`);
  const primo = Object.keys(insiemi[0][1]);
  for (const [chi, parole] of insiemi) {
    ok(uguali(Object.keys(parole), primo), `${colonna} (${chi}): gli stessi valori delle altre tabelle`, Object.keys(parole));
    const grezze = Object.entries(parole).filter(([k, v]) => !v || v === k).map(([k]) => k);
    ok(grezze.length === 0, `${colonna} (${chi}): nessuna parola è vuota o uguale al valore`, grezze);
  }
}
ok(!voci.some(([c]) => c in S.STATI_SENZA_PAROLE), "nessuna colonna è insieme registrata ed esclusa");
ok(Object.values(S.STATI_SENZA_PAROLE).every((r) => typeof r === "string" && r.length > 15), "ogni esclusione dice il perché");
// Gli attesi scritti a mano, non letti dal registro.
ok(S.parolaDelloStato("eventi.stato", "approvato", "tutti") === "Approvato", "«approvato» passa da una parola, anche se sembra già una");
ok(S.parolaDelloStato("eventi.stato", "inventato", "tutti") === "Stato non riconosciuto", "un valore che il registro non conosce lo dice");
ok(S.parolaDelloStato("newsletter_enti.stato", "inviata", "admin") === "Partita", "la newsletter, letta dall'admin, dice la sua parola (04/11: diceva «non riconosciuto»)");
// 04/11: un pubblico che la colonna non ha NON è uno stato sconosciuto, è un
// errore di chi chiama. Prima diventava una tabella vuota, e la rete diceva
// «Stato non riconosciuto» a ogni valore della newsletter.
let lancia = false;
try { S.parolaDelloStato("newsletter_enti.stato", "inviata", "tutti"); } catch { lancia = true; }
ok(lancia, "un pubblico che la colonna non ha fa errore, non «Stato non riconosciuto»");

console.log("\n§3 nessun testo prende uno stato senza una parola");
const AMMESSI = /parolaDelloStato|parolaDiStato|paroleStatoConversazione|etichetta\w*\(|ETICHETTA\w*\[|PAROLE\w*\[|CLASSE\w*\[|MESSAGGIO\w*\[|TESTI\w*\.|===|!==/;
const STATO = /\.(stato|stato_verifica)\b/;
let letti = 0;
const crudi = [];
function espressioniNeiTemplate(s) {
  const fuori = [];
  for (const inizio of s.matchAll(/\$\{/g)) {
    const i = inizio.index;
    let prof = 1;
    let j = i + 2;
    for (; j < s.length && prof > 0; j++) {
      if (s[j] === "{") prof++;
      else if (s[j] === "}") prof--;
    }
    fuori.push(s.slice(i + 2, j - 1));
  }
  return fuori;
}
function scorri(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    const rel = path.relative(ROOT, p);
    if (e.isDirectory()) {
      if (rel === "lib/supabase" || rel === "lib/stati") continue;
      scorri(p);
    } else if (/\.(tsx|ts)$/.test(e.name)) {
      letti++;
      const s = senzaCommenti(fs.readFileSync(p, "utf8"));
      for (const x of espressioniNeiTemplate(s)) if (STATO.test(x) && !AMMESSI.test(x)) crudi.push(`${rel}: \${${x.trim()}}`);
      if (/\.tsx$/.test(e.name)) {
        for (const m of s.matchAll(/(?<![=\w])\{\s*\(?\w+(?:\.\w+|\?\.\w+)*\.(?:stato|stato_verifica)\b(?:\s+as\s+string)?\)?\s*\}/g)) crudi.push(`${rel}: ${m[0]}`);
        for (const m of s.matchAll(/\?\?\s*\(?\w+(?:\.\w+)*\.(?:stato|stato_verifica)\b/g)) crudi.push(`${rel}: ${m[0]}`);
      }
    }
  }
}
for (const d of ["app", "components", "lib"]) scorri(path.join(ROOT, d));
ok(letti > 400, `file letti: ${letti}`);
ok(crudi.length === 0, "nessuno stato stampato com'è", crudi.join("\n      "));

// §3bis (04/11): il §3 accettava qualunque chiamata a parolaDelloStato come
// «una parola è stata cercata», senza guardare se la chiamata arrivava a una
// tabella. La newsletter chiedeva «tutti», che quella colonna non ha: verde
// qui, «Stato non riconosciuto» a schermo. Ora ogni chiamata nomina colonna e
// pubblico come letterali, e la coppia deve esistere nel registro. E una
// parola non si cambia di maiuscole dopo: «Approvata» abbassata diventa
// «approvata», cioè il valore grezzo, e la guardia del §2 non lo vede più.
console.log("\n§3bis ogni chiamata arriva a una tabella di parole, e la parola non si ritocca");
const chiamate = [];
const ritoccate = [];
function scorriChiamate(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    const rel = path.relative(ROOT, p);
    if (e.isDirectory()) { if (rel !== "lib/stati") scorriChiamate(p); continue; }
    if (!/\.(tsx|ts)$/.test(e.name)) continue;
    const s = senzaCommenti(fs.readFileSync(p, "utf8"));
    for (const m of s.matchAll(/parolaDelloStato\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
      const arg = m[1].split(",").map((x) => x.trim());
      chiamate.push({ rel, colonna: (arg[0] ?? "").replace(/^"|"$/g, ""), chi: (arg[2] ?? "").replace(/^"|"$/g, ""), letterali: /^".*"$/.test(arg[0] ?? "") && /^".*"$/.test(arg[2] ?? "") });
    }
    for (const m of s.matchAll(/(?:parolaDelloStato|parolaDiStato|paroleStatoConversazione)\([^;]*?\)\s*\.\s*to(?:Lower|Upper|LocaleLower|LocaleUpper)Case/g)) ritoccate.push(`${rel}: ${m[0].slice(0, 90)}`);
  }
}
for (const d of ["app", "components", "lib"]) scorriChiamate(path.join(ROOT, d));
ok(chiamate.length >= 8, `chiamate trovate: ${chiamate.length}`);
const senzaLetterali = chiamate.filter((c) => !c.letterali).map((c) => `${c.rel}: ${c.colonna}, ${c.chi}`);
ok(senzaLetterali.length === 0, "colonna e pubblico sono scritti per esteso in ogni chiamata", senzaLetterali.join("\n      "));
const senzaTabella = chiamate.filter((c) => c.letterali && !S.PAROLE_DEGLI_STATI[c.colonna]?.parole?.[c.chi]).map((c) => `${c.rel}: ${c.colonna} per «${c.chi}»`);
ok(senzaTabella.length === 0, "ogni coppia colonna-pubblico ha la sua tabella", senzaTabella.join("\n      "));
ok(ritoccate.length === 0, "nessuna parola cambiata di maiuscole dopo essere stata cercata", ritoccate.join("\n      "));

console.log("\n§4 sulla replica: ogni colonna di stato è registrata o esclusa");
const CONN = process.env.CONN;
if (!CONN) {
  console.log("  · NON HO GUARDATO: nessuna replica (CONN non è impostata). La lancia `npm run sql:tutti`.");
} else {
  const psql = (q) => execFileSync("psql", [CONN, "-At", "-F", "|", "-c", q], { encoding: "utf8" }).trim();
  const righe = psql(`
    with col as (
      select c.relname as tabella, a.attname as colonna, t.typname, t.typtype
        from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
        join pg_type t on t.oid = a.atttypid
       where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
         and a.attname in ('stato', 'stato_verifica'))
    select tabella || '.' || colonna,
           coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e join pg_type t2 on t2.oid = e.enumtypid where t2.typname = col.typname and col.typtype = 'e'),
                    (select substring(pg_get_constraintdef(k.oid) from 'ARRAY\\[(.*)\\]') from pg_constraint k
                       where k.conrelid = ('public.' || col.tabella)::regclass and k.contype = 'c'
                         and pg_get_constraintdef(k.oid) ~ ('\\(\\(' || col.colonna || ' = ANY') limit 1), '')
      from col order by 1`).split("\n").filter(Boolean);
  ok(righe.length >= 15, `colonne di stato nel database: ${righe.length}`);
  const nelDb = new Set();
  for (const r of righe) {
    const [colonna, grezzi] = r.split("|");
    nelDb.add(colonna);
    const valori = [...grezzi.matchAll(/'?([a-z_]+)'?(?:::text)?/g)].map((m) => m[1]).filter((v) => v !== "text");
    const voce = S.PAROLE_DEGLI_STATI[colonna];
    ok(Boolean(voce) || colonna in S.STATI_SENZA_PAROLE, `${colonna}: registrata o esclusa con il perché`);
    if (voce) for (const [chi, parole] of Object.entries(voce.parole))
      ok(valori.length >= 2 && uguali(Object.keys(parole), valori), `${colonna} (${chi}): le parole sono i valori veri`, { parole: Object.keys(parole), db: valori });
  }
  for (const c of [...Object.keys(S.PAROLE_DEGLI_STATI), ...Object.keys(S.STATI_SENZA_PAROLE)])
    ok(nelDb.has(c), `${c}: esiste nel database`);
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:stati)`);
process.exit(falliti === 0 ? 0 : 1);
