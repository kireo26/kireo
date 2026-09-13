// Gli articoli News, contro il motore vero.
//
// PERCHÉ ESISTE. L'8 settembre otto articoli sono entrati in repo e il
// frontmatter è stato controllato a occhio, una volta. Quattro delle cose
// guardate (draft, categoria, slug, aree) sono meccaniche e vanno rifatte da
// sole a ogni modifica: un'area rinominata in `data/aree.ts`, una categoria
// scritta male, uno slug che non combacia col nome del file sono difetti che
// una rilettura non ripete e un controllo sì.
//
// MA IL CONTROLLO CHE VALE PIÙ DI TUTTI È L'ULTIMO: che l'MDX COMPILI.
// `/news/[slug]` ha `dynamicParams = false` e `generateStaticParams` esclude le
// bozze, quindi **la build di produzione non tocca mai il corpo di una bozza**.
// Un MDX rotto dentro un `draft: true` passa ogni build, e esplode il giorno in
// cui qualcuno mette `draft: false` — cioè il giorno in cui nessuno se lo
// aspetta, su un articolo appena riletto e dato per buono.
//
// Si legge tutto dal motore, mai da una copia: le 18 aree da `data/aree.ts`, le
// categorie da `lib/news.ts`, i plugin MDX gli stessi di `app/news/[slug]`.
//
// Esecuzione: `npm run test:news`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const matter = require("gray-matter");
const { AREE } = require("@/data/aree");
const { CATEGORIE_NEWS } = require("@/lib/news");

const DIR = path.join(ROOT, "content/news");
const SLUG_AREE = new Set(AREE.map((a) => a.slug));
const CATEGORIE = Object.keys(CATEGORIE_NEWS);
const MAX_DESCRIZIONE = 160;

// Le chiavi che il lettore conosce davvero (`lib/news.ts`), più quelle che
// il frontmatter può portare senza che nessuno le legga. La differenza non è
// un errore ma va DETTA: una chiave che nessuno legge è una dichiarazione che
// non arriva a nessuno, e chi l'ha scritta crede di averla pubblicata.
const CHIAVI_LETTE = new Set([
  "title", "slug", "description", "category", "tags",
  "publishedAt", "updatedAt", "author", "draft", "ogImage", "aree",
]);

let falliti = 0;
const note = [];
const chiaviIgnote = new Map();
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };
const nota = (msg) => note.push(msg);

console.log("\n═══ Gli articoli News, contro il motore vero ═══\n");

if (!fs.existsSync(DIR)) {
  console.log("Nessuna cartella content/news: niente da controllare.\n");
  process.exit(0);
}

const file = fs.readdirSync(DIR).filter((f) => f.endsWith(".mdx")).sort();
ok(file.length > 0, `${file.length} articoli trovati`);

const corpi = [];
let pubblicati = 0;

for (const f of file) {
  const base = f.replace(/\.mdx$/, "");
  const { data, content } = matter(fs.readFileSync(path.join(DIR, f), "utf8"));
  corpi.push({ base, content });

  const problemi = [];

  for (const campo of ["title", "description", "publishedAt", "updatedAt", "author"]) {
    if (typeof data[campo] !== "string" || data[campo].trim() === "") problemi.push(`«${campo}» manca o non è testo`);
  }
  if (typeof data.draft !== "boolean") problemi.push(`«draft» dev'essere true o false (qui: ${JSON.stringify(data.draft)})`);
  else if (data.draft === false) pubblicati++;

  if (!CATEGORIE.includes(data.category)) problemi.push(`categoria «${data.category}» — le uniche sono ${CATEGORIE.join("/")}`);
  if (data.slug !== base) problemi.push(`slug «${data.slug}» diverso dal nome del file`);

  const aree = data.aree ?? [];
  if (!Array.isArray(aree)) problemi.push("«aree» dev'essere un elenco");
  else {
    const ignote = aree.filter((a) => !SLUG_AREE.has(a));
    if (ignote.length) problemi.push(`aree inesistenti in data/aree.ts: ${ignote.join(", ")}`);
  }

  // CLAUDE.md: readingTime NON è un campo frontmatter, si calcola dal corpo.
  // Scritto a mano diverge dal testo alla prima revisione.
  if (data.readingTime !== undefined) problemi.push("«readingTime» scritto a mano: si calcola dal corpo, non si dichiara");

  // Raggruppate per CHIAVE, non per articolo: quattro chiavi su otto articoli
  // facevano trentadue righe uguali, e una lista che si scorre è una lista che
  // non si legge.
  for (const k of Object.keys(data)) {
    if (!CHIAVI_LETTE.has(k)) {
      if (!chiaviIgnote.has(k)) chiaviIgnote.set(k, []);
      chiaviIgnote.get(k).push(base);
    }
  }
  const desc = String(data.description ?? "");
  if (desc.length > MAX_DESCRIZIONE) nota(`${base}: description ${desc.length} caratteri (la regola dice ≤${MAX_DESCRIZIONE})`);

  ok(problemi.length === 0, problemi.length === 0 ? `${base}: frontmatter coerente` : `${base}: ${problemi.join(" · ")}`);
}

// ── il controllo che la build non fa ──────────────────────────────────────
(async () => {
  console.log("");
  // `@mdx-js/mdx` arriva da `next-mdx-remote`, non è una dipendenza diretta:
  // il giorno che quella cambia, questo import sparisce. Se succede si DICE,
  // invece di passare in silenzio — «non ho potuto guardare» non è «va bene».
  let compile, remarkGfm, rehypeSlug;
  try {
    ({ compile } = await import("@mdx-js/mdx"));
    remarkGfm = (await import("remark-gfm")).default;
    rehypeSlug = (await import("rehype-slug")).default;
  } catch (e) {
    ok(false, `il compilatore MDX non è raggiungibile (${String(e.message).split("\n")[0]}): i corpi NON sono stati controllati`);
  }

  if (compile) {
    for (const { base, content } of corpi) {
      try {
        await compile(content, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] });
        ok(true, `${base}: l'MDX compila`);
      } catch (e) {
        ok(false, `${base}: MDX rotto — ${String(e.message).split("\n")[0]}`);
      }
    }
  }
  console.log("");
  console.log(`  (${file.length - pubblicati} in bozza, ${pubblicati} pubblicati)`);

  for (const [k, dove] of chiaviIgnote) {
    note.push(`«${k}»: nel frontmatter di ${dove.length} articol${dove.length === 1 ? "o" : "i"}, non la legge nessuno`);
  }

  if (note.length > 0) {
    console.log("\n─── da guardare, non errori ───");
    for (const n of note) console.log(`  · ${n}`);
    console.log("");
    console.log("  Queste NON fanno fallire il controllo perché la cura è la penna di");
    console.log("  una persona, non una riga di codice: accorciare una description è");
    console.log("  riscrivere un testo, e decidere se una chiave del frontmatter debba");
    console.log("  comparire sulla pagina è una scelta di prodotto. Un controllo rosso");
    console.log("  su una cosa che chi lo legge non può chiudere è un controllo che");
    console.log("  qualcuno disattiva.");
  }

  console.log("\n═══════════════════════════════════════════\n");
  if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
  console.log("✓ Frontmatter coerente col motore, e ogni corpo compila — bozze comprese.\n");
})();
