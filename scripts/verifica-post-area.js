// I post degli enti nella pagina di un'area (Mario, 31/10): solo fra le aree
// APPROVATE, al massimo 2, con un tetto nella pagina, e un'area revocata che
// toglie il post da lì e non dalla bacheca dell'ente. Le proprietà del
// database stanno in scripts/verifica-post-aree.sql; qui la lettura, la
// pagina e il modulo. Gli attesi sono scritti a mano.
//
// Esecuzione: `npm run test:postarea`.
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");
const { senzaCommenti } = require("./lib/senza-commenti");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = require.extensions[".tsx"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const A = require("@/lib/app/postArea");
const { ancora } = require("./lib/ancora");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let fatte = 0;
let falliti = 0;
function ok(cond, msg, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else { falliti++; console.log(`  ✗ ${msg}${dettaglio ? ` [${dettaglio}]` : ""}`); }
}
const leggi = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

// Un client finto che registra i filtri e risponde per tabella.
function finto(risposte) {
  const chiamate = [];
  const from = (tabella) => {
    const q = { tabella, filtri: [] };
    chiamate.push(q);
    const catena = new Proxy({}, {
      get(_, nome) {
        if (nome === "then") {
          const r = risposte[tabella] ?? { data: null, error: { message: "tabella inattesa" } };
          return (ok) => Promise.resolve(typeof r === "function" ? r(q) : r).then(ok);
        }
        return (...args) => { q.filtri.push([nome, ...args]); return catena; };
      },
    });
    return catena;
  };
  return { from, chiamate };
}

(async () => {
  console.log("§1 la lettura della pagina dell'area");
  {
    const c = finto({ istituzioni_aree: { data: null, error: { message: "giù" } } });
    const e = await A.getPostDellArea(c, "informatica-digitale");
    ok(e.stato === "non_letto", "se non si leggono gli enti con l'area approvata, è «non letto», non «nessun post»");
  }
  {
    const c = finto({ istituzioni_aree: { data: [], error: null } });
    const e = await A.getPostDellArea(c, "informatica-digitale");
    ok(e.stato === "post" && e.post.length === 0, "nessun ente con l'area approvata: nessun post");
    ok(c.chiamate.length === 1, "e i post non si leggono nemmeno");
  }
  {
    const c = finto({
      istituzioni_aree: { data: [{ istituzione_id: "e1" }], error: null },
      post_enti: { data: [{ id: "p1", istituzione_id: "e1", tipo: "testo", corpo: "Ciao", visibile_dal: "2026-10-31T08:00:00Z", istituzioni: { nome: "Davante", slug: "davante" } }], error: null },
    });
    const e = await A.getPostDellArea(c, "informatica-digitale");
    ok(e.stato === "post" && e.post.length === 1 && e.post[0].istituzione_slug === "davante", "i post di un ente con l'area approvata arrivano con il loro ente");
    const [aree, post] = c.chiamate;
    const ha = (q, ...f) => q.filtri.some((x) => JSON.stringify(x) === JSON.stringify(f));
    ok(ha(aree, "eq", "area_slug", "informatica-digitale") && ha(aree, "eq", "stato", "approvata") && ha(aree, "eq", "istituzioni.stato", "attiva"),
      "gli enti sono quelli con l'area APPROVATA adesso, e attivi (la revoca si legge qui)");
    ok(ha(post, "eq", "visibile", true) && ha(post, "contains", "aree", ["informatica-digitale"]) && ha(post, "in", "istituzione_id", ["e1"]),
      "i post sono visibili, portano quell'area, e sono di quegli enti");
    ok(ha(post, "order", "visibile_dal", { ascending: false }) && ha(post, "limit", 3), "i più recenti, e solo 3 (il tetto della sezione)");
  }
  {
    const c = finto({ istituzioni_aree: { data: [{ istituzione_id: "e1" }], error: null }, post_enti: { data: null, error: { message: "giù" } } });
    ok((await A.getPostDellArea(c, "x")).stato === "non_letto", "un errore sui post è «non letto»");
  }
  ok(A.POST_AREA_MASSIMO === 3 && A.MAX_AREE_POST === 2, "il tetto della sezione è 3, le aree per post al massimo 2");

  console.log("§2 le aree che l'ente può dare a un post");
  {
    const c = finto({ istituzioni_aree: { data: [{ area_slug: "informatica-digitale" }, { area_slug: "ai_didattica" }], error: null } });
    const aree = await A.leggiAreeApprovateEnte(c, "e1");
    ok(JSON.stringify(aree) === JSON.stringify(["informatica-digitale"]), "solo le aree di orientamento: un filone per docenti non ha una pagina d'area");
    ok(c.chiamate[0].filtri.some((f) => f[0] === "eq" && f[1] === "stato" && f[2] === "approvata"), "solo le approvate");
    const n = await A.leggiAreeApprovateEnte(finto({ istituzioni_aree: { data: null, error: { message: "giù" } } }), "e1");
    ok(n === null, "a lettura fallita null, non un elenco vuoto");
  }

  console.log("§3 il modulo del post");
  const form = senzaCommenti(leggi("components/ente/CreaPostForm.tsx"));
  ok(/areeApprovate === null \?[\s\S]*?TESTI_AREE_POST\.nonLette[\s\S]*?areeApprovate\.length === 0 \?[\s\S]*?TESTI_AREE_POST\.nessuna/.test(form),
    "non lette e nessuna approvata hanno due righe diverse, e nessuna delle due mostra un elenco");
  ok(/areeApprovate\.map\(/.test(form) && !/AREE\.map\(/.test(form), "la scelta mostra solo le aree approvate, non tutte le aree");
  ok(/\{TESTI_AREE_POST\.riga\}/.test(form), "accanto alla scelta la riga che avverte l'ente");
  ok(A.TESTI_AREE_POST.riga === "Il post comparirà nella pagina di quest'area, anche agli studenti che non ti seguono.", "la riga è quella di Mario, parola per parola");
  ok(/aree,\n\s*\}\)\.select\("id"\)/.test(form), "le aree scelte vanno nell'insert");
  ok(/area_post_non_approvata/.test(form) && /troppe_aree_post/.test(form), "il modulo conosce i due rifiuti del database");
  ok(/aree\.length >= MAX_AREE_POST/.test(form), "una terza area non si sceglie");
  const pgEnte = leggi("app/ente/(dashboard)/bacheca/page.tsx");
  ok(/leggiAreeApprovateEnte\(supabase, contesto\.istituzioneId\)/.test(pgEnte) && /areeApprovate=\{areeApprovate\}/.test(pgEnte), "la pagina dell'ente legge le approvate e le passa al modulo");

  console.log("§4 la pagina dell'area: prima roba nostra, poi roba loro");
  const pa = senzaCommenti(leggi("app/aree/[slug]/page.tsx"));
  const pos = (s) => ancora(pa, s, { dove: "pagina dell'area" });
  const ordine = [
    ["presentazione", "{area.descrizioneEstesa}"],
    ["strade", "{area.direzioni.map("],
    ["articoli", "<ArticoloCard "],
    ["guida", '<section id="guida"'],
    ["eventi", '<section id="eventi"'],
    ["enti", '<section id="enti"'],
    ["post", '<section id="post-enti"'],
    ["assistente", '<section id="assistente-digitale"'],
    ["chiamata finale", '<section className="bg-kireo-green">'],
  ];
  const posizioni = ordine.map(([, s]) => pos(s));
  ok(posizioni.every((p, i) => i === 0 || p > posizioni[i - 1]), "l'ordine è presentazione · strade · articoli · guida · eventi · enti · post · assistente · chiamata finale",
    ordine.map(([n], i) => `${n}@${posizioni[i]}`).join(" "));
  ok(/getPostDellArea\(supabase, area\.slug\)/.test(pa) && /postArea\.stato === "non_letto"/.test(pa), "la pagina legge i post dell'area e dice quando non li ha letti");
  ok(/postArea\.post\.length > 0/.test(pa), "senza post la sezione non c'è");

  console.log("§5 la lingua");
  for (const t of [...Object.values(A.TESTI_AREE_POST), ...Object.values(A.TESTI_SEZIONE_POST_AREA)]) {
    ok(trovaAccordi(t).length === 0, "nessun accordo di genere", t);
  }

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
  process.exit(falliti === 0 ? 0 : 1);
})();
