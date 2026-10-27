#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// DOVE ABITA CHI HA UN RUOLO (Mario, 27/10): «La mia area» porta tutti a casa
// loro, e `/app` non costruisce la casa di uno studente per chi non lo è.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
abilitaTypeScript();
const C = require("@/lib/ruoli/casa");

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

console.log("\n§1 — la mappa copre i ruoli che esistono\n");
{
  // L'atteso viene dalle MIGRAZIONI, non dalla mappa: l'enum e i suoi `add value`.
  const dir = path.join(ROOT, "supabase/migrations");
  const ruoli = new Set();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql"))) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
    const crea = sql.match(/create type public\.profile_role as enum \(([^)]*)\)/);
    if (crea) for (const m of crea[1].matchAll(/'([a-z_]+)'/g)) ruoli.add(m[1]);
    for (const m of sql.matchAll(/alter type public\.profile_role add value (?:if not exists )?'([a-z_]+)'/g)) ruoli.add(m[1]);
  }
  ok(ruoli.size >= 6, `le migrazioni dichiarano ${ruoli.size} ruoli (soglia 6)`);
  const mancanti = [...ruoli].filter((r) => !C.CASA_PER_RUOLO[r]);
  ok(mancanti.length === 0, "ogni ruolo dell'enum ha una casa", mancanti);
  const inventati = Object.keys(C.CASA_PER_RUOLO).filter((r) => !ruoli.has(r));
  ok(inventati.length === 0, "e la mappa non ha ruoli che l'enum non conosce", inventati);
  for (const [ruolo, casa] of Object.entries(C.CASA_PER_RUOLO)) {
    const pagina = ["page.tsx", "(dashboard)/page.tsx"].map((p) => path.join(ROOT, "app", casa.slice(1), p)).find((p) => fs.existsSync(p));
    ok(!!pagina, `${ruolo} → ${casa}: la pagina esiste`);
  }
  ok(C.casaPerRuolo("istituzione") === "/ente", "un ente abita in /ente");
  ok(C.casaPerRuolo("inventato") === null && C.casaPerRuolo(null) === null, "un ruolo che non conosciamo non ha casa: nessuno lo manda da uno studente");
}

console.log("\n§2 — chi la usa\n");
{
  const header = leggi("components/Header.tsx");
  // Per ogni «La mia area», l'ultimo `href` che la precede: è quello del suo Link.
  const pezzi = header.split("La mia area").slice(0, -1);
  const voci = pezzi.map((prima) => {
    const tutti = [...prima.matchAll(/href=(?:\{([A-Za-z_]+)\}|"([^"]+)")/g)];
    const ultimo = tutti[tutti.length - 1];
    return ultimo ? (ultimo[1] ?? ultimo[2]) : null;
  });
  ok(voci.length === 2, `«La mia area» compare due volte nel menu (desktop e telefono): ${voci.length}`, voci);
  ok(voci.every((v) => v === "HREF_LA_MIA_AREA"), "e tutte e due portano a HREF_LA_MIA_AREA, non a /app", voci);
  ok(C.HREF_LA_MIA_AREA === "/dopo-accesso", "che è /dopo-accesso: la decisione sta sul server, dove si legge il profilo");
  const dopo = leggi("app/dopo-accesso/page.tsx");
  ok(/redirect\(casaPerRuolo\(ruolo\) \?\? "\/app"\)/.test(dopo) && !/redirect\("\/ente"\)/.test(dopo), "/dopo-accesso chiede la casa alla mappa invece di riscriversela");
  const app = leggi("app/app/layout.tsx");
  ok(/casaPerRuolo\(contesto\.ruolo\)/.test(app) && /redirect\(casa\)/.test(app), "/app manda a casa sua chi non è uno studente");
  ok(!/Il tuo percorso di orientamento sta per iniziare/.test(app), "e non dice più a un ente che il suo percorso di orientamento sta per iniziare");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:casa)`);
process.exit(falliti === 0 ? 0 : 1);
