/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LE ORE PCTO DI UN EVENTO: come si scrivono, chi le calcola, chi le corregge.
//
// ⚠️ NON CONFONDERLO CON `verifica-ore-pcto.js` (`npm run test:ore`), che è la
// guardia sulla FRASE DEL CONTATORE che lo studente legge («1 ora certificata
// su 90»).
//
// ⚠️ FINO AL 26/10 QUESTA SUITE SORVEGLIAVA L'AVVISO SULLE ORE SOSPETTE
// (`avvisoOrePcto`: «Stai dichiarando 0,5 ore per un incontro di 5 minuti»).
// Con `20261029100000` le ore dichiarate SONO la durata della finestra, le
// calcola il database, e l'avviso è uscito insieme al campo: confrontava un
// numero con sé stesso. Le proprietà sull'avviso sono uscite con lui (stanno
// nella storia, `git log -S avvisoOrePcto`); quelle che restano vere restano.
//
//   §1 COME SI SCRIVE UN'ORA E UNA DURATA: `numeroOre`, `durataLeggibile`, e
//      nessuna pagina che stampi un numero grezzo.
//   §2 IL CAMPO CHE RESTA è quello della correzione dell'admin: due decimali,
//      e un terzo si rifiuta invece di sparire in silenzio.
//   §3 I TESTI DICONO I NUMERI, e li ricevono dal database: nessuna copia
//      della formula in TypeScript.
//   §4 I TRE FORM: la creazione non manda più le ore e pretende la fine; lo
//      spostamento non parte senza l'anteprima delle sue date; la correzione
//      passa dalla funzione dell'admin, non da un update.

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { senzaCommenti } = require("./lib/senza-commenti.js");
const { ancora, fetta } = require("./lib/ancora.js");
const ts = require("typescript");

const RADICE = join(__dirname, "..");
let fatte = 0;
let falliti = 0;

function ok(condizione, cosa, dettaglio) {
  fatte++;
  if (condizione) {
    console.log(`  ✓ ${cosa}`);
  } else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

const leggi = (rel) => senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));

function caricaModulo(rel, risolvi) {
  const js = ts.transpileModule(readFileSync(join(RADICE, rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  new Function("require", "module", "exports", js)((n) => risolvi(n), modulo, modulo.exports);
  return modulo.exports;
}

const formato = caricaModulo("lib/formato.ts", () => {
  throw new Error("lib/formato.ts non deve importare niente");
});
const { durataLeggibile, erroreOrePcto, numeroOre } = caricaModulo(
  "lib/eventi/orePcto.ts",
  (nome) => {
    if (nome === "@/lib/formato") return formato;
    throw new Error(`import non previsto: ${nome}`);
  },
);

const orePcto = { durataLeggibile, erroreOrePcto, numeroOre };
const D = caricaModulo("lib/eventi/oreDallOrario.ts", (nome) => {
  if (nome === "@/lib/formato") return formato;
  if (nome === "@/lib/eventi/orePcto") return orePcto;
  throw new Error(`import non previsto: ${nome}`);
});

console.log("\n§1 — come si scrivono le ore e le durate\n");

{
  ok(durataLeggibile(5 / 60) === "5 minuti", "«5 minuti»", durataLeggibile(5 / 60));
  ok(durataLeggibile(1 / 60) === "1 minuto", "«1 minuto» al singolare", durataLeggibile(1 / 60));
  ok(durataLeggibile(1) === "1 ora", "«1 ora» al singolare", durataLeggibile(1));
  ok(durataLeggibile(2) === "2 ore", "«2 ore»", durataLeggibile(2));
  ok(durataLeggibile(1.5) === "1 ora e 30 minuti", "«1 ora e 30 minuti»", durataLeggibile(1.5));
  ok(!/1 ore|1 minuti|2 ora\b/.test([1, 2, 1 / 60, 2 / 60, 1.5].map(durataLeggibile).join(" ")), "nessun accordo sbagliato");
  ok(numeroOre(0.75) === "0,75" && numeroOre("1.50") === "1,50" && numeroOre(1.1 + 2.2) === "3,30" && numeroOre(0.4) === "0,40" && numeroOre(2) === "2" && numeroOre("1.00") === "1", "le ore si stampano con la virgola, senza rumore, con due decimali se non intere (anche da stringa)");
  // NESSUNA ORA GREZZA NELLE PAGINE: sei posti stampavano `{x.ore_pcto}h` col
  // punto. Si cerca la forma, non i sei file: il settimo nascerebbe uguale.
  {
    const { readdirSync, statSync } = require("node:fs");
    const grezze = [];
    const scorri = (dir) => {
      for (const n of readdirSync(join(RADICE, dir))) {
        const rel = join(dir, n);
        if (statSync(join(RADICE, rel)).isDirectory()) { if (n !== "node_modules") scorri(rel); continue; }
        if (!/\.tsx$/.test(n)) continue;
        const t = senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));
        // I nomi sono quelli delle ore di un EVENTO e quelli delle ore di uno
        // STUDENTE (26/10): con i soli primi, `{v.oreCertificate}h` nel riquadro
        // PCTO di /app/attivita stampava «0.4h» col punto e nessuno lo vedeva.
        // Esclusi per forma, non per file: `value={orePcto}` è la stringa che
        // l'ente sta digitando, `{errori.orePcto}` è un messaggio d'errore.
        for (const m of t.matchAll(/\{\s*[\w?.]*(?:ore_pcto|orePcto|totaleOrePcto|ore_pcto_totali|oreCertificate|ore_certificate|oreRiconosciute|ore_riconosciute)[\w?. ]*(?:\?\?\s*0)?\s*\}/g)) {
          // Un valore PASSATO (`prop={ore}`, compreso `value=`) o una
          // destrutturazione (`{ ore }: …`) non stampa niente: lo stampa chi lo riceve.
          if (/errori\./.test(m[0]) || /=$/.test(t.slice(Math.max(0, m.index - 1), m.index)) || /^\s*:/.test(t.slice(m.index + m[0].length))) continue;
          grezze.push(`${rel}: ${m[0]}`);
        }
        for (const m of t.matchAll(/\$\{\s*[\w?.]*(?:ore_pcto|orePcto|oreCertificate|ore_certificate|oreRiconosciute|ore_riconosciute)\s*\}h/g)) grezze.push(`${rel}: ${m[0]}`);
      }
    };
    scorri("app"); scorri("components");
    ok(grezze.length === 0, "nessuna pagina stampa un numero di ore senza passare da `numeroOre`", grezze.join(" | "));
  }
}

console.log("\n§2 — il campo che resta: la correzione dell'admin\n");

{
  ok(erroreOrePcto("abc") !== null && erroreOrePcto("Infinity") !== null, "il rifiuto chiede un numero finito");
  ok(erroreOrePcto("-1") !== null, "e non negativo");
  ok(erroreOrePcto("0.75") === null, "quarantacinque minuti si scrivono (0,75)");
  ok(erroreOrePcto("0.750") === null, "…e gli zeri in coda non sono decimali persi");
  {
    const e = erroreOrePcto("0.755");
    ok(e !== null && /due decimali/.test(e), "un terzo decimale si RIFIUTA, invece di diventare 0,76 in silenzio", String(e));
  }
  const src = leggi("components/admin/CorreggiOreForm.tsx");
  ok(/erroreOrePcto\(valore\)/.test(src), "il form della correzione chiede la regola a `erroreOrePcto`, non la riscrive");
  ok(/rpc\("correggi_ore_evento"/.test(src), "e salva passando da `correggi_ore_evento`");
  // Un update diretto prenderebbe `permission denied` (privilegi di colonna), e
  // soprattutto non scriverebbe il segno: chi e quando.
  ok(!/\.from\("eventi"\)/.test(src) && !/\.update\(/.test(src), "e NON con un update diretto su `eventi`");
  ok(/rpc\("anteprima_correzione_ore"/.test(src), "le frasi sul massimo vengono da `anteprima_correzione_ore`");
  ok(/valore\.trim\(\) === ""/.test(src), "e un campo vuoto non è una correzione: si dice, non si manda zero");
  ok(/Scrivi quante ore vale l'incontro\./.test(src) && !/zero o più\."\s*:\s*erroreOrePcto/.test(src), "il campo vuoto chiede le ore, senza rispondere a un errore non ancora fatto");
  // IL NOME DI CHI HA CORRETTO (Mario): la promessa, la colonna, il blocco sulla
  // cancellazione e la riga che si legge sono una cosa sola.
  ok(/fissate a mano da \$\{fissateDa\}/.test(src), "la riga di stato nomina chi ha corretto");
  ok(/non siamo riusciti a leggere da chi/.test(src), "e senza un nome lo dice, invece di tacerlo");
  {
    const mod = leggi("lib/eventi/moderazione.ts");
    ok(/ore_pcto_fissate_da_nome: nomeCorrettore/.test(mod) && /\.from\("profiles"\)/.test(mod), "il nome lo legge la guardia della pagina, da `profiles`");
    const pag = leggi("app/diretta/[id]/page.tsx");
    ok(/fissateDa=\{evento\.ore_pcto_fissate_da_nome\}/.test(pag), "e la pagina lo passa al form");
  }
  // La riga di stato non attribuisce le ore all'orario: per un evento di prima
  // del 26/10 le ha scritte l'ente, e il database non lo distingue.
  ok(!/calcolate dall'orario/.test(src), "la riga di stato non dice «calcolate dall'orario» (falso per gli eventi vecchi)");
}

console.log("\n§3 — i testi dicono i numeri, e li ricevono\n");

{
  ok(D.testoOreCreazione(0.33) === "Questo incontro vale 0,33 ore PCTO, calcolate dall'orario.", "creazione: «vale 0,33 ore PCTO, calcolate dall'orario»", D.testoOreCreazione(0.33));
  ok(D.testoOreCreazione("1.00").includes("1,00 ore"), "e un'ora intera si scrive 1,00, come nei testi di Mario", D.testoOreCreazione("1.00"));
  const base = { ore_attuali: "0.33", ore_nuove: "1.00", fissate_a_mano: false, aveva_fine: true };
  const t1 = D.testoAnteprimaSpostamento(base);
  ok(t1 === "Spostando l'orario, le ore dell'evento verranno ricalcolate sulla nuova durata: da 0,33 a 1,00.", "spostamento: i due numeri, da → a", String(t1));
  const t2 = D.testoAnteprimaSpostamento({ ...base, ore_attuali: "0.50", fissate_a_mano: true });
  ok(t2 === "Le ore erano state fissate a mano (0,50): verranno sostituite dal calcolo sulla nuova durata (1,00).", "con una correzione a mano: lo dice, con i due numeri", String(t2));
  const t3 = D.testoAnteprimaSpostamento({ ...base, ore_attuali: "3", aveva_fine: false });
  ok(t3 === "Questo incontro non aveva un orario di fine: con il nuovo orario varrà 1,00 ore.", "evento senza fine: il suo testo, non un errore", String(t3));
  ok(D.testoAnteprimaSpostamento({ ...base, ore_attuali: "1.00" }) === null, "stessa durata, nessuna correzione: nessuna frase");
  // L'ordine: la correzione a mano vince sul confronto anche quando i numeri
  // coincidono — è la cosa che lo spostamento distrugge.
  ok(D.testoAnteprimaSpostamento({ ...base, ore_attuali: "1.00", fissate_a_mano: true }) !== null, "una correzione a mano si dice anche quando il numero coincide");
  ok(/riprova il calcolo/.test(D.TESTO_ANTEPRIMA_FALLITA), "l'anteprima fallita dice cosa fare");

  const nonChiusa = { durata_minuti: "20", massimo: "0.33", chiusa: false, ha_fine: true };
  const c1 = D.testiCorrezioneOre(nonChiusa, 0.33);
  ok(
    c1.length === 1 && c1[0] === "Con l'orario previsto (20 minuti), le ore riconosciute non potranno superare 0,33. Se l'incontro finisce prima, quel massimo scende.",
    "correzione, non chiusa, entro il massimo: la frase di Mario con 20 minuti e 0,33",
    JSON.stringify(c1),
  );
  const c2 = D.testiCorrezioneOre(nonChiusa, 2);
  ok(
    c2.length === 1 && c2[0].startsWith("Nella certificazione automatica il massimo riconoscibile resta 0,33, calcolato sulla durata dell'incontro. Una scuola che certifica a mano i propri studenti riconoscerà invece il valore che scrivi qui. La correzione resta registrata con il tuo nome."),
    "sopra il massimo: la frase (i), che dice la differenza con la certificazione della scuola",
    JSON.stringify(c2),
  );
  // ⚠️ LA PROPRIETÀ CHE HA APERTO LA STRADA (i): sopra il massimo «non potranno
  // superare» è falso per la certificazione manuale, che non ha tetto.
  ok(!c2.some((r) => /non potranno superare/.test(r)), "e sopra il massimo NON promette un tetto che la scuola non ha");
  const chiusa = { durata_minuti: "30", massimo: "0.50", chiusa: true, ha_fine: true };
  const c3 = D.testiCorrezioneOre(chiusa, 0.4);
  ok(c3.length === 1 && c3[0] === D.TESTO_CORREZIONE_GIA_CHIUSA, "chiusa, entro il massimo: solo la frase delle presenze già certificate", JSON.stringify(c3));
  const c4 = D.testiCorrezioneOre(chiusa, 3);
  ok(c4.length === 2 && c4[0].includes("resta 0,50") && !c4[0].includes("finisce prima") && c4[1] === D.TESTO_CORREZIONE_GIA_CHIUSA, "chiusa, sopra: la (i) senza «finisce prima» — è già finito — e poi la chiusura", JSON.stringify(c4));
  // ⚠️ L'UNICO CASO SENZA TETTO NON TACE (Mario, 26/10): un evento senza fine,
  // mai chiuso, riconosce intero quello che l'admin scrive.
  {
    const senza = D.testiCorrezioneOre({ durata_minuti: null, massimo: null, chiusa: false, ha_fine: false }, 3);
    ok(senza.length === 1 && senza[0] === D.TESTO_CORREZIONE_SENZA_TETTO && /senza nessun tetto/.test(senza[0]), "evento senza fine: la frase del caso senza tetto, non il silenzio", JSON.stringify(senza));
    const senzaInvalido = D.testiCorrezioneOre({ durata_minuti: null, massimo: null, chiusa: false, ha_fine: false }, null);
    ok(senzaInvalido[0] === D.TESTO_CORREZIONE_SENZA_TETTO, "…anche con il campo non valido: non dipende dal valore");
  }
  // ⚠️ IL GEMELLO (Mario, 26/10): chiusa senza durata scritta è la seconda porta
  // del ramo senza tetto, e la prima stesura mostrava solo la riga della
  // chiusura — la metà che non dice la cosa pericolosa. Oggi il vincolo
  // `eventi_durata_con_chiusura` la rende irraggiungibile (lo prova
  // `scripts/verifica-ore-dall-orario.sql`), ma se si raggiungesse deve parlare.
  {
    const gemello = D.testiCorrezioneOre({ durata_minuti: null, massimo: null, chiusa: true, ha_fine: true }, 3);
    ok(
      gemello.length === 1 && gemello[0] === D.TESTO_CORREZIONE_CHIUSA_SENZA_DURATA && /per intero/.test(gemello[0]) && /restano con le ore di allora/.test(gemello[0]),
      "chiusa senza durata: dice che non c'è un massimo E che le presenze restano, non solo la seconda",
      JSON.stringify(gemello),
    );
  }
  // ⚠️ UN VALORE NON LETTO NON SI GIUDICA (Mario): con il campo non valido si
  // dice il massimo e basta — né la (i) né un «entro».
  {
    const nc = D.testiCorrezioneOre(nonChiusa, null);
    ok(nc.length === 1 && nc[0].startsWith("Con l'orario previsto (20 minuti)") && !/scrivi qui/.test(nc[0]), "campo non valido, non chiusa: il massimo dell'incontro, senza confronto", JSON.stringify(nc));
    const ch = D.testiCorrezioneOre(chiusa, null);
    ok(
      ch.length === 2 && ch[0] === "Nella certificazione automatica il massimo riconoscibile è 0,50, calcolato sulla durata dell'incontro." && ch[1] === D.TESTO_CORREZIONE_GIA_CHIUSA,
      "campo non valido, chiusa: il massimo (all'indicativo, senza «resta») e la chiusura",
      JSON.stringify(ch),
    );
  }

  // NESSUNA COPIA DELLA FORMULA in TypeScript (Mario): i numeri vengono da SQL.
  const sorgenti = ["lib/eventi/oreDallOrario.ts", "components/ente/CreaEventoForm.tsx", "components/ente/SpostaFinestraForm.tsx", "components/admin/CorreggiOreForm.tsx"];
  const copie = sorgenti.filter((f) => /\/\s*36\b|3[_]?600[_]?000|\/\s*60\s*\*\s*100|Math\.floor/.test(leggi(f)));
  ok(copie.length === 0, "nessuno dei quattro file ricalcola le ore dalle date", copie.join(", "));
}

console.log("\n§4 — i tre form\n");

{
  const crea = leggi("components/ente/CreaEventoForm.tsx");
  ok(!/ore_pcto\s*:/.test(crea), "la creazione NON manda più `ore_pcto` (la migrazione B la rifiuterebbe)");
  ok(!/id="orePcto"/.test(crea) && !/setOrePcto/.test(crea), "e il campo delle ore non c'è più");
  ok(/rpc\("ore_dichiarate_da_finestra"/.test(crea), "il numero sotto le date viene da `ore_dichiarate_da_finestra`");
  ok(/testoOreCreazione\(/.test(crea) && /TESTO_ORE_CREAZIONE_SENZA_NUMERO/.test(crea), "con la frase col numero, e quella senza quando il calcolo non risponde");
  let validate = "";
  try {
    validate = fetta(crea, { nome: "function validate(", dove: "la validazione" }, { nome: "const inizioItaliano", dove: "subito dopo" });
  } catch (e) {
    ok(false, "la fetta di `validate` si ritaglia", e.message);
  }
  // La fine obbligatoria per TUTTI, non solo per i webinar: il ramo sta fuori da `if (eDiretta)`.
  try {
    const iDiretta = ancora(validate, "if (eDiretta) {", { dove: "il ramo dei webinar" });
    const iFine = ancora(validate, "if (!dataFine)", { dove: "la fine obbligatoria" });
    ok(iFine < iDiretta, "la fine è obbligatoria per ogni evento, non solo dentro il ramo dei webinar");
  } catch (e) {
    ok(false, "le due àncore di `validate` non sono ambigue", e.message);
  }
  ok(!/\(facoltativa\)/.test(crea), "e l'etichetta non dice più «facoltativa»");
  try {
    const i = ancora(crea, "{chiaveOre && oreCorrenti &&", { dove: "la riga delle ore" });
    const blocco = crea.slice(i, i + 200);
    ok(blocco.includes("!errori.dataInizio") && blocco.includes("!errori.dataFine"), "la riga delle ore tace quando una delle due date è in errore");
  } catch (e) {
    ok(false, "l'àncora della riga delle ore non è ambigua", e.message);
  }

  const sposta = leggi("components/ente/SpostaFinestraForm.tsx");
  ok(/rpc\("anteprima_spostamento_finestra"/.test(sposta), "lo spostamento chiede l'anteprima con le sue date");
  ok(/testoAnteprimaSpostamento\(/.test(sposta), "e la dice con `testoAnteprimaSpostamento`");
  // L'anteprima che non risponde BLOCCA, con il testo e un modo di riprovare.
  let salva = "";
  try {
    salva = fetta(sposta, { nome: "async function salva(", dove: "il salvataggio" }, { nome: "if (!aperto) {", dove: "il bottone chiuso" });
  } catch (e) {
    ok(false, "la fetta di `salva` si ritaglia", e.message);
  }
  try {
    const iBlocco = ancora(salva, 'if (anteprimaCorrente?.tipo !== "pronta") return;', { dove: "il blocco senza anteprima" });
    const iRpc = ancora(salva, 'rpc("sposta_finestra_evento"', { dove: "lo spostamento" });
    ok(iRpc > iBlocco, "senza l'anteprima di QUESTE date lo spostamento non parte (il controllo sta prima della chiamata)");
  } catch (e) {
    ok(false, "le due àncore di `salva` non sono ambigue", e.message);
  }
  ok(/anteprima\.chiave === chiave/.test(sposta), "e un'anteprima vale solo per la coppia di date con cui è stata chiesta");
  ok(/TESTO_ANTEPRIMA_FALLITA/.test(sposta) && /Riprova il calcolo/.test(sposta), "il fallimento si dice, con un bottone per riprovare");
  // ⚠️ IL BOTTONE È SPENTO ANCHE AD ANTEPRIMA FALLITA (Mario: «le frasi si
  // leggono, i bottoni si credono»), non solo durante il calcolo.
  ok(/anteprimaNonPronta = chiave !== null && anteprimaCorrente\?\.tipo !== "pronta"/.test(sposta) && /disabled=\{salvataggio \|\| anteprimaNonPronta\}/.test(sposta), "il bottone è spento finché l'anteprima di queste date non è pronta — anche quando è fallita");
  // La fine uguale all'inizio non fa nascere un'anteprima: non è un incontro.
  ok(/new Date\(fineItaliano\)\.getTime\(\) > new Date\(inizioItaliano\)\.getTime\(\)/.test(crea), "nella creazione la durata zero non chiede le ore: non è un incontro");
  {
    const v = (() => { try { return fetta(crea, { nome: "function validate(", dove: "la validazione" }, { nome: "const inizioItaliano", dove: "subito dopo" }); } catch { return ""; } })();
    const testi = [...v.matchAll(/"(Inserisci data e ora di fine: [^"]+)"/g)].map((m) => m[1]);
    ok(testi.length === 2, "i due testi della fine mancante hanno la stessa forma («Inserisci data e ora di fine: servono a…»)", JSON.stringify(testi));
  }
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
