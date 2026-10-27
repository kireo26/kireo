#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// IL CONTO DI QUELLO CHE PAGHIAMO (Mario, 27/10), metà codice. La metà
// database sta in scripts/verifica-consumo-ai.sql (npm run sql:tutti).
//
// §1 è un SOVRAINSIEME: ogni chiamata al modello in app/ e lib/
// (`messages.create(` / `messages.stream(`), con una soglia dichiarata, e per
// ognuna il suo `registraConsumo(` prima della chiamata successiva. Una
// chiamata nuova senza conto nasce rossa. ⚠️ È lessicale: vede che il conto è
// scritto dopo la chiamata, non che passi il processo giusto.
// §2 pretende che `processo` non abbia un default in tutta la catena.
// §3 esegue la traduzione del consumo con valori scritti a mano.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();

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
const leggi = (f) => senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));
function fileSorgenti(dir) {
  const out = [];
  for (const voce of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...fileSorgenti(rel));
    else if (/\.(ts|tsx)$/.test(voce.name)) out.push(rel);
  }
  return out;
}

console.log("\n§1 — ogni chiamata al modello lascia il suo conto\n");
{
  const chiamate = [];
  for (const f of ["app", "lib"].flatMap(fileSorgenti)) {
    const src = leggi(f);
    const re = /messages\.(create|stream)\(/g;
    let m;
    while ((m = re.exec(src))) chiamate.push({ f, i: m.index, src });
  }
  ok(chiamate.length >= 5, `le chiamate al modello trovate sono almeno 5 (oggi: ${chiamate.length})`, chiamate.map((c) => c.f));
  for (const c of chiamate) {
    const dopo = c.src.slice(c.i + 10);
    const prossima = dopo.search(/messages\.(create|stream)\(/);
    const tratto = prossima === -1 ? dopo : dopo.slice(0, prossima);
    ok(/registraConsumo\(/.test(tratto), `${c.f}: la chiamata è seguita dal suo conto`);
  }
}

console.log("\n§2 — il processo è obbligatorio, senza default\n");
{
  const cj = leggi("lib/ai/chiamaJson.ts");
  const dichiarazioni = cj.match(/processo\??:\s*string/g) ?? [];
  ok(dichiarazioni.length === 2 && dichiarazioni.every((d) => !d.includes("?")), "chiamaJson e chiamaJsonGrezzo lo dichiarano obbligatorio", dichiarazioni);
  ok(/registraConsumo\(opzioni\.processo,/.test(cj), "chiamaJsonGrezzo lo passa al conto");
  const ce = leggi("lib/escape/chiamaEscape.ts");
  ok(/\n\s*processo: string,/.test(ce) && !/processo\?:/.test(ce) && !/processo\s*=\s*"/.test(ce), "chiamaEscape lo pretende come parametro");
  const chiamanti = ["app", "lib"].flatMap(fileSorgenti).flatMap((f) => {
    const src = leggi(f);
    return [...src.matchAll(/chiamaJson\(client, \{[\s\S]*?\}\);/g)].map((m) => ({ f, testo: m[0] }));
  });
  ok(chiamanti.length >= 3 && chiamanti.every((c) => /processo: "[a-z/-]+"/.test(c.testo)), `ogni chiamata a chiamaJson dal cron nomina il proprio processo (${chiamanti.length})`);
}

console.log("\n§3 — la traduzione del consumo\n");
{
  const { argomentiConsumo } = require(path.join(ROOT, "lib/ai/consumo.ts"));
  const a = argomentiConsumo("p/x", "m", true, { input_tokens: 120, output_tokens: 30.6, cache_creation_input_tokens: null, cache_read_input_tokens: -4 });
  ok(a.p_input === 120 && a.p_output === 31 && a.p_cache_scrittura === 0 && a.p_cache_lettura === 0, "numeri arrotondati, assenti e negativi a zero", a);
  ok(a.p_processo === "p/x" && a.p_modello === "m" && a.p_di_prova === true, "processo, modello e prova passano com'erano", a);
  const vuoto = argomentiConsumo("p/x", "m", false, undefined);
  ok(vuoto.p_input === 0 && vuoto.p_output === 0, "senza consumo letto si conta la chiamata, a zero token", vuoto);
}

console.log("\n§4 — `banco spesa` somma per giorno e separa la prova\n");
{
  const { riassumiSpesa } = require(path.join(ROOT, "scripts/banco/spesa.js"));
  const r = (giorno, processo, di_prova, chiamate, token_input) => ({ giorno, processo, modello: "m", di_prova, chiamate, token_input, token_output: 1, token_cache_scrittura: 0, token_cache_lettura: 0 });
  const { perGiorno, perProcesso, totale } = riassumiSpesa([
    r("2026-10-27", "assistente", false, 3, 300),
    r("2026-10-27", "escape/proposta", false, 2, 50),
    r("2026-10-27", "assistente", true, 10, 1000),
    r("2026-10-26", "assistente", false, 1, 100),
  ]);
  ok(totale.produzione.chiamate === 6 && totale.produzione.input === 450, "il totale di produzione somma tutti i processi e tutti i giorni", totale.produzione);
  ok(totale.prova.chiamate === 10 && totale.prova.input === 1000, "la prova sta a parte", totale.prova);
  ok(perGiorno.get("2026-10-27").produzione.chiamate === 5 && perGiorno.get("2026-10-26").produzione.chiamate === 1, "per giorno", [...perGiorno.keys()]);
  ok(perProcesso.get("assistente · m").produzione.input === 400, "per processo, su più giorni", perProcesso.get("assistente · m"));
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:consumo)`);
process.exit(falliti === 0 ? 0 : 1);
