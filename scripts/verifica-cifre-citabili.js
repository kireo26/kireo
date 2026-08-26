// Verifica dell'insieme delle CIFRE CITABILI (lib/escape/cifreCitabili.ts).
//
// La regola che il test difende è una sola, e vale la pena scriverla prima dei
// casi: il revisore può citare solo quello che lo studente poteva sapere. Da
// qui discendono le due direzioni che possono rompersi, e che qui si guardano
// entrambe perché hanno costi opposti:
//
//   - troppo STRETTO → il ripiego cablato sostituisce paragrafi buoni. È il
//     modo silenzioso di peggiorare il finale: nessuno se ne accorge, i testi
//     diventano generici. Da qui i casi sui numeri DERIVATI (l'avanzo, i giorni
//     rimasti), che non compaiono da nessuna parte e sono la sostanza dei
//     paragrafi migliori;
//   - troppo LARGO → torna il difetto da cui siamo partiti. Da qui il caso del
//     materiale NON aperto: se il suo contenuto entrasse nell'insieme, il
//     revisore potrebbe citare un numero che lo studente non ha mai visto, e
//     la meccanica dei gettoni varrebbe per chi gioca ma non per chi commenta.
//
// Nessuna chiamata AI: si costruisce la missione reale dal config e si guarda
// l'insieme che ne esce.
//
// Esecuzione: `npm run test:cifre`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
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
require.extensions[".ts"] = require.extensions[".tsx"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { getMissione, materialiLetti } = require("@/lib/escape/config");
const { insiemeCifreCitabili, cifreNonCitabili } = require("@/lib/escape/cifreCitabili");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// La partita della Missione 04 di stamattina, per quanto serve qui: mandato
// scelto, due materiali letti (M4 la perizia, M10 la seconda squadra), M13 NON
// letto, e un piano composto.
const RISPOSTE = new Map([
  ["s1_materiali", { letti: ["M4"] }],
  ["s1_mandato", { opzioneId: "sicurezza" }],
  ["s2_informazioni", { selezionati: ["M10"] }],
  ["s3_budget", { selezionati: ["elettrico", "copertura", "controsoffitto"] }],
  ["s4_proposta", { testo: "Abbiamo tenuto 15.000 euro di fondo imprevisti." }],
]);

function main() {
  console.log("\n═══ Le cifre che il revisore può citare ═══\n");

  const get = (id) => RISPOSTE.get(id);
  const mission = getMissione("cantiere-scuola", get);
  ok(Boolean(mission), "la missione 04 si risolve dal config");
  const letti = materialiLetti(get);
  ok(letti.has("M4") && letti.has("M10") && !letti.has("M13"), "materiali letti: M4 e M10 sì, M13 no");

  const insieme = insiemeCifreCitabili(mission, RISPOSTE, letti);
  const dentro = (n, msg) => ok(insieme.has(String(n)), msg);

  // ── 1. il testo della missione, che ha davanti in ogni caso ──────────────
  dentro(240000, "il budget della missione (240.000) è citabile");
  dentro(83, "la scadenza in giorni (83) è citabile");

  // ── 2. quello che ha scritto lui ─────────────────────────────────────────
  dentro(15000, "una cifra scritta dallo studente nella proposta è citabile");

  // ── 3. i residui del suo piano ───────────────────────────────────────────
  // Sono i numeri dei paragrafi migliori — «X euro e Y giorni rimasti» — e non
  // compaiono da nessuna parte: se non li derivassimo, il ripiego cablato
  // mangerebbe proprio le frasi che vogliamo.
  const { valutaPiano } = require("@/lib/escape/config");
  const stepPiano = mission.stanze.flatMap((s) => s.step).find((s) => s.id === "s3_budget");
  const { soldi, giorni } = valutaPiano(stepPiano, ["elettrico", "copertura", "controsoffitto"]);
  dentro(soldi, `il costo del piano composto (${soldi}) è citabile`);
  dentro(240000 - soldi, `l'avanzo del piano (${240000 - soldi}) è citabile pur non comparendo da nessuna parte`);
  dentro(83 - giorni, `i giorni rimasti (${83 - giorni}) sono citabili pur non comparendo da nessuna parte`);

  // ── 4. i documenti aperti sì, quelli non aperti no ───────────────────────
  const tuttiIMateriali = mission.stanze.flatMap((s) => s.step).flatMap((s) => [...(s.materiali ?? []), ...(s.dossier ?? [])]);
  const m4 = tuttiIMateriali.find((m) => m.id === "M4");
  const m13 = tuttiIMateriali.find((m) => m.id === "M13");
  ok(Boolean(m4 && m13), "M4 e M13 esistono nella missione risolta");

  const numeriDi = (t) => (String(t).match(/\d{2,}/g) ?? []).map((x) => String(Number(x)));
  const soloInM13 = numeriDi(m13.contenuto).filter((n) => !numeriDi(m4.contenuto).includes(n) && !insieme.has(n));
  ok(numeriDi(m4.contenuto).some((n) => insieme.has(n)), "i numeri del materiale APERTO (M4) sono citabili");
  ok(soloInM13.length > 0, `almeno un numero del materiale NON aperto (M13) resta fuori dall'insieme (${soloInM13.slice(0, 3).join(", ")})`);

  // ── 5. cosa si controlla e cosa no ───────────────────────────────────────
  const finto = new Set(["100"]);
  ok(cifreNonCitabili("Hai messo 3 cose in fila e ne restano 2.", finto).length === 0, "i numeri a una cifra non sono affermazioni falsificabili: non si controllano");
  ok(cifreNonCitabili("Le perdite erano al 6%.", finto).length === 1, "una percentuale si controlla anche a una cifra sola");
  ok(cifreNonCitabili("Hai speso 100 su 100.", finto).length === 0, "una cifra dentro l'insieme passa");
  ok(cifreNonCitabili("un fondo imprevisti (37.000 euro)", finto)[0] === "37.000", "la cifra fuori insieme torna nella forma grezza, come si legge nel testo");
  ok(cifreNonCitabili("Hai speso 240.000 su 240000.", new Set(["240000"])).length === 0, "«240.000» e «240000» sono lo stesso numero");

  // ── 6. il caso reale della 04, come è uscito ─────────────────────────────
  // 15.000 lo ha scritto lui, 37.000 è l'avanzo del SUO piano: entrambi
  // citabili. Quello che la guardia non può vedere — e nessun insieme può — è
  // che il revisore li ha scambiati fra loro. Sta scritto qui perché non si
  // creda che questo test copra anche quello.
  ok(cifreNonCitabili("un fondo imprevisti di 15.000 euro", insieme).length === 0, "la cifra vera del fondo imprevisti resta citabile");

  console.log("\n═══════════════════════════════════════════\n");
  if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
  console.log("✓ L'insieme citabile contiene quello che lo studente poteva sapere, e non altro.\n");
}

main();
