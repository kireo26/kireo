#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// CONSERVARE TUTTO, TOGLIERE IL NOME (Mario, 03/11). Quando una persona cancella
// l'account il profilo non si cancella più, quindi le cascate da `profiles` non
// scattano: cosa succede a ogni tabella lo decide `conserva_alla_cancellazione`.
// Una tabella nuova in cascata, con dentro un testo libero, resterebbe intera
// in silenzio: per questo ogni tabella della cascata DICE cosa le succede, in
// `supabase/conservare-alla-cancellazione.json`, e questa guardia è rossa su
// una tabella che non lo dice. È la forma del sovrainsieme con le esclusioni
// scritte (vedi «La cascata è la dichiarazione di appartenenza»).
//
// ⚠️ È lessicale: vede che la funzione NOMINA una tabella, non che la tratti
// bene. Quello lo prova `scripts/verifica-conservare-tutto.sql`, che cancella
// per davvero (con CONN qui lo lancia).
//
// Uso: npm run test:conservare   (CONN="host=/tmp port=54329 user=postgres dbname=postgres" per la replica)

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { cascataDaProfili } = require("./lib/cascata-profili");

const ROOT = path.join(__dirname, "..");
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

const registro = JSON.parse(fs.readFileSync(path.join(ROOT, "supabase/conservare-alla-cancellazione.json"), "utf8")).tabelle;
const TRATTAMENTI = new Set(["fatto", "testo", "rapporto", "fatto_e_rapporto", "altro"]);

console.log("\n§1 — ogni tabella della cascata dice cosa le succede\n");
const { cascata } = cascataDaProfili();
const inCascata = [...cascata.keys()];
ok(inCascata.length >= 40, `il lettore vede la cascata (${inCascata.length} tabelle, pavimento 40)`);
const senza = inCascata.filter((t) => !registro[t]);
ok(senza.length === 0, "nessuna tabella in cascata senza un trattamento", senza);
const stantie = Object.keys(registro).filter((t) => !cascata.has(t));
ok(stantie.length === 0, "nessuna voce per una tabella che non è (più) in cascata", stantie);
const malformate = Object.entries(registro).filter(([, v]) => !TRATTAMENTI.has(v.trattamento) || typeof v.perche !== "string" || v.perche.length < 15);
ok(malformate.length === 0, "ogni voce ha un trattamento noto e il suo perché", malformate.map(([k]) => k));

console.log("\n§2 — la funzione nomina le tabelle a cui deve fare qualcosa\n");
const dir = path.join(ROOT, "supabase/migrations");
let corpo = null;
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  const s = fs.readFileSync(path.join(dir, f), "utf8");
  // L'ultima definizione vince: ogni file più tardi la sostituisce.
  for (const m of s.matchAll(/create or replace function public\.conserva_alla_cancellazione\([\s\S]*?\$\$([\s\S]*?)\$\$;/g)) corpo = m[1];
}
ok(corpo !== null && corpo.length > 500, "l'ultima definizione di conserva_alla_cancellazione si legge");
const daNominare = Object.entries(registro).filter(([, v]) => ["testo", "rapporto", "fatto_e_rapporto"].includes(v.trattamento)).map(([k]) => k);
ok(daNominare.length >= 25, `le tabelle a cui succede qualcosa (${daNominare.length}, pavimento 25)`);
const corpoSenzaCommenti = (corpo ?? "").replace(/--[^\n]*/g, "");
const mute = daNominare.filter((t) => !new RegExp(`public\\.${t}\\b`).test(corpoSenzaCommenti));
ok(mute.length === 0, "ogni tabella di testo o di rapporto è nominata dalla funzione", mute);
const fattiToccati = Object.entries(registro)
  .filter(([, v]) => v.trattamento === "fatto")
  .map(([k]) => k)
  .filter((t) => new RegExp(`delete from public\\.${t}\\b`).test(corpoSenzaCommenti));
ok(fattiToccati.length === 0, "nessun fatto si cancella", fattiToccati);

console.log("\n§3 — sulla replica: cancellare per davvero\n");
const CONN = process.env.CONN;
if (!CONN) {
  console.log("  · non ho guardato: senza CONN non c'è una replica (la lancia npm run sql:tutti)");
} else {
  const uscita = execFileSync("psql", [CONN, "-q", "-f", path.join(ROOT, "scripts/verifica-conservare-tutto.sql")], { encoding: "utf8" });
  ok(/\b0 ROTTE su 12\b/.test(uscita), "verifica-conservare-tutto.sql: 12 su 12", uscita.split("\n").filter((r) => /ROTT/.test(r)).join("\n"));
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:conservare)`);
process.exit(falliti === 0 ? 0 : 1);
