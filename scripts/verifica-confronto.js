// Le quantità del confronto fra due passate, provate senza file.
//
// PERCHÉ ESISTONO. Il risultato più importante della seconda passata — che il
// 23% dei confronti fra due ruoli si inverte a fixture identico — era stato
// calcolato a mano, con uno script buttato via. Un numero che si calcola a
// mano una volta non si ricalcola: e queste sono le quantità su cui poi si
// decide se una rubrica funziona.
//
// L'INVERSIONE È QUELLA CHE CONTA, e ha un caso al bordo che la media non ha:
// due ruoli a pari merito. Se restano pari non è successo niente; se uno
// supera l'altro, la frase «questo più di quello» è nata dal nulla. Va scelto,
// non lasciato al caso.
//
// Esecuzione: `npm run test:confronto`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { punteggi, scarti, inversioni, affiancaGeneri } = require("./banco/confronta");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

console.log("\n═══ Due passate a confronto ═══\n");

const rapporto = (righe) => ({
  esiti: righe.map(([etichetta, fiduciaFinale, tappe = []]) => ({
    etichetta,
    fiduciaFinale,
    tappe: tappe.map(([faseId, p]) => ({ faseId, revisione: { punteggio_fiducia: p } })),
  })),
});

// ── i punteggi si estraggono da dove stanno davvero ────────────────────────
const a = rapporto([
  ["w > uno", 69, [["t1", 18], ["t2", 17]]],
  ["w > due", 69, [["t1", 16]]],
  ["w > tre", 60],
]);
const b = rapporto([
  ["w > uno", 74, [["t1", 18], ["t2", 19]]],
  ["w > due", 64, [["t1", 15]]],
  ["w > tre", 60],
]);
const pa = punteggi(a);
const pb = punteggi(b);
ok(pa.ruoli.size === 3 && pa.tappe.size === 3, "legge i punteggi per ruolo e per tappa, dove il rapporto li mette");
ok(pa.tappe.get("w > uno / t2") === 17, "…e la tappa la indicizza con il ruolo davanti, così due ruoli non si confondono");

// ── gli scarti ─────────────────────────────────────────────────────────────
const sr = scarti(pa.ruoli, pb.ruoli);
ok(sr.coppie === 3, "confronta solo i ruoli presenti in tutte e due le passate");
ok(Math.abs(sr.medio - 10 / 3) < 0.001, `scarto medio ${sr.medio.toFixed(2)}: (5 + 5 + 0) / 3`);
ok(sr.massimo === 5 && sr.almeno3 === 2 && sr.almeno5 === 2, "massimo e soglie contati sul valore assoluto: un −5 si muove come un +5");
ok(sr.delta[0].chiave.startsWith("w > "), "i ruoli che si sono mossi di più vengono per primi");

// Un ruolo che c'è solo in una passata non inventa un confronto.
const soloDopo = rapporto([["w > uno", 70], ["w > quattro", 50]]);
ok(scarti(punteggi(a).ruoli, punteggi(soloDopo).ruoli).coppie === 1, "un ruolo giocato in una sola passata resta fuori dai conti");

// ── LE INVERSIONI ──────────────────────────────────────────────────────────
// Prima: uno 69, due 69, tre 60. Dopo: uno 74, due 64, tre 60.
// Le tre coppie: (uno,due) era pari e ora non lo è → inversione.
//                (uno,tre) 69>60 e 74>60 → invariata.
//                (due,tre) 69>60 e 64>60 → invariata.
const inv = inversioni(pa.ruoli, pb.ruoli);
ok(inv.confronti === 3, "conta ogni coppia una volta sola, non due");
ok(inv.invertite === 1, "un pari merito che si rompe È un'inversione: la frase «questo più di quello» è nata dal nulla");
ok(Math.abs(inv.tasso - 1 / 3) < 0.001, "il tasso è sulle coppie, non sui ruoli");
ok(inv.esempi[0].x === "w > uno" && inv.esempi[0].prima[0] === 69, "e l'esempio porta i quattro numeri, così si va a rileggere");

// Due pari che restano pari NON sono un'inversione: non è cambiato niente.
const pari1 = punteggi(rapporto([["x", 50], ["y", 50]])).ruoli;
const pari2 = punteggi(rapporto([["x", 60], ["y", 60]])).ruoli;
ok(inversioni(pari1, pari2).invertite === 0, "due ruoli che restano a pari merito non contano come inversione");

// Un ordine identico non produce inversioni, per quanto i numeri si muovano.
const su1 = punteggi(rapporto([["x", 10], ["y", 20], ["z", 30]])).ruoli;
const su2 = punteggi(rapporto([["x", 40], ["y", 50], ["z", 60]])).ruoli;
ok(inversioni(su1, su2).invertite === 0, "se tutti salgono dello stesso, l'ordine regge e non c'è nessuna inversione");

// Uno scambio secco fra due soli ruoli è il 100% dell'unica coppia.
const gi1 = punteggi(rapporto([["x", 70], ["y", 60]])).ruoli;
const gi2 = punteggi(rapporto([["x", 60], ["y", 70]])).ruoli;
ok(inversioni(gi1, gi2).invertite === 1 && inversioni(gi1, gi2).tasso === 1, "uno scambio secco è un'inversione su una coppia");

// ── la tabella affiancata ──────────────────────────────────────────────────
const ga = { misura: { perGenere: { revisione: { testi: 96, accordi: 20, certe: 4, registro: 63 }, "feedback finale": { testi: 24, accordi: 8, certe: 5, registro: 34 } } } };
const gb = { misura: { perGenere: { revisione: { testi: 92, accordi: 18, certe: 4, registro: 55 }, "feedback finale": { testi: 23, accordi: 4, certe: 2, registro: 19 } } } };
const righe = affiancaGeneri(ga, gb);
ok(righe.length === 2, "affianca i generi presenti in una qualunque delle due passate");
const fin = righe.find((r) => r.genere === "feedback finale");
ok(fin.a.certe === 5 && fin.b.certe === 2, "e tiene i due valori distinti: è così che si vede se una correzione ha preso");

// Un genere che compare solo in una passata non fa saltare la tabella.
const solo = affiancaGeneri(ga, { misura: { perGenere: { revisione: { testi: 1, accordi: 0, certe: 0, registro: 0 } } } });
ok(solo.length === 2 && solo.find((r) => r.genere === "feedback finale").b.testi === 0, "un genere assente da una passata vale zero, non fa saltare la riga");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Le due passate si confrontano, e l'inversione sa cosa fare di un pari merito.\n");
