// L'avviso «Come è fatto questo post» deve dire esattamente quello che c'è nel
// frontmatter, e niente di più.
//
// PERCHÉ ESISTE. Dal 2026-09-26 quel riquadro non è più un blockquote ricopiato
// a mano in otto articoli: lo genera `lib/avvisoAI.ts` dalle quattro chiavi
// `ai*`. È la riga della pagina in cui qualcuno si prende una responsabilità
// editoriale, quindi le proprietà che contano non sono estetiche:
//
//   · i valori entrano VERBATIM — nessun articolo aggiunto davanti ad `aiRole`,
//     nessun accordo al plurale su `aiTools`, nessun produttore attribuito allo
//     strumento sbagliato quando gli strumenti sono due;
//   · ogni campo assente TOGLIE la sua frase invece di sostituirla con una
//     generica: un avviso che dice meno è meglio di uno che afferma una
//     revisione che nessuno ha fatto;
//   · un articolo non assistito non ha nessun riquadro.
//
// E si controlla anche sul CORPUS VERO, non solo su casi inventati: sono gli
// undici file di `content/news` a dire se la funzione regge sui valori che
// esistono davvero — la stessa ragione per cui la formula della testa si prova
// sui rapporti del robot e non su una lista scritta a mano.
//
// La guardia lessicale in fondo verifica che il componente CHIAMI la funzione
// invece di ricomporre la frase: una seconda copia del testo dentro il `.tsx`
// sarebbe esattamente la malattia che questo lavoro ha chiuso.
//
// Esecuzione: `npm run test:avviso`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();

const { componiAvvisoAI, INTESTAZIONE_AVVISO_AI } = require("@/lib/avvisoAI");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let falliti = 0;
function ok(cond, testo) {
  console.log(`  ${cond ? "✓" : "✗"} ${testo}`);
  if (!cond) falliti++;
}

console.log("\n═══ L'AVVISO «COME È FATTO QUESTO POST» ═══\n");

const COMPLETA = {
  aiAssisted: true,
  aiTools: ["Perplexity", "Claude (Anthropic)"],
  aiRole: "ricerca delle fonti e stesura del testo",
  aiReviewedBy: "Mario Izzo",
};

// ── Nessuna dichiarazione, nessun riquadro ───────────────────────────────────
console.log("Un articolo non assistito non ha riquadro");
ok(componiAvvisoAI({}) === null, "frontmatter senza `aiAssisted` → null");
ok(componiAvvisoAI({ aiAssisted: false }) === null, "`aiAssisted: false` → null");
ok(
  componiAvvisoAI({ aiAssisted: false, aiTools: ["Claude (Anthropic)"], aiRole: "tutto" }) === null,
  "`aiAssisted: false` vince sui campi pieni (nessun avviso a sorpresa)"
);

// ── `aiRole` entra verbatim, dopo i due punti ────────────────────────────────
console.log("\n`aiRole` entra verbatim, e i due punti sono la ragione per cui può");
const completa = componiAvvisoAI(COMPLETA);
ok(
  completa.includes("è stato: ricerca delle fonti e stesura del testo."),
  "il valore sta dopo i due punti, parola per parola"
);
ok(
  !/è stato: (la |il |lo |le |i |gli |una |un |uno )/.test(completa),
  "nessun articolo infilato davanti al valore"
);
ok(!completa.includes("ha fatto"), "non torna la forma vecchia «ha fatto <ruolo>», che suonava come l'etichetta di un campo");
// La proprietà nella sua forma generale: ciò che sta fra i due punti e il punto
// successivo è ESATTAMENTE il valore, non una sua parafrasi.
const fraIDuePunti = /è stato: (.+?)\.\s/.exec(completa);
ok(
  fraIDuePunti !== null && fraIDuePunti[1] === COMPLETA.aiRole,
  "fra i due punti e il punto c'è il valore e nient'altro"
);
const ruoloStrano = componiAvvisoAI({ ...COMPLETA, aiRole: "  solo il fact-checking  " });
ok(
  ruoloStrano.includes("è stato: solo il fact-checking."),
  "uno spazio di troppo nel frontmatter non arriva in pagina, il testo sì"
);

// ── `aiTools`: il produttore non si sposta mai di strumento ──────────────────
console.log("\n`aiTools`: due strumenti non diventano uno strumento di due produttori");
ok(
  completa.includes("— Perplexity e Claude (Anthropic) —"),
  "due strumenti, elencati così come sono scritti"
);
ok(
  !completa.includes("Perplexity e Claude, di Anthropic") && !completa.includes("Perplexity e Claude —"),
  "Perplexity non viene attribuita ad Anthropic"
);
const unoSolo = componiAvvisoAI({ ...COMPLETA, aiTools: ["Claude (Anthropic)"] });
ok(unoSolo.includes("— Claude (Anthropic) —"), "uno strumento, senza connettivo");
ok(!unoSolo.includes(" e Claude"), "uno strumento non porta una «e» orfana");
const tre = componiAvvisoAI({ ...COMPLETA, aiTools: ["Perplexity", "Claude (Anthropic)", "NotebookLM"] });
ok(tre.includes("— Perplexity, Claude (Anthropic) e NotebookLM —"), "tre strumenti: virgole e una «e» finale");
const senzaStrumenti = componiAvvisoAI({ ...COMPLETA, aiTools: [] });
ok(
  senzaStrumenti.startsWith("Il contributo dell'intelligenza artificiale è stato: "),
  "nessuno strumento dichiarato: la frase si chiude su sé stessa, senza trattini vuoti"
);
ok(!senzaStrumenti.includes("—"), "e senza trattini a vuoto");
ok(
  componiAvvisoAI({ ...COMPLETA, aiTools: ["", "   ", "Claude (Anthropic)"] }).includes("— Claude (Anthropic) —"),
  "le voci vuote nel frontmatter non producono elenchi sporchi"
);

// ── Un campo assente toglie la sua frase ────────────────────────────────────
console.log("\nUn campo assente toglie la sua frase, non la sostituisce");
const senzaRevisore = componiAvvisoAI({ ...COMPLETA, aiReviewedBy: undefined });
ok(!senzaRevisore.includes("approvato"), "senza revisore non si afferma nessuna approvazione");
ok(!senzaRevisore.includes("responsabilità editoriale"), "né nessuna responsabilità editoriale");
ok(senzaRevisore.endsWith("Ogni fonte è stata poi aperta e controllata."), "la frase chiude col punto, non a metà");
ok(componiAvvisoAI({ ...COMPLETA, aiReviewedBy: "   " }) === senzaRevisore, "un revisore di soli spazi è un revisore assente");
ok(
  completa.includes("approvato da Mario Izzo, che ne ha la responsabilità editoriale."),
  "col revisore, il nome entra verbatim e la responsabilità è detta"
);
const senzaRuolo = componiAvvisoAI({ ...COMPLETA, aiRole: undefined });
ok(!senzaRuolo.includes("è stato:"), "senza `aiRole` i due punti non restano aperti su un vuoto");
ok(
  senzaRuolo.startsWith("Un'intelligenza artificiale — Perplexity e Claude (Anthropic) — ha contribuito"),
  "e la frase cambia forma invece di introdurre il niente"
);

// ── Igiene del testo ─────────────────────────────────────────────────────────
console.log("\nIgiene: nessuno spazio doppio, nessuno spazio prima di un punto");
const varianti = [completa, unoSolo, tre, senzaStrumenti, senzaRevisore, senzaRuolo, ruoloStrano];
ok(!varianti.some((t) => /  /.test(t)), "nessun doppio spazio in nessuna variante");
ok(!varianti.some((t) => / [.,]/.test(t)), "nessuno spazio prima di un punto o di una virgola");
ok(
  varianti.every((t) => /\.$/.test(t)),
  "ogni variante finisce con un punto"
);
ok(INTESTAZIONE_AVVISO_AI === "Come è fatto questo post.", "l'intestazione è quella, e sta in un posto solo");

// La lingua del prodotto non conosce il genere di chi legge: stesso setaccio
// del resto dei testi (vedi «La lingua di KIREO» in CLAUDE.md).
const accordi = varianti.flatMap((t) => trovaAccordi(t));
ok(accordi.length === 0, `nessuna forma accordata col genere di chi legge${accordi.length ? ` — ${accordi.join(", ")}` : ""}`);

// ── Il corpus vero ───────────────────────────────────────────────────────────
console.log("\nIl corpus vero: gli articoli in content/news");
const DIR = path.join(ROOT, "content", "news");
const file = fs.readdirSync(DIR).filter((n) => n.endsWith(".mdx")).sort();
ok(file.length > 0, `${file.length} articoli letti`);

let assistiti = 0;
let senzaRiquadro = 0;
let problemi = 0;
for (const nome of file) {
  const { data } = matter(fs.readFileSync(path.join(DIR, nome), "utf8"));
  const corpo = componiAvvisoAI(data);
  if (data.aiAssisted === true) {
    assistiti++;
    if (corpo === null) {
      console.log(`  ✗ ${nome}: dichiarato assistito e nessun riquadro`);
      problemi++;
      continue;
    }
    // Ogni valore dichiarato deve comparire tale e quale nel testo reso.
    for (const atteso of [data.aiRole, data.aiReviewedBy, ...(data.aiTools ?? [])]) {
      if (atteso && !corpo.includes(String(atteso).trim())) {
        console.log(`  ✗ ${nome}: «${atteso}» dichiarato e non reso`);
        problemi++;
      }
    }
    if (/  /.test(corpo) || / \./.test(corpo)) {
      console.log(`  ✗ ${nome}: testo sporco — «${corpo}»`);
      problemi++;
    }
    for (const forma of trovaAccordi(corpo)) {
      console.log(`  ✗ ${nome}: forma accordata «${forma}»`);
      problemi++;
    }
  } else {
    senzaRiquadro++;
    if (corpo !== null) {
      console.log(`  ✗ ${nome}: non assistito e riquadro reso comunque`);
      problemi++;
    }
  }
}
ok(problemi === 0, `${assistiti} articoli assistiti resi senza difetti, ${senzaRiquadro} senza riquadro`);
ok(assistiti > 0 && senzaRiquadro > 0, "il corpus contiene entrambi i casi (se no questa prova non dice niente)");

// ── Il componente chiama la funzione, non ricompone la frase ─────────────────
console.log("\nIl componente chiama la funzione invece di ricomporre il testo");
const tsx = fs.readFileSync(path.join(ROOT, "components", "news", "AvvisoAI.tsx"), "utf8");
ok(/componiAvvisoAI/.test(tsx) && /@\/lib\/avvisoAI/.test(tsx), "`AvvisoAI.tsx` importa e chiama `componiAvvisoAI`");
ok(!tsx.includes("Ogni fonte"), "nessuna seconda copia della frase dentro il componente");
ok(!tsx.includes("è stato:"), "e nessuna seconda copia della forma con i due punti");

const pagina = fs.readFileSync(path.join(ROOT, "app", "news", "[slug]", "page.tsx"), "utf8");
ok(/<AvvisoAI/.test(pagina), "la pagina dell'articolo rende il riquadro");

console.log(falliti === 0 ? "\n✓ tutto a posto\n" : `\n✗ ${falliti} controlli falliti\n`);
process.exit(falliti === 0 ? 0 : 1);
