// La misura sui testi raccolti — il PRODOTTO del robot, non «tutto verde».
//
// Alla fine di una passata ci sono ~125 testi scritti dai revisori: quattro
// revisioni e un feedback finale per ruolo. Su quei testi passano i pattern che
// abbiamo già, e che hanno la risposta giusta nota — l'unico tipo di giudizio
// automatico di cui ci fidiamo.
//
// COSA NON FA, e non è una dimenticanza: non dice se una revisione è BUONA.
// Quello si legge. Un modello che valuta un modello condivide i suoi angoli
// ciechi, e ne abbiamo la prova: due revisori diversi hanno elogiato lo stesso
// paragrafo pericoloso.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..", "..", "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
if (!require.extensions[".ts"]) {
  require.extensions[".ts"] = function (mod, filename) {
    const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
      fileName: filename,
    });
    return mod._compile(out.outputText, filename);
  };
}

const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const { trovaRegistro } = require("@/lib/lingua/registroStudente");
const { stringheInJson } = require("@/lib/lingua/scansione");
const { verificaAtteso } = require("./atteso");

// Una cattura senza la frase intorno non si rilegge: `dove` dice in quale
// campo sta, non cosa c'era scritto. E qui serve più che altrove, perché i
// pattern sono LARGHI di proposito — per il tripwire un falso positivo è una
// voce di whitelist, per la guardia una chiamata in più, ma la misura non ha
// un umano dentro il ciclo: pubblica un numero. Il primo giro vero, il 31
// agosto 2026, ha dato 4 catture e 4 falsi positivi («quel signore ci entra da
// solo», «Tonino da solo», «il defibrillatore parla da solo», «hai capito»
// dentro un complimento): il tasso pubblicato diceva 33% dove il vero era 0.
const CONTORNO = 120;

function conContesto(testo, cattura) {
  const i = String(testo).toLowerCase().indexOf(String(cattura).toLowerCase());
  if (i < 0) return String(cattura);
  const da = Math.max(0, i - CONTORNO);
  const a = Math.min(testo.length, i + cattura.length + CONTORNO);
  return `${da > 0 ? "…" : ""}${testo.slice(da, i)}»${testo.slice(i, i + cattura.length)}«${testo.slice(i + cattura.length, a)}${a < testo.length ? "…" : ""}`;
}

// La classe più affidabile: il participio con ESSERE / il riflessivo in seconda
// persona, che falsi positivi non ne fa. `da sol[oa]` invece resta sempre una
// cattura DA GUARDARE — la sua percentuale di verità la dice una persona.
const CERTA = /\b(?:sei|ti sei|se ti sei|quando sei|non sei)\b/;
const certa = (cattura) => CERTA.test(String(cattura).toLowerCase());

// Ogni testo con la sua provenienza, così una cattura si può andare a rileggere
// invece di restare un numero.
function raccogliTesti(esiti) {
  const testi = [];
  for (const e of esiti) {
    for (const t of e.tappe) {
      if (t.revisione) testi.push({ dove: `${e.etichetta} / ${t.faseId} / revisione`, valore: t.revisione });
      if (t.reazione) testi.push({ dove: `${e.etichetta} / ${t.faseId} / reazione del cliente`, valore: t.reazione });
    }
    if (e.feedbackFinale) testi.push({ dove: `${e.etichetta} / feedback finale`, valore: e.feedbackFinale });
  }
  return testi;
}

function misura(esiti) {
  const testi = raccogliTesti(esiti);

  const accordi = [];
  const registro = [];
  for (const t of testi) {
    // Si scende alle singole stringhe invece di passare l'oggetto intero, così
    // la frase intorno alla cattura è quella vera e non un JSON appiattito.
    for (const s of stringheInJson(t.valore)) {
      for (const c of trovaAccordi(s)) accordi.push({ dove: t.dove, cattura: c, contesto: conContesto(s, c), certa: certa(c) });
      for (const c of trovaRegistro(s)) registro.push({ dove: t.dove, cattura: c, contesto: conContesto(s, c) });
    }
  }

  // Gli esiti dei revisori, contati per come li marca il motore.
  const esitiRevisione = {};
  let tentativiTotali = 0;
  let tappeConTentativiExtra = 0;
  for (const e of esiti) {
    for (const t of e.tappe) {
      if (t.giaFatta) continue;
      const k = t.esitoRevisione ?? "sconosciuto";
      esitiRevisione[k] = (esitiRevisione[k] ?? 0) + 1;
      tentativiTotali += t.tentativi || 0;
      if ((t.tentativi || 0) > 1) tappeConTentativiExtra++;
    }
  }

  // La fiducia per ruolo: un ruolo che dà sempre il minimo o sempre il massimo
  // ha un problema di rubrica, non di studente.
  const fiducia = esiti
    .filter((e) => e.fiduciaFinale !== null && e.fiduciaFinale !== undefined)
    .map((e) => ({ etichetta: e.etichetta, valore: e.fiduciaFinale }))
    .sort((a, b) => a.valore - b.valore);

  const fermati = esiti.filter((e) => e.fermato).map((e) => ({ etichetta: e.etichetta, ...e.fermato }));

  // Le trappole: confronto letterale sul testo della revisione, mai un modello
  // che giudica un modello.
  const trappole = esiti
    .filter((e) => e.atteso)
    .map((e) => ({ etichetta: e.etichetta, nome: e.nome ?? null, ...verificaAtteso(e.atteso, e) }));

  // Per GENERE DI TESTO, non solo in totale: la prima passata ha mostrato che
  // il feedback finale è cinque volte più esposto delle revisioni e che la
  // reazione del cliente non sbaglia mai. Quel numero dice DOVE si lavora — un
  // prompt invece di quattro — e a mano non lo rifà nessuno.
  const generi = ["revisione", "reazione del cliente", "feedback finale"];
  const genereDi = (dove) => generi.find((g) => String(dove).endsWith(g)) ?? "altro";
  const perGenere = {};
  for (const g of generi) perGenere[g] = { testi: 0, accordi: 0, certe: 0, registro: 0 };
  for (const t of testi) {
    const g = genereDi(t.dove);
    if (perGenere[g]) perGenere[g].testi++;
  }
  for (const a of accordi) {
    const g = genereDi(a.dove);
    if (perGenere[g]) { perGenere[g].accordi++; if (a.certa) perGenere[g].certe++; }
  }
  for (const r of registro) {
    const g = genereDi(r.dove);
    if (perGenere[g]) perGenere[g].registro++;
  }

  // Quanti TESTI hanno almeno una cattura, non quante catture: è il numero che
  // dice quante volte la guardia ha chiesto una seconda risposta E la seconda
  // era ancora sporca. Ogni riga qui è una chiamata a pagamento spesa per
  // niente, e sul registro la prima passata ne ha contate tante.
  const testiConAccordo = new Set(accordi.map((a) => a.dove)).size;
  const testiConRegistro = new Set(registro.map((r) => r.dove)).size;

  return {
    testi: testi.length,
    accordi,
    registro,
    testiConAccordo,
    testiConRegistro,
    perGenere,
    esitiRevisione,
    tentativiTotali,
    tappeConTentativiExtra,
    fiducia,
    fermati,
    trappole,
  };
}

function percentuale(parte, tutto) {
  return tutto === 0 ? "—" : `${((parte / tutto) * 100).toFixed(1)}%`;
}

function stampaRapporto(m, righe = console.log) {
  const di = (t = "") => righe(t);

  di("\n═══════════ LA MISURA ═══════════\n");

  if (m.trappole && m.trappole.length > 0) {
    di("TRAPPOLE");
    for (const t of m.trappole) {
      const esito = t.colta === true ? "✓ COLTA" : t.colta === false ? "✗ NON COLTA" : "— nessun verdetto";
      di(`  ${esito}  ${t.nome ?? t.etichetta}  (tappa «${t.tappa}»${Number.isFinite(t.punteggio) ? `, ${t.punteggio} punti` : ""})`);
      if (t.motivo) di(`      ${t.motivo}`);
      for (const c of t.controlli ?? []) di(`      ${c.ok ? "✓" : "✗"} ${c.ok ? c.descrizione : c.spiegazione}`);
    }
    di("");
    di("  Confronto letterale sul testo della revisione, mai un modello che giudica");
    di("  un altro modello. Una trappola NON colta è il risultato più utile che");
    di("  questo banco possa dare: vuol dire che il revisore ha lasciato passare");
    di("  esattamente la cosa che gli avevamo chiesto di non lasciar passare.");
    di("");
  }

  if (m.fermati.length > 0) {
    di(`FERMATI: ${m.fermati.length}`);
    di("  Un gate che morde è un risultato, non un ostacolo. Questi vanno letti per primi.\n");
    for (const f of m.fermati) {
      di(`  · ${f.etichetta} — a «${f.dove}»`);
      di(`      ${f.perche}`);
      if (f.gate) di(`      (è un gate del prodotto che ha rifiutato la consegna: guardalo prima di cambiare il file)`);
    }
    di("");
  }

  di(`TESTI RACCOLTI: ${m.testi}`);
  di("  Revisioni di tappa, reazioni del cliente e feedback finali. Sono i testi che");
  di("  uno studente avrebbe letto: su questi passano i pattern, non su un campione.\n");

  const certe = m.accordi.filter((a) => a.certa).length;
  di(`LINGUA INVARIANTE — ${m.accordi.length} catture da leggere su ${m.testi} testi`);
  if (m.accordi.length === 0) {
    di("  Nessuna. I pattern non hanno trovato niente da guardare.");
  } else {
    di("  NON sono ancora un tasso di esposizione: i pattern sono larghi apposta e");
    di("  una parte di queste sarà legittima («il defibrillatore parla da solo» non");
    di("  è rivolto a chi legge). Quante lo siano davvero lo dice chi le legge.");
    di(`  Di queste, ${certe} sono della classe che falsi positivi non ne fa (il`);
    di("  participio con «essere» in seconda persona): quelle contano comunque.");
    di("");
    for (const a of m.accordi.slice(0, 12)) di(`  · ${a.dove}${a.certa ? "   [certa]" : ""}\n      ${a.contesto}`);
    if (m.accordi.length > 12) di(`  … e altre ${m.accordi.length - 12}, tutte nel rapporto su file.`);
  }
  di("");

  di("DOVE SI CONCENTRANO (per genere di testo)");
  di("  Serve a sapere quale prompt toccare: non tutti sbagliano allo stesso modo.");
  for (const [g, v] of Object.entries(m.perGenere)) {
    if (v.testi === 0) continue;
    di(`  ${g.padEnd(22)} ${String(v.testi).padStart(3)} testi   lingua ${v.accordi} (${v.certe} certe, ${percentuale(v.certe, v.testi)})   registro ${v.registro}`);
  }
  di("");

  di(`REGISTRO — ${m.registro.length} catture da leggere`);
  if (m.registro.length === 0) di("  Nessuna parola-verdetto e nessuna terza persona.");
  else {
    di("  Stessa avvertenza: «hai capito» dentro un complimento non è un verdetto.");
    di("");
    for (const r of m.registro.slice(0, 12)) di(`  · ${r.dove}\n      ${r.contesto}`);
    if (m.registro.length > 12) di(`  … e altre ${m.registro.length - 12}, tutte nel rapporto su file.`);
  }
  di("");

  di("QUANTO CI È COSTATO");
  di(`  Testi con almeno una cattura — lingua: ${m.testiConAccordo}, registro: ${m.testiConRegistro} (su ${m.testi}).`);
  di("  Ognuno di questi è una SECONDA chiamata che la guardia ha chiesto e che");
  di("  non è servita: il testo è arrivato allo studente comunque sporco. Se il");
  di("  numero del registro è alto, la regola nel prompt non sta prendendo —");
  di("  chiederla meglio costa una chiamata a testo e non la risolve.");
  di("");

  di("REVISORI:");
  const totRev = Object.values(m.esitiRevisione).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(m.esitiRevisione).sort((a, b) => b[1] - a[1])) {
    di(`  ${String(k).padEnd(18)} ${v}  (${percentuale(v, totRev)})`);
  }
  di(`  Tappe che hanno avuto bisogno di più di un giro: ${m.tappeConTentativiExtra}`);
  if (m.tappeConTentativiExtra > 0) {
    di("  Ogni giro in più è un giorno di attesa in produzione. Il motivo sta nei log:");
    di("      npm run banco log 240");
  }
  di("");

  if (m.fiducia.length > 0) {
    di("FIDUCIA PER RUOLO (dal più basso):");
    for (const f of m.fiducia) di(`  ${String(f.valore).padStart(3)}/100  ${f.etichetta}`);
    const min = m.fiducia[0].valore;
    const max = m.fiducia[m.fiducia.length - 1].valore;
    di(`  Estremi: ${min} — ${max}.`);
    if (max - min < 10) {
      di("  ⚠  Una forbice così stretta su ruoli diversi non è un merito: vuol dire che");
      di("     il punteggio non sta distinguendo niente. Va guardata la rubrica.");
    }
  }

  di("\n═════════════════════════════════\n");
  di("Cosa NON c'è qui, apposta: se una revisione sia BUONA. Quello si legge.");
  di("Un modello che valuta un modello condivide i suoi angoli ciechi — e ne");
  di("abbiamo la prova: due revisori diversi hanno elogiato lo stesso paragrafo");
  di("pericoloso, quello del protocollo senza defibrillatore.\n");
}

module.exports = { misura, stampaRapporto, raccogliTesti };
