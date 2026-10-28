#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:interessati` — gli «Interessati» di un ente (28/10/2026,
// 20261111100000). Le proprietà sul database stanno in
// scripts/verifica-interessati.sql; qui:
//   §1 l'anno di corso si ricava dall'anno di diploma, con l'anno scolastico;
//   §2 il quadro e i filtri (attesi scritti a mano);
//   §3 le due funzioni dell'ente non leggono MAI il lavoro di orientamento
//      dello studente né quello che KIREO ne ha dedotto, e filtrano sull'ente;
//   §4 la riga sotto «Profilo condiviso ✓» resta, e dice quello che l'ente vede.
// ⚠️ Il §3 è lessicale: vede i nomi delle tabelle, non una lettura nascosta in
// un'altra funzione chiamata da queste. Per questo non chiamano nessuna
// funzione che legga dati dello studente (lo controlla anche lui).
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();
const I = require("@/lib/ente/interessati");
const G = require("@/lib/app/gestiEnte");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}
const leggi = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

console.log("§1 l'anno di corso");
const ottobre26 = new Date("2026-10-28T10:00:00Z");
const maggio27 = new Date("2027-05-10T10:00:00Z");
ok(I.annoDiCorso(2027, ottobre26) === 5, "a ottobre 2026 chi si diploma nel 2027 è al 5° anno");
ok(I.annoDiCorso(2029, ottobre26) === 3, "e chi si diploma nel 2029 al 3°");
ok(I.annoDiCorso(2027, maggio27) === 5, "a maggio 2027 è ancora al 5°: l'anno scolastico finisce a giugno");
ok(I.annoDiCorso(2026, ottobre26) === "diplomato", "chi si è diplomato nel 2026 non ha un anno di corso");
ok(I.annoDiCorso(null, ottobre26) === null && I.etichettaAnno(null) === "Anno non indicato", "senza anno di diploma, «non indicato», non un numero inventato");
ok(I.annoDiCorso(2027, new Date("2026-08-31T21:30:00Z")) === 4 && I.annoDiCorso(2027, new Date("2026-08-31T22:30:00Z")) === 5,
  "il cambio d'anno scolastico è il primo settembre in ora italiana");

console.log("§2 il quadro e i filtri");
const base = { cognome: "X", scuola_denominazione: "LICEO A", scuola_provincia: "Napoli", conversazione_id: null };
const righe = [
  { ...base, student_id: "1", nome: "Uno", anno_diploma: 2027, aree_interesse: ["informatica-digitale"], creata_il: "2026-10-05T10:00:00Z", copre_attivita: true, eventi_seguiti: 2, guida_scaricata: false },
  { ...base, student_id: "2", nome: "Due", anno_diploma: 2027, aree_interesse: ["informatica-digitale", "economia-management"], creata_il: "2026-09-20T10:00:00Z", copre_attivita: true, eventi_seguiti: 0, guida_scaricata: false },
  { ...base, student_id: "3", nome: "Tre", anno_diploma: 2028, aree_interesse: [], creata_il: "2026-10-01T10:00:00Z", copre_attivita: true, eventi_seguiti: 0, guida_scaricata: true, scuola_provincia: "Roma", scuola_denominazione: "LICEO B" },
  { ...base, student_id: "4", nome: "Quattro", anno_diploma: 2027, aree_interesse: ["informatica-digitale"], creata_il: "2026-08-01T10:00:00Z", copre_attivita: false, eventi_seguiti: null, guida_scaricata: null },
];
const nome = (s) => s;
const q = I.quadroInteressati(righe, ottobre26, nome);
ok(q.totale === 4 && q.nuoviQuestoMese === 2, "4 in tutto, 2 nuovi a ottobre", `${q.totale} / ${q.nuoviQuestoMese}`);
ok(q.hannoFatto === 2 && q.soloLaMano === 1 && q.senzaAttivita === 1, "2 hanno fatto qualcosa, 1 solo la mano, 1 non lo sappiamo", `${q.hannoFatto}/${q.soloLaMano}/${q.senzaAttivita}`);
ok(q.hannoFatto + q.soloLaMano + q.senzaAttivita === q.totale, "le tre parti sommano il totale: nessuno sparisce dal conto");
ok(I.haFattoQualcosa(righe[3]) === null, "un consenso che non copre l'attività non è «no»: è «non lo so»");
ok(q.perArea[0].valore === "informatica-digitale" && q.perArea[0].conteggio === 3, "per area: informatica in testa con 3");
ok(JSON.stringify(q.perAnno.map((v) => [v.valore, v.conteggio])) === JSON.stringify([["5", 3], ["4", 1]]), "per anno: 3 al quinto, 1 al quarto");
ok(q.perProvincia.find((v) => v.valore === "Roma")?.conteggio === 1 && q.perScuola.length === 2, "per provincia e per scuola");
const f1 = I.filtraInteressati(righe, { area: "informatica-digitale", anno: "5", provincia: "Napoli" }, ottobre26);
ok(f1.map((r) => r.nome).join(",") === "Uno,Due,Quattro", "«5° anno · Informatica · Napoli» restringe a tre");
ok(I.filtraInteressati(righe, { fatto: "no" }, ottobre26).map((r) => r.nome).join(",") === "Due", "«solo la mano» non prende chi non sappiamo");
ok(I.filtraInteressati(righe, { fatto: "si" }, ottobre26).map((r) => r.nome).join(",") === "Uno,Tre", "«hanno fatto» sono i due giusti");
ok(I.hrefFiltro("/ente/interessati", { area: "a", anno: "5" }, "provincia", "Napoli") === "/ente/interessati?area=a&anno=5&provincia=Napoli",
  "un filtro nuovo tiene gli altri");
ok(I.hrefFiltro("/ente/interessati", { area: "a" }, "area", undefined) === "/ente/interessati", "e togliere l'ultimo riporta alla pagina pulita");
ok(I.leggiFiltri({ fatto: "forse", area: ["x", "y"] }).fatto === undefined && I.leggiFiltri({ area: ["x", "y"] }).area === "x", "un parametro sbagliato si ignora");

console.log("§3 le funzioni dell'ente non leggono il lavoro di orientamento");
const cartella = path.join(ROOT, "supabase/migrations");
const ultime = {};
for (const f of fs.readdirSync(cartella).filter((f) => f.endsWith(".sql")).sort()) {
  const sql = fs.readFileSync(path.join(cartella, f), "utf8").replace(/--[^\n]*/g, "");
  const re = /create or replace function public\.(interessati_ente|scheda_interessato_ente|ente_vede_interessati)\b[\s\S]*?\$\$([\s\S]*?)\$\$/g;
  let m;
  while ((m = re.exec(sql))) ultime[m[1]] = m[2];
}
ok(Object.keys(ultime).length === 3, "trovate le tre funzioni", Object.keys(ultime).join(", "));
const VIETATE = /\b(evidence|area_signal|style_signal|mission_attempt|test_attempt|step_response|journal_entry|portfolio_item|workshop_\w+|consegne_evento|domande_live|assistente_\w+|activity_log)\b/;
for (const [n, corpo] of Object.entries(ultime)) {
  ok(!VIETATE.test(corpo), `${n} non nomina test, missioni, workshop, prove, profilo dedotto`, (corpo.match(VIETATE) ?? [])[0]);
}
for (const n of ["interessati_ente", "scheda_interessato_ente"]) {
  const corpo = ultime[n] ?? "";
  // Per ogni lettura, l'alias che prende e il filtro su QUELL'alias entro la
  // clausola: un filtro su un'altra tabella (la condivisione) non vale.
  const letture = [...corpo.matchAll(/from public\.(eventi|recinto_enti|conversazioni_enti)\s+(\w+)/g)];
  const senzaFiltro = letture.filter((m) => {
    const dopo = corpo.slice(m.index, m.index + 400);
    return !new RegExp(`\\b${m[2]}\\.(organizzatore_id|istituzione_id)\\s*=\\s*p_istituzione_id`).test(dopo);
  });
  ok(letture.length >= 3 && senzaFiltro.length === 0, `${n}: ogni lettura di eventi, guida e conversazioni è filtrata sull'ente che chiede`,
    `${letture.length} letture, senza filtro: ${senzaFiltro.map((m) => m[0]).join(" | ")}`);
  ok(/ente_vede_interessati\(p_istituzione_id\)/.test(corpo), `${n} chiede prima chi può guardare`);
  ok(/copre_attivita/.test(corpo), `${n} guarda cosa copre il consenso`);
}

console.log("§4 la riga sotto «Profilo condiviso ✓»");
const btn = senzaCommenti(leggi("components/app/ManifestazioneInteresseButton.tsx"));
// Il ramo «già condiviso» va da `if (id) {` al primo `return (` dopo di lui.
const iRamo = ancora(btn, "if (id) {");
const ramoAttivo = btn.slice(iRamo, iRamo + btn.slice(iRamo + 1).search(/\n  return \(/) + 1);
ok(/DIDASCALIA_CONDIVISO_CON_ATTIVITA/.test(ramoAttivo) && /DIDASCALIA_CONDIVISO_SENZA_ATTIVITA/.test(ramoAttivo), "a profilo condiviso la riga resta, nelle sue due forme");
ok(/copreAttivita: boolean;/.test(btn), "cosa copre la condivisione è una prop obbligatoria");
ok(/copreAttivita=\{condivisioneCopreAttivita\}/.test(leggi("app/istituzioni/[slug]/page.tsx")), "la pagina dell'ente la passa, letta dalla riga");
ok(/attivit/.test(G.DIDASCALIA_CONDIVISO_SENZA_ATTIVITA) === false && /verso di lui/.test(G.DIDASCALIA_CONDIVISO_CON_ATTIVITA), "la forma stretta non promette l'attività, quella larga sì");
ok(/test, missioni/.test(G.DIDASCALIA_CONDIVISO_CON_ATTIVITA) && /test, le missioni/.test(btn), "la riga e il pannello dicono che test e missioni non si vedono");
ok(/verso di lui/.test(G.DIDASCALIA_CONDIVIDI) && /verso di lui su KIREO/.test(btn), "la didascalia e il pannello nominano l'attività verso l'ente, che il consenso nuovo copre");

// §5 (Mario, 28/10): il soggetto della promessa, l'ente che non scrive per
// primo, la nota sulle aree. Il pannello si legge con gli spazi normalizzati:
// un a-capo del formattatore non è contenuto.
console.log("\n§5 le promesse del pannello e la regola del primo messaggio");
const pannello = btn.replace(/\s+/g, " ");
ok(/KIREO non gli dà mai la tua email o il tuo telefono/.test(pannello) && !/Non condivide mai/.test(pannello),
  "è KIREO a non dare email e telefono: una promessa fatta a nome di un altro non è una promessa");
ok(/revocare la condivisione/.test(pannello), "si revoca la condivisione, non una cosa qualunque");
// «sei rimasto» (Mario) accorda col genere di chi legge: la forma con *avere*
// dice la stessa cosa e non concorda.
ok(/quanto tempo ci hai passato/.test(pannello) && !/e per quanto,/.test(pannello) && !/sei rimast/.test(pannello),
  "«e quanto tempo ci hai passato», non «e per quanto» né «sei rimasto»");
ok(/la conversazione la apri tu/.test(pannello), "il pannello dice che la conversazione la apre lo studente");
ok(!/pag(a|ano|amento)|soldi|piano/i.test(pannello), "di soldi non si parla nel pannello");
for (const t of [G.DIDASCALIA_CONDIVIDI, G.DIDASCALIA_CONDIVISO_CON_ATTIVITA, G.DIDASCALIA_CONDIVISO_SENZA_ATTIVITA]) {
  ok(!/può scriverti/.test(t), "nessuna didascalia dice che l'ente può scrivere per primo", t);
}
const migrRegola = leggi("supabase/migrations/20261112100000_ente_non_scrive_per_primo.sql");
ok(/comment on function public\.apri_conversazione_ente\(uuid, text\)/.test(migrRegola) && /REGOLA, non limite tecnico/.test(migrRegola),
  "la regola sta accanto a apri_conversazione_ente, scritta come regola");
const paginaInt = leggi("app/ente/(dashboard)/interessati/page.tsx");
ok(/titolo="Per area dichiarata" nota=\{TESTI_INTERESSATI\.notaAree\}/.test(paginaInt) && /più aree/.test(I.TESTI_INTERESSATI.notaAree),
  "sotto «Per area dichiarata» la nota: ogni studente può aver scelto più aree");
ok((paginaInt.match(/nota=\{/g) || []).length === 1, "e solo lì: le altre ripartizioni sommano al totale");
for (const t of [G.DIDASCALIA_CONDIVIDI, G.DIDASCALIA_CONDIVISO_CON_ATTIVITA, G.DIDASCALIA_CONDIVISO_SENZA_ATTIVITA, ...Object.values(I.TESTI_INTERESSATI)]) {
  ok(trovaAccordi(t).length === 0, "nessun accordo di genere", t);
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
