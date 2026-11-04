#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// npm run test:giri — i giri dei cron e la mail del lunedì (04/11, 20261209110000).
//
// §1 riassumiGiri, con gli attesi scritti a mano: un giorno senza giro, un giro
//    non finito, i giri a mano esclusi dalla lettura, nessun giro registrato.
// §2 il lunedì è quello italiano; testoGiri senza lettura lo dice.
// §3 leggiGiri: il giro di chi scrive la mail non è «non finito», una lettura
//    fallita è null.
// §4 i tre cron scrivono il giro appena autorizzati e lo chiudono prima di
//    rispondere; il cron dei workshop manda la mail il lunedì comunque.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();
const G = require(path.join(ROOT, "lib/osservabilita/giriCron.ts"));

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

// Lunedì 9 novembre 2026, 7:00 a Roma (6:00 UTC).
const LUNEDI = new Date("2026-11-09T06:00:00Z");
const giro = (processo, istante, finito = true) => ({ processo, partito_il: istante, finito_il: finito ? istante : null });

console.log("\n§1 · il riassunto");
const righe = [];
// Motore: tutti i giorni dal 2 all'8, tranne il 5.
for (const g of ["02", "03", "04", "06", "07", "08"]) righe.push(giro("cron/workshop-motore", `2026-11-${g}T06:00:05Z`));
// Newsletter: due al giorno, l'8 il secondo partito e non finito.
for (const g of ["02", "03", "04", "05", "06", "07", "08"]) {
  righe.push(giro("cron/newsletter", `2026-11-${g}T05:30:02Z`));
  righe.push(giro("cron/newsletter", `2026-11-${g}T06:30:02Z`, g !== "08"));
}
const r = G.riassumiGiri(righe, LUNEDI);
const motore = r.find((x) => x.processo === "cron/workshop-motore");
const news = r.find((x) => x.processo === "cron/newsletter");
const sonda = r.find((x) => x.processo === "cron/registrazioni");
ok(r.length === 3, "una riga per ognuno dei tre cron");
ok(motore.giri === 6 && motore.attesi === 7, "il motore: 6 giri su 7 attesi", motore);
ok(JSON.stringify(motore.giorniSenza) === JSON.stringify(["2026-11-05"]), "il motore: il 5 novembre senza giro", motore.giorniSenza);
ok(motore.ultimo && motore.ultimo.partito.toISOString() === "2026-11-08T06:00:05.000Z", "il motore: l'ultimo giro è l'8");
ok(news.giri === 14 && news.attesi === 14 && news.giorniSenza.length === 0 && news.nonFiniti === 1, "la newsletter: 14 su 14, uno non finito", news);
ok(sonda.ultimo === null && sonda.giri === 0 && sonda.giorniSenza.length === 7, "la sonda: nessun giro registrato, sette giorni senza", sonda);
ok(G.giriDaSegnalare(r) === true, "un giorno senza giro si segnala");
const tuttiBene = [];
for (const g of ["02", "03", "04", "05", "06", "07", "08"]) {
  tuttiBene.push(giro("cron/workshop-motore", `2026-11-${g}T06:00:05Z`), giro("cron/registrazioni", `2026-11-${g}T04:17:00Z`));
  tuttiBene.push(giro("cron/newsletter", `2026-11-${g}T05:30:02Z`), giro("cron/newsletter", `2026-11-${g}T06:30:02Z`));
}
ok(G.giriDaSegnalare(G.riassumiGiri(tuttiBene, LUNEDI)) === false, "una settimana piena non si segnala");
// Il giorno è quello italiano: un giro alle 23:30 UTC del 4 è il 5 a Roma.
const notte = G.riassumiGiri([giro("cron/registrazioni", "2026-11-04T23:30:00Z")], LUNEDI).find((x) => x.processo === "cron/registrazioni");
ok(!notte.giorniSenza.includes("2026-11-05") && notte.giorniSenza.includes("2026-11-04"), "un giro alle 23:30 UTC del 4 conta per il 5 italiano");

console.log("\n§2 · il lunedì e i testi");
ok(G.eLunedìARoma(LUNEDI) === true, "lunedì 9 novembre alle 7 è lunedì");
ok(G.eLunedìARoma(new Date("2026-11-08T23:30:00Z")) === true, "domenica 23:30 UTC è già lunedì a Roma");
ok(G.eLunedìARoma(new Date("2026-11-10T06:00:00Z")) === false, "martedì no");
ok(/Non siamo riusciti a leggere i giri dei cron/.test(G.testoGiri(null)) && /non vuol dire che abbiano girato/.test(G.testoGiri(null)), "una lettura fallita lo dice, e non dice «hanno girato»");
ok(G.giriDaSegnalare(null) === true, "una lettura fallita si segnala");
const t = G.testoGiri(r);
ok(/giorni senza nessun giro/.test(t) && /partiti e non finiti: 1/.test(t) && /nessun giro registrato/.test(t), "il testo dice il buco, il non finito, e chi non ha mai girato");

console.log("\n§3 · la lettura");
function finto(rows, errore = null) {
  const q = { select: () => q, eq: () => q, gte: () => q, order: () => q, limit: async () => ({ data: errore ? null : rows, error: errore }), delete: () => q, lt: async () => ({ error: null }) };
  return { from: () => q };
}
(async () => {
  const corrente = { id: "adesso", processo: "cron/workshop-motore", partito_il: "2026-11-09T06:00:01Z", finito_il: null };
  const con = await G.leggiGiri(finto([corrente, ...tuttiBene.map((x, i) => ({ id: `r${i}`, ...x }))]), LUNEDI, "adesso");
  const m = con.find((x) => x.processo === "cron/workshop-motore");
  ok(m.nonFiniti === 0 && m.ultimo.finito === true, "il giro di chi scrive la mail non è «partito e non finito»");
  const senza = await G.leggiGiri(finto([corrente]), LUNEDI, null);
  ok(senza.find((x) => x.processo === "cron/workshop-motore").ultimo.finito === false, "un altro giro non finito resta non finito");
  const err = await G.leggiGiri(finto([], { message: "giù" }), LUNEDI, null);
  ok(err === null, "una lettura fallita è null, non una settimana vuota");

  console.log("\n§4 · i cron");
  for (const nome of ["workshop-motore", "newsletter", "registrazioni"]) {
    const src = senzaCommenti(fs.readFileSync(path.join(ROOT, `app/api/cron/${nome}/route.ts`), "utf8"));
    const auth = ancora(src, 'return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });', { dove: nome });
    const inizio = ancora(src, "const giro = await segnaGiroIniziato(PROCESSO,", { dove: nome });
    ok(inizio > auth, `${nome}: il giro si scrive dopo l'autorizzazione`);
    const dopoAuth = src.slice(auth);
    const primaAltro = dopoAuth.search(/createServiceRoleClient\(|ANTHROPIC_API_KEY|eOraDiInvio\(/);
    ok(primaAltro === -1 || inizio - auth < primaAltro, `${nome}: …prima di qualunque cosa che possa fermarlo`);
    const posizioni = (re) => [...src.matchAll(re)].map((m) => m.index);
    const ultimoReturn = Math.max(...posizioni(/return NextResponse\.json\(/g));
    const chiusure = posizioni(/await segnaGiroFinito\(giro, PROCESSO\);/g).filter((i) => i < ultimoReturn);
    ok(chiusure.length > 0 && Math.max(...chiusure) > inizio, `${nome}: il giro si chiude prima della risposta finale`);
  }
  const motoreSrc = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/api/cron/workshop-motore/route.ts"), "utf8"));
  ok(/const lunedi = alertRichiesto && eLunedìARoma\(/.test(motoreSrc), "il lunedì vale solo sul giro programmato");
  ok(/if \(alertRichiesto && \(lunedi \|\|/.test(motoreSrc), "il lunedì la mail parte comunque");
  ok(/leggiGiri\(supabase, new Date\(\), giro\?\.id \?\? null\)/.test(motoreSrc), "la lettura conosce il giro di chi scrive");
  ok(/\$\{testoGiri\(giri\)\}/.test(motoreSrc), "i giri entrano nella mail");

  console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:giri)`);
  process.exit(falliti === 0 ? 0 : 1);
})();
