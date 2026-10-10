// La guardia di «Scarica i miei dati», nelle DUE direzioni.
//
// Il 5/10/2026 l'export interrogava cinque tabelle, di cui una non esisteva
// da tre mesi: `webinar_registrations`. Nessuno se n'era accorto, e la ragione
// non è che nessuno l'avesse vista fallire — è che NON C'ERA NIENTE CHE
// POTESSE VEDERLA. Quel codice gira nel browser e non può registrare un
// guasto; l'errore veniva scartato; e `?? []` trasformava un 404 in «zero
// prenotazioni».
//
// L'elenco che all'export serve esiste già, scritto da noi, dentro il
// database: la chiusura transitiva di `on delete cascade` da `profiles` —
// cioè le tabelle le cui righe spariscono quando sparisce una persona.
// Quindi la cecità si chiude PRIMA della produzione invece che dopo, e si
// chiude nelle due direzioni:
//
//   derivato e NON classificato → una tabella di uno studente che l'export
//       non dà e di cui nessuno ha detto niente. È il silenzio: un'esclusione
//       corretta e un'omissione hanno lo stesso aspetto, cioè niente.
//
//   classificato e NON derivato → un nome a cui l'export crede e che non
//       corrisponde a niente. È la COPIA STANTIA applicata a un elenco: un
//       nome che era giusto quando fu scritto e che adesso protegge il vuoto.
//       In un export senza guardia non lo vedrebbe nessuno, perché una
//       sezione che non trova nulla si comporta esattamente come una sezione
//       che trova una tabella vuota. ⚠️ È questa la direzione che avrebbe
//       reso rossa `webinar_registrations` il giorno in cui è stata rimossa
//       dal repo — e costa una riga in più della prima.
//
// La derivazione è condivisa con il sovrainsieme di `TABELLE_DI_STUDENTI`
// (`scripts/lib/cascata-profili.js`): due consumatori, una derivazione sola,
// altrimenti divergono.
//
// Esecuzione: `npm run test:export`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { cascataDaProfili } = require("./lib/cascata-profili.js");
const { senzaCommenti } = require("./lib/senza-commenti.js");
const { fetta } = require("./lib/ancora.js");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();
const { SEZIONI_EXPORT, assemblaEsportazione } = require("@/lib/app/esportaDati");

let rossi = 0;
let fatti = 0;
function ok(condizione, titolo, dettaglio) {
  fatti += 1;
  if (condizione) {
    console.log(`  ok   ${titolo}`);
  } else {
    rossi += 1;
    console.log(`  ROSSA ${titolo}`);
    if (dettaglio) console.log(`       ${dettaglio}`);
  }
}

// ── Le liste dichiarate, lette dal modulo invece che ricopiate qui: una
// seconda copia di un elenco è una copia che diverge.
function leggiElenchi() {
  const src = senzaCommenti(fs.readFileSync(path.join(ROOT, "lib/app/esportaDati.ts"), "utf8"));
  // Ogni àncora dichiara quante volte il nome compare: `export const X` una
  // volta sola, e la chiusura `\n];` tante quante sono gli elenchi. Senza il
  // conto, un secondo elenco aggiunto domani sposterebbe in silenzio il pezzo
  // che questo controllo guarda.
  const blocco = (nome, quale) =>
    fetta(src, { nome: `export const ${nome}`, volte: 1 }, { nome: "\n];", volte: 3, quale });
  const tabelleDi = (nome, quale) =>
    [...blocco(nome, quale).matchAll(/tabella:\s*"([a-z_][a-z0-9_]*)"/g)].map((m) => m[1]);
  const nature = [...blocco("ATTESE", 1).matchAll(/natura:\s*"([a-z]+)"/g)].map((m) => m[1]);
  return {
    sezioni: tabelleDi("SEZIONI_EXPORT", 0),
    attese: tabelleDi("ATTESE", 1),
    fuori: tabelleDi("FUORI", 2),
    nature,
  };
}

// `profiles` è la RADICE della cascata, quindi non compare nella chiusura: è
// la sola tabella ammessa in un elenco senza esservi dentro, e la si nomina
// qui invece di lasciarla passare per caso.
const RADICE = "profiles";

console.log("\n§1 · La derivazione legge davvero qualcosa");
const { cascata, tabelle } = cascataDaProfili();
// Soglia dichiarata: una guardia verde su un insieme vuoto non ha provato
// niente, e lo dice con lo stesso verde di una che ha provato tutto.
ok(cascata.size > 20, `la cascata da ${RADICE} ha ${cascata.size} tabelle`,
  "sotto le venti, il lettore lessicale delle migrazioni ha smesso di leggere");
ok(tabelle.size > 40, `le migrazioni creano ${tabelle.size} tabelle`,
  "sotto le quaranta, l'estrattore dei `create table` ha smesso di leggere");
ok(cascata.has("student_area_interests") && cascata.has("presenze_live"),
  "la cascata prende le due tabelle che il nome della colonna perdeva",
  "student_area_interests e presenze_live usano `user_id`, non `student_id`");

console.log("\n§2 · Gli elenchi dichiarati si leggono");
const { sezioni, attese, fuori, nature } = leggiElenchi();
ok(Array.isArray(sezioni) && sezioni.length > 0, `SEZIONI_EXPORT: ${sezioni?.length ?? "non leggibile"} sezioni`);
ok(Array.isArray(attese) && attese.length > 0, `ATTESE: ${attese?.length ?? "non leggibile"} tabelle`);
ok(Array.isArray(fuori) && fuori.length > 0, `FUORI: ${fuori?.length ?? "non leggibile"} tabelle`);

const classificate = new Map();
let doppie = [];
for (const [nome, lista] of [["SEZIONI_EXPORT", sezioni], ["ATTESE", attese], ["FUORI", fuori]]) {
  for (const t of lista ?? []) {
    if (classificate.has(t)) doppie.push(`${t} (in ${classificate.get(t)} e in ${nome})`);
    else classificate.set(t, nome);
  }
}
ok(doppie.length === 0, "nessuna tabella in due elenchi", doppie.join("; "));

console.log("\n§3 · Derivato e non classificato — il silenzio");
const nonClassificate = [...cascata.keys()].filter((t) => !classificate.has(t)).sort();
ok(nonClassificate.length === 0,
  `tutte le ${cascata.size} tabelle della cascata sono classificate`,
  nonClassificate.length
    ? `senza nome né ragione: ${nonClassificate.join(", ")}\n       ` +
      "→ una riga in SEZIONI_EXPORT (va nel file), in ATTESE (gli è dovuta, con la sua natura) " +
      "oppure in FUORI (non è di uno studente, con il perché)."
    : null);

console.log("\n§4 · Classificato e non derivato — la copia stantia");
const fantasma = [...classificate.keys()]
  .filter((t) => t !== RADICE && !cascata.has(t))
  .sort();
ok(fantasma.length === 0,
  "nessun elenco nomina una tabella che non discende da uno studente",
  fantasma.length
    ? `nominate e non trovate sotto la cascata: ${fantasma.join(", ")}\n       ` +
      fantasma
        .map((t) => `  • ${t}: ${tabelle.has(t) ? "la tabella esiste ma non ha una FK in cascata da profiles" : "LA TABELLA NON ESISTE in nessuna migrazione"}`)
        .join("\n       ")
    : null);

console.log("\n§5 · Il conto del debito, perché un numero che cambia si vede");
const quante = (nat) => nature.filter((n) => n === nat).length;
console.log(`  · nel file oggi: ${sezioni.length} sezioni (di cui ${RADICE}, la radice)`);
console.log(`  · dovute e non date: ${attese.length}` +
  ` — scritto ${quante("scritto")}, fatto ${quante("fatto")}, dedotto ${quante("dedotto")},` +
  ` terzo ${quante("terzo")}, nostro ${quante("nostro")}`);
console.log(`  · non di uno studente: ${fuori.length}`);
ok(attese.length + fuori.length + sezioni.length - 1 === cascata.size,
  "i tre elenchi coprono la cascata esattamente, senza somme che non tornano",
  `${sezioni.length - 1} + ${attese.length} + ${fuori.length} ≠ ${cascata.size}`);

console.log("\n§6 · La forma del file");
// Si chiede al modulo, non si rilegge il sorgente: una regex su un testo dice
// che è scritto, non che arriva a chi legge.
const ULTIMA = SEZIONI_EXPORT.length - 1;
const adesso = new Date("2026-10-10T20:00:00Z");
const tuttiOk = SEZIONI_EXPORT.map((_, i) => ({ ottenuta: true, dati: i === ULTIMA ? [] : { x: 1 } }));
const unaPersa = tuttiOk.map((e, i) => (i === ULTIMA ? { ottenuta: false, motivo: "PGRST205" } : e));
const nessuna = tuttiOk.map(() => ({ ottenuta: false, motivo: "PGRST205" }));

const esitoCompleto = assemblaEsportazione(tuttiOk, adesso);
const esitoIncompleto = assemblaEsportazione(unaPersa, adesso);
const esitoVuoto = assemblaEsportazione(nessuna, adesso);

const chiavi = SEZIONI_EXPORT.map((s) => s.chiave);
const completo = JSON.parse(esitoCompleto.file);
const incompleto = JSON.parse(esitoIncompleto.file);
const mancante = chiavi[ULTIMA];

ok(completo.completo === true && Array.isArray(completo.nonSiamoRiusciti) && completo.nonSiamoRiusciti.length === 0,
  "un file completo porta comunque `completo` e `nonSiamoRiusciti`",
  "un campo che compare solo quando le cose vanno male è un campo che nessuno impara a cercare");
ok(completo.avviso === undefined, "un file completo non porta un avviso di incompletezza");
const primeTre = Object.keys(completo).slice(0, 3);
ok(primeTre.join(",") === "esportatoIl,completo,nonSiamoRiusciti",
  `l'intestazione sta in cima, prima dei dati (${primeTre.join(", ")})`);

ok(incompleto.completo === false && incompleto.nonSiamoRiusciti.join() === mancante,
  `un file incompleto nomina la sezione mancante (${mancante})`);
ok(!(mancante in incompleto),
  `la sezione mancante NON compare nel file`,
  "né `[]`, che è una bugia, né un segnaposto, che è rumore in mezzo ai dati");
ok(typeof incompleto.avviso === "string" && incompleto.avviso.includes("non vuol dire che siano vuote"),
  "l'avviso dice che un vuoto non è un «non lo so»",
  "è la frase che porta il peso: la regola di casa detta a un sedicenne");
ok(chiavi.filter((c) => c !== mancante).every((c) => c in incompleto),
  "le altre sezioni restano nel file");
ok(esitoVuoto.file === null, "se non si ottiene niente, non si scarica nessun file",
  "un file con la sola intestazione si apre e sembra «non ho niente su KIREO»");

console.log("\n§7 · Il componente non ricompone il file a mano");
const form = senzaCommenti(fs.readFileSync(path.join(ROOT, "components/app/ProfiloForm.tsx"), "utf8"));
// Il corpo dell'export: dalla sua funzione a quella che la segue. Le due
// àncore dichiarano il proprio conto — ognuna compare nella dichiarazione e
// nell'`onClick` che la chiama.
const esportazione = fetta(
  form,
  { nome: "handleScaricaDati", volte: 2, dove: "ProfiloForm" },
  { nome: "handleEliminaDefinitivo", volte: 2, dove: "ProfiloForm" },
);
ok(esportazione.includes("assemblaEsportazione") && esportazione.includes("SEZIONI_EXPORT"),
  "l'export chiama il modulo invece di scrivere le query a mano");
ok(!/\?\?\s*\[\]/.test(esportazione),
  "nessun `?? []` nel percorso dell'export",
  "è la forma esatta con cui un 404 diventava «zero prenotazioni»");
ok(!/\.from\(["'][a-z_]+["']\)/.test(esportazione.replace(/\.from\(s\.tabella\)/g, "")),
  "nessuna tabella nominata a mano nel componente",
  "una query inline è una sezione che la guardia non vede");
ok(/console\.error/.test(esportazione),
  "un errore di sezione lascia una traccia",
  "il browser non può registrare un guasto: quella riga è l'unica traccia che resta");
ok(esportazione.includes("TESTO_NESSUN_FILE"),
  "il caso «nessun file» ha il suo testo e non un silenzio");

console.log(`\n${rossi === 0 ? "✓" : "✗"} ${fatti - rossi}/${fatti} proprietà verificate\n`);
process.exit(rossi === 0 ? 0 : 1);
