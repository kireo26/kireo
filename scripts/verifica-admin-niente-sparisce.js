// «NIENTE SPARISCE» — la guardia del riordino dell'area admin (Mario, 31/10).
//
// La regola del riordino: niente di quello che oggi si può fare in /admin deve
// diventare impossibile. Questa prova nasce PRIMA di spostare qualunque cosa,
// verde sulla pagina di partenza, così il giorno in cui uno spostamento lascia
// un'azione senza casa diventa rossa. *Il momento in cui si perde una cosa è
// lo stesso in cui si smette di guardarla.*
//
// Cosa guarda:
//   §1 ogni componente di components/admin è montato (<Nome …) da un file
//      RAGGIUNGIBILE da una pagina dell'admin (le pagine sotto app/admin e la
//      pagina dell'evento, app/diretta/[id], dove vive la plancia dell'admin),
//      seguendo le importazioni. Un componente montato solo da un file che
//      nessuna pagina importa è un'azione senza porta.
//   §2 ogni route di app/api/admin è chiamata da un file raggiungibile.
//   §3 l'INVENTARIO: le azioni e le letture che l'inventario del 31/10 ha
//      contato, ognuna con la cosa che la fa (un componente o la tabella che
//      legge). Una lettura che sparisce da tutte le pagine è rossa.
//   §4 le cose che NON hanno una schermata, nominate: si fanno dal SQL Editor.
//      Il giorno in cui una schermata ne prende una, si toglie da qui.
//
// ⚠️ È lessicale (legge il sorgente e le importazioni), e sbaglia per difetto:
// un componente montato dentro un ramo che non si rende mai la guardia lo vede
// montato. Il pavimento sta sulle quantità lette, che non scendono quando il
// riordino va bene.
//
// Esecuzione: `npm run test:admin`.
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./lib/senza-commenti");

const ROOT = path.join(__dirname, "..");
let fatte = 0;
let falliti = 0;
function ok(cond, msg, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    falliti++;
    console.log(`  ✗ ${msg}${dettaglio ? ` [${dettaglio}]` : ""}`);
  }
}

function elenca(dir, out = []) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) elenca(rel, out);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(rel.split(path.sep).join("/"));
  }
  return out;
}

const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// ── le importazioni: da un file ai file che importa ──────────────────────────
function risolvi(da, spec) {
  let base;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(da), spec));
  else return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
}
function importazioni(rel) {
  const src = leggi(rel);
  const out = [];
  for (const m of src.matchAll(/\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)) {
    const r = risolvi(rel, m[1] ?? m[2]);
    if (r) out.push(r);
  }
  return out;
}

// Le porte dell'admin: le pagine e i layout sotto app/admin, e la pagina
// dell'evento (dove l'admin ha la sua plancia). Una pagina nuova del riordino
// sotto app/admin entra da sola.
const PORTE = [
  ...elenca("app/admin").filter((f) => /\/(page|layout)\.tsx$/.test(f)),
  "app/diretta/[id]/page.tsx",
];
ok(PORTE.length >= 2, `le porte dell'admin lette: ${PORTE.length}`);

const raggiungibili = new Set();
const coda = [...PORTE];
while (coda.length) {
  const f = coda.pop();
  if (raggiungibili.has(f)) continue;
  raggiungibili.add(f);
  for (const i of importazioni(f)) if (!raggiungibili.has(i)) coda.push(i);
}
ok(raggiungibili.size > 20, `file raggiungibili da una pagina dell'admin: ${raggiungibili.size}`);
const sorgenti = new Map([...raggiungibili].map((f) => [f, leggi(f)]));

const montatoDa = (nome) =>
  [...sorgenti].filter(([f, s]) => !f.endsWith(`/${nome}.tsx`) && new RegExp(`<${nome}\\b`).test(s)).map(([f]) => f);

console.log("\n§1 ogni componente dell'admin è montato da una pagina raggiungibile");
const componenti = elenca("components/admin").filter((f) => f.endsWith(".tsx"));
ok(componenti.length >= 12, `componenti in components/admin: ${componenti.length}`);
for (const c of componenti) {
  const nome = path.basename(c, ".tsx");
  const da = montatoDa(nome);
  ok(da.length > 0, `${nome} è montato`, da.length ? da.join(", ") : "da nessuna pagina dell'admin");
}

console.log("\n§2 ogni route dell'admin è chiamata da una pagina raggiungibile");
const route = fs.readdirSync(path.join(ROOT, "app/api/admin"), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
ok(route.length >= 4, `route in app/api/admin: ${route.length}`);
for (const r of route) {
  const da = [...sorgenti].filter(([f, s]) => !f.startsWith(`app/api/admin/${r}/`) && s.includes(`/api/admin/${r}`)).map(([f]) => f);
  ok(da.length > 0, `/api/admin/${r} è chiamata`, da.length ? da.join(", ") : "da nessuna pagina dell'admin");
}

console.log("\n§3 l'inventario del 31/10: ogni cosa ha ancora un posto");
// Un'azione si riconosce dal componente che la fa; una lettura dalla tabella
// che legge (il nome della sezione può cambiare, la tabella no).
const INVENTARIO = [
  { cosa: "riprovare l'email all'ente non partita", componente: "RiprovaAvvisoEnte" },
  { cosa: "attivare un'istituzione in attesa", componente: "AttivaIstituzioneButton" },
  { cosa: "approvare o rifiutare un evento", componente: "AzioneApprovazione" },
  { cosa: "approvare o rifiutare una newsletter", componente: "AzioneApprovazione" },
  { cosa: "togliere un post dal feed, con il motivo", componente: "TogliPost" },
  { cosa: "revocare un'area di un ente, con il motivo", componente: "RevocaArea" },
  { cosa: "chiudere una conversazione con un ente", componente: "AzioneChiudiConversazione" },
  { cosa: "approvare una richiesta di upgrade", componente: "AzioneApprovazioneUpgrade" },
  { cosa: "attivare una scuola e la sua convenzione", componente: "AttivaScuolaControlli" },
  { cosa: "segnare una richiesta di contatto come gestita", componente: "ToggleGestitaRichiesta" },
  { cosa: "cambiare il video della diretta", componente: "GestisciVideoDirettaForm" },
  { cosa: "scrivere la chiave di trasmissione", componente: "GestisciChiaveTrasmissioneForm" },
  { cosa: "correggere le ore PCTO di un evento", componente: "CorreggiOreForm" },
  { cosa: "le notifiche dell'admin", componente: "NotificheBell" },
  { cosa: "leggere i messaggi delle scuole agli studenti", tabella: "messaggi_scuola" },
  { cosa: "leggere le conversazioni con gli enti", tabella: "conversazioni_enti" },
  { cosa: "leggere le richieste di contatto", tabella: "richieste_contatto" },
  { cosa: "leggere i post degli enti", tabella: "post_enti" },
  { cosa: "leggere le aree degli enti", tabella: "istituzioni_aree" },
  { cosa: "leggere gli esiti delle email agli enti", tabella: "avvisi_email_enti" },
];
for (const v of INVENTARIO) {
  if (v.componente) {
    const da = montatoDa(v.componente);
    ok(da.length > 0, `${v.cosa} (${v.componente})`, da.length ? da.join(", ") : "nessuna pagina dell'admin lo monta");
  } else {
    const da = [...sorgenti].filter(([, s]) => new RegExp(`from\\(\\s*["']${v.tabella}["']`).test(s)).map(([f]) => f);
    ok(da.length > 0, `${v.cosa} (legge ${v.tabella})`, da.length ? da.join(", ") : "nessuna pagina dell'admin la legge");
  }
}

console.log("\n§4 le cose che non hanno una schermata: si fanno dal SQL Editor");
// Nominate perché un buco non nominato fra sei mesi sembra una scelta. Il
// giorno in cui una schermata ne prende una, si toglie da qui e si aggiunge
// all'inventario.
const SOLO_SQL_EDITOR = [
  "marcare un profilo di prova (profiles.di_prova)",
  "esentare un profilo dai cancelli (profiles.esente_cancelli)",
  "cambiare il tipo di un ente (istituzioni.tipo)",
  "cambiare il piano di un ente fuori da una richiesta di upgrade",
];
for (const s of SOLO_SQL_EDITOR) console.log(`  · ${s}`);
ok(SOLO_SQL_EDITOR.length === 4, `${SOLO_SQL_EDITOR.length} cose dichiarate «solo SQL Editor»`);

console.log("");
if (falliti > 0) {
  console.error(`✗ ${falliti} su ${fatte} proprietà (npm run test:admin)`);
  process.exit(1);
}
console.log(`✓ ${fatte}/${fatte} proprietà (npm run test:admin)`);
