// I tipi di attività: due liste che nessuno aggiorna insieme, e una parola che
// è vera su una sola di loro.
//
// ═══ PERCHÉ ESISTE, dal 2026-09-29 ═══
// `tipo_attivita` vive in DUE posti che non si parlano: l'enum Postgres (creato
// in 20260712150000, esteso da ogni `alter type … add value`) e `PESI_ATTIVITA`
// in lib/app/activityLog.ts, che è la mappa da cui nasce il tipo `TipoAttivita`
// e quindi l'obbligo di scrivere un'etichetta per ognuno. Il compilatore tiene
// insieme la mappa e le etichette; NESSUNO teneva insieme la mappa e l'enum —
// un valore aggiunto solo in SQL sarebbe finito a schermo come «Attività
// registrata», un valore aggiunto solo in TypeScript avrebbe fatto fallire
// l'insert con un errore di Postgres.
//
// ═══ E LA PAROLA «PCTO» ═══
// Fino al 29/09 `workshop_pcto` era scritto da TRE strade diverse (progetto
// KIREO concluso / presenza certificata su un evento di tipo workshop / vecchio
// caricamento file v1), con lo stesso peso e nessuna colonna che dicesse quale.
// «PCTO» era vero su UNA: le ore nascono solo da una certificazione con un
// responsabile nominato. Dalla separazione dei nomi la parola resta dove è
// vera, e questo controllo lo tiene fermo — perché rimetterla sull'altra
// etichetta è, di nuovo, la cosa premurosa che viene in mente per prima.
//
// ═══ LA METÀ «COSA GUARDA» ═══
// Ogni estrattore dice quanto ha selezionato, e un estrattore che torna a mani
// vuote FALLISCE invece di passare in silenzio: un controllo che non vede
// l'ingresso è verde su tutto e sembra sano da fuori (la regola pagata il 26/09
// in test:guardie). I due elenchi si confrontano nei DUE versi: «manca in SQL»
// e «manca in TypeScript» hanno cure opposte.
//
// Le etichette non si leggono dal sorgente: si CHIEDONO alla funzione che le
// produce, con un client finto. Una regex su `ETICHETTE_TIPO` direbbe che la
// frase è scritta, non che arriva a chi legge.
//
// Esecuzione: `npm run test:attivita`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");

abilitaTypeScript();

const { PESI_ATTIVITA } = require("@/lib/app/activityLog");
const { getPercorsoEsplorazione } = require("@/lib/app/attivita");

let falliti = 0;
let passati = 0;
function ok(cond, msg) {
  if (cond) { passati++; console.log(`  ✓ ${msg}`); }
  else { falliti++; console.log(`  ✗ FAIL ${msg}`); }
}

const DIR = path.join(ROOT, "supabase", "migrations");
const FILE = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const sql = (f) => senzaCommentiSql(fs.readFileSync(path.join(DIR, f), "utf8"));

// ── 1) i valori dell'enum, dalle migrazioni ─────────────────────────────────
console.log("\n1) L'enum tipo_attivita, letto dalle migrazioni");

const valoriSql = [];
for (const f of FILE) {
  const src = sql(f);
  const create = /create type public\.tipo_attivita as enum\s*\(([^)]*)\)/i.exec(src);
  if (create) for (const m of create[1].matchAll(/'([a-z_]+)'/g)) valoriSql.push(m[1]);
  for (const m of src.matchAll(/alter type public\.tipo_attivita add value(?: if not exists)? '([a-z_]+)'/gi)) valoriSql.push(m[1]);
}
ok(valoriSql.length > 0, `l'estrattore vede ${valoriSql.length} valori nelle migrazioni (a mani vuote sarebbe verde su tutto)`);
ok(new Set(valoriSql).size === valoriSql.length, "nessun valore è dichiarato due volte");

// ── 2) le due liste coincidono, nei due versi ───────────────────────────────
console.log("\n2) SQL e TypeScript dicono gli stessi tipi");

const chiaviTs = Object.keys(PESI_ATTIVITA);
const soloSql = valoriSql.filter((v) => !chiaviTs.includes(v));
const soloTs = chiaviTs.filter((v) => !valoriSql.includes(v));
ok(
  soloSql.length === 0,
  `nessun valore esiste solo in SQL${soloSql.length ? ` (${soloSql.join(", ")}: a schermo diventerebbe «Attività registrata»)` : ""}`,
);
ok(
  soloTs.length === 0,
  `nessuno esiste solo in TypeScript${soloTs.length ? ` (${soloTs.join(", ")}: l'insert fallirebbe su Postgres)` : ""}`,
);
ok(valoriSql.length === chiaviTs.length, `e i conti tornano: ${valoriSql.length} in SQL, ${chiaviTs.length} in TypeScript`);

// ── 3) le etichette, chieste alla funzione che le produce ───────────────────
//
// Client finto: `getPercorsoEsplorazione` costruisce una catena
// from().select().eq().order().limit() e attende l'ultima. Ogni metodo
// restituisce lo stesso oggetto, che è thenable.
console.log("\n3) Ogni tipo ha una frase sua, e arriva a chi legge");

function clientFinto(righe) {
  const chain = {
    from: () => chain,
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (res) => res({ data: righe, error: null }),
  };
  return chain;
}

const AREA = "informatica-digitale";
const righe = chiaviTs.map((t, i) => ({ id: `r${i}`, area_slug: AREA, tipo_attivita: t, livello: null, created_at: "2026-09-29T10:00:00Z" }));

(async () => {
  const voci = await getPercorsoEsplorazione(clientFinto(righe), "u1");
  ok(voci.length === chiaviTs.length, `le ${chiaviTs.length} righe finte tornano tutte etichettate (${voci.length})`);

  const generiche = voci.filter((v) => v.testo === "Attività registrata");
  ok(generiche.length === 0, `nessun tipo cade sulla frase generica${generiche.length ? ` (${generiche.length})` : ""}`);

  const testi = voci.map((v) => v.testo);
  const doppie = testi.filter((t, i) => testi.indexOf(t) !== i);
  ok(doppie.length === 0, `due tipi non raccontano lo stesso fatto con la stessa frase${doppie.length ? ` (${doppie.join(" / ")})` : ""}`);

  // ── 4) «PCTO» su una sola etichetta, e su quella giusta ───────────────────
  //
  // Le ore PCTO esistono solo dove qualcuno le certifica: un progetto workshop
  // KIREO non ha un monte ore (la tabella `workshop` ha `durata_giorni`) e non
  // ha nessuna catena di responsabilità — l'ha giudicato un'AI.
  console.log("\n4) «PCTO» sta dove è vero");

  const conPcto = voci.filter((v) => /PCTO/.test(v.testo)).map((v) => v.id);
  const idPcto = `r${chiaviTs.indexOf("workshop_pcto")}`;
  ok(conPcto.length === 1, `la parola «PCTO» compare in una sola etichetta (${conPcto.length})`);
  ok(conPcto[0] === idPcto, "…e in quella della presenza certificata su un evento, non in quella del progetto KIREO");

  const progetto = voci.find((v) => v.id === `r${chiaviTs.indexOf("workshop_progetto")}`);
  ok(progetto != null && !/PCTO/.test(progetto.testo), `l'etichetta del progetto non promette ore: «${progetto?.testo}»`);

  // ── 5) chi scrive quale valore, nelle definizioni VIVE ────────────────────
  //
  // L'ultima definizione di una funzione è quella viva (stessa regola di
  // test:guardie): rieseguire il corpo di una migrazione vecchia rimetterebbe
  // il nome condiviso senza che niente si rompa.
  console.log("\n5) Le tre strade scrivono tre nomi (definizione viva)");

  function corpoVivo(nome) {
    let trovato = null;
    for (const f of FILE) {
      const src = sql(f);
      const i = src.search(new RegExp(`create (?:or replace )?function public\\.${nome}\\s*\\(`, "i"));
      if (i === -1) continue;
      const fine = src.indexOf("$$;", i);
      trovato = { file: f, corpo: src.slice(i, fine === -1 ? src.length : fine) };
    }
    return trovato;
  }

  for (const [nome, atteso, altro] of [
    ["avanza_fase_workshop", "workshop_progetto", "workshop_pcto"],
    ["certifica_presenza", "workshop_pcto", "workshop_progetto"],
    ["chiudi_diretta_evento", "workshop_pcto", "workshop_progetto"],
  ]) {
    const v = corpoVivo(nome);
    ok(v !== null, `${nome}: la definizione viva si trova${v ? ` (${v.file})` : ""}`);
    ok(v !== null && v.corpo.includes(`'${atteso}'`), `${nome} scrive '${atteso}'`);
    ok(v !== null && !v.corpo.includes(`'${altro}'`), `…e non '${altro}'`);
  }

  // ── 6) i due tipi di workshop non si scrivono dal browser ─────────────────
  //
  // LA STRADA MORTA. Fino al 2026-08-29 il caricamento file dei workshop v1
  // chiamava `registraAttivita(areaSlug, "workshop_pcto")` da un componente
  // client: una TERZA strada verso lo stesso nome, che ha lasciato righe
  // indistinguibili dalle altre due. Il punto d'ingresso è chiuso (la route
  // risponde 410 e il componente non è montato da nessuna parte), ma la riga è
  // rimasta lì fino al 29/09 — e sarebbe tornata a scrivere al primo che
  // rimonta il blocco.
  //
  // Le due scritture legittime le fanno solo funzioni SQL, dove c'è un fatto da
  // registrare: la chiusura di un progetto e la certificazione di una presenza.
  // Nessuna delle due nasce da un clic, quindi dal browser non si scrive
  // nessuna delle due — e questa è la guardia che lo tiene fermo.
  console.log("\n6) Nessun tipo di workshop si scrive dal browser");

  const filesTs = [];
  function raccogli(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) raccogli(p);
      else if (/\.tsx?$/.test(e.name)) filesTs.push(p);
    }
  }
  for (const d of ["app", "components", "lib"]) raccogli(path.join(ROOT, d));
  ok(filesTs.length > 100, `l'estrattore legge ${filesTs.length} file di prodotto (troppo pochi = non sta guardando)`);

  const chiamanti = [];
  for (const p of filesTs) {
    const src = senzaCommenti(fs.readFileSync(p, "utf8"));
    for (const m of src.matchAll(/registraAttivita\s*\(([^)]*)\)/g)) chiamanti.push({ file: path.relative(ROOT, p), args: m[1] });
  }
  ok(chiamanti.length > 0, `e vede ${chiamanti.length} chiamate a registraAttivita (a zero sarebbe verde su niente)`);

  const colpevoli = chiamanti.filter((c) => /workshop_(pcto|progetto)/.test(c.args));
  ok(
    colpevoli.length === 0,
    `nessuna chiamata client scrive un tipo di workshop${colpevoli.length ? ` (${colpevoli.map((c) => c.file).join(", ")})` : ""}`,
  );

  console.log("");
  if (falliti > 0) { console.error(`✗ ${falliti} verifiche fallite (${passati} superate)`); process.exit(1); }
  console.log(`✓ Tutte le ${passati} verifiche dei tipi di attività superate.`);
})();
