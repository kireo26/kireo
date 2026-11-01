// GLI ENTI NELL'AREA ADMIN, LOTTO 2 (Mario, 01/11): l'elenco in ordine alfabetico, con la
// ricerca e i filtri che non si perdono, la pagina di un ente con le decisioni
// che stavano nella pagina provvisoria, il flusso ristretto a lui. Gli attesi
// sono scritti a mano.
//
// Esecuzione: `npm run test:enti`.
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");

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
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true, jsx: "react-jsx" },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

let fatte = 0;
let falliti = 0;
function ok(cond, msg, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    falliti++;
    console.log(`  ✗ ${msg}${dettaglio ? ` [${dettaglio}]` : ""}`);
  }
}
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

function clientFinto(risposte) {
  const filtri = [];
  const catena = (tabella) => {
    const r = risposte[tabella] ?? { data: [], count: 0, error: null };
    const c = {};
    for (const m of ["select", "in", "neq", "not", "gte", "order", "limit", "range", "or", "ilike"]) c[m] = () => c;
    c.eq = (col, v) => (filtri.push([tabella, col, v]), c);
    c.then = (ok, ko) => Promise.resolve(r).then(ok, ko);
    return c;
  };
  return { filtri, from: (t) => catena(t) };
}

(async () => {
  const E = require("@/lib/admin/enti");

  console.log("§1 i filtri dell'elenco");
  ok(E.filtroDa(undefined) === "tutti" && E.filtroDa("boh") === "tutti", "un filtro assente o storto è «Tutti»");
  ok(E.filtroDa("cambio_piano") === "cambio_piano" && E.filtroDa("in_attesa") === "in_attesa", "un filtro noto resta");
  ok(E.hrefFiltro("tutti") === "/admin/enti", "«Tutti» è l'indirizzo pulito");
  ok(E.hrefFiltro("sospesa", "Brera") === "/admin/enti?stato=sospesa&q=Brera", "un filtro porta con sé la ricerca");
  ok(JSON.stringify(E.FILTRI_ENTI.map((f) => f.chiave)) === JSON.stringify(["tutti", "in_attesa", "attiva", "sospesa", "cambio_piano", "segnalati"]),
    "sei filtri: tutti, i tre stati, il cambio di piano e le conversazioni segnalate");

  console.log("\n§2 i filtri che guardano un'altra tabella: non letto non è nessuno");
  {
    const rotto = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "giù" } }) }) }) };
    ok((await E.idEntiPerFiltro(rotto, "segnalati")) === null, "una lettura fallita dei segnalati è null");
    const unoDue = { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [{ istituzione_id: "a" }, { istituzione_id: "a" }, { istituzione_id: "b" }], error: null }) }) }) };
    ok(JSON.stringify(await E.idEntiPerFiltro(unoDue, "cambio_piano")) === JSON.stringify(["a", "b"]), "gli enti con un cambio di piano, una volta sola");
    ok((await E.idEntiPerFiltro(unoDue, "attiva")) === undefined, "un filtro di stato non guarda altre tabelle");
  }

  console.log("\n§3 la scheda dell'ente: null su una forma inattesa, e chi segue diviso");
  ok(E.leggiScheda(null) === null && E.leggiScheda({ seguaci_studenti: 1 }) === null, "una forma incompleta è null, non zeri");
  ok(E.leggiScheda({ seguaci_studenti: null, seguaci_altri: 0, account: [] }) === null, "un conteggio null non diventa zero");
  const sch = E.leggiScheda({ seguaci_studenti: "3", seguaci_altri: 0, account: [{ nome: "Rita", cognome: "E", email: "r@x.it", dal: "2026-10-01" }] });
  ok(sch && sch.seguaciStudenti === 3 && sch.account[0].email === "r@x.it", "la forma buona si legge", JSON.stringify(sch));
  ok(E.testoSeguaci({ seguaciStudenti: 3, seguaciAltri: 0, account: [] }) === "Studenti che lo seguono: 3", "senza altri account, solo gli studenti");
  ok(E.testoSeguaci({ seguaciStudenti: 3, seguaciAltri: 2, account: [] }) === "Studenti che lo seguono: 3 · altri account: 2", "gli altri account si contano a parte, mai come studenti");

  console.log("\n§4 l'elenco: alfabetico, cercato per nome, il totale, i filtri che non si perdono");
  {
    const s = leggi("app/admin/enti/page.tsx");
    ok(/\.order\("nome", \{ ascending: true \}\)/.test(s), "in ordine alfabetico per nome");
    ok(/\.ilike\("nome",/.test(s), "la ricerca guarda il nome");
    ok(/count: "exact"/.test(s) && /testoTotale\(/.test(s), "legge il totale e lo scrive");
    ok(/T\.nonLetti/.test(s) && /T\.filtroNonLetto/.test(s), "una lettura fallita (dell'elenco o del filtro) si dice");
    ok(/nascosti=\{/.test(s) && /extra=\{/.test(s), "la ricerca e le pagine portano con sé il filtro");
    ok(/href=\{`\/admin\/enti\/\$\{e\.id\}`\}/.test(s), "ogni ente apre la sua pagina");
    ok(!/PROVVISORIA/.test(fs.readFileSync(path.join(ROOT, "app/admin/enti/page.tsx"), "utf8")), "la pagina provvisoria è uscita nello stesso commit");
    // Dal 01/11 (Mario) l'elenco attiva un ente in attesa dalla riga: è l'unica
    // decisione che ci sta, perché il filtro «In attesa» esiste per farla.
    // Le altre restano nella pagina dell'ente.
    for (const c of ["RevocaArea", "AzioneApprovazioneUpgrade", "AzioneChiudiConversazione"]) ok(!new RegExp(`<${c}\\b`).test(s), `l'elenco non decide (${c} sta nella pagina dell'ente)`);
    const piatto = s.replace(/\s+/g, " ");
    ok(/e\.stato === "in_attesa" && \( <> .*<AttivaIstituzioneButton istituzioneId=\{e\.id as string\} nome=\{e\.nome as string\}/.test(piatto), "«Attiva» dalla riga, solo per un ente in attesa, con il suo nome");
    ok((s.match(/<AttivaIstituzioneButton\b/g) || []).length === 1, "un bottone solo per riga");
    ok(/testoAccountInAttesa\(/.test(s) && /rpc\("scheda_admin_ente"/.test(s), "la riga in attesa dice l'email dell'account, letta dalla funzione dell'admin");
    const r = leggi("components/admin/Ricerca.tsx");
    ok(/type="hidden"/.test(r), "la ricerca sa portare un campo nascosto");
    ok(/new URLSearchParams\(extra\)/.test(leggi("components/admin/Paginazione.tsx")), "le pagine sanno portare un filtro");
  }

  console.log("\n§4bis attivare: una conferma che nomina l'ente, e «fatto» solo se il database lo dice");
  {
    const A = require(path.join(ROOT, "lib/admin/attivaEnte.ts"));
    ok(A.TESTI_ATTIVA_ENTE.domanda("Musica Academy") === "Attivare Musica Academy?", "la conferma nomina l'ente", A.TESTI_ATTIVA_ENTE.domanda("Musica Academy"));
    ok(A.esitoAttivazione([{ stato: "attiva" }]) === "attivato", "una riga riletta attiva è «fatto»");
    ok(A.esitoAttivazione([]) === "non_toccato", "zero righe toccate non è «fatto» (la RLS filtra senza errore)");
    ok(A.esitoAttivazione([{ stato: "in_attesa" }]) === "non_toccato", "una riga rimessa da un trigger non è «fatto»");
    ok(A.esitoAttivazione(null) === "errore", "una scrittura fallita è un errore");
    const b = senzaCommenti(leggi("components/admin/AttivaIstituzioneButton.tsx"));
    ok(/\.update\(\{ stato: "attiva" \}\)\.eq\("id", istituzioneId\)\.select\("stato"\)/.test(b), "l'attivazione rilegge la riga");
    ok(/esitoAttivazione\(/.test(b) && /esito !== "attivato"/.test(b), "decide dall'esito riletto");
    const iRefresh = ancora(b, "router.refresh()");
    const iEsito = ancora(b, 'esito !== "attivato"');
    ok(iEsito > 0 && iRefresh > iEsito, "la pagina si rilegge solo dopo un'attivazione confermata");
    ok(/T\.domanda\(nome\)/.test(b) && /setChiedi\(true\)/.test(b), "il primo clic chiede, non attiva");
    const E = require(path.join(ROOT, "lib/admin/enti.ts"));
    ok(/^Non siamo riusciti/.test(E.testoAccountInAttesa(null)), "un account non letto si dice, non diventa «nessuno»");
    ok(E.testoAccountInAttesa({ seguaciStudenti: 0, seguaciAltri: 0, account: [{ nome: "R", cognome: "E", email: "rita@ente.it", dal: null }] }) === "Account: rita@ente.it", "la riga dice l'email");
  }

  console.log("\n§5 la pagina dell'ente: le decisioni che c'erano, e niente letto di nascosto");
  {
    const s = leggi("app/admin/enti/[id]/page.tsx");
    for (const c of ["AttivaIstituzioneButton", "RevocaArea", "AzioneApprovazioneUpgrade", "AzioneChiudiConversazione", "GruppiFlusso"]) ok(new RegExp(`<${c}\\b`).test(s), `monta ${c}`);
    ok(/ente\.stato === "in_attesa" && <AttivaIstituzioneButton/.test(s.replace(/\s+/g, " ")), "attivare solo un ente in attesa");
    ok(/r\.stato === "in_attesa" && <AzioneApprovazioneUpgrade/.test(s.replace(/\s+/g, " ")), "decidere solo un cambio di piano in attesa");
    ok(/rpc\("scheda_admin_ente"/.test(s), "chi segue e gli account dalla funzione dell'admin");
    ok(/caricaStatisticheDiUnEnte\(id\)/.test(s) && !/rpc\("statistiche_ente"/.test(s), "i numeri dalla stessa lettura dell'ente, non chiamata da qui");
    ok(/leggiFlusso\(supabase, new Date\(\), id\)/.test(s), "il flusso ristretto a questo ente");
    ok(!/messaggi_enti/.test(s), "i messaggi delle conversazioni non si leggono da qui (decisione aperta)");
    ok(!/note_revisione|motivo_rimozione|motivo_rifiuto/.test(s), "nessuna colonna che il client non legge");
    for (const sez of ["chi", "aree", "piano", "pubblica", "numeri", "conversazioni", "attivita"]) ok(s.includes(`id="${sez}"`), `la sezione #${sez}`);
    const c = leggi("lib/ente/caricaStatistiche.ts");
    ok((c.match(/rpc\("statistiche_ente"/g) ?? []).length === 1, "statistiche_ente si chiama una volta sola, nel caricatore");
  }

  console.log("\n§6 il flusso ristretto a un ente");
  {
    const F = require("@/lib/admin/flusso");
    const conEnte = F.DEFINIZIONI.filter((d) => d.colonnaEnte).map((d) => d.chiave);
    ok(JSON.stringify(conEnte) === JSON.stringify(["eventi", "post", "post_tolti", "newsletter", "enti", "upgrade"]), "i gruppi che hanno un ente", conEnte.join());
    const cl = clientFinto({});
    const g = await F.leggiFlusso(cl, new Date("2026-11-01T10:00:00Z"), "ENTE");
    ok(g.length === 6 && !g.some((x) => x.chiave === "scuole" || x.chiave === "messaggi_scuola"), "le scuole non entrano nel flusso di un ente");
    const sulEnte = cl.filtri.filter(([, , v]) => v === "ENTE").map(([t, col]) => `${t}.${col}`);
    ok(sulEnte.includes("eventi.organizzatore_id") && sulEnte.includes("istituzioni.id") && sulEnte.filter((x) => x === "post_enti.istituzione_id").length === 2,
      "ogni gruppo è filtrato sulla colonna del suo ente", sulEnte.join());
    const tutti = await F.leggiFlusso(clientFinto({}), new Date("2026-11-01T10:00:00Z"));
    ok(tutti.length === F.DEFINIZIONI.length, "senza un ente, il flusso è quello di tutti");
    ok(F.DEFINIZIONI.find((d) => d.chiave === "upgrade").href === "/admin/enti?stato=cambio_piano", "il gruppo dei cambi di piano porta al filtro");
  }

  console.log("");
  if (falliti > 0) {
    console.error(`✗ ${falliti} su ${fatte} proprietà (npm run test:enti)`);
    process.exit(1);
  }
  console.log(`✓ ${fatte}/${fatte} proprietà (npm run test:enti)`);
})();
