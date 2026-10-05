#!/usr/bin/env node
// LA VERIFICA SCOLASTICA NON SI AUTODICHIARA — e la policy che lo impone POGGIA
// SU DUE MECCANISMI CHE VIVONO ALTROVE.
//
// `student_profiles_update_own` (20261005100000) pretende
// `stato_verifica = 'dichiarato'` nel `with check`. Quella pretesa non respinge
// nessuno grazie a due cose scritte in un'altra migrazione:
//
//   (a) il secondo ramo di `blocco_cambio_scuola_verificato` riporta a
//       `dichiarato` chi cambia scuola senza toccare lo stato — senza di lui un
//       rifiutato che ridichiara una scuola verrebbe RESPINTO;
//   (b) il ramo `else` di `verifica_studente` azzera `school_code` al rifiuto —
//       senza di lui un rifiutato potrebbe salvare la SOLA classe, il trigger
//       non lo riporterebbe a `dichiarato` e la policy lo respingerebbe.
//
// La fragilità è stata SCELTA (vedi la migrazione: fra un rifiuto sbagliato e
// una scrittura sbagliata si prende il rifiuto, perché il primo lo scopre il
// primo utente e il secondo non lo scopre nessuno) — ma una dipendenza nascosta
// si sceglie solo se si trasforma in una dipendenza SORVEGLIATA. Questo file è
// quella sorveglianza: se qualcuno tocca uno dei due meccanismi deve diventare
// rosso QUI, non deve diventare rosso uno studente.
//
// PERCHÉ ANCHE QUI E NON SOLO IN scripts/verifica-student-profiles.sql: quello
// prova le stesse due dipendenze ESEGUENDOLE, che è più forte — ma lo lancia
// una persona nel SQL Editor. Questo gira a ogni `npm test`. Le due letture
// restano diverse apposta: una esegue, l'altra legge le definizioni vive.
//
// L'ULTIMA definizione di un nome è quella viva: i file si leggono in ordine e
// una `create or replace` successiva sostituisce la precedente. Guardare una
// definizione vecchia vorrebbe dire dare rosso su un difetto già riparato.

const fs = require("fs");
const path = require("path");
const { senzaCommentiSql } = require("./lib/senza-commenti");

const DIR = path.join(__dirname, "..", "supabase", "migrations");
const RADICE = path.join(__dirname, "..");

let falliti = 0;
function ok(cond, msg, extra) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    falliti++;
    console.log(`  ✗ ${msg}`);
    if (extra) console.log(`      → ${extra}`);
  }
}

// ── le definizioni vive delle funzioni ─────────────────────────────────────
const fn = new Map();
const file = fs.readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort();
for (const nome of file) {
  const sql = fs.readFileSync(path.join(DIR, nome), "utf8");
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([\s\S]*?\)\s*returns([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\3\$/gi;
  let m;
  while ((m = re.exec(sql))) {
    fn.set(m[1], { file: nome, corpo: senzaCommentiSql(m[4]) });
  }
}

// ── la definizione viva della policy ───────────────────────────────────────
// Una policy non si sostituisce con `or replace`: si droppa e si ricrea. Quindi
// l'ultima `create policy` con quel nome è quella viva, come per le funzioni.
const policy = (() => {
  let viva = null;
  for (const nome of file) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(DIR, nome), "utf8"));
    const re = /create\s+policy\s+student_profiles_update_own\b([\s\S]*?);/gi;
    let m;
    while ((m = re.exec(sql))) viva = { file: nome, testo: m[1] };
  }
  return viva;
})();

console.log("\n═══ La verifica scolastica non si autodichiara ═══\n");

// ── 0) LE GUARDIE DEGLI ESTRATTORI ─────────────────────────────────────────
// Se smettessero di riconoscere una forma, questo file passerebbe verde senza
// aver guardato niente — il modo peggiore di fallire, perché somiglia a un
// successo.
console.log("§0 · gli estrattori vedono qualcosa");
ok(fn.size >= 80, `l'estrattore delle funzioni legge ${fn.size} definizioni vive`);
ok(fn.has("blocco_cambio_scuola_verificato"), "trova blocco_cambio_scuola_verificato");
ok(fn.has("verifica_studente"), "trova verifica_studente");
ok(policy !== null, "trova la definizione viva di student_profiles_update_own");

// ── 1) la policy, cioè la cosa imposta ─────────────────────────────────────
console.log("\n§1 · la policy impone quello che dice di imporre");
if (policy) {
  const t = policy.testo;
  ok(
    /stato_verifica\s*=\s*'dichiarato'/i.test(t),
    `il with check pretende stato_verifica = 'dichiarato' (${policy.file})`,
    "senza, uno studente si scrive «verificato» da sé: è il buco del 5/10, e la " +
      "verifica è il meccanismo con cui dichiariamo di trattare lecitamente i dati di un minore",
  );
  ok(
    /verificato_da\s+is\s+null/i.test(t) && /verificato_il\s+is\s+null/i.test(t),
    "e pretende verificato_da / verificato_il nulli",
    "senza, l'attribuzione è falsificabile anche senza cambiare stato",
  );
  ok(
    /user_id\s*=\s*auth\.uid\(\)/i.test(t),
    "e continua a pretendere che la riga sia la propria",
  );
}

// ── 2) DIPENDENZA (a): il trigger riporta a «dichiarato» ───────────────────
console.log("\n§2 · DIPENDENZA (a) — il trigger riporta a «dichiarato» chi cambia scuola");
{
  const c = fn.get("blocco_cambio_scuola_verificato")?.corpo ?? "";
  ok(
    /new\.stato_verifica\s*:=\s*'dichiarato'/i.test(c),
    "il secondo ramo assegna new.stato_verifica := 'dichiarato'",
    "TOLTO QUESTO, la policy di 20261005100000 respinge un rifiutato che ridichiara " +
      "una scuola. La cura NON è togliere questa proprietà: è riaprire la policy a " +
      "`stato_verifica <> 'verificato'`, sapendo che quella lascia scriversi un autorifiuto.",
  );
  ok(
    /new\.school_code\s+is\s+distinct\s+from\s+old\.school_code/i.test(c),
    "e scatta sul cambio di school_code",
    "se la condizione cambiasse, il ramo potrebbe non scattare più dove la policy lo assume",
  );
}

// ── 3) DIPENDENZA (b): il rifiuto azzera school_code ───────────────────────
console.log("\n§3 · DIPENDENZA (b) — il rifiuto azzera school_code");
{
  const c = fn.get("verifica_studente")?.corpo ?? "";
  ok(
    /stato_verifica\s*=\s*'rifiutato'[\s\S]{0,200}?school_code\s*=\s*null/i.test(c),
    "il ramo del rifiuto scrive school_code = null",
    "TOLTO QUESTO, un rifiutato conserva la scuola e può salvare la SOLA classe: il " +
      "trigger non lo riporta a «dichiarato» (la scuola non cambia) e la policy lo respinge.",
  );
}

// ── 4) nessun altro scrittore delle tre colonne, dal client ────────────────
// Il grep di ieri su questa tabella escludeva le righe con `from(`, cioè
// esattamente dove vive una `.update()` concatenata, e ha fatto concludere che
// l'app non la scrivesse: la scrittura legittima di ProfiloForm era proprio là.
// Qui si cercano le tre colonne in tutto l'albero dell'app, senza filtri.
console.log("\n§4 · nessun punto dell'app scrive le tre colonne della verifica");
{
  const dentro = [];
  const cammina = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) cammina(p);
      else if (/\.tsx?$/.test(e.name)) {
        const src = require("./lib/senza-commenti").senzaCommenti(fs.readFileSync(p, "utf8"));
        if (/\b(stato_verifica|verificato_da|verificato_il)\s*:/.test(src)) {
          dentro.push(path.relative(RADICE, p));
        }
      }
    }
  };
  for (const d of ["app", "components", "lib"]) cammina(path.join(RADICE, d));
  ok(
    dentro.length === 0,
    "le tre colonne non compaiono come campi di un oggetto scritto",
    dentro.length ? `trovate in: ${dentro.join(", ")}` : undefined,
  );
}

console.log(
  falliti === 0
    ? "\n✓ tutto verde\n"
    : `\n✗ ${falliti} assert fallit${falliti === 1 ? "o" : "i"}\n`,
);
process.exit(falliti === 0 ? 0 : 1);
