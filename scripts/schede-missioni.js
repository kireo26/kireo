// KIREO Escape — genera le SCHEDE DI GIOCO di tutte le missioni, leggendo
// esclusivamente da lib/escape/config.ts.
//
// REGOLA DI QUESTO FILE (non negoziabile): lo script NON contiene dati propri.
// Nessuna lista di missioni, nessuna etichetta di contenuto, nessuna soglia
// scritta a mano. L'elenco delle missioni viene da MISSIONI (derivato da DEFS),
// i titoli delle stanze dai `testi` di ciascuna missione, i numeri dalle sue
// funzioni. Se domani si aggiunge una missione al config, compare qui senza che
// nessuno tocchi questo file — ed è tutto il punto: una scheda committata
// diventerebbe una seconda fonte di verità che invecchia in silenzio.
//
// L'output NON va committato (è in .gitignore): si rigenera quando serve.
// Esecuzione: `npm run schede` → schede-missioni.md

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

const { MISSIONI, getMissioneDef } = require("@/lib/escape/config");

// Insieme "tutti i materiali letti": derivato dagli id che la missione stessa
// dichiara, mai una lista scritta qui.
const idMateriali = (d) => new Set([...d.materialiLiberi, ...d.materialiGettone, ...d.mandati.flatMap((m) => m.consulenze)].map((m) => m.id));
const VUOTO = new Set();
const num = (n) => (typeof n === "number" ? n.toLocaleString("it-IT") : String(n));
const taglia = (t, n) => (t && t.length > n ? t.slice(0, n) + "…" : t || "");

let out = `# KIREO Escape — schede di gioco\n\n`;
out += `Generato da \`npm run schede\` leggendo \`lib/escape/config.ts\`. Non committare questo file: si rigenera.\n\n`;
out += `Il contenuto è **dinamico**. I dossier della Stanza 2 sono i materiali a gettone **più le 2 consulenze del mandato scelto**; alcune voci di budget e alcuni lavori si sbloccano solo dopo aver letto un certo materiale (segnati 🔒); gli avvisi dello scarto compaiono solo a materiale letto. Le voci sono risolte col **primo mandato**.\n`;

for (const meta of MISSIONI) {
  const d = getMissioneDef(meta.slug);
  if (!d) continue;
  const TUTTI = idMateriali(d);
  const t = d.testi;

  out += `\n---\n\n# ${meta.titolo}\n\n\`${meta.slug}\` · *${meta.sottotitolo}*${meta.durata ? ` · ${meta.durata}` : ""} · tipo: ${meta.tipo}\n\n${meta.descrizione}\n\n`;
  out += `**Aree candidate** (${d.areeCandidate.length}): ${d.areeCandidate.join(", ")}\n`;

  out += `\n## ${t.materiali.titolo}\n\n> ${t.materiali.prompt}\n\n`;
  for (const m of d.materialiLiberi) out += `- **${m.id} · ${m.titolo}** — ${taglia(m.contenuto, 200)}\n`;

  out += `\n## ${t.priorita.titolo}\n\n> ${t.priorita.prompt}\n\n`;
  d.prioritaVoci.forEach((e, i) => {
    out += `${i + 1}. **${e.label}**${typeof e.affidabilita === "number" ? ` — affidabilità ${e.affidabilita}` : ""} · aree: ${e.aree.join(", ") || "—"}\n`;
  });
  if (d.prioritaVoci.some((e) => typeof e.affidabilita === "number")) out += `\n> ⚠ L'ordine è valutato come **gerarchia di affidabilità** (misura > stima > interpretazione).\n`;

  out += `\n## ${t.mandato.titolo}\n\n> ${t.mandato.prompt}\n\n`;
  for (const m of d.mandati) {
    out += `- **${m.label}** — ${m.frase}\n  - aree: ${m.aree.join(", ") || "**nessuna**"}\n  - consulenze sbloccate: ${m.consulenze.map((c) => `«${c.titolo}» (${c.costo})`).join(" · ")}\n`;
  }

  out += `\n## ${t.informazioni.titolo} (budget ${5} gettoni)\n\n> ${t.informazioni.prompt}\n\n`;
  for (const m of d.materialiGettone) out += `- **${m.id} · ${m.titolo}** (${m.costo}) — ${taglia(m.contenuto, 200)}\n`;
  out += `\n_+ le 2 consulenze del mandato scelto._\n`;

  out += `\n## ${t.nonApprofondire.titolo}${t.nonApprofondire.hint ? "" : ""}\n\n> ${t.nonApprofondire.prompt}\n`;

  out += `\n## ${t.budget.titolo}\n\n> ${t.budget.prompt}\n\n`;
  if (d.piano) {
    const soldi = typeof d.piano.budgetSoldi === "function" ? d.piano.budgetSoldi(TUTTI) : d.piano.budgetSoldi;
    out += `**Vincoli**: ${soldi !== undefined ? `${num(soldi)} ${d.piano.unitaSoldi}` : "nessun tetto"}`;
    if (d.piano.budgetGiorni) out += ` · ${d.piano.budgetGiorni} giorni`;
    if (d.piano.obiettivo !== undefined) out += ` · obiettivo da RAGGIUNGERE: ${d.piano.obiettivo} ${d.piano.unitaObiettivo || ""}`;
    out += `\n\n`;
    const base = new Set(d.piano.lavori(VUOTO).map((l) => l.id));
    for (const l of d.piano.lavori(TUTTI)) {
      out += `- **${l.label}** \`${l.id}\` — ${num(l.costo)} ${d.piano.unitaSoldi}`;
      if (l.giorni) out += `, ${l.giorni} gg`;
      if (l.risparmio) out += `, risparmio ${l.risparmio}`;
      if (l.essenziale) out += ` · **ESSENZIALE**`;
      if (l.parallelizzabile) out += ` · parallelizzabile`;
      if (l.richiede) out += ` · richiede: ${l.richiede.join(", ")}`;
      if (!base.has(l.id)) out += ` · 🔒`;
      out += `\n`;
    }
  } else {
    const m0 = d.mandati[0];
    const totali = d.mandati.map((m) => d.budget.totale(m, TUTTI));
    out += `**Totale**: ${num(d.budget.totale(m0, TUTTI))} ${d.budget.unita} (passo ${num(d.budget.passo)})`;
    if (new Set(totali).size > 1) out += ` — ⚠ varia col mandato: ${d.mandati.map((m, i) => `${m.label} ${num(totali[i])}`).join(", ")}`;
    out += `\n\n`;
    const base = new Set(d.budget.voci(m0, VUOTO).map((v) => v.id));
    for (const v of d.budget.voci(m0, TUTTI)) {
      out += `- **${v.label}** \`${v.id}\`${v.costoIndicativo ? ` — ≈ ${num(v.costoIndicativo)} ${d.budget.unita}` : ""} · aree: ${v.aree.join(", ") || "—"}${base.has(v.id) ? "" : " · 🔒"}\n`;
    }
  }

  out += `\n## ${t.scarto.titolo} — da scartare: ${d.daScartare}\n\n> ${t.scarto.prompt}\n\n`;
  for (const o of d.scarto(TUTTI)) {
    const trap = o.trappola ? (o.trappolaSeScartata ? ` · 🪤 **TRAPPOLA INVERTITA — pericoloso SCARTARLA**` : ` · 🪤 **TRAPPOLA — pericoloso TENERLA**`) : "";
    out += `- **${o.label}** \`${o.id}\` — qualità ${o.qualita}${trap}\n`;
    if (o.avviso) out += `  - avviso (a materiale letto): _${o.avviso}_\n`;
  }

  out += `\n## ${t.ruoli.titolo} (Stanza ${d.ruoliStanza})\n\n> ${t.ruoli.prompt}\n\n`;
  if (d.assegnaPersone) {
    out += `**Compiti**: ${d.assegnaPersone.compiti.map((c) => `${c.label} \`${c.id}\``).join(" · ")}\n\n`;
    out += `**Persone**: ${d.assegnaPersone.persone.map((p) => `${p.nome || p.label || p.id} \`${p.id}\``).join(" · ")}\n`;
  } else {
    for (const r of d.ruoli) out += `- **${r.label}** \`${r.id}\` · area: ${r.area}\n`;
  }

  out += `\n## ${t.previsione.titolo}\n\n> ${t.previsione.prompt}\n\n_${t.previsione.domanda}_\n`;
  out += `\n## ${t.proposta.titolo} — minimo ${t.proposta.minCaratteri} caratteri\n\n> ${t.proposta.prompt}\n`;
  if (t.proposta.hint) out += `\n_${t.proposta.hint}_\n`;
  out += `\n## ${t.riflessione.titolo} — minimo ${t.riflessione.minCaratteri} caratteri\n\n> ${t.riflessione.prompt}\n`;
  out += `\n## ${t.passi.titolo} — sceglierne ${d.quantiPassi}, in ordine\n\n> ${t.passi.prompt}\n\n`;
  for (const p of d.passi) out += `- **${p.label}** \`${p.id}\`\n`;
}

const dest = path.join(ROOT, "schede-missioni.md");
fs.writeFileSync(dest, out);
console.log(`✓ ${MISSIONI.length} missioni → schede-missioni.md (${out.split("\n").length} righe)`);
