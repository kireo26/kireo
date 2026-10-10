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
const {
  SEZIONI_EXPORT,
  assemblaEsportazione,
  ATTESE,
  VOCI_DEBITO,
  COSA_CONTIENE,
} = require("@/lib/app/esportaDati");

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

function tuttiIFileTs(dir) {
  const out = [];
  for (const v of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) out.push(...tuttiIFileTs(p));
    else if (/\.(ts|tsx)$/.test(v.name)) out.push(p);
  }
  return out;
}

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

console.log("\n§6 · I due elenchi, e le tabelle che nessuna voce nomina");
// I due elenchi sono scritti a mano (sono voce) e `ATTESE` cresce. Senza
// questo controllo, il giorno in cui una tabella nuova entra nel debito gli
// elenchi restano quelli e nessuno lo sa — e la forma in cui diventano falsi è
// la peggiore, perché un elenco si legge come esaustivo: una voce mancante non
// è un'omissione, è un'affermazione che tutto il resto c'è.
//
// Qui si importa invece di rileggere il sorgente, perché queste sono proprietà
// di VALORI. Il conto incrociato con il lettore lessicale di §2 è gratis e
// sorveglia l'estrattore.
ok(attese.length === ATTESE.length,
  `i due estrattori di ATTESE concordano (${attese.length})`,
  `il lettore lessicale dice ${attese.length} e l'import ${ATTESE.length}: uno dei due ha smesso di leggere`);

// Il primo elenco: una voce per sezione, e non può essere altrimenti perché è
// derivato — quello che si prova è che ogni sezione ce l'abbia davvero, e che
// nessuna sia il nome di una tabella buttato lì.
const senzaVoce = SEZIONI_EXPORT.filter((s) => !s.voce || s.voce.trim().length < 10).map((s) => s.chiave);
ok(senzaVoce.length === 0,
  `tutte le ${SEZIONI_EXPORT.length} sezioni del file hanno la loro voce nel primo elenco`,
  `${senzaVoce.join(", ")} — una sezione senza voce è una sezione che il file dà e non nomina`);
ok(COSA_CONTIENE.inQuestoFile.length === SEZIONI_EXPORT.length &&
   COSA_CONTIENE.nonAncoraInQuestoFile.length === VOCI_DEBITO.length,
  `i due elenchi hanno una voce per cosa (${COSA_CONTIENE.inQuestoFile.length} + ${COSA_CONTIENE.nonAncoraInQuestoFile.length})`,
  "se divergono dai dati da cui nascono, non sono derivati: sono una copia");
// ⚠️ IL CONTO NON BASTA: un elenco scritto a mano con lo stesso numero di voci
// passerebbe il confronto di sopra e divergerebbe al primo che ne tocca una.
// La proprietà è che siano DERIVATI, e quella si legge solo nel sorgente.
const moduloExport = senzaCommenti(fs.readFileSync(path.join(ROOT, "lib/app/esportaDati.ts"), "utf8"));
ok(/inQuestoFile:\s*SEZIONI_EXPORT\.map\(/.test(moduloExport) &&
   /nonAncoraInQuestoFile:\s*VOCI_DEBITO\.map\(/.test(moduloExport),
  "…e sono derivati dai dati, non elencati a mano",
  "una lista a mano accanto a quella vera è la copia che nessuno rilegge: " +
  "il primo elenco nasce dalle `voce` delle sezioni, il secondo dai `testo` delle voci del debito");

// LA QUARTA VOCE DICHIARA DI ESSERE VUOTA, e le due metà vanno insieme: che la
// voce lo dica, e che nessuno scriva quella tabella. Il giorno in cui qualcuno
// la scrive, quella frase diventa falsa e questo controllo è l'unica cosa che
// lo dice — altrimenti un ragazzo legge «è vuota per tutti» su una sezione che
// ha dei dati dentro.
const voceAttivita = SEZIONI_EXPORT.find((s) => s.tabella === "student_activities");
ok(Boolean(voceAttivita) && /vuota per tutti/.test(voceAttivita.voce),
  "la voce di `student_activities` dichiara di essere vuota",
  "è `[]` per tutti, e un elenco di «cosa contiene» che la nomina senza dirlo fa concludere a un ragazzo di non aver fatto niente");
const scritture = [];
for (const dir of ["app", "components", "lib"]) {
  for (const f of tuttiIFileTs(path.join(ROOT, dir))) {
    const src = senzaCommenti(fs.readFileSync(f, "utf8"));
    if (/from\("student_activities"\)[\s\S]{0,120}?\.(insert|update|upsert|delete)\(/.test(src)) {
      scritture.push(path.relative(ROOT, f));
    }
  }
}
ok(scritture.length === 0,
  "…e nessun codice dell'app scrive quella tabella, quindi la frase è vera",
  `${scritture.join(", ")} — adesso si riempie: quella voce dice una cosa falsa e va riscritta`);

const idVoci = VOCI_DEBITO.map((v) => v.id);
const nominate = [...new Set(ATTESE.map((a) => a.nominataDa).filter(Boolean))];
const nonNominate = ATTESE.filter((a) => a.nominataDa === null).map((a) => a.tabella).sort();
const inventate = nominate.filter((v) => !idVoci.includes(v)).sort();
ok(inventate.length === 0,
  "nessuna tabella punta a una voce che non esiste",
  `${inventate.join(", ")} — o la voce si scrive, o quelle tabelle restano senza`);
ok(nominate.length === idVoci.length,
  "ogni voce del secondo elenco copre almeno una tabella",
  `${idVoci.length} voci e solo ${nominate.length} coprono qualcosa: ` +
  `${idVoci.filter((v) => !nominate.includes(v)).join(", ")} — una voce che non copre niente ` +
  "promette al ragazzo una cosa che non abbiamo");

// Il cricchetto. NON è «zero», perché oggi non è zero: è il numero di oggi,
// dichiarato, così il silenzio cresce solo se qualcuno lo decide. Rosso nei
// due versi, e i due versi vogliono due cose opposte.
//
// Le due di oggi sono `recinto_enti` (le guide scaricate da un ente: la voce
// degli enti enumera follow, interesse e messaggi, e una guida non è nessuna
// delle tre) e `style_signal` (la voce dei punteggi si limita «sulle aree», e
// lo stile non è un'area). Segnalate a Mario il 10/10/2026.
const NON_NOMINATE_ATTESE = 2;
ok(nonNominate.length === NON_NOMINATE_ATTESE,
  `${nonNominate.length} tabelle del debito che nessuna voce nomina (dichiarate: ${NON_NOMINATE_ATTESE})`,
  nonNominate.length > NON_NOMINATE_ATTESE
    ? `il debito è cresciuto e gli elenchi sono rimasti quelli: ${nonNominate.join(", ")}\n       ` +
      "→ o una voce le nomina, o si alza il numero qui sapendo che il file tace su di loro."
    : `gli elenchi sono migliorati: porta il numero a ${nonNominate.length}. ` +
      `Restano fuori: ${nonNominate.join(", ") || "nessuna"}`);
console.log(`  · il secondo elenco nomina ${ATTESE.length - nonNominate.length} delle ${ATTESE.length} tabelle del debito`);
console.log(`  · non nominate: ${nonNominate.join(", ") || "nessuna"}`);

console.log("\n§7 · La forma del file");
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
const fileOk = JSON.parse(esitoCompleto.file);
const fileRotto = JSON.parse(esitoIncompleto.file);
const mancante = chiavi[ULTIMA];

ok(fileOk.tutteLePartiRichiesteOttenute === true &&
   Array.isArray(fileOk.nonSiamoRiusciti) && fileOk.nonSiamoRiusciti.length === 0,
  "un file completo porta comunque `tutteLePartiRichiesteOttenute` e `nonSiamoRiusciti`",
  "un campo che compare solo quando le cose vanno male è un campo che nessuno impara a cercare");
// Il nome vecchio prometteva più della cosa che afferma: non deve rientrare,
// e nemmeno restare accanto al nuovo.
ok(!("completo" in fileOk) && !("completo" in fileRotto),
  "nessun campo si chiama `completo`",
  "rispondeva a «le query sono riuscite?» e si leggeva come «questo è tutto quello che avete su di me»");
ok(fileOk.avviso === undefined, "un file completo non porta un avviso di incompletezza");
const intestazione = Object.keys(fileOk).slice(0, 4);
ok(intestazione.join(",") === "esportatoIl,cosaContiene,tutteLePartiRichiesteOttenute,nonSiamoRiusciti",
  `l'intestazione sta in cima, prima dei dati (${intestazione.join(", ")})`);

for (const [nome, f] of [["completo", fileOk], ["incompleto", fileRotto]]) {
  ok(Array.isArray(f.cosaContiene?.inQuestoFile) && f.cosaContiene.inQuestoFile.length === SEZIONI_EXPORT.length &&
     Array.isArray(f.cosaContiene?.nonAncoraInQuestoFile) && f.cosaContiene.nonAncoraInQuestoFile.length === VOCI_DEBITO.length &&
     typeof f.cosaContiene?.nota === "string",
    `i due elenchi ci sono nel file ${nome}, con la nota`,
    "il debito non è un guasto: è quello che l'export non copre ancora, e vale anche quando tutto è andato bene");
}
// ⚠️ UNA FRASE SOLA, NO. È la forma che afferma: elencare quello che non c'è
// fa credere che tutto il resto ci sia.
ok(typeof fileOk.cosaContiene !== "string",
  "`cosaContiene` non è tornato a essere una frase sola",
  "con quattro sezioni su trentacinque tabelle, una frase che elenca le mancanze afferma che il resto è dentro");

ok(fileRotto.tutteLePartiRichiesteOttenute === false && fileRotto.nonSiamoRiusciti.join() === mancante,
  `un file incompleto nomina la sezione mancante (${mancante})`);
ok(!(mancante in fileRotto),
  `la sezione mancante NON compare nel file`,
  "né `[]`, che è una bugia, né un segnaposto, che è rumore in mezzo ai dati");
ok(typeof fileRotto.avviso === "string" && fileRotto.avviso.includes("non vuol dire che siano vuote"),
  "l'avviso dice che un vuoto non è un «non lo so»",
  "è la frase che porta il peso: la regola di casa detta a un sedicenne");
ok(chiavi.filter((c) => c !== mancante).every((c) => c in fileRotto),
  "le altre sezioni restano nel file");
ok(esitoVuoto.file === null, "se non si ottiene niente, non si scarica nessun file",
  "un file con la sola intestazione si apre e sembra «non ho niente su KIREO»");

console.log("\n§8 · Il componente non ricompone il file a mano");
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
