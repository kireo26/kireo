// Verifica di `sezioneRaggiungeMinimo` — la regola che decide quando una
// tappa del workshop può essere consegnata.
//
// Esiste per una ragione sola, ed è il caso della checklist. In una lista di
// cose che uno METTE IN PIEDI («spunta ciò che prevedi»), pretendere almeno
// una spunta rende indicibile la risposta «nessuna di queste»: per andare
// avanti lo studente deve dichiarare di prevedere qualcosa che non prevede.
// Quella spunta finisce in `contenuto`, il revisore la legge come una sua
// dichiarazione, e col cross-feed nel profilo diventerebbe un'affermazione su
// di lui che nessuna sua scelta sostiene. È la regola di casa — il finale
// riporta, non afferma — rovesciata, un piano più a monte.
//
// La stessa funzione gira in due posti (il bottone «Consegna la tappa» nel
// browser e la route consegna-tappa sul contenuto autorevole del DB), quindi
// un cambio qui cambia il gate in tutti e due.
//
// Esecuzione: `npm run test:consegna`.

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
require.extensions[".ts"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { sezioneRaggiungeMinimo, sezioniIncomplete } = require("@/lib/workshop/elaboratoValore");
const { WORKSHOP_ELABORATO } = require("@/lib/workshop/elaborato-config");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const CHECKLIST = { id: "sic", titolo: "La sicurezza", tipo: "checklist", voci: ["DAE in sala", "Un operatore BLSD per turno"] };

console.log("\n═══ Quando una tappa si può consegnare ═══\n");

// ── la checklist: «nessuna di queste» dev'essere dicibile ──────────────────
ok(sezioneRaggiungeMinimo(CHECKLIST, { voci: {}, nota: "" }) === false, "checklist vuota, senza nota: non basta (resta distinguibile da «non compilata»)");
ok(sezioneRaggiungeMinimo(CHECKLIST, { voci: { "DAE in sala": true }, nota: "" }) === true, "una spunta basta, come prima");
ok(
  sezioneRaggiungeMinimo(CHECKLIST, { voci: {}, nota: "Nessuna di queste: la palestra apre solo con Tonino presente, e lui il BLSD non ce l'ha ancora." }) === true,
  "zero spunte ma una nota che spiega: basta — è il caso per cui questo test esiste",
);
ok(sezioneRaggiungeMinimo(CHECKLIST, { voci: {}, nota: "   " }) === false, "una nota di soli spazi non è una risposta");
ok(sezioneRaggiungeMinimo(CHECKLIST, { voci: { "DAE in sala": false }, nota: "" }) === false, "una casella toccata e poi tolta non conta come spunta");
ok(sezioneRaggiungeMinimo(CHECKLIST, undefined) === false, "una sezione mai aperta non raggiunge il minimo");

// ── gli altri tipi non sono cambiati ──────────────────────────────────────
ok(sezioneRaggiungeMinimo({ id: "t", titolo: "T", tipo: "testo_lungo", minCaratteri: 20 }, "corto") === false, "testo sotto la soglia: no");
ok(sezioneRaggiungeMinimo({ id: "t", titolo: "T", tipo: "testo_lungo", minCaratteri: 20 }, "abbastanza lungo da passare") === true, "testo sopra la soglia: sì");
ok(sezioneRaggiungeMinimo({ id: "b", titolo: "B", tipo: "tabella", colonne: ["a"], minRighe: 2 }, [["x"]]) === false, "tabella sotto le righe minime: no");
ok(sezioneRaggiungeMinimo({ id: "s", titolo: "S", tipo: "scelta", opzioni: ["a", "b"] }, { opzione: "", motivazione: "boh" }) === false, "scelta senza opzione: no, anche con la motivazione scritta");
ok(sezioneRaggiungeMinimo({ id: "i", titolo: "I", tipo: "immagine", opzionale: true }, undefined) === true, "una sezione facoltativa non blocca mai");

// ── il gate vero, su una tappa reale del config ────────────────────────────
// La tappa 3 di palestra/salute è quella su cui il caso è stato trovato.
const tappa = WORKSHOP_ELABORATO["palestra-popolare"]?.salute?.fasi?.find((f) => f.id === "sicurezza");
ok(Boolean(tappa), "la tappa «sicurezza» di palestra/salute esiste nel config");
if (tappa) {
  const checklistNelConfig = tappa.sezioni.filter((s) => s.tipo === "checklist");
  ok(checklistNelConfig.length > 0, "quella tappa ha davvero una sezione checklist");

  // Contenuto minimo per tutte le sezioni TRANNE le checklist, che restano a
  // zero spunte con una nota: la tappa deve poter partire lo stesso.
  const contenuto = {};
  for (const s of tappa.sezioni) {
    if (s.tipo === "checklist") contenuto[s.id] = { voci: {}, nota: "Nessuna di queste, e ti spiego perché." };
    else if (s.tipo === "tabella") contenuto[s.id] = Array.from({ length: Math.max(1, s.minRighe ?? 1) }, () => (s.colonne ?? ["a"]).map(() => "x"));
    else if (s.tipo === "scelta") contenuto[s.id] = { opzione: (s.opzioni ?? ["a"])[0], motivazione: "perché sì" };
    else if (s.tipo === "immagine") contenuto[s.id] = "percorso/finto.png";
    else contenuto[s.id] = "x".repeat(Math.max(1, s.minCaratteri ?? 1));
  }
  ok(sezioniIncomplete(tappa, contenuto).length === 0, "la tappa si consegna con le checklist a zero spunte, se la nota c'è");

  for (const s of checklistNelConfig) contenuto[s.id] = { voci: {}, nota: "" };
  ok(sezioniIncomplete(tappa, contenuto).length === checklistNelConfig.length, "senza spunte e senza nota, la tappa resta ferma su quelle sezioni");
}

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ «Nessuna di queste» è una risposta dicibile.\n");
