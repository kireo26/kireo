// KIREO Escape — CENSIMENTO DEL MOTORE (mappature azione→area + rete di regressione).
//
// Perché esiste: verificare a mano le mappature azione→area di 12 missioni (più i
// tag dei materiali) è undici volte il lavoro fatto per la 03, e a mano qualcosa
// sfugge sempre — soprattutto le mappature MANCANTI. Questo script produce, in un
// minuto, la mappa completa + una lista corta di casi dubbi da rivedere a mano.
//
// Quattro uscite:
//   1) Pass A (statico, dal config): OGNI elemento area-taggato di OGNI missione,
//      per ogni mandato (così i contenuti gated si sbloccano). Garantisce la
//      completezza — nessuna mappatura sfugge.
//   2) Caso inverso: quali delle 18 aree NON ricevono mai un tag in nessuna delle
//      12 missioni (potenzialmente il ritrovamento più grosso: un'area mai
//      raggiungibile = uno studente portato per essa che non riceve mai un segnale).
//   3) Pass B (dinamico, sei giocatori sintetici): calcolaEvidenze(mission, risposte,
//      null) — AI off, deterministico. Quattro con ATTESA DICHIARATA → PASS/FAIL:
//      il censimento è anche la rete di regressione (chi rimette mandato.aree[0]
//      fa fallire il test, non lo scopre uno studente). Due per sola copertura.
//   4) Casi dubbi: un euristico di lessico (SEMINATO da data/aree.ts, poi ritoccato)
//      confronta l'etichetta che vede lo studente con l'area taggata; i sospetti
//      finiscono in CSV + Markdown, un documento da rivedere voce per voce. È un
//      TRIAGE, non un giudice: falsi positivi/negativi attesi, la mappa completa è
//      sempre a fianco.
//
// Esecuzione: `node scripts/censimento-motore.js` (oppure `npm run censimento`).
// Output: cartella `censimento-output/` (gitignorata) con censimento.json,
// casi-dubbi.csv, casi-dubbi.md. Exit 1 se un'asserzione di regressione FALLISCE.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità, non parte del bundle Next */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..");

// require-hook: transpila i .ts al volo e risolve l'alias @/ (identico agli altri verifica-*).
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

const { MISSIONI, getMissione, stepDellaMissione } = require(path.join(ROOT, "lib/escape/config.ts"));
const { calcolaEvidenze } = require(path.join(ROOT, "lib/escape/scoring.ts"));
const { AREE, getAreaBySlug } = require(path.join(ROOT, "data/aree.ts"));

const nomeArea = (slug) => getAreaBySlug(slug)?.nome ?? slug;

// ─────────────────────────────────────────── util

const accessore = (obj) => (id) => obj[id];
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); // toglie i diacritici combinanti

function trovaStep(mission, tipo) {
  return stepDellaMissione(mission).find((s) => s.tipo === tipo);
}
function trovaStepId(mission, id) {
  return stepDellaMissione(mission).find((s) => s.id === id);
}

// ─────────────────────────── Pass A: risoluzione completa e walk dei tag

// Estrae, da uno step RISOLTO, le righe di tag: { mecc, id, label, aree }.
function tagDelloStep(s) {
  const righe = [];
  const push = (mecc, id, label, aree) => righe.push({ mecc, id, label, aree: aree || [] });
  switch (s.tipo) {
    case "esplora_libero": for (const m of s.materiali) push("materiale", m.id, m.titolo, m.aree); break;
    case "scelta_singola": for (const o of s.opzioni) push("mandato", o.id, o.label, o.aree); break;
    case "ordina_priorita": for (const e of s.elementi) push("priorita", e.id, e.label, e.aree); break;
    case "seleziona_informazioni": for (const d of s.dossier) push("dossier", d.id, d.titolo, d.aree); break;
    case "alloca_budget": for (const v of s.voci) push("budget_voce", v.id, v.label, v.aree); break;
    case "pianifica_lavori": for (const l of s.lavori) push("lavoro", l.id, l.label, l.aree); break;
    case "scarta_opzione": for (const o of s.opzioni) push("scarto", o.id, o.label, o.aree); break;
    case "assegna_ruoli": for (const r of s.ruoli) push("ruolo", r.id, r.label, r.area ? [r.area] : []); break;
    case "assegna_persone": for (const c of s.compiti) push("compito", c.id, c.label, c.area ? [c.area] : []); break;
    default: break; // previsione/decisione/riflessione/pianifica_passi: nessun tag d'area
  }
  return righe;
}

// Per una missione: risolve con OGNI mandato e tutti i materiali letti (sblocca il
// gated), unisce i tag. Ritorna righe { missione, mecc, elementoId, etichetta, area }.
function censisciMissione(slug) {
  const base = getMissione(slug);
  const stepMandato = trovaStepId(base, "s1_mandato");
  const mandati = stepMandato ? stepMandato.opzioni.map((o) => o.id) : [null];
  const liberiIds = (trovaStepId(base, "s1_materiali")?.materiali ?? []).map((m) => m.id);

  const seen = new Set(); // dedup per mecc|elementoId|area (stesso elemento su più mandati)
  const righe = [];
  const areeCandidate = base.areeCandidate || [];

  for (const mid of mandati) {
    // 1° passo: risolvi con mandato + liberi letti → ottieni i dossier della Stanza 2
    const get1 = accessore({ s1_materiali: { letti: liberiIds }, s1_mandato: { opzioneId: mid } });
    const m1 = getMissione(slug, get1);
    const dossierIds = (trovaStepId(m1, "s2_informazioni")?.dossier ?? []).map((d) => d.id);
    // 2° passo: tutti i materiali letti (liberi + dossier) → sblocca voci/lavori gated
    const get2 = accessore({ s1_materiali: { letti: liberiIds }, s2_informazioni: { selezionati: dossierIds }, s1_mandato: { opzioneId: mid } });
    const m2 = getMissione(slug, get2);

    for (const s of stepDellaMissione(m2)) {
      for (const t of tagDelloStep(s)) {
        for (const area of t.aree) {
          const chiave = `${t.mecc}|${t.id}|${area}`;
          if (seen.has(chiave)) continue;
          seen.add(chiave);
          righe.push({ missione: slug, mecc: t.mecc, elementoId: t.id, etichetta: t.label, area });
        }
      }
    }
  }
  return { righe, areeCandidate };
}

// ─────────────────────────── Pass B: sei giocatori sintetici

// Costruisce le risposte di un giocatore per una missione, secondo la strategia.
// Risolve prima con mandato+materiali, poi riempie ogni step dagli step risolti.
// `strategia`: nullo | completista | monomandato | contrario | essenziale | diversificato.
function costruisciGiocatore(slug, strategia) {
  const base = getMissione(slug);
  const stepMandatoBase = trovaStepId(base, "s1_mandato");
  const mandati = stepMandatoBase.opzioni; // [{id,label,aree}]
  const liberiIds = (trovaStepId(base, "s1_materiali")?.materiali ?? []).map((m) => m.id);

  // scelta del mandato + aree su cui il giocatore AGISCE (focus)
  let mandato = mandati[0];
  let focus = new Set(mandato.aree);
  if (strategia === "diversificato") { mandato = mandati[mandati.length - 1]; focus = new Set(mandato.aree); }
  if (strategia === "contrario") {
    // mandato di un'area A; il focus delle AZIONI è un'area B ≠ A (presa dai ruoli).
    mandato = mandati[0];
    const areeA = new Set(mandato.aree);
    // risolvi per leggere i ruoli e scegliere un'area B fuori da A
    const gTmp = accessore({ s1_materiali: { letti: liberiIds }, s1_mandato: { opzioneId: mandato.id } });
    const mTmp = getMissione(slug, gTmp);
    const ruoliStep = trovaStep(mTmp, "assegna_ruoli") || trovaStep(mTmp, "assegna_persone");
    const areeRuoli = ruoliStep ? (ruoliStep.ruoli ? ruoliStep.ruoli.map((r) => r.area) : ruoliStep.compiti.map((c) => c.area)) : [];
    const B = areeRuoli.find((a) => a && !areeA.has(a));
    focus = new Set(B ? [B] : areeRuoli.filter(Boolean).slice(0, 1));
  }

  // materiali letti: gli spenditori aprono tutto (sblocca il gated); nullo/essenziale niente
  const apriTutto = !(strategia === "nullo" || strategia === "essenziale");
  const get1 = accessore({ s1_materiali: { letti: apriTutto ? liberiIds : [] }, s1_mandato: { opzioneId: mandato.id } });
  const m1 = getMissione(slug, get1);
  const dossierTutti = (trovaStepId(m1, "s2_informazioni")?.dossier ?? []).map((d) => ({ id: d.id, aree: d.aree }));

  // per sbloccare le voci gated, gli spenditori concentrati (monomandato) leggono
  // comunque TUTTI i dossier ma poi allocano solo sul focus; i dossier selezionati
  // per la CURIOSITÀ li limitiamo al focus per non diluire (tranne completista).
  const dossierSelez =
    strategia === "nullo" || strategia === "essenziale" ? [] :
    strategia === "completista" || strategia === "diversificato" ? dossierTutti.map((d) => d.id) :
    dossierTutti.filter((d) => d.aree.some((a) => focus.has(a))).map((d) => d.id);
  // per il gated: assicura che i materiali che sbloccano le voci siano letti →
  // gli spenditori concentrati leggono comunque tutti i dossier per lo sblocco,
  // ma la curiosità la contiamo solo sui selezionati sopra. materialiLetti unisce
  // s1_materiali + s2_informazioni: quindi per lo sblocco mettiamo tutti i dossier
  // in un secondo accessore SOLO per risolvere le voci, ma le RISPOSTE salvano i selez.
  const lettiPerSblocco = apriTutto ? [...liberiIds, ...dossierTutti.map((d) => d.id)] : [];
  const getSblocco = accessore({ s1_materiali: { letti: lettiPerSblocco }, s1_mandato: { opzioneId: mandato.id } });
  const mission = getMissione(slug, getSblocco); // missione con voci/lavori gated risolti

  // ora riempiamo ogni step della missione risolta
  const risposte = new Map();
  const set = (id, payload) => { if (trovaStepId(mission, id)) risposte.set(id, payload); };
  const preferiti = (arr, getAree) => arr.filter((x) => (getAree(x) || []).some((a) => focus.has(a)));

  // s1_materiali (risposta effettiva salvata)
  set("s1_materiali", { letti: apriTutto ? liberiIds : [] });

  // s1_priorita: ordina mettendo davanti gli elementi del focus
  const pr = trovaStepId(mission, "s1_priorita");
  if (pr) {
    const focusFirst = [...pr.elementi].sort((a, b) => {
      const fa = (a.aree || []).some((x) => focus.has(x)) ? 0 : 1;
      const fb = (b.aree || []).some((x) => focus.has(x)) ? 0 : 1;
      return fa - fb;
    });
    const ordine = strategia === "nullo" || strategia === "essenziale" ? pr.elementi.map((e) => e.id) : focusFirst.map((e) => e.id);
    set("s1_priorita", { ordine });
  }

  // s1_mandato
  set("s1_mandato", { opzioneId: mandato.id });

  // s2_informazioni
  set("s2_informazioni", { selezionati: dossierSelez });
  set("s2_non_approfondire", { testo: "" });

  // s3_budget: alloca o pianifica_lavori
  const budget = trovaStepId(mission, "s3_budget");
  if (budget) {
    if (budget.tipo === "alloca_budget") {
      const allocazioni = {};
      if (strategia === "nullo") { /* niente */ }
      else if (strategia === "completista" || strategia === "diversificato") {
        const quota = Math.max(budget.passo, Math.floor(budget.totale / Math.max(1, budget.voci.length) / budget.passo) * budget.passo);
        for (const v of budget.voci) allocazioni[v.id] = quota;
      } else if (strategia === "essenziale") {
        if (budget.voci[0]) allocazioni[budget.voci[0].id] = budget.passo;
      } else { // monomandato / contrario: tutto sulle voci del focus
        const vf = preferiti(budget.voci, (v) => v.aree);
        const target = vf.length ? vf : budget.voci.slice(0, 1);
        const quota = Math.max(budget.passo, Math.floor(budget.totale / Math.max(1, target.length) / budget.passo) * budget.passo);
        for (const v of target) allocazioni[v.id] = quota;
      }
      set("s3_budget", { allocazioni });
    } else { // pianifica_lavori
      let selezionati = [];
      if (strategia === "nullo") selezionati = [];
      else if (strategia === "completista" || strategia === "diversificato") selezionati = budget.lavori.map((l) => l.id);
      else if (strategia === "essenziale") selezionati = budget.lavori.slice(0, 1).map((l) => l.id);
      else { const lf = preferiti(budget.lavori, (l) => l.aree); selezionati = (lf.length ? lf : budget.lavori.slice(0, 1)).map((l) => l.id); }
      set("s3_budget", { selezionati });
    }
  }

  // s3_scarto: scarta i primi daScartare (nullo/essenziale) o quelli FUORI focus (mono/contrario)
  const scarto = trovaStepId(mission, "s3_scarto");
  if (scarto) {
    let scartati;
    if (strategia === "monomandato" || strategia === "contrario") {
      const fuori = scarto.opzioni.filter((o) => !(o.aree || []).some((a) => focus.has(a)));
      scartati = fuori.slice(0, scarto.daScartare).map((o) => o.id);
      if (scartati.length < scarto.daScartare) scartati = scarto.opzioni.slice(0, scarto.daScartare).map((o) => o.id);
    } else if (strategia === "completista") {
      const perQ = [...scarto.opzioni].sort((a, b) => (a.qualita ?? 0.5) - (b.qualita ?? 0.5));
      scartati = perQ.slice(0, scarto.daScartare).map((o) => o.id);
    } else {
      scartati = scarto.opzioni.slice(0, scarto.daScartare).map((o) => o.id);
    }
    set("s3_scarto", { scartati });
  }

  // ruoli: assegna_ruoli o assegna_persone
  const ruoliStep = trovaStep(mission, "assegna_ruoli") || trovaStep(mission, "assegna_persone");
  if (ruoliStep) {
    const idRuoli = ruoliStep.id;
    if (ruoliStep.tipo === "assegna_ruoli") {
      const assegnazioni = {};
      if (strategia === "nullo") { /* niente io */ }
      else if (strategia === "completista") for (const r of ruoliStep.ruoli) assegnazioni[r.id] = "io";
      else if (strategia === "essenziale") { if (ruoliStep.ruoli[0]) assegnazioni[ruoliStep.ruoli[0].id] = "io"; }
      else { const rf = ruoliStep.ruoli.filter((r) => focus.has(r.area)); (rf.length ? rf : ruoliStep.ruoli.slice(0, 1)).forEach((r) => (assegnazioni[r.id] = "io")); }
      set(idRuoli, { assegnazioni });
    } else {
      const assegnazioni = {};
      if (strategia === "completista") for (const c of ruoliStep.compiti) assegnazioni[c.id] = "io";
      else if (strategia === "nullo") { /* niente */ }
      else if (strategia === "essenziale") { if (ruoliStep.compiti[0]) assegnazioni[ruoliStep.compiti[0].id] = "io"; }
      else { const cf = ruoliStep.compiti.filter((c) => focus.has(c.area)); (cf.length ? cf : ruoliStep.compiti.slice(0, 1)).forEach((c) => (assegnazioni[c.id] = "io")); }
      set(idRuoli, { assegnazioni });
    }
  }

  // step aperti (nessuna prova con AI off) + previsione + passi
  set("s4_previsione", { fiducia: strategia === "nullo" ? 50 : 60 });
  set("s4_proposta", { testo: "" });
  set("s5_riflessione", { testo: "" });
  const passi = trovaStepId(mission, "s5_passi");
  if (passi) set("s5_passi", { passi: passi.passi.slice(0, passi.quanti).map((p) => p.id) });

  return { mission, risposte, mandato, focus };
}

// Aggrega le prove d'AREA come ricalcola_area_signal (media pesata per dimensione,
// confidence, azioni distinte). ⚠ SPECCHIO della funzione SQL: se cambia la
// formula in 20260810110000/20260818*, aggiornare anche qui.
function aggrega(evidenze) {
  const perArea = new Map();
  for (const e of evidenze) {
    if (e.categoria !== "area" || !e.area_slug) continue;
    let a = perArea.get(e.area_slug);
    if (!a) { a = { dims: {}, pesoTot: 0, azioni: new Set() }; perArea.set(e.area_slug, a); }
    const d = (a.dims[e.dimensione] = a.dims[e.dimensione] || { vp: 0, p: 0 });
    d.vp += e.valore * e.peso; d.p += e.peso;
    a.pesoTot += e.peso;
    if (e.step_id) a.azioni.add(e.step_id);
  }
  const out = new Map();
  for (const [slug, a] of perArea) {
    const mean = (dim) => (a.dims[dim] && a.dims[dim].p > 0 ? a.dims[dim].vp / a.dims[dim].p : null);
    out.set(slug, {
      interest: mean("interest"), performance: mean("performance"), self_efficacy: mean("self_efficacy"), curiosity: mean("curiosity"),
      confidence: Math.min(1, a.pesoTot / 10), pesoTot: a.pesoTot, azioni: a.azioni.size,
      pesoInteresse: a.dims.interest ? a.dims.interest.p : 0,
    });
  }
  return out;
}

// ─────────────────────────── lessico (seminato da data/aree.ts, poi ritoccato)

const STOPWORD = new Set(norm(
  "il lo la i gli le un uno una di a da in con su per tra fra e o che chi cui non piu meno come dove quando " +
  "sono essere avere fare del della dello dei degli delle al allo alla ai agli alle dal dalla nel nella nei " +
  "sul sulla si ci vi ne se ma anche solo ogni qualche tutto tutti tutte questo questa quello quella suo sua " +
  "loro nostro chi cosa area aree percorso percorsi mondo lavoro lavori studente studenti mestiere mestieri " +
  "diploma post corso corsi laurea its academy professionale professionali diretta spesso tramite fino vanno " +
  "richieste competenze scelta scelte strada strade generiche ente enti nome nomi").split(/\s+/));

// Ritocco a mano: parole-spia AGGIUNTE (segnale forte, spesso assenti dai testi
// descrittivi) e RIMOSSE (troppo generiche, creano rumore). È il livello di
// giudizio umano DICHIARATO sopra il seed automatico — non un lessico inventato.
// Ritocco a mano, prima passata. Escluse di proposito le parole troppo generiche
// che davano falsi positivi nel primo run (per Fix C, non irrigidire oltre senza
// dati): "verificare"/"analisi" (verificare/analizzare è azione trasversale, non
// scienza), "pubblico" (ambiguo: servizio pubblico ≠ parlare al pubblico — il
// caso "spiegare al pubblico" lo cattura comunque "spiegare"), "spazio"/"gestione"
// (generici). Crescere questa mappa È il passo di hand-tune; ridurre i falsi
// positivi si fa qui e nella STOPWORD, non nel motore.
const LESSICO_AGGIUNTE = {
  "comunicazione-media": ["comunica", "comunicare", "comunicazione", "raccontare", "racconto", "narrazione", "spiegare", "spiega", "annuncio", "annunciare", "campagna", "social", "messaggio", "storytelling", "divulgare", "divulgazione"],
  "economia-management": ["budget", "costo", "costi", "bilancio", "investimento", "investire", "ricavo", "ricavi", "finanziario", "spesa", "economico", "break-even", "cassa"],
  "giurisprudenza-pa": ["norma", "normativa", "legge", "regolamento", "convenzione", "contratto", "permesso", "autorizzazione", "burocrazia", "adempimento", "delibera"],
  "arte-design-moda": ["logo", "grafica", "visiva", "estetica", "colore", "colori", "immagine", "layout", "illustrazione"],
  "scienze-ricerca": ["misura", "misurare", "misurato", "esperimento", "campione", "rilevazione"],
  "edilizia-architettura": ["cantiere", "muro", "tetto", "solaio", "collaudo", "planimetria", "metratura", "ristrutturazione"],
  "salute-professioni-sanitarie": ["sanitario", "paziente", "infermiere", "prevenzione"],
  "scienze-educazione": ["educativo", "educazione", "didattica", "pedagogia", "apprendimento", "insegnare"],
};
const LESSICO_RIMOSSE = new Set(norm("sistema sistemi progetto progetti attivita servizio servizi persona persone qualita valore realta ambito settore").split(/\s+/));

// Ritorna:
//  - discriminanti: le parole-spia su cui SI FLAGGA (LESSICO_AGGIUNTE normalizzato).
//    Sono i termini-tema di ciascuna area, curati a mano PARTENDO dal significato
//    delle 18 aree (data/aree.ts). Perché non si flagga sull'auto-estratto: le
//    descrizioni condividono poche parole, quindi troppe parole incidentali
//    ("prima", "meglio", "spazio") risultano uniche a un'area per caso e
//    sommergono i veri sospetti (es. "bilancio"→economia). Provato: flaggare
//    sull'auto-seed dava 155 flag, ~80% rumore.
//  - autoSeed: il vocabolario CANDIDATO estratto dalle descrizioni (parole uniche
//    a un'area, lunghezza ≥6). NON usato per flaggare: è il materiale da cui Mario
//    fa crescere LESSICO_AGGIUNTE a mano. Questo È il «seed dai dati, poi ritocco»:
//    i dati propongono i candidati, l'umano cura quali diventano spie di flag.
function costruisciLessico() {
  const perAreaAuto = new Map();
  for (const a of AREE) {
    const testo = [a.nome, a.descrizioneBreve, a.descrizioneEstesa, ...(a.direzioni || [])].join(" ");
    const parole = norm(testo).split(/[^a-z]+/).filter((w) => w.length >= 6 && !STOPWORD.has(w) && !LESSICO_RIMOSSE.has(w));
    perAreaAuto.set(a.slug, new Set(parole));
  }
  const freq = new Map();
  for (const set of perAreaAuto.values()) for (const w of set) freq.set(w, (freq.get(w) || 0) + 1);
  const autoSeed = {}; // slug -> parole candidate (uniche all'area), da promuovere a mano
  for (const [slug, set] of perAreaAuto) autoSeed[slug] = [...set].filter((w) => freq.get(w) === 1).sort();

  const discriminanti = new Map(); // slug -> Set(parole-spia su cui si flagga)
  for (const a of AREE) discriminanti.set(a.slug, new Set((LESSICO_AGGIUNTE[a.slug] || []).map(norm)));
  return { discriminanti, autoSeed };
}

// Per una riga di tag, cerca aree X≠Y(taggata) le cui parole forti compaiono
// nell'etichetta. Ritorna gli slug sospetti.
function areeSospette(etichetta, areaTaggata, discriminanti) {
  const testo = norm(etichetta);
  const sospette = [];
  for (const [slug, forti] of discriminanti) {
    if (slug === areaTaggata) continue;
    for (const w of forti) {
      // match su confine di parola per evitare sottostringhe spurie
      const re = new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
      if (re.test(testo)) { sospette.push({ slug, parola: w }); break; }
    }
  }
  return sospette;
}

// ─────────────────────────── esecuzione (calcolaEvidenze è async)

async function run() {
  const OUT = path.join(ROOT, "censimento-output");
  fs.mkdirSync(OUT, { recursive: true });
  const slugs = MISSIONI.map((m) => m.slug);
  const { discriminanti, autoSeed } = costruisciLessico();

  // Pass A
  const tuttiTag = [];
  const areeTaggate = new Set();
  const areeCandidateTotali = new Set();
  for (const slug of slugs) {
    const { righe, areeCandidate } = censisciMissione(slug);
    tuttiTag.push(...righe);
    for (const r of righe) areeTaggate.add(r.area);
    for (const a of areeCandidate) areeCandidateTotali.add(a);
  }
  const maiTaggate = AREE.map((a) => a.slug).filter((s) => !areeTaggate.has(s));
  const maiRaggiungibili = maiTaggate.filter((s) => !areeCandidateTotali.has(s));

  // ── Euristica dei tag isolati ────────────────────────────────────────────
  // Un'area che, in una missione, compare su UNO o DUE elementi soltanto è
  // sospetta: di solito è un contesto scambiato per campo o un refuso di
  // copia-incolla. Non è un errore certo — è un posto dove guardare a occhio.
  const elementiPerMissioneArea = new Map();
  for (const r of tuttiTag) {
    const k = r.missione + "|" + r.area;
    if (!elementiPerMissioneArea.has(k)) elementiPerMissioneArea.set(k, new Set());
    elementiPerMissioneArea.get(k).add(r.mecc + "/" + r.elementoId + "|" + r.etichetta);
  }
  const tagIsolati = [];
  for (const [k, set] of elementiPerMissioneArea) {
    if (set.size <= 2) {
      const [missione, area] = k.split("|");
      tagIsolati.push({ missione, area, n: set.size, elementi: [...set].map((e) => e.split("|")[0]).sort() });
    }
  }
  tagIsolati.sort((a, b) => a.n - b.n || a.missione.localeCompare(b.missione) || a.area.localeCompare(b.area));

  // ── Copertura fra missioni ────────────────────────────────────────────────
  // I totali non bastano: un'area con venti tag tutti in una missione è fragile
  // quanto una con un tag solo — la incontra solo chi gioca quella. Conta in
  // quante missioni distinte (su totale) l'area compare. 1-2 missioni = fragile.
  const spanArea = new Map();
  for (const r of tuttiTag) {
    if (!spanArea.has(r.area)) spanArea.set(r.area, { tag: 0, miss: new Set() });
    const v = spanArea.get(r.area); v.tag++; v.miss.add(r.missione);
  }
  const coperturaMissioni = AREE.map((a) => a.slug).map((s) => {
    const v = spanArea.get(s) || { tag: 0, miss: new Set() };
    return { area: s, tag: v.tag, missioni: v.miss.size, fragile: v.miss.size <= 2 };
  }).sort((a, b) => a.missioni - b.missioni || a.tag - b.tag);

  // Pass B + asserzioni
  const STRATEGIE = ["nullo", "completista", "monomandato", "contrario", "essenziale", "diversificato"];
  const asserzioni = []; // { slug, nome, esito: 'PASS'|'FAIL', dettaglio }
  const aggregatiPerMissione = {};
  const buchiCopertura = []; // { slug, area } — area taggata (Pass A) ma mai emessa da nessun giocatore

  // aree taggate per missione (dal Pass A), per il confronto di copertura
  const areeTaggatePerMissione = {};
  for (const r of tuttiTag) (areeTaggatePerMissione[r.missione] = areeTaggatePerMissione[r.missione] || new Set()).add(r.area);

  for (const slug of slugs) {
    const agg = {};
    const info = {};
    const emesse = new Set();
    for (const strat of STRATEGIE) {
      const { mission, risposte, mandato, focus } = costruisciGiocatore(slug, strat);
      // calcolaEvidenze ora ritorna { evidenze, revisoreEsito }: al censimento
      // serve solo l'array delle prove (gli step aperti sono comunque saltati,
      // anthropic=null).
      const { evidenze } = await calcolaEvidenze(mission, risposte, null);
      agg[strat] = aggrega(evidenze);
      info[strat] = { evidenze, mandato, focus, mission };
      for (const e of evidenze) if (e.categoria === "area" && e.area_slug) emesse.add(e.area_slug);
    }
    aggregatiPerMissione[slug] = agg;
    // buco di copertura: aree taggate ma che nessuno dei 6 giocatori ha attivato
    for (const area of areeTaggatePerMissione[slug] || []) if (!emesse.has(area)) buchiCopertura.push({ slug, area });

    const topPer = (m, dim) => {
      let best = null;
      for (const [slugA, v] of m) if (v[dim] != null) { if (!best || v[dim] > best.v || (v[dim] === best.v && v.pesoTot > best.peso)) best = { slug: slugA, v: v[dim], peso: v.pesoTot }; }
      return best;
    };
    const maxConf = (m) => { let x = 0; for (const v of m.values()) x = Math.max(x, v.confidence); return x; };

    // ═ REGRESSIONE (invarianti robuste, exit 1 se falliscono) ═

    // contrario: (i) il mandato emette SOLO interest; (ii) la self_efficacy NON tocca
    // l'area del mandato. È IL guardiano di mandato.aree[0]: se qualcuno rimette il
    // mandato a conferire performance/autoefficacia sulla sua area, questo fallisce.
    {
      const co = info["contrario"];
      const evid = co.evidenze;
      const areeA = new Set(co.mandato.aree);
      const mandatoNonInterest = evid.filter((e) => e.step_id === "s1_mandato" && e.categoria === "area" && e.dimensione !== "interest");
      const selfEffSuA = evid.filter((e) => e.categoria === "area" && e.dimensione === "self_efficacy" && areeA.has(e.area_slug));
      const ok = mandatoNonInterest.length === 0 && selfEffSuA.length === 0;
      asserzioni.push({ slug, tipo: "regressione", nome: "contrario: il merito segue le azioni, non il mandato", esito: ok ? "PASS" : "FAIL", dettaglio: `mandato-non-interest=${mandatoNonInterest.length} selfEff-su-A=${selfEffSuA.length}` });
    }
    // nullo: confidence più bassa dell'impegnato (chi tira via ha un profilo più
    // debole). Robusta: un giocatore che spende gettoni/budget/ruoli accumula
    // sempre più peso di uno che sceglie sempre la prima opzione a costo zero.
    {
      const n = maxConf(agg["nullo"]);
      const mo = maxConf(agg["monomandato"]);
      const ok = n < mo;
      asserzioni.push({ slug, tipo: "regressione", nome: "nullo: profilo più debole dell'impegnato", esito: ok ? "PASS" : "FAIL", dettaglio: `maxConf nullo=${n.toFixed(3)} < monomandato=${mo.toFixed(3)}` });
    }

    // ═ DIAGNOSTICA (proprietà di contenuto: si REVISIONANO, non fanno exit 1) ═
    // Non sono invarianti: dipendono da come una missione distribuisce i tag (la
    // priorità emette interesse su OGNI elemento, l'interest-mean è sensibile ai
    // contributi a basso valore). Un ⚠ qui è un CANDIDATO di squilibrio da guardare
    // con Fix C — un'area che batte il mandato anche quando ci si concentra sul
    // mandato — non un bug del motore.

    // monomandato: l'area del mandato dovrebbe risultare in cima (ranking reale:
    // interest-mean, tiebreak confidenza).
    {
      const mono = info["monomandato"];
      const top = topPer(agg["monomandato"], "interest");
      const ok = top && mono.mandato.aree.includes(top.slug);
      asserzioni.push({ slug, tipo: "diagnostica", nome: "monomandato: area del mandato in cima", esito: ok ? "PASS" : "REVIEW", dettaglio: `top=${top ? top.slug : "—"} mandato.aree=[${mono.mandato.aree.join(",")}]` });
    }
    // completista: profilo più PIATTO del focus. Chi clicca tutto non deve ottenere
    // un picco più netto di chi si concentra: il gap #1-#2 del completista ≤ quello
    // del monomandato. (Metrica robusta al problema dell'interest-mean assoluto.)
    {
      const gapDi = (m) => { const vals = [...m.values()].map((v) => v.interest).filter((x) => x != null).sort((a, b) => b - a); return vals.length >= 2 ? vals[0] - vals[1] : vals[0] ?? 0; };
      const gc = gapDi(agg["completista"]);
      const gm = gapDi(agg["monomandato"]);
      const ok = gc <= gm + 1e-9;
      asserzioni.push({ slug, tipo: "diagnostica", nome: "completista: il volume non crea un picco più netto del focus", esito: ok ? "PASS" : "REVIEW", dettaglio: `gap completista=${gc.toFixed(3)} ≤ monomandato=${gm.toFixed(3)}` });
    }
  }

  // ── casi dubbi (lessico) ──
  const dubbi = [];
  for (const r of tuttiTag) {
    const sospette = areeSospette(r.etichetta, r.area, discriminanti);
    for (const s of sospette) dubbi.push({ ...r, areaSuggerita: s.slug, parola: s.parola });
  }
  // dedup per missione|mecc|elementoId|areaSuggerita
  const visto = new Set();
  const dubbiUnici = dubbi.filter((d) => { const k = `${d.missione}|${d.mecc}|${d.elementoId}|${d.areaSuggerita}`; if (visto.has(k)) return false; visto.add(k); return true; });

  // ── output file ──
  fs.writeFileSync(path.join(OUT, "censimento.json"), JSON.stringify({ tuttiTag, maiTaggate, maiRaggiungibili, asserzioni, buchiCopertura, tagIsolati, coperturaMissioni, dubbi: dubbiUnici, lessicoAutoSeed: autoSeed }, null, 2));

  const mdIso = [
    "# Tag isolati — censimento del motore Escape",
    "",
    "Ogni riga: un'area che in una missione compare su **uno o due elementi soltanto**. **Sospetta, non un verdetto** — di solito è un contesto scambiato per campo o un refuso. Guarda a occhio. Non cattura invece un'area *densa ma fuori tema* (es. un grappolo su 5 elementi): per quella serve la lettura di `coperturaMissioni`.",
    "",
    "| missione | area | n. elementi | elementi |",
    "|---|---|---|---|",
    ...tagIsolati.map((t) => `| ${t.missione} | ${nomeArea(t.area)} | ${t.n} | ${t.elementi.join(", ")} |`),
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "tag-isolati.md"), mdIso);

  const csvEsc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const csv = ["missione,meccanismo,elemento_id,etichetta,area_attuale,area_suggerita,parola_spia"]
    .concat(dubbiUnici.map((d) => [d.missione, d.mecc, d.elementoId, d.etichetta, d.area, d.areaSuggerita, d.parola].map(csvEsc).join(",")))
    .join("\n");
  fs.writeFileSync(path.join(OUT, "casi-dubbi.csv"), csv);

  const md = [
    "# Casi dubbi — censimento del motore Escape",
    "",
    "Ogni riga: un'etichetta il cui lessico richiama un'area diversa da quella taggata. **Triage automatico, non un verdetto** — conferma o scarta voce per voce. La mappa completa è in `censimento.json`.",
    "",
    "| missione | meccanismo | id | etichetta (quello che vede lo studente) | area attuale | area suggerita | parola-spia |",
    "|---|---|---|---|---|---|---|",
    ...dubbiUnici.map((d) => `| ${d.missione} | ${d.mecc} | ${d.elementoId} | ${d.etichetta.replace(/\|/g, "\\|")} | ${nomeArea(d.area)} | ${nomeArea(d.areaSuggerita)} | ${d.parola} |`),
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "casi-dubbi.md"), md);

  // ── stampa a video ──
  const line = (s) => process.stdout.write(s + "\n");
  line("╔══════════════════════════════════════════════════════════════╗");
  line("║  CENSIMENTO DEL MOTORE ESCAPE                                   ║");
  line("╚══════════════════════════════════════════════════════════════╝");
  line("");
  line(`Pass A — mappa completa: ${tuttiTag.length} tag (missione×meccanismo×elemento×area) su ${slugs.length} missioni.`);
  line("");
  line("CASO INVERSO — aree mai taggate (uno studente portato per esse non riceve un segnale strutturato):");
  if (maiTaggate.length === 0) line("  ✓ nessuna: tutte e 18 le aree ricevono almeno un tag.");
  else for (const s of maiTaggate) line(`  ⚠ ${nomeArea(s)} (${s})${areeCandidateTotali.has(s) ? " — solo in areeCandidate (raggiungibile solo via testo AI)" : " — MAI, nemmeno in areeCandidate"}`);
  if (maiRaggiungibili.length) { line(""); line(`  ⛔ TOTALMENTE IRRAGGIUNGIBILI (né tag né areeCandidate): ${maiRaggiungibili.map(nomeArea).join(", ")}`); }
  line("");
  line("PASS B — REGRESSIONE (invarianti; un FAIL è un bug del motore → exit 1):");
  let falliti = 0;
  for (const a of asserzioni.filter((x) => x.tipo === "regressione")) { if (a.esito === "FAIL") falliti++; line(`  ${a.esito === "PASS" ? "✓" : "✗ FAIL"}  [${a.slug}] ${a.nome}  ·  ${a.dettaglio}`); }
  line("");
  const daRivedere = asserzioni.filter((x) => x.tipo === "diagnostica" && x.esito === "REVIEW");
  line(`PASS B — DIAGNOSTICA (proprietà di contenuto da rivedere con Fix C, NON exit): ${daRivedere.length} segnalazioni`);
  for (const a of daRivedere) line(`  ⚠ REVIEW  [${a.slug}] ${a.nome}  ·  ${a.dettaglio}`);
  line("");
  line(`COPERTURA Pass B — aree taggate ma non attivate da nessuno dei 6 giocatori: ${buchiCopertura.length}`);
  if (buchiCopertura.length) for (const b of buchiCopertura) line(`  · [${b.slug}] ${nomeArea(b.area)} — verificata solo staticamente, non dal vivo`);
  line("");
  line(`CASI DUBBI (lessico): ${dubbiUnici.length} → censimento-output/casi-dubbi.{csv,md}`);
  line("");
  line(`TAG ISOLATI — un'area su 1-2 elementi in una missione (sospetta, da rivedere a occhio): ${tagIsolati.length}`);
  for (const t of tagIsolati) line(`  · [${t.missione}] ${nomeArea(t.area)} — ${t.n} elemento/i: ${t.elementi.join(", ")}`);
  line("  (→ tag-isolati.md. NB: non cattura un'area densa ma fuori tema — per quella leggi la copertura qui sotto.)");
  line("");
  line("COPERTURA FRA MISSIONI — in quante missioni distinte compare ogni area (fragile ≤ 2):");
  for (const c of coperturaMissioni) line(`  ${c.fragile ? "⚠" : " "} ${nomeArea(c.area).padEnd(34)} ${String(c.tag).padStart(3)} tag  in ${c.missioni} missioni`);
  line("");
  line(`Mappa completa: censimento-output/censimento.json`);
  line("");
  if (falliti > 0) { line(`✗ ${falliti} asserzioni FALLITE.`); process.exit(1); }
  line("✓ Tutte le asserzioni di regressione passano.");
}

run().catch((e) => { console.error(e); process.exit(1); });
