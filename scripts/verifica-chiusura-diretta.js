// La metà TypeScript della traccia di chiusura (11/10/2026). La metà database
// sta in `scripts/verifica-chiusura-diretta.sql`, che gira contro una replica.
//
// Le proprietà che conta tenere, e nessuna si vede rileggendo:
//
//   §1 LA FORMA «etichetta: numero» NON HA ACCORDI. È la scelta di Mario, e la
//      ragione non è estetica: «1 presenti» è il difetto del giro dei plurali,
//      che in italiano non si deriva dal numero senza conoscere il genere del
//      nome. La prova è meccanica: cambiando i numeri, il testo deve differire
//      SOLO nelle cifre.
//   §2 TRE ESITI DISTINGUIBILI. Il difetto da cui nasce tutto: «0 nuove
//      certificazioni» per una diretta già chiusa è un'affermazione sugli
//      studenti al posto di «l'ho già fatto». I tre testi non devono
//      collassare, e quello della seconda pressione deve portare l'ora.
//   §3 IL BOTTONE SPARISCE, non si disabilita. Un bottone disabilitato dice
//      «qui c'è qualcosa da fare, ma non ora»: su una chiusura è falso per
//      sempre. Si legge dal sorgente, perché è l'unica cosa che un test Node
//      può vedere di un `.tsx`.
//   §4 LE DUE PAGINE PASSANO LA TRACCIA. Un prop dimenticato lascia il bottone
//      su una diretta chiusa, ed è esattamente il difetto che questo giro
//      chiude: verde su tutto il resto, e il prodotto fa la cosa di prima.
//   §5 LO STATO NON SI INDOVINA. Un `diretta_chiusa_da_tipo` che non
//      riconosciamo non deve produrre una riga che afferma una chiusura senza
//      saperne dire l'autore.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { senzaCommenti } = require("./lib/senza-commenti.js");
const { ancora, creaFetta } = require("./lib/ancora.js");

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

function leggi(rel) {
  return senzaCommenti(readFileSync(join(RADICE, rel), "utf8"));
}

// La fetta che non esplode e che non mente: `fetta()` SOLLEVA quando l'àncora è
// ambigua (ed è il suo mestiere), ma qui un throw fermerebbe la suite su una
// riga sola — quindi l'eccezione diventa un rosso che nomina il motivo, e la
// fetta mancante è `null`. `dentro`/`fuori` la trattano come un no nei due
// versi: con `""` le proprietà che la leggevano restavano verdi proprio quando
// il controllo non aveva potuto guardare (vedi `creaFetta` in lib/ancora.js).
const { fettaOppureRosso, dentro, fuori } = creaFetta(ok);

// Le funzioni si CHIAMANO, non si legge il sorgente: una regex su un letterale
// dice che la frase è scritta, non che arriva a chi legge. Si compila il solo
// modulo dei testi con `tsc` in memoria e si esegue; l'import di `lib/formato`
// è REALE e non uno shim, perché l'ora che l'ente legge dipende dalla zona e
// provarla con un formattatore finto proverebbe un'altra cosa.
const ts = require("typescript");
let testi;

function caricaModulo(rel, risolvi) {
  const sorgente = readFileSync(join(RADICE, rel), "utf8");
  const js = ts.transpileModule(sorgente, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  const richiedi = (nome) => risolvi(nome);
  new Function("require", "module", "exports", js)(richiedi, modulo, modulo.exports);
  return modulo.exports;
}

const formato = caricaModulo("lib/formato.ts", () => {
  throw new Error("lib/formato.ts non deve importare niente");
});
testi = caricaModulo("lib/eventi/chiusuraDiretta.ts", (nome) => {
  if (nome === "@/lib/formato") return formato;
  throw new Error(`import non previsto: ${nome}`);
});

const { statoChiusura, testoEsitoChiusura, testoStatoChiusura } = testi;

console.log("\n§1 — la forma «etichetta: numero» non ha accordi\n");

const soloCifre = (s) => s.replace(/\d+/g, "#");

{
  const uno = testoEsitoChiusura({ tipo: "chiusa", presenti: 1, certificati: 1 });
  const molti = testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 9 });
  ok(
    soloCifre(uno) === soloCifre(molti),
    "un presente e dodici danno la stessa frase, cambiano solo le cifre",
    `«${uno}» vs «${molti}»`,
  );
  ok(uno.includes("Presenti: 1."), "il numero sta dopo l'etichetta, non davanti al nome", uno);
  ok(uno.includes("Nuove certificazioni automatiche: 1."), "e lo stesso per le certificazioni", uno);
  // La direzione in cui questo controllo può essere vacuo: se i testi
  // smettessero di contenere numeri, `soloCifre` renderebbe tutto uguale.
  ok(/\d/.test(uno) && /\d/.test(molti), "i due testi contengono davvero dei numeri (il confronto non è vacuo)");
}

{
  const zero = testoEsitoChiusura({ tipo: "chiusa", presenti: 1, certificati: 0 });
  ok(
    soloCifre(zero) === soloCifre(testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 0 })),
    "anche il ramo «nessuno sopra soglia» non accorda su «presenti»",
    zero,
  );
}

console.log("\n§2 — tre esiti distinguibili, e la seconda pressione dice QUANDO\n");

const QUANDO = "2026-10-04T17:20:00.000Z"; // 19:20 a Roma
{
  const certificati = testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 9 });
  const nessuno = testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati: 0 });
  const gia = testoEsitoChiusura({ tipo: "gia_chiusa", presenti: 12, quando: QUANDO });

  ok(new Set([certificati, nessuno, gia]).size === 3, "i tre testi sono tre testi diversi");
  ok(
    nessuno.includes("Nessuno ha raggiunto la soglia"),
    "nessuno sopra soglia lo dice a parole, non con uno zero",
    nessuno,
  );
  ok(
    !nessuno.includes("certificazioni automatiche: 0") && !nessuno.includes("0 nuove"),
    "e non lo dice MAI con uno zero: è il difetto da cui nasce il giro",
    nessuno,
  );
  ok(gia.includes("era già stata chiusa"), "la seconda pressione dice che era già chiusa", gia);
  ok(gia.includes("19:20"), "e dice a che ora (zona di Roma, non UTC)", gia);
  ok(gia.includes("4 ottobre"), "e che giorno", gia);
  ok(
    !gia.includes("Presenti:"),
    "la seconda pressione non ripete i presenti: la domanda a cui risponde è un'altra",
    gia,
  );
}

console.log("\n§3 — lo stato al caricamento: il bottone sparisce\n");

{
  // ⚠️ LA FIXTURE PORTA LA RICEVUTA, E NON È UN DETTAGLIO: fino all'11/10
  // questo blocco costruiva lo stato A MANO senza il campo `ricevuta`, e
  // quando quel campo è nato la guardia è restata VERDE — perché la funzione
  // DEGRADA (senza ricevuta dice solo quando e da chi), quindi il test stava
  // provando il ramo di RIPIEGO e lo chiamava comportamento. Un ripiego
  // elegante rende verdi le fixture che non sanno del campo nuovo.
  //
  // Da qui il costruttore: una fixture che si scrive in un posto solo è una
  // fixture che si completa in un posto solo.
  const chiusa = (daTipo, ricevuta = { presenti: 12, certificati: 9 }) => ({ tipo: "chiusa", quando: QUANDO, daTipo, ricevuta });
  const riga = testoStatoChiusura(chiusa("kireo"));
  const rigaEnte = testoStatoChiusura(chiusa("ente"));
  ok(riga.includes("19:20") && riga.includes("4 ottobre"), "la riga di stato dice quando", riga);
  ok(riga !== rigaEnte, "e dice da che parte è arrivata la chiusura: i due testi non sono lo stesso");
  ok(riga.includes("KIREO"), "KIREO si nomina", riga);
  ok(rigaEnte.includes("organizzatore"), "l'ente si nomina", rigaEnte);
  // ⚠️ «il» E NON «dal» (Mario): una diretta non è chiusa DA un momento, è
  // stata chiusa IN un momento — «dal» suggerisce uno stato che dura, e qui il
  // fatto è un gesto.
  ok(riga.startsWith("Diretta chiusa il 4 ottobre"), "«Diretta chiusa il …», non «dal»", riga);

  // ⚠️⚠️ LA RIGA PORTA LA RICEVUTA, ed è la correzione dell'11/10: il difetto
  // da cui nasce l'1.1 NON era «non si sa se è chiusa» — era che il conto
  // (presenti, certificazioni) viveva solo nello stato React di chi aveva
  // premuto, e un F5 lo cancellava. Una riga che dice solo «è chiusa» lascia il
  // conto perso com'era.
  ok(riga.includes("Presenti: 12."), "e dice quanti erano presenti", riga);
  ok(riga.includes("Certificazioni automatiche: 9."), "e quante certificazioni ha prodotto", riga);
  // Senza «Nuove»: alla rilettura non sono nuove. È l'unica differenza con
  // l'esito di una pressione (vedi §3bis).
  ok(!/Nuove/.test(riga), "senza «Nuove»: alla rilettura quelle certificazioni non sono nuove", riga);
  // Lo zero ha la sua frase, la stessa dell'esito: «Certificazioni
  // automatiche: 0» si leggerebbe come «nessuno si è qualificato» detto con un
  // numero, che è il difetto da cui nasce tutto il giro.
  const rigaZero = testoStatoChiusura(chiusa("ente", { presenti: 12, certificati: 0 }));
  ok(rigaZero.includes("Nessuno ha raggiunto la soglia di presenza."), "e con zero certificati lo dice a parole", rigaZero);
  ok(!/Certificazioni automatiche: 0/.test(rigaZero), "mai «Certificazioni automatiche: 0»", rigaZero);

  // ⚠️ E LA SECONDA FRASE È USCITA: «La chiusura si fa una volta sola: qui non
  // c'è più niente da premere» spiegava l'assenza del bottone, e la ricevuta la
  // rende inutile — «un bottone grigio invita a chiedersi perché; una riga che
  // dice cosa è successo no» (Mario).
  ok(!/niente da premere/.test(riga), "e non spiega più l'assenza del bottone: la ricevuta lo fa da sé", riga);

  // IL RIPIEGO, adesso nominato come tale: se uno dei due conteggi non arriva
  // non si stampa un numero inventato, si dice meno.
  // ⚠️⚠️ LE DUE FRASI SONO LO STESSO FATTO IN DUE MOMENTI, e Mario l'ha chiesto
  // esplicitamente: «le due frasi devono restare identiche nelle parole». La
  // coda viene da un posto solo (`codaRicevuta`), e la sola differenza ammessa è
  // «Nuove» — vera al momento della pressione, falsa alla rilettura. Si prova
  // togliendola: se le due code divergono per qualunque altra cosa, sono due
  // copie e divergeranno ancora.
  for (const [nome, certificati] of [
    ["con certificazioni", 9],
    ["con zero", 0],
  ]) {
    const e = testoEsitoChiusura({ tipo: "chiusa", presenti: 12, certificati });
    const st = testoStatoChiusura(chiusa("kireo", { presenti: 12, certificati }));
    // `split` e non `indexOf`: prova anche che la coda compaia UNA volta sola,
    // e un'assenza torna `null` invece di uno `slice(-1)` che sembra un testo.
    const coda = (t) => {
      const parti = t.split("Presenti:");
      return parti.length === 2 ? `Presenti:${parti[1]}` : null;
    };
    const codaE = coda(e);
    const codaS = coda(st);
    ok(codaE !== null && codaS !== null, `${nome}: le due frasi hanno entrambe la coda (il confronto non è vacuo)`, `${codaE} / ${codaS}`);
    ok(
      codaE !== null && codaS !== null && codaE.replace("Nuove certificazioni", "Certificazioni") === codaS,
      `${nome}: le due code coincidono a meno di «Nuove»`,
      `«${codaE}» ≠ «${codaS}»`,
    );
  }

  const senzaRicevuta = testoStatoChiusura(chiusa("kireo", null));
  ok(!/Presenti/.test(senzaRicevuta), "senza i due conteggi la riga dice solo quando e da chi", senzaRicevuta);
  ok(senzaRicevuta !== riga, "e il confronto non è vacuo: con la ricevuta il testo è un altro");

  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  const bloccoChiusura = fettaOppureRosso(
    src,
    { nome: "esitoChiusura ?", dove: "l'inizio del blocco della chiusura" },
    { nome: "DAD non sono coperte", dove: "la nota finale, subito dopo il blocco" },
    "il blocco della chiusura",
  );
  ok(
    bloccoChiusura.includes("testoStatoChiusura(chiusura)"),
    "il componente rende la riga di stato invece di ricomporla a mano",
  );
  ok(
    bloccoChiusura.includes("testoEsitoChiusura(esitoChiusura)"),
    "e rende l'esito chiamando la funzione, non interpolando i conteggi",
  );
  ok(
    !/Diretta chiusa[:.]/.test(src),
    "nessuna copia del testo nel componente: una seconda copia divergerebbe",
  );
  // La proprietà vera: su una diretta chiusa il bottone NON viene reso. Si
  // legge dall'ordine dei rami — l'alternativa (un `disabled` sullo stato
  // della chiusura) lascerebbe il bottone a schermo.
  let ordineGiusto = false;
  try {
    const iStato = ancora(bloccoChiusura, "testoStatoChiusura", { dove: "il ramo dello stato chiuso" });
    const iBottone = ancora(bloccoChiusura, "<Button", { dove: "il ramo del bottone" });
    ordineGiusto = iBottone > iStato;
  } catch (e) {
    ok(false, "le due àncore dell'ordine dei rami non sono ambigue", e.message);
  }
  ok(ordineGiusto, "il bottone sta nel ramo DOPO quello dello stato chiuso: su una chiusa non viene reso");
  ok(
    !/disabled=\{[^}]*chiusura/.test(src),
    "e non è un bottone disabilitato: una chiusura non è «non adesso», è «mai più»",
  );
}

console.log("\n§4 — le due pagine passano la traccia\n");

// L'àncora di CHIUSURA è quello che viene subito dopo il componente in quella
// pagina, e non `"/>"`: una fine generica compare decine di volte, e la fetta
// finirebbe alla prima chiusura di tag qualunque essa sia.
for (const [pagina, dopo] of [
  ["app/admin/page.tsx", "Esporta presenze (CSV)"],
  ["app/ente/(dashboard)/eventi/page.tsx", "<ReportEventoButton"],
]) {
  const src = leggi(pagina);
  const uso = fettaOppureRosso(
    src,
    { nome: "<ControlloDirettaEvento", dove: `il montaggio in ${pagina}` },
    { nome: dopo, dove: `quello che viene dopo il componente in ${pagina}` },
    `il montaggio in ${pagina}`,
  );
  ok(uso.includes("chiusaIl={e.diretta_chiusa_il}"), `${pagina} passa chiusaIl`);
  ok(uso.includes("chiusaDaTipo={e.diretta_chiusa_da_tipo}"), `${pagina} passa chiusaDaTipo`);
  // La metà che si dimentica: il prop si passa e la `select` non legge la
  // colonna, quindi arriva `undefined` e il bottone resta. Verde su tutto il
  // resto, e il prodotto fa la cosa di prima.
  ok(src.includes("diretta_chiusa_il, diretta_chiusa_da_tipo"), `${pagina} legge le due colonne nella select`);
}

console.log("\n§5 — lo stato non si indovina\n");

{
  ok(statoChiusura({ chiusaIl: null, chiusaDaTipo: null }).tipo === "da_chiudere", "senza ora: da chiudere");
  ok(
    statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: "ente" }).tipo === "chiusa",
    "con ora e tipo valido: chiusa",
  );
  ok(
    statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: null }).tipo === "da_chiudere",
    "ora senza tipo: non si dichiara una chiusura di cui non si sa dire l'autore",
  );
  ok(
    statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: "sistema" }).tipo === "da_chiudere",
    "un tipo che non riconosciamo vale come assente, non come un autore ignoto",
  );
  ok(
    statoChiusura({ chiusaIl: "", chiusaDaTipo: "ente" }).tipo === "da_chiudere",
    "stringa vuota: da chiudere (una `select` può restituirla, e `new Date(\"\")` è Invalid Date)",
  );
  // ⚠️ I DUE CONTEGGI ARRIVANO FINO ALLO STATO, O LA RICEVUTA NON ESISTE: è la
  // metà che si dimentica — una colonna in più nel database e un campo in più
  // nel tipo non fanno comparire niente a schermo se nessuno li passa.
  const conRicevuta = statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: "ente", presenti: 12, certificati: 9 });
  ok(
    conRicevuta.tipo === "chiusa" && conRicevuta.ricevuta && conRicevuta.ricevuta.presenti === 12,
    "i due conteggi arrivano fino allo stato",
    JSON.stringify(conRicevuta),
  );
  ok(
    conRicevuta.tipo === "chiusa" && conRicevuta.ricevuta.certificati === 9,
    "tutti e due, non uno",
  );
  // E uno solo dei due non è una ricevuta: meglio dire meno che stampare un
  // numero inventato accanto a uno vero.
  for (const [nome, extra] of [
    ["senza presenti", { certificati: 9 }],
    ["senza certificati", { presenti: 12 }],
    ["con un presenti nullo", { presenti: null, certificati: 9 }],
  ]) {
    const st = statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: "ente", ...extra });
    ok(st.tipo === "chiusa" && st.ricevuta === null, `${nome}: nessuna ricevuta, invece di mezza`, JSON.stringify(st));
  }
  // ⚠️ E LA RICEVUTA NON CANCELLA LA CHIUSURA: senza i conteggi lo stato resta
  // «chiusa», altrimenti il bottone tornerebbe su una diretta chiusa — che è il
  // difetto di partenza, ricreato da un ripiego.
  ok(
    statoChiusura({ chiusaIl: QUANDO, chiusaDaTipo: "ente" }).tipo === "chiusa",
    "e senza conteggi la diretta resta chiusa: il bottone non torna",
  );
}

console.log("\n§6 — il poll non degrada verso «non chiusa»\n");

{
  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  const pollata = fettaOppureRosso(
    src,
    { nome: "const aggiorna = useCallback", dove: "l'inizio del poll" },
    // I due `useEffect(() =>` sono il poll e l'orologio della freschezza
    // (11/10): la fetta del poll finisce al PRIMO.
    { nome: "useEffect(() =>", volte: 2, quale: 0, dove: "l'effetto che lo monta, subito dopo" },
    "il poll",
  );
  ok(
    dentro(pollata, "diretta_chiusa_il, diretta_chiusa_da_tipo"),
    "il poll rilegge lo stato della chiusura: l'altro moderatore si vede in 15s invece che premendo",
  );
  ok(
    pollata !== null && /if \(erroreEv\)[\s\S]{0,200}else if \(ev\)/.test(pollata),
    "una lettura fallita lascia quello che c'era invece di rimettere il bottone",
  );
  ok(dentro(pollata, "console.error"), "e la lettura fallita lascia una traccia invece di sparire");
}

console.log("\n§7 — la ricevuta arriva a tutti i posti che la rendono\n");

// ⚠️ LA PROPRIETÀ CHE PRENDE «NE HA DIMENTICATO UNO»: quattro punti passano
// questi prop al pannello e quattro `select` leggono le colonne. Aggiungere due
// colonne vuol dire toccarli tutti, e il modo in cui questa classe di difetti
// nasce è che uno resti indietro — con il risultato che su una pagina la
// ricevuta compare e su un'altra no, senza che niente si rompa.
{
  // Le due metà si contano separate perché sono due dimenticanze diverse: la
  // `select` che non legge la colonna (e allora il prop è sempre null) e il
  // prop che non si passa (e allora la colonna si legge per niente).
  const LETTORI = [
    "components/ente/ControlloDirettaEvento.tsx",
    "lib/eventi/moderazione.ts",
    "app/admin/page.tsx",
    "app/ente/(dashboard)/eventi/page.tsx",
  ];
  const RENDITORI = ["app/diretta/[id]/page.tsx", "app/admin/page.tsx", "app/ente/(dashboard)/eventi/page.tsx"];
  ok(LETTORI.length === 4 && RENDITORI.length === 3, "quattro lettori e tre punti che rendono (il conto è dichiarato)");
  // ⚠️ SI GUARDA DENTRO LA `select`, NON IL FILE — e l'ha detto una controprova
  // che non ha morso: togliendo i due conteggi dalla `select` del poll, un
  // `src.includes("diretta_chiusa_presenti")` resta VERDE, perché quel nome
  // compare anche nel `setChiusura` che legge la riga. È il modo 6: un'àncora
  // su un nome condiviso con qualcos'altro misura l'occorrenza sbagliata.
  const selects = [];
  for (const rel of LETTORI) {
    const src = leggi(rel);
    for (const m of src.matchAll(/\.select\(\s*"([^"]*)"/g)) selects.push([rel, m[1]]);
  }
  // Soglia dichiarata: sotto quattro l'estrattore non sta leggendo, e la
  // proprietà qui sotto sarebbe verde su un insieme vuoto.
  ok(selects.length >= 4, `le ${selects.length} \`select\` si leggono (sotto quattro l'estrattore non sta leggendo)`);
  const conTraccia = selects.filter(([, q]) => q.includes("diretta_chiusa_il"));
  ok(conTraccia.length === 4, "e quattro di loro leggono la traccia", `${conTraccia.length}`);
  for (const [rel, q] of conTraccia) {
    ok(
      q.includes("diretta_chiusa_presenti") && q.includes("diretta_chiusa_certificati"),
      `${rel}: la \`select\` che legge la traccia legge anche i due conteggi — senza, la ricevuta è sempre vuota lì`,
    );
  }
  for (const rel of RENDITORI) {
    const src = leggi(rel);
    ok(src.includes("chiusaIl={"), `${rel}: passa la traccia al pannello`);
    ok(
      src.includes("chiusaPresenti={") && src.includes("chiusaCertificati={"),
      `${rel}: e passa anche la ricevuta`,
    );
  }
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
