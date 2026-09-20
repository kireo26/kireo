// I due cancelli, per le proprietà che vivono FRA due file.
//
// Le nove proprietà di comportamento stanno in `scripts/verifica-cancelli-percorso.sql`
// e si provano contro un database. Qui ci sono quelle che un database non può
// vedere, perché sono accordi fra sorgenti diverse:
//
//   1. GLI SLUG DEI TRE TEST sono scritti due volte — in `lib/test/config.ts` e
//      dentro la funzione SQL, che non può importare TypeScript. È l'unica
//      copia che questo lavoro ha dovuto creare, ed è esattamente la specie che
//      divergerà se nessuno la guarda: il giorno in cui un test cambia slug, la
//      funzione risponde «no» a chi i test li ha fatti tutti, e il cancello si
//      chiude in silenzio su gente che aveva il diritto di passare.
//
//   2. LE POLICY CHIAMANO DAVVERO I PREDICATI. Una funzione definita e non
//      chiamata è un cancello che non c'è, e la migrazione sembrerebbe a posto.
//
//   3. `banco robot` SI RIFIUTA PRIMA DI SPENDERE, non dopo. La guardia messa
//      dopo il ciclo costerebbe la passata e riempirebbe la lista dei cancelli
//      di rumore — è il difetto del 13/09 con una causa nuova.
//
//   4. `prossimaTappa` NON RICALCOLA la soglia delle missioni. Se tornasse a
//      scrivere `t1 && t2 && t3`, la home e la policy direbbero la stessa cosa
//      in due lingue, e divergerebbero al primo che ne tocca una.
//
// Esecuzione: `npm run test:cancelli`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MIGRAZIONE = path.join(ROOT, "supabase/migrations/20260920100000_cancelli_percorso.sql");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const sql = fs.readFileSync(MIGRAZIONE, "utf8");
const config = fs.readFileSync(path.join(ROOT, "lib/test/config.ts"), "utf8");
const robot = fs.readFileSync(path.join(ROOT, "scripts/banco/robot/index.js"), "utf8");
const tappa = fs.readFileSync(path.join(ROOT, "lib/percorso/prossimaTappa.ts"), "utf8");

console.log("\n═══ I due cancelli del percorso ═══\n");

// ── 1) gli slug dei tre test ────────────────────────────────────────────────
console.log("1) Gli slug dei tre test dicono la stessa cosa nelle due lingue");

const slugDiConfig = ["SLUG_T1", "SLUG_T2", "SLUG_T3"].map((nome) => {
  const m = config.match(new RegExp(`export const ${nome} = "([^"]+)"`));
  return m ? m[1] : null;
});
ok(slugDiConfig.every(Boolean), `lib/test/config.ts dichiara i tre slug (${slugDiConfig.join(", ")})`);

// Dalla funzione SQL: la lista dentro `test_slug in (...)`.
const bloccoFunzione = sql.slice(sql.indexOf("function public.ha_completato_i_tre_test"));
const inClause = bloccoFunzione.match(/test_slug in \(([^)]*)\)/);
const slugDiSql = inClause ? [...inClause[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : [];
ok(slugDiSql.length === 3, `la funzione SQL ne nomina tre (${slugDiSql.join(", ") || "nessuno"})`);
ok(
  slugDiConfig.every((s) => slugDiSql.includes(s)) && slugDiSql.every((s) => slugDiConfig.includes(s)),
  "i due elenchi coincidono" +
    (slugDiConfig.every((s) => slugDiSql.includes(s)) ? "" : "\n      → un test ha cambiato slug e la funzione SQL è rimasta indietro: il cancello si chiuderebbe su chi ha i requisiti"),
);
// Il conteggio deve essere 3, non «almeno uno»: con `>= 1` basterebbe un test.
ok(/count\(distinct test_slug\)\s*=\s*3/.test(bloccoFunzione), "il predicato pretende tutti e tre i test distinti, non almeno uno");

// ── 2) le policy chiamano i predicati ───────────────────────────────────────
console.log("\n2) Le policy chiamano davvero i predicati");

const policyMissione = sql.slice(sql.indexOf("create policy mission_attempt_insert_own"), sql.indexOf("drop policy if exists workshop_iscrizioni_insert_own"));
const policyWorkshop = sql.slice(sql.indexOf("create policy workshop_iscrizioni_insert_own"));

ok(policyMissione.includes("ha_completato_i_tre_test()"), "la policy delle missioni chiede i tre test");
ok(policyMissione.includes("ha_gia_giocato_una_missione()"), "…e lascia passare chi ha già un tentativo (rigioco, non-retroattività)");
ok(policyWorkshop.includes("ha_esperienza_percorso()"), "la policy dei workshop chiede un'esperienza");
ok(policyWorkshop.includes("e_gia_entrato_in_un_workshop()"), "…e lascia passare chi è già dentro (cambio ruolo)");

// Le condizioni che c'erano prima devono essere sopravvissute alla riscrittura.
for (const pezzo of ["stato = 'attivo'", "w.attivo", "r.workshop_id = workshop_id"]) {
  ok(policyWorkshop.includes(pezzo), `la policy dei workshop conserva la condizione preesistente «${pezzo}»`);
}

// ── 3) i ruoli nominati ─────────────────────────────────────────────────────
console.log("\n3) I permessi nominano i ruoli, non solo PUBLIC");

for (const fn of ["ha_completato_i_tre_test", "ha_esperienza_percorso", "e_gia_entrato_in_un_workshop", "ha_gia_giocato_una_missione"]) {
  const revoca = new RegExp(`revoke all on function public\\.${fn}\\(\\)[^;]*from[^;]*anon`);
  ok(revoca.test(sql), `${fn}: la revoca nomina anon (un «from public» non lo toglierebbe)`);
}

// ── 4) il robot si rifiuta prima di spendere ────────────────────────────────
console.log("\n4) `banco robot` si rifiuta PRIMA di spendere");

const iRifiuto = robot.indexOf("cancelloApertoPerIWorkshop(sessione)");
const iCiclo = robot.indexOf("for (const lavoro of piano.lavori)");
ok(iRifiuto !== -1, "la guardia del cancello esiste in scripts/banco/robot/index.js");
ok(iRifiuto !== -1 && iCiclo !== -1 && iRifiuto < iCiclo, "la guardia sta PRIMA del ciclo che spende");
// E deve interrompere, non solo stampare: un avviso che non ferma è un avviso
// che produce comunque venticinque fermati.
const fraGuardiaECiclo = iRifiuto !== -1 && iCiclo !== -1 ? robot.slice(iRifiuto, iCiclo) : "";
ok(/cancello === false[\s\S]{0,700}?\breturn\b/.test(fraGuardiaECiclo), "e INTERROMPE la passata, non si limita ad avvisare");
// Degrada verso il partire: solo `=== false` ferma, non un null di lettura.
ok(fraGuardiaECiclo.includes("cancello === false"), "ferma solo su un «no» vero, non su una lettura fallita");

// ── 5) prossimaTappa non ricalcola la soglia ────────────────────────────────
console.log("\n5) La home non ricalcola la soglia delle missioni");

ok(tappa.includes("ha_completato_i_tre_test"), "il rung delle missioni chiede al predicato del cancello");
ok(!/if\s*\(t1 && t2 && t3\)/.test(tappa), "e non riscrive `t1 && t2 && t3` per conto suo");
ok(/t1 && t2\b/.test(tappa), "i rung intermedi guardano ancora i test uno per uno (devono nominare il prossimo)");
ok(!/nessun gate, tutto resta aperto/.test(tappa), "il commento «nessun gate, tutto resta aperto» non c'è più: sarebbe falso");

// ── 6) controprove ──────────────────────────────────────────────────────────
console.log("\n6) Controprove: il controllo si accorge davvero");

const provaSlug = (elenco) => elenco.every((s) => slugDiConfig.includes(s)) && slugDiConfig.every((s) => elenco.includes(s));
ok(!provaSlug(["da-dove-parti", "come-ti-muovi", "un-altro-slug"]), "uno slug cambiato nella funzione SQL farebbe fallire il confronto");
ok(!/if\s*\(t1 && t2 && t3\)/.test("if (t1 && t2 && t3) return {") === false, "il pattern del ricalcolo riconosce la forma che vogliamo vietare");
ok(!/revoke all on function public\.finta\(\)[^;]*from[^;]*anon/.test(sql), "la regex delle revoche non passa su una funzione che non c'è");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(`✗ ${falliti} controlli falliti.\n`);
  process.exit(1);
}
console.log("✓ I cancelli sono collegati, e le due lingue dicono la stessa cosa.\n");
