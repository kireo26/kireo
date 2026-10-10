// La metà TypeScript della traccia di chiusura (11/10/2026). La metà database
// sta in `scripts/verifica-chiusura-diretta.sql`, che gira contro una replica.
//
// Le proprietà che conta tenere, e nessuna si vede rileggendo:
//
//   §1 LA FORMA «etichetta: numero» NON HA ACCORDI. È la scelta di Mario, e la
//      ragione non è estetica: «1 presenti» è il difetto del giro dei plurali,
//      che in italiano non si deriva dal numero senza conoscere il genere del
//      nome. La prova è meccanica: cambiando i numeri, il testo deve differire
//      SOLO nelle cifre.
//   §2 TRE ESITI DISTINGUIBILI. Il difetto da cui nasce tutto: «0 nuove
//      certificazioni» per una diretta già chiusa è un'affermazione sugli
//      studenti al posto di «l'ho già fatto». I tre testi non devono
//      collassare, e quello della seconda pressione deve portare l'ora.
//   §3 IL BOTTONE SPARISCE, non si disabilita. Un bottone disabilitato dice
//      «qui c'è qualcosa da fare, ma non ora»: su una chiusura è falso per
//      sempre. Si legge dal sorgente, perché è l'unica cosa che un test Node
//      può vedere di un `.tsx`.
//   §4 LE DUE PAGINE PASSANO LA TRACCIA. Un prop dimenticato lascia il bottone
//      su una diretta chiusa, ed è esattamente il difetto che questo giro
//      chiude: verde su tutto il resto, e il prodotto fa la cosa di prima.
//   §5 LO STATO NON SI INDOVINA. Un `diretta_chiusa_da_tipo` che non
//      riconosciamo non deve produrre una riga che afferma una chiusura senza
//      saperne dire l'autore.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { senzaCommenti } = require("./lib/senza-commenti.js");
const { ancora, fetta } = require("./lib/ancora.js");

const RADICE = join(__dirname, "..");
let fatte = 0;
let falliti = 0;

function ok(condizione, cosa, dettaglio) {
  fatte++;
  if (condizione) {
    console.log(`  ✓ ${cosa}`);
  } else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

function leggi(rel) {
  return senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));
}

/**
 * Una fetta che non esplode: `fetta()` condivisa SOLLEVA quando l'àncora è
 * ambigua (ed è il suo mestiere — un conto sbagliato è il difetto che quel
 * file esiste per prendere), ma qui un throw fermerebbe la suite su una riga
 * sola. L'eccezione diventa un rosso che nomina il motivo.
 */
function fettaOppureRosso(src, da, a, nome) {
  try {
    return fetta(src, da, a);
  } catch (e) {
    ok(false, `la fetta «${nome}» si ritaglia`, e.message);
    return "";
  }
}

// Le funzioni si CHIAMANO, non si legge il sorgente: una regex su un letterale
// dice che la frase è scritta, non che arriva a chi legge. Si compila il solo
// modulo dei testi con `tsc` in memoria e si esegue; l'import di `lib/formato`
// è REALE e non uno shim, perché l'ora che l'ente legge dipende dalla zona e
// provarla con un formattatore finto proverebbe un'altra cosa.
const ts = require("typescript");
let testi;

function caricaModulo(rel, risolvi) {
  const sorgente = readFileSync(join(RADICE, rel), "utf8");
  const js = ts.transpileModule(sorgente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  const richiedi = (nome) => risolvi(nome);
  new Function("require", "module", "exports", js)(richiedi, modulo, modulo.exports);
  return modulo.exports;
}

const formato = caricaModulo("lib/formato.ts", () => {
  throw new Error("lib/formato.ts non deve importare niente");
});
testi = caricaModulo("lib/eventi/chiusuraDiretta.ts", (nome) => {
  if (nome === "@/lib/formato") return formato;
  throw new Error(`import non previsto: ${nome}`);
});

const { statoChiusura, testoEsitoChiusura, testoStatoChiusura } = testi;

console.log("\n§1 — la forma «etichetta: numero» non ha accordi\n");

const soloCifre = (s) => s.replace(/\d+/g, "#");

{
  const uno = testoEsitoChiusura({ tipo: "chiusa", presenti: 1, certificati: 1 });
  const molti = testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 9 });
  ok(
    soloCifre(uno) === soloCifre(molti),
    "un presente e dodici danno la stessa frase, cambiano solo le cifre",
    `«${uno}» vs «${molti}»`,
  );
  ok(uno.includes("Presenti: 1."), "il numero sta dopo l'etichetta, non davanti al nome", uno);
  ok(uno.includes("Nuove certificazioni automatiche: 1."), "e lo stesso per le certificazioni", uno);
  // La direzione in cui questo controllo può essere vacuo: se i testi
  // smettessero di contenere numeri, `soloCifre` renderebbe tutto uguale.
  ok(/\d/.test(uno) && /\d/.test(molti), "i due testi contengono davvero dei numeri (il confronto non è vacuo)");
}

{
  const zero = testoEsitoChiusura({ tipo: "chiusa", presenti: 1, certificati: 0 });
  ok(
    soloCifre(zero) === soloCifre(testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 0 })),
    "anche il ramo «nessuno sopra soglia» non accorda su «presenti»",
    zero,
  );
}

console.log("\n§2 — tre esiti distinguibili, e la seconda pressione dice QUANDO\n");

const QUANDO = "2026-10-04T17:20:00.000Z"; // 19:20 a Roma
{
  const certificati = testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 9 });
  const nessuno = testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 0 });
  const gia = testoEsitoChiusura({ tipo: "gia_chiusa", presenti: 12, quando: QUANDO });

  ok(new Set([certificati, nessuno, gia]).size === 3, "i tre testi sono tre testi diversi");
  ok(
    nessuno.includes("Nessuno ha raggiunto la soglia"),
    "nessuno sopra soglia lo dice a parole, non con uno zero",
    nessuno,
  );
  ok(
    !nessuno.includes("certificazioni automatiche: 0") && !nessuno.includes("0 nuove"),
    "e non lo dice MAI con uno zero: è il difetto da cui nasce il giro",
    nessuno,
  );
  ok(gia.includes("era già stata chiusa"), "la seconda pressione dice che era già chiusa", gia);
  ok(gia.includes("19:20"), "e dice a che ora (zona di Roma, non UTC)", gia);
  ok(gia.includes("4 ottobre"), "e che giorno", gia);
  ok(
    !gia.includes("Presenti:"),
    "la seconda pressione non ripete i presenti: la domanda a cui risponde è un'altra",
    gia,
  );
}

console.log("\n§3 — lo stato al caricamento: il bottone sparisce\n");

{
  const riga = testoStatoChiusura({ tipo: "chiusa", quando: QUANDO, daTipo: "kireo" });
  const rigaEnte = testoStatoChiusura({ tipo: "chiusa", quando: QUANDO, daTipo: "ente" });
  ok(riga.includes("19:20") && riga.includes("4 ottobre"), "la riga di stato dice quando", riga);
  ok(riga !== rigaEnte, "e dice da che parte è arrivata la chiusura: i due testi non sono lo stesso");
  ok(riga.includes("KIREO"), "KIREO si nomina", riga);
  ok(rigaEnte.includes("organizzatore"), "l'ente si nomina", rigaEnte);
  ok(
    !/certificat/i.test(riga),
    "e NON dice niente sulle certificazioni: al caricamento non sappiamo quante sono, e «sono state certificate» è falso quando nessuno era sopra soglia",
    riga,
  );

  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  const bloccoChiusura = fettaOppureRosso(
    src,
    { nome: "esitoChiusura ?", dove: "l'inizio del blocco della chiusura" },
    { nome: "DAD non sono coperte", dove: "la nota finale, subito dopo il blocco" },
    "il blocco della chiusura",
  );
  ok(
    bloccoChiusura.includes("testoStatoChiusura(chiusura)"),
    "il componente rende la riga di stato invece di ricomporla a mano",
  );
  ok(
    bloccoChiusura.includes("testoEsitoChiusura(esitoChiusura)"),
    "e rende l'esito chiamando la funzione, non interpolando i conteggi",
  );
  ok(
    !/Diretta chiusa[:.]/.test(src),
    "nessuna copia del testo nel componente: una seconda copia divergerebbe",
  );
  // La proprietà vera: su una diretta chiusa il bottone NON viene reso. Si
  // legge dall'ordine dei rami — l'alternativa (un `disabled` sullo stato
  // della chiusura) lascerebbe il bottone a schermo.
  let ordineGiusto = false;
  try {
    const iStato = ancora(bloccoChiusura, "testoStatoChiusura", { dove: "il ramo dello stato chiuso" });
    const iBottone = ancora(bloccoChiusura, "<Button", { dove: "il ramo del bottone" });
    ordineGiusto = iBottone > iStato;
  } catch (e) {
    ok(false, "le due àncore dell'ordine dei rami non sono ambigue", e.message);
  }
  ok(ordineGiusto, "il bottone sta nel ramo DOPO quello dello stato chiuso: su una chiusa non viene reso");
  ok(
    !/disabled=\{[^}]*chiusura/.test(src),
    "e non è un bottone disabilitato: una chiusura non è «non adesso», è «mai più»",
  );
}

console.log("\n§4 — le due pagine passano la traccia\n");

// L'àncora di CHIUSURA è quello che viene subito dopo il componente in quella
// pagina, e non `"/>"`: una fine generica compare decine di volte, e la fetta
// finirebbe alla prima chiusura di tag qualunque essa sia.
for (const [pagina, dopo] of [
  ["app/admin/page.tsx", "Esporta presenze (CSV)"],
  ["app/ente/(dashboard)/eventi/page.tsx", "<ReportEventoButton"],
]) {
  const src = leggi(pagina);
  const uso = fettaOppureRosso(
    src,
    { nome: "<ControlloDirettaEvento", dove: `il montaggio in ${pagina}` },
    { nome: dopo, dove: `quello che viene dopo il componente in ${pagina}` },
    `il montaggio in ${pagina}`,
  );
  ok(uso.includes("chiusaIl={e.diretta_chiusa_il}"), `${pagina} passa chiusaIl`);
  ok(uso.includes("chiusaDaTipo={e.diretta_chiusa_da_tipo}"), `${pagina} passa chiusaDaTipo`);
  // La metà che si dimentica: il prop si passa e la `select` non legge la
  // colonna, quindi arriva `undefined` e il bottone resta. Verde su tutto il
  // resto, e il prodotto fa la cosa di prima.
  ok(src.includes("diretta_chiusa_il, diretta_chiusa_da_tipo"), `${pagina} legge le due colonne nella select`);
}

console.log("\n§5 — lo stato non si indovina\n");

{
  ok(statoChiusura({ chiusaIl: null, chiusaDaTipo: null }).tipo === "da_chiudere", "senza ora: da chiudere");
  ok(
    statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: "ente" }).tipo === "chiusa",
    "con ora e tipo valido: chiusa",
  );
  ok(
    statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: null }).tipo === "da_chiudere",
    "ora senza tipo: non si dichiara una chiusura di cui non si sa dire l'autore",
  );
  ok(
    statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: "sistema" }).tipo === "da_chiudere",
    "un tipo che non riconosciamo vale come assente, non come un autore ignoto",
  );
  ok(
    statoChiusura({ chiusaIl: "", chiusaDaTipo: "ente" }).tipo === "da_chiudere",
    "stringa vuota: da chiudere (una `select` può restituirla, e `new Date(\"\")` è Invalid Date)",
  );
}

console.log("\n§6 — il poll non degrada verso «non chiusa»\n");

{
  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  const pollata = fettaOppureRosso(
    src,
    { nome: "const aggiorna = useCallback", dove: "l'inizio del poll" },
    { nome: "useEffect(() =>", dove: "l'effetto che lo monta, subito dopo" },
    "il poll",
  );
  ok(
    pollata.includes("diretta_chiusa_il, diretta_chiusa_da_tipo"),
    "il poll rilegge lo stato della chiusura: l'altro moderatore si vede in 15s invece che premendo",
  );
  ok(
    /if \(erroreEv\)[\s\S]{0,200}else if \(ev\)/.test(pollata),
    "una lettura fallita lascia quello che c'era invece di rimettere il bottone",
  );
  ok(pollata.includes("console.error"), "e la lettura fallita lascia una traccia invece di sparire");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
