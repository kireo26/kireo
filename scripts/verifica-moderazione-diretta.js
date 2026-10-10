/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// La pagina di moderazione di una diretta (11/10/2026). Niente database: è una
// pagina e un valore, e la vera autorizzazione sta nelle RPC che già hanno le
// loro prove SQL.
//
// Le proprietà che conta tenere:
//
//   §1 LA FRESCHEZZA DICE QUANDO, E DICE QUANDO NON LO SA. «Presenti ora: 12»
//      è un'affermazione sul presente: se l'ultimo giro è fallito due minuti fa
//      è un'affermazione sul passato travestita, e chi modera decide su quella.
//   §2 DUE OROLOGI, E DUE INTERVALLI. L'orologio deve avanzare anche quando il
//      poll non ritorna, altrimenti l'età non cresce e un dato vecchio si legge
//      come fresco — cioè il difetto non si vede proprio nel caso per cui la
//      riga esiste.
//   §3 BASTA UNA LETTURA FALLITA SU TRE. Dichiarare freschi i numeri perché due
//      sono arrivati è la stessa bugia in forma più piccola.
//   §4 UNA PAGINA PER DUE RUOLI, CON UNA SOLA DIFFERENZA. «Due pagine gemelle
//      divergono sempre» (Mario): la differenza è di politica dei dati (chi
//      scarica cosa), non di pagina.
//   §5 LA PAGINA SI RAGGIUNGE. Una funzione completa senza porta è il difetto
//      del 28/09, e si trova solo cercandola.

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { senzaCommenti } = require("./lib/senza-commenti.js");
const { ancora, creaFetta } = require("./lib/ancora.js");
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

// La fetta che non esplode e che non mente: `fetta()` SOLLEVA quando l'àncora è
// ambigua (ed è il suo mestiere), ma qui un throw fermerebbe la suite su una
// riga sola — quindi l'eccezione diventa un rosso che nomina il motivo, e la
// fetta mancante è `null`. `dentro`/`fuori` la trattano come un no nei due
// versi: con `""` le proprietà che la leggevano restavano verdi proprio quando
// il controllo non aveva potuto guardare (vedi `creaFetta` in lib/ancora.js).
const { fettaOppureRosso, dentro, fuori } = creaFetta(ok);

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
const {
  rigaFreschezza,
  numeroStantio,
  SECONDI_FRESCO,
  FALLITI_PRIMA_DI_STANTIO,
  SECONDI_STANTIO,
  NUMERO_NON_AGGIORNATO,
} = caricaModulo("lib/eventi/freschezza.ts", (nome) => {
  if (nome === "@/lib/formato") return formato;
  throw new Error(`import non previsto: ${nome}`);
});

// Le 19:07:00 di Roma.
const QUANDO = new Date("2026-10-04T17:07:00.000Z");
const dopo = (secondi) => new Date(QUANDO.getTime() + secondi * 1000);

console.log("\n§1 — la freschezza dice quando, e dice quando non lo sa\n");

{
  const fresco = rigaFreschezza({ quando: QUANDO, falliti: 0 }, dopo(3));
  const vecchio = rigaFreschezza({ quando: QUANDO, falliti: 0 }, dopo(90));
  const rotto = rigaFreschezza({ quando: QUANDO, falliti: 1 }, dopo(130));
  const vuoto = rigaFreschezza({ quando: null, falliti: 0 }, dopo(3));
  const vuotoRotto = rigaFreschezza({ quando: null, falliti: 1 }, dopo(3));

  ok(new Set([fresco, vecchio, rotto, vuoto, vuotoRotto]).size === 5, "i cinque casi sono cinque testi diversi");
  // ⚠️ I QUATTRO TESTI SONO DI MARIO, PAROLA PER PAROLA. Il primo non dice
  // l'ora: «Aggiornato alle 19:07» quando sono le 19:07 è una precisione che
  // non serve a nessuno.
  ok(fresco === "Aggiornato adesso.", "appena arrivato: «adesso», senza un orologio che non serve", fresco);
  ok(vecchio === "Aggiornato alle 19:07, 1 minuto fa.", "qualche tempo fa: l'ora E l'età", vecchio);
  // ⚠️ LA PROPRIETÀ PER CUI ESISTE: un giro fallito non lascia i numeri a
  // sembrare freschi.
  ok(
    rotto === "⚠ L'ultimo aggiornamento non è riuscito. Questi numeri sono delle 19:07, 2 minuti fa.",
    "ultimo giro fallito: lo dice, con l'ora e l'età",
    rotto,
  );
  ok(rotto.includes("⚠"), "e si distingue a vista da una riga normale", rotto);
  ok(!/non è andato a buon fine/.test(rotto), "«non è riuscito»: più corto, stessa cosa", rotto);
  ok(vuoto === "In attesa dei dati…", "niente ancora arrivato: lo dice invece di tacere", vuoto);
  ok(
    vuotoRotto.includes("non c'è ancora niente da mostrare"),
    "e se il primo giro è fallito, dice che non c'è niente — non «aggiornato»",
    vuotoRotto,
  );
  // ⚠️ L'ORA E L'ETÀ STANNO INSIEME in tutti e due i casi che hanno un dato:
  // servono a due domande diverse — l'ora per capire cosa è successo nel
  // frattempo, il «due minuti fa» per decidere se fidarsi.
  for (const [nome, riga] of [
    ["aggiornato", vecchio],
    ["fallito", rotto],
  ]) {
    ok(/19:07/.test(riga) && /\bfa\./.test(riga), `${nome}: l'ora e l'età, non una delle due`, riga);
  }
  ok(!fresco.includes("17:07"), "l'ora è quella di Roma, non UTC", fresco);
}

{
  // Il confine della freschezza, provato al bordo: una soglia che nessuno
  // prova al bordo è una soglia che nessuno sa dove sia.
  ok(SECONDI_FRESCO === 20, "la soglia è 20 secondi (il poll gira ogni 15)");
  ok(!rigaFreschezza({ quando: QUANDO, falliti: 0 }, dopo(20)).includes("fa"), "a 20 secondi esatti: ancora «adesso»");
  ok(rigaFreschezza({ quando: QUANDO, falliti: 0 }, dopo(21)).includes("fa"), "a 21: compare l'età");
  // Gli accordi: l'uno capita, ed è il difetto dei plurali del 4/10.
  ok(rigaFreschezza({ quando: QUANDO, falliti: 1 }, dopo(1)).includes("1 secondo fa"), "«1 secondo» al singolare");
  ok(rigaFreschezza({ quando: QUANDO, falliti: 1 }, dopo(60)).includes("1 minuto fa"), "«1 minuto» al singolare");
  ok(rigaFreschezza({ quando: QUANDO, falliti: 1 }, dopo(120)).includes("2 minuti fa"), "«2 minuti» al plurale");
  ok(rigaFreschezza({ quando: QUANDO, falliti: 1 }, dopo(2)).includes("2 secondi fa"), "«2 secondi» al plurale");
  // Un'orologio del browser spostato indietro fra due letture non produce
  // «aggiornato fra 3 secondi».
  const negativo = rigaFreschezza({ quando: QUANDO, falliti: 0 }, dopo(-5));
  ok(!negativo.includes("-"), "un'età negativa non si stampa", negativo);
}

console.log("\n§1bis — oltre una soglia il NUMERO si degrada\n");

// ⚠️ LA CORREZIONE DI MARIO DELL'11/10, e vale più dei testi: «un moderatore
// che guarda lo schermo per due secondi, in mezzo a una diretta, legge
// "Presenti: 12". Non legge la riga sopra. Dopo qualche tentativo fallito di
// fila, non basta avvisare accanto al numero: deve cambiare il numero».
//
// La riga di freschezza resta e non basta: l'unica cosa che la freschezza deve
// impedire è che a colpo d'occhio un numero vecchio somigli a uno fresco.
{
  ok(FALLITI_PRIMA_DI_STANTIO === 3, "tre giri falliti di fila (il poll gira ogni 15 secondi: 45 secondi)");
  ok(FALLITI_PRIMA_DI_STANTIO * 15 < 60, "cioè sotto il minuto che Mario ha fissato come limite");
  ok(FALLITI_PRIMA_DI_STANTIO > 1, "e più di uno: un giro fallito è rumore di rete, e non deve far lampeggiare niente");

  // Il confine sui fallimenti, provato al bordo.
  ok(!numeroStantio({ quando: QUANDO, falliti: 2 }, dopo(30)), "a due falliti il numero regge ancora");
  ok(numeroStantio({ quando: QUANDO, falliti: 3 }, dopo(45)), "al terzo si degrada");

  // ⚠️ LA SECONDA STRADA, E NON È PRUDENZA GENERICA: una `fetch` può restare
  // APPESA — nessun errore, nessuna risoluzione — e allora `falliti` resta 0
  // mentre l'età cresce senza limite. È lo stesso caso per cui l'orologio ha un
  // intervallo suo (§2), e un degrado basato sui soli fallimenti lo
  // mancherebbe: la riga direbbe «2 minuti fa» accanto a un numero che sembra
  // appena arrivato.
  ok(SECONDI_STANTIO === 60, "oltre un minuto si degrada comunque, anche con zero fallimenti");
  ok(!numeroStantio({ quando: QUANDO, falliti: 0 }, dopo(SECONDI_STANTIO - 1)), "a 59 secondi senza errori: regge");
  ok(numeroStantio({ quando: QUANDO, falliti: 0 }, dopo(SECONDI_STANTIO)), "a 60: si degrada, perché il poll non sta tornando");

  // Niente da degradare quando non c'è nessun numero: il componente mostra «…»
  // e la riga dice che si è in attesa.
  ok(!numeroStantio({ quando: null, falliti: 9 }, dopo(300)), "senza nessun dato non c'è niente da degradare");
  // Un successo azzera: il numero appena arrivato è fresco qualunque cosa sia
  // successa prima.
  ok(!numeroStantio({ quando: dopo(300), falliti: 0 }, dopo(301)), "un successo azzera il conto: il dato nuovo è fresco");
}

{
  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  ok(src.includes("numeroStantio(freschezza, ora)"), "il componente chiede il degrado alla funzione invece di deciderlo da sé");
  ok(src.split("numeroStantio(").length - 1 === 1, "e la chiama UNA volta sola: due chiamate sarebbero due copie della stessa decisione");
  ok(/const stantio = numeroStantio/.test(src), "in un valore, non dentro il JSX");

  // ⚠️ IL DATO NON SI DISTRUGGE: era vero, alle 19:07. Il numero resta
  // leggibile e cambia ASPETTO — il ternario sta sulla classe, non sul
  // contenuto. Un trattino al suo posto chiuderebbe il difetto buttando via
  // l'informazione.
  ok(/className=\{stantio \?/.test(src), "il degrado è sull'aspetto del numero");
  ok(/\{presenti \?\? "…"\}/.test(src), "e il numero resta: era vero, alla sua ora");
  ok(src.split('{presenti ?? "…"}').length - 1 === 1, "reso una volta sola: due rami sarebbero due copie");
  ok(/line-through/.test(src), "barrato, perché a colpo d'occhio non somigli a uno fresco");

  // ⚠️ E IL BARRATO NON ARRIVA A TUTTI: una linea sopra una cifra non la vede
  // chi usa un lettore di schermo, e per quella persona il numero resterebbe
  // identico a uno fresco — cioè il difetto, per lei, non sarebbe chiuso.
  ok(
    src.split("NUMERO_NON_AGGIORNATO").length - 1 === 2,
    "il degrado ha anche un testo, per chi non vede il barrato (l'import PIÙ l'uso: il solo import non lo rende)",
  );
  ok(/sr-only/.test(src), "reso solo per il lettore di schermo");
  // Le due posizioni con il conto dichiarato: un `indexOf` grezzo misura la
  // prima occorrenza qualunque essa sia, e qui `NUMERO_NON_AGGIORNATO` ne ha
  // due (l'import e l'uso) — è esattamente il caso in cui un'àncora grezza
  // guarda quella sbagliata.
  const dove = (nome, opzioni) => {
    try {
      return ancora(src, nome, opzioni);
    } catch (e) {
      ok(false, `l'àncora «${nome}» non è ambigua`, e.message);
      return -1;
    }
  };
  const i = dove('{presenti ?? "…"}', { dove: "il numero dei presenti" });
  const j = dove("NUMERO_NON_AGGIORNATO", { volte: 2, quale: 1, dove: "l'uso accanto al numero, non l'import" });
  ok(i >= 0 && j > i, "e ACCANTO al numero, non al posto suo");
  ok(NUMERO_NON_AGGIORNATO === "(non aggiornato)", "«(non aggiornato)»", NUMERO_NON_AGGIORNATO);

  // La riga di freschezza si accende anche sulla strada dell'età: senza, il
  // numero sarebbe barrato e la riga sotto muta.
  ok(/freschezza\.falliti > 0 \|\| stantio/.test(src), "e la riga accanto si accende su tutte e due le strade");
}

console.log("\n§2 — due orologi, e due intervalli\n");

{
  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  // LA PROPRIETÀ: due `setInterval`, uno per il poll e uno per l'orologio. Se
  // l'orologio stesse dentro il poll, una `fetch` appesa lo fermerebbe — e
  // l'età non crescerebbe proprio quando serve che cresca.
  const intervalli = (src.match(/setInterval\(/g) ?? []).length;
  ok(intervalli === 2, "due intervalli: il poll e l'orologio", `${intervalli}`);
  ok(src.includes("setInterval(() => setOra(new Date())"), "l'orologio ha il suo");
  // I due `useEffect(() =>` sono il poll e l'orologio: la fetta del poll
  // finisce al PRIMO, cioè all'effetto che lo monta.
  const poll = fettaOppureRosso(
    src,
    { nome: "const aggiorna = useCallback", dove: "l'inizio del poll" },
    { nome: "useEffect(() =>", volte: 2, quale: 0, dove: "il primo effetto, subito dopo" },
    "il poll",
  );
  ok(fuori(poll, "setOra("), "e NON sta dentro il poll: una fetch appesa lo fermerebbe");
  ok(src.includes("rigaFreschezza(freschezza, ora)"), "la riga riceve i due orologi separati");
  // E la riga arriva a schermo accanto ai numeri, non in un angolo suo.
  const numeri = fettaOppureRosso(
    src,
    { nome: "Presenti ora:", dove: "il numero dei presenti" },
    { nome: "{domande.length > 0 &&", dove: "la lista delle domande, subito dopo" },
    "il blocco dei numeri",
  );
  ok(dentro(numeri, "rigaFreschezza"), "e sta accanto al numero di cui parla");
}

console.log("\n§3 — basta una lettura fallita su tre\n");

{
  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  ok(/const andata = !e\w+ && !e\w+ && !erroreEv;/.test(src), "il giro è «andato» solo se TUTTE E TRE le letture sono arrivate");
  ok(
    /catch \(e\) \{[\s\S]{0,300}setFreschezza\(\(f\) => \(\{ quando: f\.quando, falliti: f\.falliti \+ 1 \}\)\)/.test(src),
    "e un rigetto (una fetch che non arriva, non un errore restituito) conta come un giro fallito",
  );
  // ⚠️ IL `try` DEVE COMPRENDERE LE TRE LETTURE: `Promise.all` rigetta quando
  // una qualunque lancia, e fuori da un try quel caso lascia la freschezza a
  // quello che era — «aggiornato alle 19:07» su numeri che nessuno ha più
  // riletto, cioè il difetto nella sua forma meno visibile.
  // I due `try {` sono quello del poll (il primo) e quello della chiusura.
  const i = (() => {
    try {
      return ancora(src, "try {", { volte: 2, quale: 0, dove: "il try del poll" });
    } catch (e) {
      ok(false, "l'àncora del try non è ambigua", e.message);
      return -1;
    }
  })();
  const j = (() => {
    try {
      return ancora(src, "await Promise.all", { dove: "le tre letture in parallelo" });
    } catch (e) {
      ok(false, "l'àncora delle tre letture non è ambigua", e.message);
      return -1;
    }
  })();
  ok(i >= 0 && j > i, "il `try` comincia PRIMA delle tre letture, non dopo");
  // Un fallimento non azzera `quando`: dire «non c'è niente» su dei numeri che
  // ci sono (vecchi) è l'altra metà della stessa bugia.
  ok(
    !/falliti: f\.falliti \+ 1, quando: null/.test(src) && !/quando: null, falliti: f\.falliti/.test(src),
    "un fallimento non azzera l'ora dell'ultimo dato buono",
  );
}

console.log("\n§4 — una pagina per due ruoli, con una sola differenza\n");

{
  const src = leggi("app/diretta/[id]/page.tsx");
  const guardia = leggi("lib/eventi/moderazione.ts");

  ok(src.includes("getContestoModerazione"), "la pagina usa la guardia condivisa");
  ok(
    !src.includes("requireAdmin") && !src.includes("getEnteContext"),
    "e NON le guardie di area, che reindirizzerebbero l'altro ruolo",
  );
  // La differenza è UNA, e si conta: ogni `parte === "kireo"` è un posto in cui
  // le due pagine divergono, e Mario ne ha ammesso una sola di sostanza (chi
  // scarica cosa) — più il link indietro e il kill switch, che sono due cose
  // che l'altro ruolo non può fare per costruzione.
  const rami = (src.match(/parte === "kireo"/g) ?? []).length;
  ok(rami === 3, "tre soli rami sul ruolo: dove si torna, il kill switch, quale export", `${rami}`);
  // Il link indietro è UN ramo e non due: l'indirizzo e il nome del posto
  // escono dallo stesso oggetto, quindi non possono divergere (un href verso
  // `/admin` con l'etichetta «ai tuoi eventi»).
  ok(src.includes("indietro.href") && src.includes("indietro.dove"), "indirizzo e nome del posto da cui si viene: un ramo solo");
  ok(src.includes("/api/admin/presenze/"), "l'admin scarica il CSV individuale");
  ok(src.includes("ReportEventoButton"), "l'ente il report aggregato");
  ok(!src.includes("esporta_consegne_evento"), "e la pagina non legge i testi: lo fa la route, che è admin-only");

  // La guardia ammette i due e dice quale: `notFound()` e non un redirect —
  // chi non c'entra non deve sapere che quell'evento esiste.
  ok(guardia.includes('parte = "kireo"') && guardia.includes('parte = "ente"'), "la guardia riconosce le due parti");
  ok((guardia.match(/notFound\(\)/g) ?? []).length === 2, "e chiude con notFound(): l'evento che non esiste e quello che non è tuo");
  // ⚠️ IL CONFRONTO È AFFERMATIVO: un `!==` con un `istituzione_id` nullo
  // sarebbe NULL-unsafe nella direzione sbagliata — il difetto ricacciato sette
  // volte in questo progetto.
  ok(
    guardia.includes("link.istituzione_id === evento.organizzatore_id"),
    "e il confronto è affermativo: fallisce chiuso su un'istituzione nulla",
  );
  // ⚠️ IL `!==` SI CERCA DA TUTTE E DUE LE PARTI, e l'ha detto una controprova
  // (11/10): la prima stesura cercava `organizzatore_id !==`, cioè il campo a
  // SINISTRA — ma la forma sbagliata che viene in mente è l'altra,
  // `!== evento.organizzatore_id`, e su quella l'asserzione restava verde.
  // Cercava una stringa diversa da quella che credeva (modo 2-bis).
  ok(
    !/organizzatore_id\s*!==/.test(guardia) && !/!==\s*(evento\.)?organizzatore_id/.test(guardia),
    "nessun confronto negativo su quel campo, da nessuna delle due parti",
  );
  // Una lettura fallita non diventa un «non esiste» muto.
  ok(guardia.includes("console.error"), "una lettura fallita lascia una traccia invece di sembrare un 404");
}

console.log("\n§5 — la pagina si raggiunge\n");

{
  // ⚠️ UNA FUNZIONE COMPLETA SENZA PORTA è il difetto del 28/09 («la consegna,
  // completa, corretta, provata, e senza porta»), e si trova solo cercandola.
  for (const pagina of ["app/admin/page.tsx", "app/ente/(dashboard)/eventi/page.tsx"]) {
    const src = leggi(pagina);
    ok(src.includes("/diretta/${e.id}"), `${pagina} linka la pagina della diretta`);
    ok(src.includes('import Link from "next/link"'), `${pagina} importa Link`);
  }
  // E il prefisso è protetto dal middleware: senza, la pagina sarebbe
  // raggiungibile senza sessione (la guardia della pagina reindirizza, ma il
  // middleware è la prima porta, e `/diretta` non sta sotto nessun prefisso
  // già protetto).
  const proxy = leggi("lib/supabase/proxy.ts");
  const aree = fettaOppureRosso(
    proxy,
    { nome: "const AREE_PROTETTE", dove: "l'elenco delle aree protette" },
    { nome: "function redirectAccedi", dove: "la funzione subito dopo" },
    "AREE_PROTETTE",
  );
  ok(dentro(aree, '"/diretta"'), "`/diretta` è fra le aree protette dal middleware");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
