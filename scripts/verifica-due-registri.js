// «LE MIE ATTIVITÀ» NON DICE ZERO A CHI HA FATTO TRE MISSIONI.
//
// IL DIFETTO, ed è la specie capostipite di questo progetto: uno studente con
// tre missioni completate apriva `/app/attivita` e leggeva «Non hai ancora
// nessuna attività registrata» — una cosa scritta che dichiara uno stato
// diverso da quello vero, NELLA PAGINA CHE ESISTE APPOSTA PER DIRGLI COSA HA
// FATTO, e in faccia a chi ha fatto di più. Per settimane è stata citata solo
// per spiegare altro (le missioni non scrivono `activity_log`).
//
// DUE PEZZI, e servono tutti e due. Il DATO — `getPercorsoRitratto` legge il
// secondo registro — si prova con un client finto (nessuna rete: si risponde in
// base alla tabella, non all'ordine delle chiamate, perché l'ordine è un
// dettaglio di implementazione e i filtri sono la domanda). La PAGINA — che il
// blocco ci sia e che lo stato vuoto dell'altro non smentisca il primo — si
// legge.
//
// E I DUE REGISTRI NON SI FONDONO: `activity_log` conta l'esplorazione, `evidence`
// il ritratto, e la loro divergenza è una PROVA che vogliamo restare visibile.
// Un controllo qui pretende che restino due blocchi.
//
// Esecuzione: `npm run test:attivita`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");

// UN LETTORE SOLO, E SPOGLIA (la classe del 27/09: un controllo lessicale che
// trova la forma dentro il commento che la cita). Le ancore di FRASE si cercano
// su una copia con gli spazi normalizzati, perché il formattatore manda a capo
// dove vuole e un a-capo non è contenuto.
const leggiSorgente = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const frasiDi = (src) => src.replace(/\s+/g, " ");

abilitaTypeScript();

const { getPercorsoRitratto } = require("@/lib/app/attivita");
const { MISSIONI } = require("@/lib/escape/config");
const { TEST_META } = require("@/lib/test/config");

let falliti = 0;
function ok(cond, testo, extra) {
  console.log(`  ${cond ? "✓" : "✗"} ${testo}`);
  if (!cond) {
    falliti++;
    if (extra) console.log(`      → ${extra}`);
  }
}

console.log("\n═══ «Le mie attività» legge entrambi i registri ═══\n");

// ── il client finto ─────────────────────────────────────────────────────────
function clienteFinto(rispondi) {
  const chiamate = [];
  const c = {
    chiamate,
    from(tabella) {
      const q = { tabella, filtri: {} };
      chiamate.push(q);
      const catena = {
        select(colonne) {
          q.colonne = colonne;
          return catena;
        },
        eq(colonna, valore) {
          q.filtri[colonna] = valore;
          return catena;
        },
        then(risolvi, rifiuta) {
          return Promise.resolve(rispondi(q)).then(risolvi, rifiuta);
        },
      };
      return catena;
    },
  };
  return c;
}

const SLUG_M = MISSIONI[0].slug;
const TITOLO_M = MISSIONI[0].titolo;
const SLUG_T = TEST_META[0].slug;
const TITOLO_T = TEST_META[0].titolo;

function finto({ missioni = [], test = [], consegne = [], rotte = [] } = {}) {
  return clienteFinto((q) => {
    if (rotte.includes(q.tabella)) return { data: null, error: { message: "boom" } };
    if (q.tabella === "mission_attempt") return { data: missioni, error: null };
    if (q.tabella === "test_attempt") return { data: test, error: null };
    if (q.tabella === "consegne_evento") return { data: consegne, error: null };
    return { data: [], error: null };
  });
}

const miss = (i, stato = "completata") => ({
  id: `m${i}`,
  mission_slug: SLUG_M,
  stato,
  completed_at: `2026-09-0${i}T10:00:00Z`,
  updated_at: `2026-09-0${i}T10:00:00Z`,
});

async function main() {
  // ── 1) IL DIFETTO DEL 5/10 ────────────────────────────────────────────────
  console.log("1) Tre missioni completate, zero righe di esplorazione");
  {
    const voci = await getPercorsoRitratto(finto({ missioni: [miss(1), miss(2), miss(3)] }), "u1");
    ok(voci.length === 3, `tre voci, non zero (${voci.length})`);
    ok(
      voci.every((v) => v.testo.includes(TITOLO_M)),
      `ognuna nomina la missione («${TITOLO_M}»)`,
      voci.map((v) => v.testo).join(" | "),
    );
    // Il filtro è sullo studente, non sull'ordine delle chiamate.
    const c = finto({ missioni: [miss(1)] });
    await getPercorsoRitratto(c, "u-xyz");
    ok(
      c.chiamate.every((q) => q.filtri.student_id === "u-xyz"),
      "ogni lettura è filtrata sullo studente",
    );
  }

  // ── 2) un tentativo IN CORSO non è una cosa fatta ─────────────────────────
  console.log("\n2) Un tentativo in corso non compare");
  {
    const voci = await getPercorsoRitratto(finto({ missioni: [miss(1), miss(2, "in_corso")] }), "u1");
    ok(voci.length === 1, `una voce sola (${voci.length})`);
  }

  // ── 3) LA DIREZIONE DELLA DEGRADAZIONE ────────────────────────────────────
  // Il filtro su `stato` sta in TypeScript e non nella query: se quella colonna
  // cambiasse nome, un `.eq()` nella query farebbe sparire il blocco IN
  // SILENZIO — cioè il difetto che il blocco chiude. Letto dopo, una riga senza
  // `stato` passa, e si vede a schermo che qualcosa è cambiato.
  console.log("\n3) Una riga senza `stato` passa, invece di sparire in silenzio");
  {
    const senzaStato = { id: "m9", mission_slug: SLUG_M, completed_at: "2026-09-09T10:00:00Z" };
    const voci = await getPercorsoRitratto(finto({ missioni: [senzaStato] }), "u1");
    ok(voci.length === 1, "la riga compare");
    ok(
      !/\.eq\("stato"/.test(leggiSorgente("lib/app/attivita.ts")),
      "…e nessuna query filtra su `stato`, che è la ragione per cui passa",
    );
  }

  // ── 4) una lettura rotta toglie LE SUE voci, non la pagina ────────────────
  console.log("\n4) Un registro che non risponde toglie solo le sue voci");
  {
    const voci = await getPercorsoRitratto(
      finto({
        missioni: [miss(1)],
        test: [{ id: "t1", test_slug: SLUG_T, stato: "completata", completed_at: "2026-09-02T10:00:00Z" }],
        rotte: ["test_attempt"],
      }),
      "u1",
    );
    ok(voci.length === 1 && voci[0].testo.includes(TITOLO_M), "resta la missione, il test no");
    const tutte = await getPercorsoRitratto(finto({ missioni: [miss(1)], rotte: ["mission_attempt", "test_attempt", "consegne_evento"] }), "u1");
    ok(tutte.length === 0, "e se non risponde nessuno, zero voci — mai un'invenzione");
  }

  // ── 5) i tre generi, e l'ordine ───────────────────────────────────────────
  console.log("\n5) Test, missioni e risposte, più recenti prima");
  {
    const voci = await getPercorsoRitratto(
      finto({
        missioni: [miss(1)],
        test: [{ id: "t1", test_slug: SLUG_T, stato: "completata", completed_at: "2026-09-05T10:00:00Z" }],
        consegne: [{ id: "c1", created_at: "2026-09-03T10:00:00Z", eventi: { titolo: "La diretta di prova" } }],
      }),
      "u1",
    );
    ok(voci.length === 3, `tre voci (${voci.length})`);
    ok(voci[0].testo.includes(TITOLO_T), `la più recente è il test («${TITOLO_T}»)`, voci.map((v) => v.testo).join(" | "));
    ok(voci[1].testo.includes("La diretta di prova"), "poi la risposta all'incontro");
    ok(voci[2].testo.includes(TITOLO_M), "poi la missione");
    // Una riga senza data non si piazza a caso in una lista ordinata per data.
    const conNulla = await getPercorsoRitratto(finto({ missioni: [{ id: "m0", mission_slug: SLUG_M, stato: "completata" }] }), "u1");
    ok(conNulla.length === 0, "una riga senza data non entra, invece di finire in cima");
  }

  // ── 6) LA PAGINA ──────────────────────────────────────────────────────────
  console.log("\n6) La pagina: il blocco c'è, e l'altro non lo smentisce");
  {
    const pag = leggiSorgente("app/app/attivita/page.tsx");
    const frasi = frasiDi(pag);
    ok(/getPercorsoRitratto/.test(pag), "la pagina legge il secondo registro");
    ok(/ritratto\.length > 0 &&/.test(pag), "e il blocco sparisce quando non c'è niente, invece di dire «vuoto»");
    // LA FORMA VIETATA, non solo sostituita: è la frase che uno studente con tre
    // missioni leggeva, e ci si torna per abitudine.
    ok(
      !/Non hai ancora nessuna attività registrata/.test(frasi),
      "lo stato vuoto non dice più «Non hai ancora nessuna attività registrata»",
    );
    ok(/Qui non c'è ancora niente/.test(frasi), "…dice «qui», cioè parla dell'esplorazione e non di tutto");
    // I DUE REGISTRI RESTANO DUE: un elenco unico cancellerebbe la distinzione
    // che la home spiega nella sua copy, e con lei la prova che non si parlano.
    ok(
      /getPercorsoEsplorazione/.test(pag) && /getPercorsoRitratto/.test(pag),
      "i due registri restano due blocchi, non una lista sola",
    );
  }

  console.log(falliti === 0 ? "\n✓ tutto verde\n" : `\n✗ ${falliti} assert fallit${falliti === 1 ? "o" : "i"}\n`);
  process.exit(falliti === 0 ? 0 : 1);
}

main();
