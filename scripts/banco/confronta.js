// `npm run banco confronta <rapporto-a> <rapporto-b>` — due passate a confronto.
//
// PERCHÉ ESISTE. Il risultato più importante della seconda passata — che il
// 23% dei confronti fra due ruoli si INVERTE fra una passata e l'altra, a
// fixture identico — è stato calcolato a mano, con uno script buttato via, su
// due file JSON. Il banco sapeva misurare una passata e non sapeva
// confrontarne due, ed è successo che il confronto valesse più di entrambe le
// misure singole.
//
// LE TRE COSE CHE DICE, che sono esattamente quelle che sono servite:
//   1. la STABILITÀ del punteggio — scarto per ruolo e per tappa, e soprattutto
//      quante coppie di ruoli si invertono. Se un punteggio non riproduce se
//      stesso su un testo che non è cambiato, non può dire a uno studente com'è
//      andata rispetto a un altro;
//   2. LINGUA e REGISTRO per genere di testo, affiancati: è come si vede se una
//      correzione ha preso, e su quale prompt;
//   3. COSA È CAMBIATO IN MEZZO — il commit di ciascuna passata. Senza il terzo
//      punto gli altri due invecchiano in una settimana: fra due mesi si
//      guardano due rapporti e nessuno si ricorda cosa c'era in mezzo.
//
// Sola lettura, e non tocca la rete: legge due file.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
// La stessa funzione che usa la misura, non una seconda copia: due definizioni
// di «ripresa» divergono al primo che ne tocca una. Sta in un file suo e non
// dentro `misura.js` apposta — quel modulo tira dentro il transpilatore
// TypeScript per leggere il prodotto, e il confronto non deve dipenderne.
const { riprese, descriviRipresa } = require("./riprese");
// Stessa ragione: una seconda definizione di «livello» divergerebbe dalla
// prima, e questo è il comando in cui la differenza fa più danno.
const { livelli, descriviLivello } = require("./livelli");

// ── le quantità, pure: si provano senza file (npm run test:confronto) ───────

// Il punteggio finale per ruolo, e quello per tappa. Chiave = etichetta del
// ruolo; per le tappe, `ruolo / faseId`.
function punteggi(rapporto) {
  const ruoli = new Map();
  const tappe = new Map();
  for (const e of rapporto.esiti ?? []) {
    if (typeof e.fiduciaFinale === "number") ruoli.set(e.etichetta, e.fiduciaFinale);
    for (const t of e.tappe ?? []) {
      const p = t.revisione?.punteggio_fiducia;
      if (typeof p === "number") tappe.set(`${e.etichetta} / ${t.faseId}`, p);
    }
  }
  return { ruoli, tappe };
}

function scarti(a, b) {
  const comuni = [...a.keys()].filter((k) => b.has(k));
  const delta = comuni.map((k) => ({ chiave: k, a: a.get(k), b: b.get(k), d: b.get(k) - a.get(k) }));
  const assoluti = delta.map((x) => Math.abs(x.d));
  return {
    coppie: comuni.length,
    // Quanti restano fuori dal confronto. `coppie` da solo dice cosa si è
    // guardato, non cosa manca — e un numero che tace su ciò che non ha visto
    // si legge come se avesse visto tutto.
    soloA: [...a.keys()].filter((k) => !b.has(k)).length,
    soloB: [...b.keys()].filter((k) => !a.has(k)).length,
    medio: assoluti.length ? assoluti.reduce((s, x) => s + x, 0) / assoluti.length : 0,
    massimo: assoluti.length ? Math.max(...assoluti) : 0,
    almeno3: assoluti.filter((x) => x >= 3).length,
    almeno5: assoluti.filter((x) => x >= 5).length,
    delta: [...delta].sort((x, y) => Math.abs(y.d) - Math.abs(x.d)),
  };
}

// LA MISURA CHE CONTA: quante coppie di ruoli si scambiano di posto. Un
// punteggio serve a dire «questo più di quello»; se l'ordine cambia da solo,
// quella frase non la può dire. I pari non si contano come inversioni: due
// ruoli a pari merito che restano vicini non hanno cambiato niente.
function inversioni(a, b) {
  const chiavi = [...a.keys()].filter((k) => b.has(k));
  let confronti = 0;
  let invertite = 0;
  const esempi = [];
  for (let i = 0; i < chiavi.length; i++) {
    for (let j = i + 1; j < chiavi.length; j++) {
      const x = chiavi[i];
      const y = chiavi[j];
      const primaX = Math.sign(a.get(x) - a.get(y));
      const dopoX = Math.sign(b.get(x) - b.get(y));
      confronti++;
      if (primaX !== dopoX && (primaX !== 0 || dopoX !== 0)) {
        invertite++;
        if (esempi.length < 6) esempi.push({ x, y, prima: [a.get(x), a.get(y)], dopo: [b.get(x), b.get(y)] });
      }
    }
  }
  return { confronti, invertite, tasso: confronti ? invertite / confronti : 0, esempi };
}

// La tabella per genere di testo, con due colonne invece di una.
function affiancaGeneri(a, b) {
  const generi = new Set([...Object.keys(a.misura?.perGenere ?? {}), ...Object.keys(b.misura?.perGenere ?? {})]);
  const righe = [];
  for (const g of generi) {
    const va = a.misura?.perGenere?.[g];
    const vb = b.misura?.perGenere?.[g];
    if (!va && !vb) continue;
    righe.push({ genere: g, a: va ?? { testi: 0, accordi: 0, certe: 0, registro: 0 }, b: vb ?? { testi: 0, accordi: 0, certe: 0, registro: 0 } });
  }
  return righe;
}

// ── il contorno: cosa c'era in mezzo ────────────────────────────────────────
// Il rapporto porta con sé il commit su cui girava. I rapporti vecchi non ce
// l'hanno, e si dice invece di inventarlo.
function cheCosaCera(rapporto, percorso) {
  if (rapporto.commit) return rapporto.commit;
  return `sconosciuto (rapporto scritto prima che il banco lo registrasse — ${path.basename(percorso)})`;
}

// LE DUE PASSATE ERANO PULITE? È la domanda che viene PRIMA dei numeri, e per
// mesi non se la faceva nessuno. Una passata ripresa gioca meno di quello che
// dice: una tappa trovata già revisionata non porta i suoi testi in questo
// rapporto, e una trovata già consegnata porta una revisione scritta su un
// lavoro che ha salvato un'altra passata. Le due cose spostano i numeri che
// questo comando confronta — e senza questa riga si leggerebbero come un
// cambiamento del prodotto.
function pulizia(rapporto, nome) {
  const r = riprese(rapporto.esiti ?? []);
  return { nome, ...r };
}

// CON CHE COSA SONO STATE GIOCATE. È la domanda che viene prima ancora di
// quella sulla pulizia: due passate sullo stesso identico codice, una con le
// consegne buone e una con quelle deboli, DEVONO dare numeri diversi — e se
// nessuno dice qual era l'ingresso, quella differenza si legge come una
// modifica del prodotto. Puro: `npm run test:confronto` lo prova senza file.
function ingressiConfrontabili(a, b) {
  const la = livelli(a.esiti ?? []);
  const lb = livelli(b.esiti ?? []);
  const noti = la.noto && lb.noto && !la.misto && !lb.misto;
  return { a: la, b: lb, noti, diversi: noti && la.unico !== lb.unico };
}

function commitFra(a, b) {
  if (!a?.sha || !b?.sha || a.sha === b.sha) return null;
  try {
    const out = execSync(`git log --oneline ${a.sha}..${b.sha}`, { encoding: "utf8", cwd: path.join(__dirname, "..", "..") });
    return out.trim().split("\n").filter(Boolean);
  } catch {
    return null;
  }
}

// ── il comando ──────────────────────────────────────────────────────────────

const per = (x) => `${(x * 100).toFixed(1)}%`;

function confronta(fileA, fileB) {
  if (!fileA || !fileB) {
    console.log("\nServono due rapporti:\n  npm run banco confronta banco-robot-<prima>.json banco-robot-<dopo>.json\n");
    console.log("I rapporti li scrive `npm run banco robot` alla fine di ogni passata.\n");
    process.exit(1);
  }
  for (const f of [fileA, fileB]) {
    if (!fs.existsSync(f)) {
      console.error(`\n✗ Non trovo ${f}\n`);
      process.exit(1);
    }
  }
  const a = JSON.parse(fs.readFileSync(fileA, "utf8"));
  const b = JSON.parse(fs.readFileSync(fileB, "utf8"));

  const pa = punteggi(a);
  const pb = punteggi(b);
  const sRuoli = scarti(pa.ruoli, pb.ruoli);
  const sTappe = scarti(pa.tappe, pb.tappe);
  const inv = inversioni(pa.ruoli, pb.ruoli);

  console.log("\n═══════════ DUE PASSATE A CONFRONTO ═══════════\n");
  console.log(`  prima:  ${path.basename(fileA)}   ${cheCosaCera(a, fileA)?.sha ?? cheCosaCera(a, fileA)}`);
  console.log(`  dopo:   ${path.basename(fileB)}   ${cheCosaCera(b, fileB)?.sha ?? cheCosaCera(b, fileB)}`);
  const fra = commitFra(a.commit, b.commit);
  if (fra) {
    console.log(`\n  Cosa è cambiato in mezzo (${fra.length} commit):`);
    for (const riga of fra.slice(0, 12)) console.log(`    · ${riga}`);
    if (fra.length > 12) console.log(`    … e altri ${fra.length - 12}.`);
  } else {
    console.log("\n  Cosa è cambiato in mezzo: non ricostruibile (uno dei due rapporti non porta il commit).");
  }

  // L'INGRESSO, prima ancora della pulizia. Se le due passate hanno giocato
  // consegne di livello diverso, i numeri qui sotto non stanno confrontando il
  // prodotto: stanno confrontando due studenti diversi.
  const ing = ingressiConfrontabili(a, b);
  const dilivello = (l) => (l.misto ? `MISTO (${l.distinti.join(", ")})` : l.noto ? l.unico : "non dichiarato");
  console.log(`\n  Consegne giocate — prima: ${dilivello(ing.a)}   dopo: ${dilivello(ing.b)}`);
  if (ing.diversi) {
    console.log("\n─── ATTENZIONE: NON È UN CONFRONTO SUL PRODOTTO\n");
    console.log(`  La prima ha giocato consegne «${ing.a.unico}», la seconda «${ing.b.unico}».`);
    console.log(`    ${ing.a.unico}: ${descriviLivello(ing.a.unico)}`);
    console.log(`    ${ing.b.unico}: ${descriviLivello(ing.b.unico)}`);
    console.log("  I numeri qui sotto DEVONO venire diversi, e la differenza non dice niente");
    console.log("  su quanto è cambiato il codice: dice quanto erano diverse le due consegne.");
    console.log("  È l'unica lettura per cui questo accostamento serve — se cercavi un delta");
    console.log("  del prodotto, ti serve una passata dello stesso livello.");
  } else if (!ing.noti) {
    console.log("  Almeno una delle due non lo dichiara (o ha mescolato più livelli): il");
    console.log("  confronto si legge sapendo che l'ingresso potrebbe non essere lo stesso.");
  }

  // Poi la pulizia: se una delle due passate non è pulita, i
  // numeri qui sotto si leggono diversamente.
  const pulA = pulizia(a, "prima");
  const pulB = pulizia(b, "dopo");
  const sporche = [pulA, pulB].filter((p) => p.tappe.length > 0);
  const ignote = [pulA, pulB].filter((p) => !p.noto && p.tappeViste > 0);
  if (sporche.length > 0 || ignote.length > 0) {
    console.log("\n─── ATTENZIONE: NON SONO DUE PASSATE PULITE\n");
    for (const p of sporche) {
      console.log(`  ${p.nome}: ${p.tappe.length === 1 ? "1 tappa ripresa" : `${p.tappe.length} tappe riprese`} da una passata precedente`);
      for (const t of p.tappe) console.log(`    · ${t.etichetta} / ${t.faseId} — ${descriviRipresa(t)}`);
    }
    for (const p of ignote) {
      console.log(`  ${p.nome}: non si sa — scritta prima che il banco registrasse le riprese.`);
      console.log("    Non vuol dire pulita: vuol dire che non si può dire.");
    }
    console.log("");
    console.log("  Una tappa ripresa sposta i numeri qui sotto senza che il prodotto sia");
    console.log("  cambiato: se era già revisionata i suoi testi non sono in questo rapporto,");
    console.log("  se era già consegnata la revisione gira su un lavoro salvato altrove.");
  }

  console.log("\n─── STABILITÀ DEL PUNTEGGIO\n");
  console.log(`  per RUOLO   ${sRuoli.coppie} confrontabili   scarto medio ${sRuoli.medio.toFixed(2)} su 100   massimo ${sRuoli.massimo}`);
  if (sRuoli.soloA || sRuoli.soloB) {
    console.log(`              (fuori dal confronto: ${sRuoli.soloA} solo nella prima, ${sRuoli.soloB} solo nella seconda)`);
  }
  console.log(`              |Δ| ≥ 3: ${sRuoli.almeno3}   |Δ| ≥ 5: ${sRuoli.almeno5}`);
  console.log(`  per TAPPA   ${sTappe.coppie} confrontabili   scarto medio ${sTappe.medio.toFixed(2)} su 25   massimo ${sTappe.massimo}`);
  console.log("");
  console.log(`  INVERSIONI: ${inv.invertite} su ${inv.confronti} confronti fra due ruoli (${per(inv.tasso)})`);
  console.log("  È la misura che conta più della media: un punteggio serve a dire «questo");
  console.log("  più di quello», e ogni inversione è una volta in cui quella frase cambia");
  console.log("  da sola, sullo stesso identico testo.");
  for (const e of inv.esempi) {
    console.log(`    · ${e.x} (${e.prima[0]}→${e.dopo[0]})  vs  ${e.y} (${e.prima[1]}→${e.dopo[1]})`);
  }
  if (sRuoli.delta.length > 0) {
    console.log("\n  I ruoli che si sono mossi di più:");
    for (const d of sRuoli.delta.slice(0, 5)) console.log(`    ${d.d > 0 ? "+" : ""}${d.d}  ${d.chiave}  (${d.a} → ${d.b})`);
  }

  console.log("\n─── LINGUA E REGISTRO, PER GENERE DI TESTO\n");
  console.log("  genere                     testi        certe            registro");
  for (const r of affiancaGeneri(a, b)) {
    const certe = `${r.a.certe}/${r.a.testi} → ${r.b.certe}/${r.b.testi}`;
    const reg = `${r.a.registro} → ${r.b.registro}`;
    console.log(`  ${r.genere.padEnd(24)} ${String(r.a.testi).padStart(3)}→${String(r.b.testi).padEnd(4)} ${certe.padEnd(16)} ${reg}`);
  }
  console.log("\n  «certe» sono le sole forme accordate su cui non serve leggere (il");
  console.log("  participio con «essere» in seconda persona). Il registro invece è");
  console.log("  sempre da leggere: una parte è legittima.");

  console.log("\n═══════════════════════════════════════════════\n");
  console.log("Quello che questo confronto NON dice: se i testi sono migliorati.");
  console.log("Dice se i numeri si muovono e dove le catture calano. Se una revisione");
  console.log("è più utile di un'altra lo decide chi la legge.\n");
}

module.exports = { confronta, punteggi, scarti, inversioni, affiancaGeneri, pulizia, ingressiConfrontabili };
