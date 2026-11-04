#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA PRODUZIONE DICE SE È INDIETRO RISPETTO A `main` (04/11).
// §1 la decisione, con gli attesi scritti a mano;
// §2 le letture da GitHub con un `fetch` finto: ogni guasto è «non controllato», mai «allineato»;
// §3 i testi; §4 il cron: il controllo fa partire la mail, e solo sul giro programmato.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();
const A = require(path.join(ROOT, "lib/osservabilita/allineamentoDeploy.ts"));

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? `\n      → ${JSON.stringify(dettaglio)}` : ""}`);
  }
}

const P = "a".repeat(40); // il commit della produzione
const T = "b".repeat(40); // la testa di main
const adesso = new Date("2026-11-05T06:00:00Z");
const base = { sha: P, testa: T, avantiDi: 2, commit: ["due", "uno"], adesso };

console.log("\n§1 — la decisione\n");
ok(A.classificaAllineamento({ ...base, testa: P, statiTesta: [] }).esito === "allineato", "stesso commit: allineato");
const mai = A.classificaAllineamento({ ...base, statiTesta: [] });
ok(mai.esito === "indietro" && mai.come === "mai_partito", "main avanti e nessuno stato di Vercel: il caso del 04/11", mai);
const fall = A.classificaAllineamento({ ...base, statiTesta: [{ state: "failure", created_at: "2026-11-05T05:00:00Z" }, { state: "pending", created_at: "2026-11-05T04:59:00Z" }] });
ok(fall.esito === "indietro" && fall.come === "fallito", "l'ultimo stato è un rosso: fallito (il caso del 27/10)", fall);
const fresca = A.classificaAllineamento({ ...base, statiTesta: [{ state: "pending", created_at: "2026-11-05T05:45:00Z" }] });
ok(fresca.esito === "in_costruzione" && fresca.daMinuti === 15, "una costruzione partita 15 minuti fa: si aspetta", fresca);
const vecchia = A.classificaAllineamento({ ...base, statiTesta: [{ state: "pending", created_at: "2026-11-05T05:30:00Z" }] });
ok(vecchia.esito === "indietro" && vecchia.come === "fermo", "in costruzione da 30 minuti: è la soglia, si segnala", vecchia);
const verde = A.classificaAllineamento({ ...base, statiTesta: [{ state: "success", created_at: "2026-11-05T05:00:00Z" }] });
ok(verde.esito === "indietro" && verde.come === "fermo", "un verde di Vercel (un'anteprima) sulla testa non spiega la differenza", verde);
ok(A.MINUTI_COSTRUZIONE_TOLLERATI === 30, "la soglia è un numero solo, 30 minuti");
ok(A.allineamentoDaSegnalare({ esito: "non_controllato", motivo: "x" }) === true, "un «non controllato» si segnala");
ok(A.allineamentoDaSegnalare({ esito: "indietro", ...base, come: "mai_partito" }) === true, "un «indietro» si segnala");
ok(A.allineamentoDaSegnalare({ esito: "allineato", sha: P }) === false && A.allineamentoDaSegnalare(fresca) === false, "allineato e in costruzione no");

console.log("\n§2 — le letture, con un fetch finto\n");
const env = { VERCEL_GIT_COMMIT_SHA: P, VERCEL_GIT_REPO_OWNER: "kireo26", VERCEL_GIT_REPO_SLUG: "kireo" };
const risposta = (status, corpo) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });
function finto(mappa) {
  const chiesti = [];
  const f = async (url) => {
    chiesti.push(url);
    for (const [pezzo, r] of mappa) if (url.includes(pezzo)) { if (r instanceof Error) throw r; return r; }
    throw new Error("url inattesa " + url);
  };
  f.chiesti = chiesti;
  return f;
}
const confrontoAvanti = { status: "ahead", ahead_by: 2, commits: [{ sha: "c".repeat(40), commit: { message: "uno\n\ncorpo" } }, { sha: T, commit: { message: "due" } }] };
(async () => {
  const f1 = finto([["/compare/", risposta(200, confrontoAvanti)], ["/statuses", risposta(200, [])]]);
  const r1 = await A.leggiAllineamento(env, f1, adesso);
  ok(r1.esito === "indietro" && r1.come === "mai_partito" && r1.testa === T, "main avanti, nessuno stato: indietro, mai partito", r1);
  ok(JSON.stringify(r1.commit) === JSON.stringify(["due", "uno"]), "i commit mancanti, dal più recente, solo la prima riga", r1.commit);
  ok(f1.chiesti[0] === `https://api.github.com/repos/kireo26/kireo/compare/${P}...main`, "il confronto parte dal commit della produzione", f1.chiesti[0]);
  ok(f1.chiesti[1] === `https://api.github.com/repos/kireo26/kireo/commits/${T}/statuses?per_page=20`, "e gli stati sono quelli della testa", f1.chiesti[1]);

  const f2 = finto([["/compare/", risposta(200, confrontoAvanti)], ["/statuses", risposta(200, [{ state: "failure", created_at: "2026-11-05T05:00:00Z", context: "Vercel" }, { state: "success", created_at: "2026-11-05T05:00:00Z", context: "altro" }])]]);
  const r2 = await A.leggiAllineamento(env, f2, adesso);
  ok(r2.esito === "indietro" && r2.come === "fallito", "gli stati che contano sono quelli di Vercel", r2);

  const r3 = await A.leggiAllineamento(env, finto([["/compare/", risposta(200, { status: "identical", ahead_by: 0, commits: [] })]]), adesso);
  ok(r3.esito === "allineato", "identici: allineato, senza chiedere gli stati", r3);

  const nc = async (f, e = env) => (await A.leggiAllineamento(e, f, adesso)).esito === "non_controllato";
  ok(await nc(finto([]), { VERCEL_GIT_REPO_OWNER: "kireo26", VERCEL_GIT_REPO_SLUG: "kireo" }), "senza il proprio commit: non controllato");
  ok(await nc(finto([["/compare/", new Error("fetch failed")]])), "la rete che cade: non controllato");
  ok(await nc(finto([["/compare/", risposta(403, { message: "rate limit" })]])), "GitHub che risponde 403 (il tetto delle richieste): non controllato");
  ok(await nc(finto([["/compare/", risposta(404, {})]])), "un commit che GitHub non conosce: non controllato");
  ok(await nc(finto([["/compare/", risposta(200, { status: "ahead" })]])), "una forma senza commits: non controllato");
  ok(await nc(finto([["/compare/", risposta(200, { status: "diverged", ahead_by: 1, behind_by: 1, commits: [{ sha: T }] })], ["/statuses", risposta(200, [])]])), "la produzione fuori da main: non controllato, non allineato");
  ok(await nc(finto([["/compare/", risposta(200, confrontoAvanti)], ["/statuses", risposta(500, {})]])), "gli stati che non arrivano: non controllato");
  ok(await nc(finto([["/compare/", risposta(200, confrontoAvanti)], ["/statuses", risposta(200, { message: "x" })]])), "gli stati in una forma strana: non controllato");

  console.log("\n§3 — i testi\n");
  const tn = A.testoAllineamento({ esito: "non_controllato", motivo: "x <y>" });
  ok(/Non siamo riusciti a controllare/.test(tn) && /non vuol dire che lo sia/.test(tn), "il non controllato non si legge come un sì", tn);
  ok(tn.includes("x &lt;y&gt;"), "il motivo è scritto senza HTML", tn);
  const ti = A.testoAllineamento(r1);
  ok(/INDIETRO/.test(ti) && ti.includes("aaaaaaa") && ti.includes("bbbbbbb") && /mai cominciato un deploy/.test(ti), "l'indietro dice i due commit e perché", ti);
  ok(/<li>due<\/li><li>uno<\/li>/.test(ti), "e quali commit mancano", ti);
  ok(/l'ultimo deploy di main è fallito/.test(A.testoAllineamento(r2)), "il fallito lo dice");

  console.log("\n§4 — il cron\n");
  const cron = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/api/cron/workshop-motore/route.ts"), "utf8"));
  ok(/const allineamento = alertRichiesto\s*\?\s*await leggiAllineamento\(process\.env/.test(cron), "il controllo lo fa la produzione, sul giro programmato");
  ok(/if \(alertRichiesto && \(deployDaSegnalare \|\|/.test(cron), "un disallineamento o un non controllato fa partire la mail da solo");
  ok(/const html = `\$\{allineamento \? `<p><strong>Deploy<\/strong> — \$\{testoAllineamento\(allineamento\)\}/.test(cron), "e sta in testa alla mail");
  ok(/deployDaSegnalare \? \(allineamento\?\.esito === "indietro"/.test(cron), "l'oggetto della mail lo dice");

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti} su ${fatte}`);
  process.exit(falliti === 0 ? 0 : 1);
})();
