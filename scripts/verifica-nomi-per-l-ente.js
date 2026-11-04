#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// npm run test:profili — chi legge `profiles` (04/11, Mario: «ho guardato tutte
// le regole che leggono `profiles` e sono queste»).
//
// §1 Le regole di LETTURA su `profiles` che le migrazioni lasciano in piedi sono
//    esattamente due: la propria riga e l'admin. Una policy nuova di lettura
//    nasce rossa: chi vuole mostrare a qualcuno il profilo di un altro passa da
//    una funzione che dà solo i campi che servono (nome e cognome, di solito).
//    Lessicale sulle migrazioni; con la replica (CONN) anche su pg_policies.
// §2 I tre lettori dell'ente (messaggi, conversazione, registro docenti) non
//    leggono più `profiles!student_id` e chiamano le due funzioni.
// §3 Un nome non letto lo dice, e non diventa «Studente» o «Docente».
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
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

console.log("\n§1 · le regole di lettura su profiles sono due");
const dir = path.join(ROOT, "supabase/migrations");
const file = fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort();
const vive = new Map(); // nome → comando
let create = 0;
for (const f of file) {
  const s = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
  const eventi = [];
  for (const m of s.matchAll(/create\s+policy\s+([a-z_]+)\s+on\s+public\.profiles\b([^;]*)/gi)) {
    const cmd = (/\bfor\s+(select|insert|update|delete|all)\b/i.exec(m[2])?.[1] ?? "all").toLowerCase();
    eventi.push({ i: m.index, tipo: "c", nome: m[1], cmd });
  }
  for (const m of s.matchAll(/drop\s+policy\s+(?:if\s+exists\s+)?([a-z_]+)\s+on\s+public\.profiles\b/gi)) eventi.push({ i: m.index, tipo: "d", nome: m[1] });
  for (const e of eventi.sort((a, b) => a.i - b.i)) {
    if (e.tipo === "c") { create++; vive.set(e.nome, e.cmd); } else vive.delete(e.nome);
  }
}
// Il pavimento sulle create lette, che non scendono quando il prodotto migliora.
ok(file.length > 200 && create >= 10, `migrazioni lette: ${file.length}, policy create su profiles: ${create}`);
const lettura = [...vive].filter(([, c]) => c === "select" || c === "all").map(([n]) => n).sort();
ok(JSON.stringify(lettura) === JSON.stringify(["profiles_select_admin", "profiles_select_own"]),
  "restano solo profiles_select_own e profiles_select_admin", lettura);
if (process.env.CONN) {
  const out = execFileSync("psql", [process.env.CONN, "-Atc",
    "select string_agg(policyname, ',' order by policyname) from pg_policies where schemaname='public' and tablename='profiles' and cmd in ('SELECT','ALL')"]).toString().trim();
  ok(out === "profiles_select_admin,profiles_select_own", "sulla replica, pg_policies dice lo stesso", out);
} else console.log("  · replica non collegata (CONN): pg_policies non guardato");

console.log("\n§2 · i lettori dell'ente passano dalle funzioni");
const leggi = (r) => senzaCommenti(fs.readFileSync(path.join(ROOT, r), "utf8"));
const lettori = [
  ["app/ente/(dashboard)/messaggi/page.tsx", "leggiNomiInConversazione("],
  ["app/ente/(dashboard)/messaggi/[id]/page.tsx", "leggiNomiInConversazione("],
  ["components/ente/PlanciaEnteEvento.tsx", "leggiNomiDocentiIscritti("],
];
for (const [r, chiamata] of lettori) {
  const s = leggi(r);
  ok(!/profiles!/.test(s), `${r} non legge profiles con un embed`);
  ok(s.includes(chiamata) && s.includes("nomeOppure("), `${r} chiama ${chiamata.slice(0, -1)} e mostra il nome con nomeOppure`);
}
const lib = leggi("lib/ente/nomiPerEnte.ts");
ok(/rpc\("nomi_degli_studenti_in_conversazione"\)/.test(lib) && /rpc\("nomi_dei_docenti_iscritti",\s*\{\s*p_evento/.test(lib), "la lib chiama le due funzioni della migrazione");

console.log("\n§3 · un nome non letto lo dice");
const N = require(path.join(ROOT, "lib/ente/nomiPerEnte.ts"));
// Attesi scritti a mano.
ok(N.nomeOppure(null, "x", "Studente") === "Non siamo riusciti a leggere il nome", "non letto: lo dice, non «Studente»");
ok(N.nomeOppure(new Map([["x", "Stella Scrive"]]), "x", "Studente") === "Stella Scrive", "letto: il nome");
ok(N.nomeOppure(new Map(), "x", "Docente") === "Docente", "assente: il ripiego di sempre");
const finto = (risposta) => ({ rpc: async () => risposta });
(async () => {
  const errore = await N.leggiNomiInConversazione(finto({ data: null, error: { message: "giù" } }));
  ok(errore === null, "una lettura fallita è null, non una mappa vuota");
  const vuota = await N.leggiNomiDocentiIscritti(finto({ data: [], error: null }), "e");
  ok(vuota instanceof Map && vuota.size === 0, "una lettura riuscita senza righe è una mappa vuota");
  const piena = await N.leggiNomiInConversazione(finto({ data: [{ conversazione_id: "c1", nome: "Stella", cognome: "Scrive" }], error: null }));
  ok(piena?.get("c1") === "Stella Scrive", "la conversazione porta il nome del suo studente");
  console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:profili)`);
  process.exit(falliti === 0 ? 0 : 1);
})();
