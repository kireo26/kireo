#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LE STATISTICHE DELL'ENTE (Mario, 27/10): «Download guida: 0» con la guida
// scaricata, e «0 iscritti · 1 partecipati» sulla stessa riga. Le due cure
// stanno nel database (20261102110000, 20261102120000, provate da
// `scripts/verifica-statistiche-ente.sql`); qui si sorveglia la metà del client
// che le fa funzionare, cioè DOVE e COME si scrive `recinto_enti`.
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

function fileSorgenti(dir) {
  const out = [];
  for (const voce of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...fileSorgenti(rel));
    else if (/\.(ts|tsx)$/.test(voce.name)) out.push(rel);
  }
  return out;
}

(async () => {
console.log("\n§1 — chi scrive il recinto, e su quale vincolo\n");
{
  // L'insieme: ogni file del prodotto che nomina la tabella in una `.from(...)`.
  const sorgenti = ["app", "components", "lib"].flatMap(fileSorgenti);
  const scrittori = sorgenti.filter((f) => /\.from\(\s*["']recinto_enti["']\s*\)\s*\.\s*(insert|upsert|update|delete)\b/.test(leggi(f)));
  ok(scrittori.length === 1 && scrittori[0] === path.join("lib", "app", "recinto.ts"),
    "una sola scrittura su recinto_enti in tutto il prodotto, in lib/app/recinto.ts", scrittori);

  // L'atteso viene dalle MIGRAZIONI, non dal file sotto esame: l'ultimo vincolo
  // unique su recinto_enti che nessuna migrazione successiva ha tolto.
  const dir = path.join(ROOT, "supabase/migrations");
  const vincoli = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
    // Per nome: un file che crea il recinto crea anche altre tabelle, coi loro vincoli.
    for (const m of sql.matchAll(/constraint (recinto_enti_\w+) unique \(([^)]*)\)/g)) {
      vincoli.set(m[1], m[2].split(",").map((c) => c.trim()).sort().join(","));
    }
    for (const m of sql.matchAll(/alter table public\.recinto_enti drop constraint (\w+)/g)) vincoli.delete(m[1]);
  }
  ok(vincoli.size === 1, `le migrazioni lasciano un vincolo unique sul recinto (${[...vincoli.keys()].join(", ") || "nessuno"})`);
  const atteso = [...vincoli.values()][0] ?? "";
  const recinto = leggi("lib/app/recinto.ts");
  const bersaglio = (recinto.match(/onConflict:\s*"([^"]+)"/) ?? [])[1] ?? "";
  ok(bersaglio.split(",").map((c) => c.trim()).sort().join(",") === atteso,
    "il bersaglio del conflitto è il vincolo delle migrazioni", { bersaglio, atteso });
  ok(atteso.split(",").includes("origine"), "…e il vincolo comprende l'origine: una guida dopo un evento lascia la sua riga", atteso);
  ok(/if \(error\) console\.error/.test(recinto), "un errore della scrittura si scrive nel log, non si butta");

  // Ogni gesto passa da lì, ognuno con la sua origine.
  for (const [f, origine] of [
    ["components/app/GuidaEnteForm.tsx", "guida"],
    ["components/app/IscrivitiNewsletterButton.tsx", "newsletter"],
    ["components/app/IscrivitiEventoButton.tsx", "evento"],
  ]) {
    ok(new RegExp(`segnaNelRecinto\\([^)]*"${origine}"\\)`).test(leggi(f)), `${f} segna l'origine «${origine}»`);
  }
}


console.log("\n§2 — le quote contano solo l'approvato, e «non letto» non è zero\n");
{
  // Un client finto che registra i filtri di ogni lettura e risponde con un
  // conteggio. Si ESEGUE getQuoteEnte, non se ne legge il testo.
  function clienteFinto({ fallisce = null } = {}) {
    const letture = [];
    return {
      letture,
      from(tabella) {
        const filtri = [];
        letture.push({ tabella, filtri });
        const catena = {
          select() { return catena; },
          eq(c, v) { filtri.push(["eq", c, v]); return catena; },
          in(c, v) { filtri.push(["in", c, v]); return catena; },
          not(c, op, v) { filtri.push(["not", c, v]); return catena; },
          gte() { return catena; },
          lte() { return catena; },
          maybeSingle() {
            return Promise.resolve({ data: { quota_eventi_promossi: 5, quota_newsletter: 12, quota_cta_esterne: 5, quota_comunicazioni_kireo: 5 }, error: null });
          },
          then(ok, ko) {
            const tipo = filtri.find((f) => f[1] === "tipo")?.[2] ?? (filtri.some((f) => f[1] === "cta_esterna_url") ? "cta" : "evidenza");
            const r = fallisce === tipo ? { count: null, error: { message: "rete" } } : { count: 2, error: null };
            return Promise.resolve(r).then(ok, ko);
          },
        };
        return catena;
      },
    };
  }
  const { getQuoteEnte } = require(path.join(ROOT, "lib/ente/quote.ts"));
  const erroreOriginale = console.error;
  console.error = () => {};
  const finto = clienteFinto();
  const q = await getQuoteEnte(finto, "ente", "premium");
  const nulle = [];
  for (const tipo of ["evidenza", "cta", "newsletter", "comunicazione_kireo"]) {
    nulle.push([tipo, await getQuoteEnte(clienteFinto({ fallisce: tipo }), "ente", "premium")]);
  }
  console.error = erroreOriginale;

  ok(q && q.newsletterUsate === 2 && q.newsletterTotali === 12, "con le letture riuscite, le quote escono coi numeri", q);
  const di = (pred) => finto.letture.find((l) => pred(l.filtri));
  const cta = di((f) => f.some((x) => x[1] === "cta_esterna_url"));
  ok(cta && cta.filtri.some((x) => x[0] === "eq" && x[1] === "stato" && x[2] === "approvato"), "le CTA contano solo gli eventi approvati", cta?.filtri);
  for (const tipo of ["newsletter", "comunicazione_kireo"]) {
    const l = di((f) => f.some((x) => x[1] === "tipo" && x[2] === tipo));
    const stati = l?.filtri.find((x) => x[0] === "in" && x[1] === "stato")?.[2] ?? null;
    // L'atteso è scritto qui, non importato da quote.ts.
    ok(JSON.stringify([...(stati ?? [])].sort()) === JSON.stringify(["approvata", "inviata"]),
      `le ${tipo} contano solo approvate e inviate (non bozze, in approvazione, rifiutate)`, stati);
  }
  for (const [tipo, esito] of nulle) ok(esito === null, `una lettura fallita (${tipo}) dà «non letto», non zero`, esito);

  const riquadri = leggi("components/ente/RiquadriQuote.tsx");
  ok(/if \(!quote\)/.test(riquadri) && /TESTO_QUOTE_NON_LETTE/.test(riquadri), "i riquadri dicono «non letto» quando le quote non ci sono");
  for (const f of ["app/ente/(dashboard)/page.tsx", "app/ente/(dashboard)/piano/page.tsx"]) {
    ok(/<RiquadriQuote quote=\{quote\} \/>/.test(leggi(f)), `${f} passa dai riquadri condivisi`);
  }
  const form = leggi("components/ente/CreaComunicazioneForm.tsx");
  ok(/quotaRimasta !== null && quotaRimasta <= 0/.test(form), "il form non dice «quota esaurita» su una quota non letta");
}

console.log("\n§3 — il limite delle aree dipende dal tipo, e sta in un posto solo\n");
{
  const form = leggi("components/ente/ProfiloEnteForm.tsx");
  ok(!/MAX_AREE/.test(form), "il form non ha più una costante sua per il limite");
  ok(/\.rpc\("max_aree_istituzione"/.test(form), "…lo chiede alla funzione del database");
  // Non basta che il nome della costante sia sparito: un 3 scritto a mano nel
  // confronto è la stessa copia senza nome (controprova del 27/10).
  ok(/attive\.length >= massimo\b/.test(form) && !/attive\.length >= \d/.test(form),
    "…e confronta le aree con il numero letto, non con un numero scritto");
  // L'ultima definizione del trigger, dalle migrazioni.
  const dir = path.join(ROOT, "supabase/migrations");
  let ultima = "";
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
    const m = sql.match(/create or replace function public\.limite_aree_istituzione\(\)[\s\S]*?\$\$;/);
    if (m) ultima = m[0];
  }
  ok(/public\.max_aree_istituzione\(new\.istituzione_id\)/.test(ultima), "il trigger usa la stessa funzione del form");
  ok(!/>= 3\b/.test(ultima), "…e non un 3 scritto a mano");
}

console.log("\n§4 — «Per evento» e i riquadri dicono cosa contano\n");
{
  const pagina = leggi("app/ente/(dashboard)/statistiche/page.tsx");
  ok(!/\{s\.\w+\} (iscritti|partecipati|collegati|risposte)\b/.test(pagina), "nessun «{n} iscritti»: con 1 il plurale non accorda");
  ok(!/partecipati<\/span>|>\{?[^<]*\bpartecipati\b[^<]*</.test(pagina.replace(/s\.partecipati/g, "")), "la parola «partecipati» non compare più a schermo");
  ok(/s\.presenti != null \?/.test(pagina), "i collegati compaiono solo dove la vista li ha (una diretta)");
  ok(/Studenti raggiunti dall'inizio/.test(pagina), "«Studenti raggiunti» dice che non è un conto dell'anno");
  ok(/nonLetto \?/.test(pagina), "una lettura fallita non si presenta come «nessuna interazione»");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:statistiche)`);
process.exit(falliti === 0 ? 0 : 1);
})();
