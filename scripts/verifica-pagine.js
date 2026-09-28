// La passata sulle pagine rese: le parti che si possono provare senza rete.
//
// PERCHÉ ESISTE. `npm run banco pagine` è un CORPUS da leggere, non un
// controllo: non trova niente da sola, e per questo non ha un verde e un rosso.
// Ma tre cose dentro di lei sono proprietà vere, e se cadono il corpus mente
// invece di tacere — che è peggio:
//   1) lo spoglio dell'HTML non deve far uscire il testo degli SCRIPT. Il
//      payload RSC di Next contiene tutto il testo della pagina una seconda
//      volta: senza rimuoverlo il corpus sarebbe illeggibile e ogni frase
//      comparirebbe due volte;
//   2) la guardia contro il locale, nei DUE versi — deve fermare un indirizzo
//      locale (là le due metà del fuso si annullano e il corpus è cieco sul
//      difetto che l'ha motivata) e NON deve fermare una produzione vera, o è
//      una guardia che qualcuno disattiva;
//   3) la guardia sul redirect SEGUITO. Verificato il 28/09, non dedotto: `/app`
//      senza sessione risponde 200 con il corpus della pagina di login. Se
//      l'indirizzo finale non arriva, la guardia deve DIRLO — un silenzio qui è
//      indistinguibile da «sono nel posto giusto».
//
// Esecuzione: `npm run test:pagine`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./lib/senza-commenti");
const { testoDellaPagina, eLocale, PAGINE } = require("./banco/pagine");

const ROOT = path.join(__dirname, "..");
let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
};

console.log("\n═══ La passata sulle pagine rese ═══\n");

// ── 1) lo spoglio ───────────────────────────────────────────────────────────
console.log("1) Lo spoglio dell'HTML");

// Le forme che Next produce davvero: il payload RSC in uno `<script>`, gli SVG
// del logo, le entità, i blocchi.
const FINTA = `<!DOCTYPE html><html><head><title>Agenda — KIREO</title>
<style>.a{color:red}</style>
<script>self.__next_f.push([1,"TESTO_DUPLICATO_DAL_PAYLOAD"])</script>
</head><body>
<svg viewBox="0 0 80 80"><path d="M0 0"/><title>TESTO_DENTRO_SVG</title></svg>
<!-- TESTO_IN_UN_COMMENTO -->
<h1>Prossimi   eventi</h1>
<p>Un webinar il 28 settembre 2026 alle ore 15:00.</p><p>Chi l&apos;ha fatta ti ha lasciato una domanda &mdash; fino al 30.</p>
<ul><li>Primo</li><li>Secondo</li></ul>
<div>&laquo;citato&raquo; &egrave; cos&igrave; &#232; anche cos&#xec;</div>
</body></html>`;

const t = testoDellaPagina(FINTA);

// LA PROPRIETÀ CHE CONTA PIÙ DI TUTTE: niente testo dagli script. Il payload di
// Next ripete ogni frase della pagina, e un corpus doppio non si legge.
ok(!/TESTO_DUPLICATO_DAL_PAYLOAD/.test(t), "il testo dentro uno `<script>` non esce (il payload RSC ripete tutta la pagina)");
ok(!/TESTO_DENTRO_SVG/.test(t), "…né quello dentro un `<svg>`");
ok(!/TESTO_IN_UN_COMMENTO/.test(t), "…né quello di un commento HTML");
ok(!/color:red|\.a\{/.test(t), "…né il CSS");

ok(/Agenda — KIREO/.test(t), "il titolo della pagina c'è: dice subito su che pagina sei");
ok(/Un webinar il 28 settembre 2026 alle ore 15:00\./.test(t), "una frase con un orario arriva intatta (è la cosa per cui la passata esiste)");
ok(/Chi l'ha fatta ti ha lasciato una domanda — fino al 30\./.test(t), "le entità sono decodificate: `&apos;` e `&mdash;` non restano a schermo");
ok(/«citato» è così è anche così/.test(t), "…comprese quelle numeriche, decimali ed esadecimali");
ok(/^Prossimi eventi$/m.test(t), "gli spazi in mezzo a un titolo si normalizzano");
ok(/^Primo$/m.test(t) && /^Secondo$/m.test(t), "le voci di un elenco stanno su righe diverse, invece di incollarsi");
ok(!/^\s*$/m.test(t), "nessuna riga vuota: un corpus da leggere non si scorre a vuoto");

// ── 2) la guardia contro il locale, nei DUE versi ───────────────────────────
console.log("\n2) La guardia contro il locale");

for (const url of ["http://localhost:3000", "http://127.0.0.1:3000", "http://0.0.0.0:3001", "https://kireo.local"]) {
  ok(eLocale(url), `«${url}» è riconosciuto come locale, dove il corpus sarebbe cieco sul fuso`);
}
// L'ALTRA METÀ: una guardia che grida su una produzione vera è una guardia che
// qualcuno disattiva, e allora non protegge più niente.
for (const url of ["https://www.kireo.it", "https://kireo.it", "https://kireo-git-main.vercel.app"]) {
  ok(!eLocale(url), `…e «${url}» passa: non è locale`);
}

// ── 3) le tre guardie dentro il comando ─────────────────────────────────────
console.log("\n3) Dentro il comando");

const src = senzaCommenti(fs.readFileSync(path.join(ROOT, "scripts", "banco", "pagine.js"), "utf8"));
const sessione = senzaCommenti(fs.readFileSync(path.join(ROOT, "scripts", "banco", "robot", "sessione.js"), "utf8"));

ok(/eLocale\(sitoUrl\)/.test(src) && /process\.exit\(1\)/.test(src), "un indirizzo locale ferma la passata, invece di produrre un corpus cieco");
// La guardia sul redirect ha DUE metà, e la seconda è quella che si dimentica:
// se l'indirizzo finale non arriva, tacere sarebbe indistinguibile da «sono nel
// posto giusto».
ok(/r\.url\.endsWith\(percorso\)/.test(src), "un redirect seguito viene detto: senza sessione /app risponde 200 col corpus del login");
ok(/!r\.url \?/.test(src) && /NON SO su quale pagina/.test(src), "…e se l'indirizzo finale manca, lo dichiara invece di tacere");
// Se `chiama` smettesse di restituire `url`, la guardia sopra sarebbe muta per
// sempre e nessuno se ne accorgerebbe: la metà GUARDA di quel controllo.
ok(/url: risposta\.url/.test(sessione), "…e `chiama` restituisce davvero l'indirizzo finale, altrimenti la guardia non guarda niente");

ok(/"GET"/.test(src) && !/method: "POST"/.test(src), "la passata è di sola lettura: solo GET");
ok(!/anthropic|chiamaJson|chiamaEscape/i.test(src), "…e non chiama nessuna AI: non costa niente");

// L'elenco delle pagine: una ragione per ognuna, e nessun percorso che la
// sessione del robot non può aprire — sarebbe un corpus della pagina di login
// travestito da pagina di scuola.
ok(PAGINE.length >= 4, `l'elenco ha ${PAGINE.length} pagine`);
ok(
  PAGINE.every(([, ragione]) => typeof ragione === "string" && ragione.length > 15),
  "…ognuna con la ragione accanto: chi ne aggiunge una deve sapere perché ci sono queste",
);
const altrui = PAGINE.filter(([p]) => /^\/(scuola|ente|docente|admin)\b/.test(p)).map(([p]) => p);
ok(
  altrui.length === 0,
  altrui.length === 0
    ? "…e nessuna appartiene a un altro ruolo: la sessione del robot è di uno studente, e là restituirebbe il login"
    : `pagine di altri ruoli, che darebbero il corpus del login: ${altrui.join(", ")}`,
);

console.log(falliti === 0 ? "\n✅ tutto verde\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
