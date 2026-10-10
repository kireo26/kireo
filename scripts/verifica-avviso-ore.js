/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// L'AVVISO sulle ore PCTO contro la durata programmata (11/10/2026).
//
// ⚠️ NON CONFONDERLO CON `verifica-ore-pcto.js` (`npm run test:ore`), che è la
// guardia sulla FRASE DEL CONTATORE che lo studente legge («1 ora certificata
// su 90»): quella parla di accordi e separatori, questa di una soglia e di un
// avviso nel form dell'ente. Due cose diverse, due file — e questo file è nato
// SOVRASCRIVENDO quello, perché ho scritto un nome senza guardare cosa c'era:
// l'ha preso la guardia di `tutti-i-test.js` sulle chiavi doppie.
//
// Tutto in TypeScript:
// non c'è niente da provare nel database, perché `ore_pcto` resta un campo
// libero — è una scelta di Mario («non chiedo un blocco: un evento può
// legittimamente valere più della sua diretta»).
//
// Le proprietà che conta tenere:
//
//   §1 IL CASO VERO. 0,5 ore su 5 minuti (19:15 → 19:20) deve dire qualcosa.
//      È quello che ha aperto il lavoro, e una prima stesura della soglia (un
//      margine assoluto di un'ora) TACEVA proprio lì.
//   §2 I CASI ORDINARI TACCIONO. Zero ore, un'ora su 45 minuti, le ore pari
//      alla durata, una durata che non si sa. Un avviso che suona sempre non è
//      un avviso.
//   §3 IL CONFINE È ESATTO E DICHIARATO. Il doppio esatto tace, un soffio oltre
//      parla: una soglia che nessuno prova al bordo è una soglia che nessuno sa
//      dove sia.
//   §4 IL TESTO DICE I DUE NUMERI. Un numero che chi legge non può rifare gli
//      toglie fiducia in tutto il resto.
//   §5 È UN AVVISO, NON UN ERRORE. Se entrasse in `validate()` bloccherebbe un
//      uso legittimo, ed è esattamente quello che Mario ha escluso.

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { senzaCommenti } = require("./lib/senza-commenti.js");
const { ancora, fetta } = require("./lib/ancora.js");
const ts = require("typescript");

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

const leggi = (rel) => senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));

function caricaModulo(rel, risolvi) {
  const js = ts.transpileModule(readFileSync(join(RADICE, rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  new Function("require", "module", "exports", js)((n) => risolvi(n), modulo, modulo.exports);
  return modulo.exports;
}

const formato = caricaModulo("lib/formato.ts", () => {
  throw new Error("lib/formato.ts non deve importare niente");
});
const { avvisoOrePcto, durataOre, durataLeggibile, FATTORE_ORE_SOSPETTE } = caricaModulo(
  "lib/eventi/orePcto.ts",
  (nome) => {
    if (nome === "@/lib/formato") return formato;
    throw new Error(`import non previsto: ${nome}`);
  },
);

console.log("\n§1 — il caso vero: 0,5 ore su cinque minuti\n");

{
  // L'evento di Mario del 4 ottobre, numeri suoi.
  const avviso = avvisoOrePcto(0.5, "2026-10-04T19:15", "2026-10-04T19:20");
  ok(avviso !== null, "0,5 ore su 5 minuti dice qualcosa", String(avviso));
  ok(
    avviso !== null && avviso.includes("5 minuti") && avviso.includes("0,5 ore"),
    "e dice i due numeri, così chi legge può rifare il conto",
    String(avviso),
  );
  // La prima stesura della soglia era un margine assoluto di un'ora: 0,5 supera
  // 0,083 di 0,42 ore, cioè meno di un'ora, quindi TACEVA proprio qui. È il
  // motivo per cui la soglia è un rapporto.
  const durata = durataOre("2026-10-04T19:15", "2026-10-04T19:20");
  ok(
    durata !== null && 0.5 - durata < 1,
    "e un margine assoluto di un'ora avrebbe taciuto: lo scarto è meno di un'ora",
    `scarto ${(0.5 - (durata ?? 0)).toFixed(2)} ore`,
  );
}

console.log("\n§2 — i casi ordinari tacciono\n");

{
  const casi = [
    [0, "2026-10-04T19:15", "2026-10-04T19:20", "zero ore: il caso più comune di tutti"],
    [1, "2026-10-04T19:00", "2026-10-04T19:45", "un'ora su 45 minuti: arrotondare per eccesso è normale"],
    [2, "2026-10-04T19:00", "2026-10-04T21:00", "le ore pari alla durata"],
    [1, "2026-10-04T19:00", "2026-10-04T22:00", "un'ora su tre: ne conta una parte, ed è normale"],
    [3, "2026-10-04T09:00", "2026-10-04T12:00", "un workshop di tre ore che ne vale tre"],
    [0.5, "2026-10-04T19:15", "", "nessuna data di fine: non si sa la durata, quindi non si dice niente"],
    [0.5, "", "", "nessuna data: idem"],
    [0.5, "2026-10-04T19:15", "non-una-data", "una data malformata: si tace, non si indovina"],
    [0.5, "2026-10-04T19:20", "2026-10-04T19:15", "fine prima dell'inizio: è già un errore di campo, non un secondo messaggio"],
    [0.5, "2026-10-04T19:15", "2026-10-04T19:15", "durata zero: non si divide per zero e non si dice niente"],
  ];
  for (const [ore, inizio, fine, cosa] of casi) {
    const avviso = avvisoOrePcto(ore, inizio, fine);
    ok(avviso === null, cosa, String(avviso));
  }
  // ⚠️ La direzione in cui questo blocco può essere vacuo: se la funzione
  // tornasse SEMPRE null, le dieci asserzioni qui sopra sarebbero tutte verdi.
  // Il §1 è quello che lo esclude, e questa riga lo dice invece di lasciarlo
  // dedurre.
  ok(
    avvisoOrePcto(0.5, "2026-10-04T19:15", "2026-10-04T19:20") !== null,
    "e la funzione non tace sempre: il §1 è la metà che rende non vacuo questo blocco",
  );

  // ⚠️ QUELLO CHE TIENE `if (!(ore > 0))`, e l'ha detto una controprova che non
  // ha morso: togliendo quella riga, tutte le asserzioni qui sopra restano
  // verdi, perché `0 <= durata * 2` è vero e il confronto in basso prende lo
  // zero da sé. L'unico caso che quella riga protegge è `NaN`, perché
  // `NaN <= qualunque cosa` è FALSO — e allora l'avviso uscirebbe dicendo
  // «dichiara NaN ore di PCTO».
  ok(
    avvisoOrePcto(Number.NaN, "2026-10-04T19:00", "2026-10-04T21:00") === null,
    "un numero che non è un numero tace: è il caso che la guardia su `ore > 0` tiene davvero",
    String(avvisoOrePcto(Number.NaN, "2026-10-04T19:00", "2026-10-04T21:00")),
  );
  ok(
    avvisoOrePcto(-1, "2026-10-04T19:00", "2026-10-04T21:00") === null,
    "e un numero negativo pure (l'input ha min=0, ma una funzione non lo sa)",
  );
}

console.log("\n§3 — il confine è esatto, e si prova al bordo\n");

{
  ok(FATTORE_ORE_SOSPETTE === 2, "il fattore è 2 (scelto, non misurato: sta scritto nel file)");
  // Due ore di durata: il doppio esatto tace, un soffio oltre parla.
  const i = "2026-10-04T19:00";
  const f = "2026-10-04T21:00";
  ok(avvisoOrePcto(4, i, f) === null, "il doppio esatto tace (4 ore su 2)");
  ok(avvisoOrePcto(4.5, i, f) !== null, "un soffio oltre parla (4,5 ore su 2)");
  // E il caso che l'avviso prende pur essendo legittimo: va detto, non nascosto.
  const workshop = avvisoOrePcto(4, "2026-10-04T09:00", "2026-10-04T10:00");
  ok(workshop !== null, "un workshop di un'ora che dichiara 4 ore viene nominato (4×)");
  ok(
    workshop !== null && /descrizione/.test(workshop),
    "e il testo gli dice cosa fare invece di dire che è sbagliato",
    String(workshop),
  );
}

console.log("\n§4 — il testo dice i due numeri, e in italiano\n");

{
  ok(durataLeggibile(5 / 60) === "5 minuti", "«5 minuti»", durataLeggibile(5 / 60));
  ok(durataLeggibile(1 / 60) === "1 minuto", "«1 minuto» al singolare", durataLeggibile(1 / 60));
  ok(durataLeggibile(1) === "1 ora", "«1 ora» al singolare", durataLeggibile(1));
  ok(durataLeggibile(2) === "2 ore", "«2 ore»", durataLeggibile(2));
  ok(durataLeggibile(1.5) === "1 ora e 30 minuti", "«1 ora e 30 minuti»", durataLeggibile(1.5));
  // ⚠️ Gli accordi: è il difetto dei plurali del 4/10, e qui una durata di
  // un'ora o di un minuto capita davvero.
  ok(!/1 ore|1 minuti|2 ora\b/.test([1, 2, 1 / 60, 2 / 60, 1.5].map(durataLeggibile).join(" ")), "nessun accordo sbagliato");
  // La virgola italiana, non il punto: è la stessa classe del separatore
  // delle migliaia che `lib/formato.ts` esiste per tenere in un posto solo.
  const mezza = avvisoOrePcto(0.5, "2026-10-04T19:15", "2026-10-04T19:20");
  ok(mezza !== null && mezza.includes("0,5") && !mezza.includes("0.5"), "le ore con la virgola, non col punto", String(mezza));
  const intere = avvisoOrePcto(4, "2026-10-04T09:00", "2026-10-04T10:00");
  ok(intere !== null && intere.includes("4 ore") && !intere.includes("4,0"), "e un intero senza decimali inutili", String(intere));
}

console.log("\n§5 — è un avviso, non un errore\n");

{
  const src = leggi("components/ente/CreaEventoForm.tsx");
  ok(src.includes('from "@/lib/eventi/orePcto"'), "il form importa la funzione invece di ricomporre la frase");
  ok(src.includes("avvisoOrePcto(Number(orePcto), dataInizio, dataFine)"), "e la chiama con i tre campi");
  // LA PROPRIETÀ CHE CONTA: non entra in `validate()`. Una riga in `errori`
  // bloccherebbe l'invio, cioè un uso che Mario ha dichiarato legittimo.
  const validate = (() => {
    try {
      return fetta(
        src,
        { nome: "function validate(", dove: "la validazione" },
        { nome: "const inizioItaliano", dove: "il calcolo degli avvisi, subito dopo" },
      );
    } catch (e) {
      ok(false, "la fetta di `validate` si ritaglia", e.message);
      return "";
    }
  })();
  ok(!validate.includes("avvisoOrePcto"), "e NON compare in `validate()`: un avviso non blocca l'invio");
  ok(!validate.includes("orePcto"), "né `validate` guarda le ore in nessun altro modo");
  // E non c'è una seconda copia del testo nel componente.
  ok(!/ore di PCTO\./.test(src), "nessuna copia del testo nel form");
  // L'avviso tace sui campi già rossi: un secondo messaggio su un campo rosso
  // è rumore.
  try {
    const i = ancora(src, "{avvisoOre &&", { dove: "il blocco dell'avviso" });
    const blocco = src.slice(i, i + 200);
    ok(
      blocco.includes("!errori.dataInizio") && blocco.includes("!errori.dataFine"),
      "e tace quando una delle due date è già in errore",
    );
  } catch (e) {
    ok(false, "l'àncora del blocco dell'avviso non è ambigua", e.message);
  }
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
