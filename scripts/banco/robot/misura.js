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

const { trovaAccordiInJson } = require("@/lib/lingua/accordoGenere");
const { trovaRegistroInJson } = require("@/lib/lingua/registroStudente");

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
    for (const c of trovaAccordiInJson(t.valore)) accordi.push({ dove: t.dove, cattura: c });
    for (const c of trovaRegistroInJson(t.valore)) registro.push({ dove: t.dove, cattura: c });
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

  return { testi: testi.length, accordi, registro, esitiRevisione, tentativiTotali, tappeConTentativiExtra, fiducia, fermati };
}

function percentuale(parte, tutto) {
  return tutto === 0 ? "—" : `${((parte / tutto) * 100).toFixed(1)}%`;
}

function stampaRapporto(m, righe = console.log) {
  const di = (t = "") => righe(t);

  di("\n═══════════ LA MISURA ═══════════\n");

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

  di(`LINGUA INVARIANTE: ${m.accordi.length} catture su ${m.testi} testi (${percentuale(m.accordi.length, m.testi)})`);
  if (m.accordi.length === 0) {
    di("  Nessuna forma accordata al genere di chi legge. È il numero vero che");
    di("  sostituisce la stima dell'~8% fatta su una consegna-fixture sola.");
  } else {
    for (const a of m.accordi.slice(0, 12)) di(`  · ${a.dove}\n      «${a.cattura}»`);
    if (m.accordi.length > 12) di(`  … e altre ${m.accordi.length - 12}.`);
    di("  Sono forme SFUGGITE ALLA GUARDIA: la guardia rilegge e richiede una sola");
    di("  volta, quindi queste sono l'esposizione residua, non il lavoro fatto.");
  }
  di("");

  di(`REGISTRO: ${m.registro.length} catture (${percentuale(m.registro.length, m.testi)})`);
  if (m.registro.length === 0) di("  Nessuna parola-verdetto e nessuna terza persona.");
  else for (const r of m.registro.slice(0, 12)) di(`  · ${r.dove}\n      «${r.cattura}»`);
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
