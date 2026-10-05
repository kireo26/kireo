// Le email che mandiamo: niente markup dall'utente, nessun link che non sia
// http/https, e il contenuto che non arriva dal corpo di una richiesta.
//
// PERCHÉ ESISTE. Il 5/10/2026 `/api/guida-email` è risultata **senza nessuna
// guardia**: nessuna sessione (nessun client Supabase importato nel file),
// `/api` non è in AREE_PROTETTE, nessun limite — e dal corpo arrivavano il
// destinatario, il link del bottone, il nome nel saluto e il titolo in
// grassetto, con il template che interpolava in HTML senza escape. Misurato su
// build di produzione, senza sessione e senza cookie: la richiesta arrivava
// fino a `inviaEmail` con l'indirizzo scelto da chi chiamava. In produzione la
// chiave Brevo c'è, quindi quell'email partiva — autentica, con SPF e DKIM
// validi, da `noreply@kireo.it`.
//
// Non è una falla di lettura: è un'azione nel mondo a nome nostro, verso
// persone che non hanno mai usato KIREO, e IRREVERSIBILE — un'email mandata non
// si cancella, e un dominio bruciato porta nello spam le email vere alle
// scuole.
//
// LE TRE PROPRIETÀ CHE QUESTO FILE TIENE, e sono di forma, non di gusto:
//
//   1. ogni `${…}` dentro un template passa da `esc()` o è un valore di cui si
//      conosce la provenienza (una costante nostra, non il corpo di una
//      richiesta);
//   2. l'href di un bottone passa da `linkSicuro()`;
//   3. le route che mandano email non prendono il LINK né il TITOLO dal corpo.
//
// La terza è quella che conta più delle altre due: l'escape rende innocuo il
// markup, ma un link scelto da chi chiama resta un link scelto da chi chiama.
//
// Esecuzione: `npm run test:email`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");

const ROOT = path.join(__dirname, "..");
let falliti = 0;
const ok = (cond, msg, extra) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) {
    falliti++;
    if (extra) console.log(`      → ${extra}`);
  }
};
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

console.log("\n═══ Le email: niente markup dall'utente, nessun link scelto da chi chiama ═══\n");

// ── 1) ogni interpolazione nei template è coperta ───────────────────────────
console.log("1) Ogni `${…}` nei template passa da esc(), o ha una provenienza nota");

const tmpl = leggi("lib/email/templates.ts");

// I valori di cui si conosce la provenienza: costanti nostre e composizioni
// interne. Un nome nuovo qui è una DECISIONE — e va scritta, perché ogni voce
// aggiunta è una stringa che potrà scrivere markup.
const PROVENIENZA_NOTA = [
  "SITE_URL", // lib/site.ts, costante nostra
  "ETICHETTA_ORIGINE[origine]", // mappa chiusa qui dentro
  "contenuto", // HTML già composto, passato a involucroEmail
  "bottone(", // compone a sua volta, e passa da esc()+linkSicuro()
  "involucroEmail(",
];

// ⚠️ SOLO LE INTERPOLAZIONI CHE COMPONGONO MARKUP. La prima stesura leggeva
// ogni `${…}` del file e gridava su `throw new Error(\`…${pulito.slice(0,40)}\`)`
// dentro `linkSicuro` — un messaggio d'errore, non un'email. Un controllo che
// grida su una cosa giusta è un controllo che qualcuno disattiva: il
// discriminante è che il template letterale contenga un tag (`<`), che è
// esattamente la proprietà di cui ci importa.
const letterali = [...tmpl.matchAll(/`(?:[^`\\]|\\.)*`/gs)].map((m) => m[0]).filter((l) => l.includes("<"));
const interpolazioni = letterali.flatMap((l) => [...l.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim()));
ok(interpolazioni.length > 10, `ci sono interpolazioni da guardare (${interpolazioni.length})`, "zero interpolazioni vuol dire che l'estrattore non sta leggendo: un verde su un insieme vuoto");

const scoperte = interpolazioni.filter((e) => {
  if (e.includes("esc(")) return false;
  return !PROVENIENZA_NOTA.some((p) => e.includes(p));
});
ok(
  scoperte.length === 0,
  scoperte.length === 0
    ? "nessuna interpolazione scoperta: tutte passano da esc() o hanno provenienza nota"
    : `interpolazioni scoperte: ${scoperte.map((s) => `\${${s}}`).join(", ")}`,
  "una stringa che arriva dal corpo di una richiesta e finisce in un'email senza esc() scrive il markup di un'email a nome nostro",
);

// ── 2) l'escape copre il contesto attributo, non solo il testo ──────────────
console.log("\n2) esc() copre anche il contesto attributo, e linkSicuro rifiuta gli schemi");

require("./banco/ts").abilitaTypeScript();
const { esc, linkSicuro } = require("@/lib/email/templates");

ok(esc("<b>x</b>") === "&lt;b&gt;x&lt;/b&gt;", "i tag si neutralizzano");
ok(esc('a"b') === "a&quot;b", "…e le VIRGOLETTE, che sono quelle che fanno uscire da un href=\"…\"");
ok(esc("a'b") === "a&#39;b", "…e l'apice singolo");
ok(esc("a&b") === "a&amp;b", "la e commerciale si converte per prima (altrimenti le altre si doppiano)");
ok(esc(null) === "" && esc(undefined) === "", "un valore assente non diventa la stringa «null»");

// ⚠️ CHE `bottone` LA CHIAMI, non solo che la funzione funzioni. La prima
// stesura provava solo `linkSicuro` in isolamento, e togliendola da `bottone`
// la suite restava VERDE: il controllo esercitava ciò che la funzione DECIDE e
// non ciò che il template GUARDA. L'ha detto la controprova, non una rilettura.
ok(/<a href="\$\{esc\(linkSicuro\(href\)\)\}"/.test(tmpl), "il bottone passa l'href da linkSicuro() dentro esc()");

ok(linkSicuro("https://kireo.it/x") === "https://kireo.it/x", "un https passa");
ok(linkSicuro("  http://kireo.it/x  ") === "http://kireo.it/x", "…e viene ripulito dagli spazi");
for (const cattivo of ["javascript:alert(1)", "data:text/html,x", "//kireo.it/x", "mailto:a@b.it", ""]) {
  let alzato = false;
  try {
    linkSicuro(cattivo);
  } catch {
    alzato = true;
  }
  ok(alzato, `«${cattivo || "(vuoto)"}» viene rifiutato`);
}

// ── 3) LA PROPRIETÀ CHE CONTA: il contenuto non viene dal corpo ─────────────
console.log("\n3) Le route che mandano email non prendono link né titolo dal corpo");

const route = leggi("app/api/guida-email/route.ts");

ok(/createClient\(\)/.test(route), "la route legge dal database (client normale: la RLS filtra alle istituzioni attive)");
ok(/from\("guide_enti"\)/.test(route), "…e prende la guida da `guide_enti`");
ok(
  !/linkGuida\s*=\s*corpo\./.test(route),
  "il LINK non viene dal corpo della richiesta",
  "è la cura che fa scendere la gravità da phishing a spam: con il link dal corpo, un'email autentica a nome nostro manda la gente dove dice chi ha chiamato",
);
ok(!/titoloGuida\s*=\s*`?[^;]*corpo\.(istituzioneNome|titolo)/.test(route), "…e nemmeno il TITOLO");
ok(
  /guida\.istituzione_id !== corpo\.istituzioneId/.test(route),
  "la guida viene verificata contro l'istituzione indicata",
  "senza, il `guidaId` tornerebbe a essere un contenuto invece di una chiave",
);

// Il form non manda più il contenuto: se tornasse a mandarlo, la route lo
// ignorerebbe — ma la riga nel corpo è l'invito a riusarlo.
const form = leggi("components/app/GuidaEnteForm.tsx");
const dove = ancora(form, "/api/guida-email", { volte: 1, dove: "GuidaEnteForm" });
const corpoFetch = form.slice(dove, dove + 400);
ok(!/pdfUrl\s*[,}]/.test(corpoFetch.replace(/pdfUrl:\s*[^,}]*/g, "")), "il form non manda il `pdfUrl` nel corpo");
ok(/guidaId/.test(corpoFetch), "…manda il `guidaId`, cioè una chiave");

// ── 4) nessun'altra route compone un'email con un link dal corpo ────────────
console.log("\n4) Nessun'altra route manda email con un link dal corpo");

function tuttiIFile(dir) {
  const out = [];
  for (const v of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) out.push(...tuttiIFile(p));
    else if (/\.(ts|tsx)$/.test(v.name)) out.push(p);
  }
  return out;
}
const chiamanti = tuttiIFile(path.join(ROOT, "app"))
  .concat(tuttiIFile(path.join(ROOT, "lib")))
  .filter((p) => !p.endsWith(path.join("lib", "email", "brevo.ts")))
  .filter((p) => /inviaEmail\s*\(/.test(senzaCommenti(fs.readFileSync(p, "utf8"))));

ok(chiamanti.length >= 2, `i chiamanti di inviaEmail sono ${chiamanti.length}`, "sotto due, l'estrattore non sta leggendo");
for (const p of chiamanti) {
  const rel = path.relative(ROOT, p);
  const src = senzaCommenti(fs.readFileSync(p, "utf8"));
  // Un `bottone(...)`/link composto direttamente da `corpo.*`/`body.*`: la
  // forma che ha prodotto la settima falla.
  const sospette = [...src.matchAll(/\b(?:link|href|url)\w*\s*[=:]\s*(corpo|body|payload)\./gi)].map((m) => m[0]);
  ok(sospette.length === 0, `${rel}: nessun link composto dal corpo della richiesta`, sospette.join(", "));
}

console.log(falliti === 0 ? "\n✅ Le email non portano markup né link scelti da chi chiama.\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
