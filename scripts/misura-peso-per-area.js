// Due misure che servono a decidere la BARRA del ritratto: quanto peso di prova
// accumula uno studente per area, e quanto ne potrebbe accumulare al massimo.
//
// PERCHÉ. `area_signal` è una MEDIA pesata: invariante di scala, non sa quante
// volte lo studente è passato di lì. La barra dovrebbe passare alla quantità —
// ma con quale scala? Una scala unica presuppone che tutte le aree siano
// ugualmente raggiungibili, e il censimento dice che non lo sono: Comunicazione
// & Media compare in otto missioni, Ristorazione & Turismo in due. Con una
// scala unica Ristorazione avrà per sempre una barra corta, e lo studente
// leggerà «qui hai fatto poco» dove la verità è «qui c'era poco da fare» —
// cioè una nostra lacuna di contenuto riportata come una sua mancanza.
//
// MISURA 1 — quanto si accumula davvero: studenti sintetici a 1, 2, 3, 5, 8 e
// 11 missioni; per ogni tappa min/mediana/max del peso per area e quante aree
// superano 10 (la soglia a cui la confidence satura).
//
// MISURA 2 — il tetto per area: quanto peso accumulerebbe chi giocasse tutte le
// missioni dove l'area compare prendendo ogni volta le scelte che la toccano.
// È una STIMA, e il criterio è dichiarato sotto (le scelte si escludono a
// vicenda: un mandato su cinque, due scarti su sei, alcuni ruoli e non tutti).
//
// Nessuna chiamata AI: `calcolaEvidenze(..., null)` salta gli step aperti, che
// dipendono dal testo e non sarebbero riproducibili. Il peso del revisore resta
// quindi FUORI da entrambe le misure — vedi la nota in fondo all'output.
//
// Esecuzione: `npm run misura:peso`.

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

const { AREE } = require("@/data/aree");
const { getMissione, stepDellaMissione, MISSIONI } = require("@/lib/escape/config");
const { calcolaEvidenze } = require("@/lib/escape/scoring");

const SLUGS = MISSIONI.map((m) => m.slug);
const TAPPE = [1, 2, 3, 5, 8, 11];

const accessore = (mappa) => (id) => mappa[id];
const trovaStep = (m, tipo) => stepDellaMissione(m).find((s) => s.tipo === tipo);
const trovaStepId = (m, id) => stepDellaMissione(m).find((s) => s.id === id);

// ── il giocatore: la stessa costruzione del censimento, in forma minima ──────
// `focus` = le aree su cui il giocatore AGISCE. Con `focus = null` prende
// ovunque la prima opzione (giocatore «medio», nessuna area privilegiata);
// con un insieme di aree mette davanti tutto ciò che le tocca — è il modo di
// stimare il tetto di quell'area senza uscire dalle combinazioni ammissibili.
function rispostePerMissione(slug, focus) {
  const base = getMissione(slug);
  const mandati = trovaStepId(base, "s1_mandato").opzioni;
  const liberi = (trovaStepId(base, "s1_materiali")?.materiali ?? []).map((m) => m.id);
  // Il mandato si sceglie fra quelli che toccano il focus; se nessuno lo tocca,
  // si prende quello che SBLOCCA una consulenza sul focus — le consulenze della
  // Stanza 2 dipendono dal mandato, e per un'area che nessun mandato nomina
  // quello è l'unico modo di raggiungerla (il caso di Sicurezza & Difesa, il cui
  // unico tag del motore è il consulto col maresciallo, dietro un mandato solo).
  const perConsulenza = focus
    ? mandati.find((o) => {
        const g = accessore({ s1_materiali: { letti: liberi }, s1_mandato: { opzioneId: o.id } });
        const dss = trovaStepId(getMissione(slug, g), "s2_informazioni")?.dossier ?? [];
        return dss.some((d) => (d.aree || []).some((a) => focus.has(a)));
      })
    : null;
  const mandato = (focus && mandati.find((o) => (o.aree || []).some((a) => focus.has(a)))) || perConsulenza || mandati[0];

  const get1 = accessore({ s1_materiali: { letti: liberi }, s1_mandato: { opzioneId: mandato.id } });
  const m1 = getMissione(slug, get1);
  const dossier = (trovaStepId(m1, "s2_informazioni")?.dossier ?? []).map((d) => ({ id: d.id, aree: d.aree || [] }));
  // Tutti i dossier letti per SBLOCCARE le voci gated; poi si sceglie cosa
  // «comprare» davvero (i gettoni sono pochi, e la scelta è il segnale).
  const getSblocco = accessore({ s1_materiali: { letti: [...liberi, ...dossier.map((d) => d.id)] }, s1_mandato: { opzioneId: mandato.id } });
  const mission = getMissione(slug, getSblocco);

  const risposte = new Map();
  const set = (id, payload) => { if (trovaStepId(mission, id)) risposte.set(id, payload); };
  const tocca = (x) => (x.aree || []).some((a) => focus.has(a));

  set("s1_materiali", { letti: liberi });
  set("s1_mandato", { opzioneId: mandato.id });

  const pr = trovaStepId(mission, "s1_priorita");
  if (pr) {
    const ordine = focus
      ? [...pr.elementi].sort((a, b) => (tocca(a) ? 0 : 1) - (tocca(b) ? 0 : 1)).map((e) => e.id)
      : pr.elementi.map((e) => e.id);
    set("s1_priorita", { ordine });
  }

  const inf = trovaStepId(mission, "s2_informazioni");
  if (inf) {
    // `budget` = quanti gettoni si possono spendere (il campo si chiama così
    // nello StepSelezionaInformazioni, non «quanti»).
    const quanti = inf.budget ?? 5;
    const scelti = focus ? [...inf.dossier].sort((a, b) => (tocca(a) ? 0 : 1) - (tocca(b) ? 0 : 1)) : inf.dossier;
    set("s2_informazioni", { selezionati: scelti.slice(0, quanti).map((d) => d.id) });
  }

  const bud = trovaStepId(mission, "s3_budget");
  if (bud && bud.tipo === "alloca_budget") {
    // Tutto il budget sulle voci del focus (o distribuito, se non c'è focus).
    const voci = focus ? bud.voci.filter(tocca) : bud.voci;
    const target = voci.length ? voci : bud.voci;
    const quota = Math.floor(bud.totale / target.length);
    const alloc = {};
    for (const v of target) alloc[v.id] = quota;
    set("s3_budget", { allocazioni: alloc });
  } else if (bud && bud.tipo === "pianifica_lavori") {
    const lavori = focus ? bud.lavori.filter(tocca) : bud.lavori;
    set("s3_budget", { selezionati: (lavori.length ? lavori : bud.lavori).map((l) => l.id) });
  }

  const sc = trovaStepId(mission, "s3_scarto");
  if (sc) {
    // Si scartano le opzioni che NON toccano il focus (tenere è il segnale).
    const ordinati = focus ? [...sc.opzioni].sort((a, b) => (tocca(a) ? 1 : 0) - (tocca(b) ? 1 : 0)) : [...sc.opzioni];
    set("s3_scarto", { scartati: ordinati.slice(0, sc.daScartare).map((o) => o.id) });
  }

  // Lo step dei ruoli sta nella Stanza 3 o nella 4 secondo la missione, e può
  // essere «io/altri» oppure compito→persona (solo la 10).
  const ru = trovaStep(mission, "assegna_ruoli") || trovaStep(mission, "assegna_persone");
  if (ru && ru.tipo === "assegna_ruoli") {
    const ass = {};
    for (const r of ru.ruoli) ass[r.id] = !focus || (r.area && focus.has(r.area)) ? "io" : "altri";
    risposte.set(ru.id, { assegnazioni: ass });
  } else if (ru && ru.tipo === "assegna_persone") {
    const ass = {};
    for (const c of ru.compiti) ass[c.id] = ru.persone?.[0]?.id;
    risposte.set(ru.id, { assegnazioni: ass });
  }

  const pa = trovaStep(mission, "pianifica_passi");
  if (pa) {
    const scelti = focus ? [...pa.passi].sort((a, b) => (tocca(a) ? 0 : 1) - (tocca(b) ? 0 : 1)) : pa.passi;
    risposte.set(pa.id, { passi: scelti.slice(0, pa.quanti).map((p) => p.id) });
  }

  return { mission, risposte };
}

async function pesiDiUnaMissione(slug, focus) {
  const { mission, risposte } = rispostePerMissione(slug, focus);
  const { evidenze } = await calcolaEvidenze(mission, risposte, null);
  const per = new Map();
  for (const e of evidenze) {
    if (!e.area_slug) continue; // le righe di qualità di missione non hanno area
    per.set(e.area_slug, (per.get(e.area_slug) ?? 0) + (Number(e.peso) || 0));
  }
  return per;
}

const mediana = (v) => {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const f = (n) => n.toFixed(2).padStart(6);

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║  PESO DI PROVA PER AREA — quanto si accumula, quanto si può  ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // ── MISURA 1 ──────────────────────────────────────────────────────────────
  console.log("\n═══ 1. Studente «medio» (prima opzione ovunque), per numero di missioni ═══\n");
  console.log("missioni   aree toccate    min   mediana      max   aree sopra 10");
  const cumulato = new Map();
  for (let i = 0; i < SLUGS.length; i++) {
    const per = await pesiDiUnaMissione(SLUGS[i], null);
    for (const [a, p] of per) cumulato.set(a, (cumulato.get(a) ?? 0) + p);
    const n = i + 1;
    if (!TAPPE.includes(n)) continue;
    const v = [...cumulato.values()];
    const sopra10 = v.filter((x) => x >= 10).length;
    console.log(`${String(n).padStart(5)}      ${String(cumulato.size).padStart(6)}     ${f(Math.min(...v))} ${f(mediana(v))} ${f(Math.max(...v))}       ${sopra10}`);
  }

  // ── MISURA 2 ──────────────────────────────────────────────────────────────
  // CRITERIO DELLA STIMA, dichiarato: per ogni area si costruisce un giocatore
  // che la mette davanti in OGNI scelta (mandato che la tocca, priorità in
  // testa, gettoni su di lei, budget tutto sulle sue voci, la tiene nello
  // scarto, prende i suoi ruoli) e si gioca ogni missione in cui compare. Le
  // scelte restano ammissibili — un mandato solo, il numero giusto di scarti e
  // di gettoni — quindi NON è la somma dei tag. Resta una stima per eccesso in
  // un punto: un'area può comparire in due voci di budget che si contendono lo
  // stesso denaro, e qui prendono entrambe la loro quota.
  console.log("\n═══ 2. Tetto per area (stima, criterio dichiarato nel codice) ═══\n");
  console.log("area                                missioni   tetto   per missione");
  const righe = [];
  for (const a of AREE) {
    const focus = new Set([a.slug]);
    let tetto = 0, missioni = 0;
    for (const slug of SLUGS) {
      const per = await pesiDiUnaMissione(slug, focus);
      const p = per.get(a.slug) ?? 0;
      if (p > 0) { tetto += p; missioni++; }
    }
    righe.push({ nome: a.nome, missioni, tetto });
  }
  righe.sort((x, y) => x.tetto - y.tetto);
  for (const r of righe) console.log(`${r.nome.padEnd(34)}${String(r.missioni).padStart(7)}  ${f(r.tetto)}   ${f(r.missioni ? r.tetto / r.missioni : 0)}`);

  // Il rapporto si calcola SENZA le aree a zero: dividere per zero darebbe un
  // numero enorme e senza senso, e un'area irraggiungibile è un caso a sé — si
  // conta a parte, non si mescola con la scala.
  const tetti = righe.map((r) => r.tetto).filter((t) => t > 0);
  const zero = righe.filter((r) => r.tetto === 0);
  console.log(`\n  fra le aree raggiungibili: minimo ${Math.min(...tetti).toFixed(2)} · massimo ${Math.max(...tetti).toFixed(2)} · rapporto ${(Math.max(...tetti) / Math.min(...tetti)).toFixed(1)}×`);
  if (zero.length) console.log(`  aree con tetto ZERO (nessuna scelta le tocca): ${zero.map((r) => r.nome).join(", ")}`);
  // Il rapporto grezzo lo domina l'area con UN tag solo: senza di lei si vede
  // la dispersione delle aree «normali», che è il numero che serve alla scala.
  const senzaCoda = righe.filter((r) => r.tetto >= 5).map((r) => r.tetto);
  if (senzaCoda.length && senzaCoda.length < righe.length) {
    console.log(`  escludendo le aree sotto 5 (${righe.filter((r) => r.tetto < 5).map((r) => r.nome).join(", ")}): minimo ${Math.min(...senzaCoda).toFixed(2)} · massimo ${Math.max(...senzaCoda).toFixed(2)} · rapporto ${(Math.max(...senzaCoda) / Math.min(...senzaCoda)).toFixed(1)}×`);
  }

  console.log("\nNOTA — cosa NON è dentro questi numeri: gli step aperti (proposta,");
  console.log("riflessione, «non approfondire») chiedono una chiamata AI e qui è nulla,");
  console.log("quindi il peso del revisore (1,4 per area riconosciuta) resta fuori da");
  console.log("entrambe le misure. È il peso più alto del motore: i tetti reali sono più");
  console.log("alti di così, e più alti soprattutto per le aree che il revisore può");
  console.log("premiare — cioè le candidate, che sono un'altra distribuzione ancora.\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
