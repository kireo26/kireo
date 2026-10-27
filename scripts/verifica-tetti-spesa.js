#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// I TETTI DELLE DUE ROUTE CHE SPENDONO (Mario, 27/10), metà codice. La metà
// database sta in scripts/verifica-tetti-spesa.sql (npm run sql:tutti).
//
// §1 esegue il taglio del contesto con lunghezze scritte a mano; §2 e §3
// leggono l'ORDINE nelle due route (prima si conta, poi si spende), ancorati
// alla chiamata e non al nome; §4 confronta i nomi degli errori con quelli
// che solleva la migrazione, che è la fonte indipendente.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
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
const posizione = (src, ancora) => {
  if (typeof ancora !== "string") throw new Error("àncora non stringa");
  return src.indexOf(ancora);
};

console.log("\n§1 — il taglio del contesto lo decide il server\n");
{
  const { tagliaContesto, MAX_CARATTERI_CONTESTO } = require(path.join(ROOT, "lib/assistente/contesto.ts"));
  const m = (role, n) => ({ role, content: "x".repeat(n) });
  // 6 messaggi da 30 caratteri, tetto 100: ci stanno gli ultimi 3 (90), ma il
  // terzultimo è dell'assistente, quindi si comincia dal penultimo dello studente.
  const lunga = [m("user", 30), m("assistant", 30), m("user", 30), m("assistant", 30), m("user", 30), m("assistant", 30), m("user", 30)];
  const tenuti = tagliaContesto(lunga, 100);
  const tot = tenuti.reduce((a, x) => a + x.content.length, 0);
  ok(tot <= 100, "quello che si manda sta nel tetto", tot);
  ok(tenuti[0].role === "user", "si comincia da un messaggio dello studente", tenuti.map((x) => x.role));
  ok(tenuti.length === 3 && tenuti[tenuti.length - 1] === lunga[lunga.length - 1], "si tiene la coda, e l'ultima domanda c'è sempre", tenuti.length);
  ok(tagliaContesto([m("user", 500)], 100).length === 1, "una domanda sola più lunga del tetto resta (l'ha già limitata la route)");
  ok(tagliaContesto(lunga, 10_000).length === lunga.length, "sotto il tetto non si toglie niente");
  ok(MAX_CARATTERI_CONTESTO < 20 * 2000, "il tetto è più stretto di quello che un client può mandare (20 × 2000)", MAX_CARATTERI_CONTESTO);
  const route = leggi("app/api/assistente/route.ts");
  ok(/messages:\s*tagliaContesto\(messaggi\)/.test(route), "la route manda al modello la coda tagliata, non la history ricevuta");
}

console.log("\n§2 — l'assistente conta la richiesta prima di spendere, e non chiede niente al client\n");
{
  const route = leggi("app/api/assistente/route.ts");
  const conta = posizione(route, '.from("assistente_richieste").insert(');
  const spende = posizione(route, "client.messages.stream(");
  ok(conta > 0 && spende > 0 && conta < spende, "l'insert della richiesta sta prima della chiamata", { conta, spende });
  const blocco = route.slice(conta, spende);
  ok(/\.from\("assistente_richieste"\)\.insert\(\{ student_id: user\.id \}\)/.test(route) && !/nuovaConversazione/.test(blocco),
    "si scrive solo chi chiama, e il conto non passa da un campo del client");
  ok(/return erroreDiCortesia\([\s\S]*?500\)/.test(blocco), "se non si riesce a contare, non si spende (5xx prima della chiamata)");
}

console.log("\n§3 — escape/finalizza non rifinalizza un tentativo concluso\n");
{
  const route = leggi("app/api/escape/finalizza/route.ts");
  const guardia = posizione(route, 'if (attempt.stato !== "in_corso")');
  const spende = posizione(route, "await calcolaEvidenze(");
  ok(guardia > 0 && spende > 0 && guardia < spende, "lo stato si guarda prima del calcolo che chiama il modello", { guardia, spende });
  ok(/if \(attempt\.stato !== "in_corso"\) \{\s*return erroreDiCortesia\([^;]*409\)/.test(route), "e la guardia ritorna, non annota soltanto");
}

console.log("\n§4 — i nomi degli errori sono quelli che il database solleva\n");
{
  const sql = senzaCommentiSql(fs.readFileSync(path.join(ROOT, "supabase/migrations/20261104140000_tetti_spesa_e_tentativi.sql"), "utf8"));
  const sollevati = [...sql.matchAll(/raise exception '([a-z_]+)'/g)].map((x) => x[1]);
  ok(sollevati.includes("troppe_richieste_assistente_oggi") && sollevati.includes("troppi_tentativi_missione_oggi"), "la migrazione solleva i due nomi", sollevati);
  ok(leggi("app/api/assistente/route.ts").includes('includes("troppe_richieste_assistente_oggi")'), "la route dell'assistente riconosce il suo");
  const inizia = leggi("components/escape/IniziaMissione.tsx");
  ok(inizia.includes('includes("troppi_tentativi_missione_oggi")') && /domani/.test(inizia), "il bottone della missione riconosce il suo, e dice quando tornare");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:tettispesa)`);
process.exit(falliti === 0 ? 0 : 1);
