/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// La metà TypeScript della riga del tocco (11/10/2026). La metà database sta in
// `scripts/verifica-tocco-domanda.sql`, che gira contro una replica.
//
// Le proprietà che conta tenere:
//
//   §1 I CINQUE CASI SONO CINQUE. Quattro di combinazione (letta/risposta ×
//      KIREO/ente) più quello che nessuno ha scritto: uno stato avanzato SENZA
//      autore, cioè una domanda toccata prima dell'11/10/2026. Lì si dice
//      quello che si sa e non si inventa una parte.
//   §2 NIENTE SU UNA DOMANDA NUOVA. Una riga su un fatto che non è avvenuto è
//      peggio di nessuna riga.
//   §3 L'ORA SENZA LA DATA SE È DI OGGI. Durante una diretta la data è rumore;
//      su un evento riaperto il giorno dopo, «alle 19:05» da solo sembrerebbe
//      di oggi.
//   §4 IL COMPONENTE LA CHIAMA, e la calcola UNA volta. Due chiamate nello
//      stesso render sono due copie della stessa cosa.
//   §5 L'ORA NON SI LEGGE NEL RENDER. `new Date()` dentro un render è impuro
//      (`react-hooks/purity`, e lo ha già detto su `CardEvento`): sta nello
//      stato e si aggiorna col poll.

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

function fettaOppureRosso(src, da, a, nome) {
  try {
    return fetta(src, da, a);
  } catch (e) {
    ok(false, `la fetta «${nome}» si ritaglia`, e.message);
    return "";
  }
}

// Il modulo si CHIAMA, non si legge: una regex su un letterale dice che la
// frase è scritta, non che arriva a chi legge. `lib/formato` è l'import vero e
// non uno shim — l'ora dipende dalla zona, e provarla con un formattatore
// finto proverebbe un'altra cosa.
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
const { rigaTocco } = caricaModulo("lib/eventi/tocco.ts", (nome) => {
  if (nome === "@/lib/formato") return formato;
  throw new Error(`import non previsto: ${nome}`);
});
const SORGENTE_TOCCO = leggi("lib/eventi/tocco.ts");

// Le 19:05 di Roma del 4 ottobre 2026, e un «adesso» dello stesso giorno.
const TOCCO = "2026-10-04T17:05:00.000Z";
const OGGI = new Date("2026-10-04T17:40:00.000Z");
const DOMANI = new Date("2026-10-05T09:00:00.000Z");

const d = (stato, tipo, il = TOCCO) => ({ stato, stato_da_tipo: tipo, stato_il: il });

console.log("\n§1 — i cinque casi sono cinque\n");

{
  const righe = {
    lettaKireo: rigaTocco(d("letta", "kireo"), OGGI),
    lettaEnte: rigaTocco(d("letta", "ente"), OGGI),
    rispostaKireo: rigaTocco(d("risposta_live", "kireo"), OGGI),
    rispostaEnte: rigaTocco(d("risposta_live", "ente"), OGGI),
    senzaAutore: rigaTocco(d("letta", null, null), OGGI),
  };

  ok(new Set(Object.values(righe)).size === 5, "le cinque righe sono cinque testi diversi", JSON.stringify(righe));
  // Le due parole di Mario, parola per parola.
  ok(righe.lettaKireo.startsWith("letta da KIREO"), "«letta da KIREO»", righe.lettaKireo);
  ok(righe.rispostaEnte.startsWith("risposta dall'ente"), "«risposta dall'ente»", righe.rispostaEnte);
  ok(righe.lettaEnte.startsWith("letta dall'ente"), "«letta dall'ente»", righe.lettaEnte);
  ok(righe.rispostaKireo.startsWith("risposta da KIREO"), "«risposta da KIREO»", righe.rispostaKireo);

  // Il quinto: una domanda toccata prima dell'11/10 ha lo stato avanzato e
  // nessun autore. Si dice quello che si sa.
  ok(righe.senzaAutore === "letta", "stato avanzato senza autore: si dice solo «letta»", righe.senzaAutore);
  ok(
    !/KIREO|ente/i.test(righe.senzaAutore),
    "e NON si inventa una parte: è la stessa scelta della traccia di chiusura",
    righe.senzaAutore,
  );
  // E un tipo che non riconosciamo vale come assente, non come autore ignoto.
  ok(rigaTocco(d("letta", "sistema"), OGGI) === "letta", "un tipo che non riconosciamo vale come assente");
  // Una parte senza l'ora non compone la riga intera: il DB lo vieta con un
  // CHECK, ma una `select` può restituire qualunque cosa.
  ok(rigaTocco(d("letta", "ente", null), OGGI) === "letta", "una parte senza l'ora degrada su «letta»");
}

console.log("\n§2 — niente su una domanda nuova\n");

{
  ok(rigaTocco(d("nuova", null, null), OGGI) === null, "una domanda nuova non ha nessuna riga");
  ok(
    rigaTocco(d("nuova", "ente"), OGGI) === null,
    "e nemmeno se il dato arrivasse incoerente: lo stato decide, non le colonne del tocco",
  );
  ok(rigaTocco(d("archiviata", null, null), OGGI) === null, "uno stato che non conosciamo non produce una riga");

  // ⚠️ QUELLO CHE TIENE DAVVERO LA PROPRIETÀ, e l'ha detto una controprova che
  // non ha morso: togliendo la guardia esplicita su `nuova` le asserzioni qui
  // sopra restano verdi, perché `COSA` non ha quella voce e il `if (!cosa)`
  // la prende comunque. La guardia è una convenienza; la cosa da impedire è
  // che qualcuno aggiunga la voce.
  const tabella = fettaOppureRosso(
    SORGENTE_TOCCO,
    { nome: "const COSA:", dove: "la tabella degli stati" },
    { nome: "const DA:", dove: "la tabella delle parti, subito dopo" },
    "la tabella COSA",
  );
  ok(!/\bnuova\s*:/.test(tabella), "`COSA` non ha una voce per `nuova`: è questo che impedisce la riga", tabella.trim());
}

console.log("\n§3 — l'ora senza la data se è di oggi\n");

{
  const oggi = rigaTocco(d("letta", "ente"), OGGI);
  const domani = rigaTocco(d("letta", "ente"), DOMANI);
  ok(oggi.includes("alle 19:05"), "oggi: l'ora e basta", oggi);
  ok(!/ottobre|\d{2}\/\d{2}/.test(oggi), "oggi: nessuna data, che durante una diretta è rumore", oggi);
  ok(domani.includes("4 ottobre") && domani.includes("19:05"), "un altro giorno: la data compare", domani);
  ok(oggi !== domani, "i due casi sono due testi diversi (il confronto non è vacuo)");
  // La zona: 17:05 UTC sono le 19:05 a Roma. Se la zona cadesse, qui si
  // leggerebbe 17:05 — ed è l'unica asserzione di questo file che la vede.
  ok(!oggi.includes("17:05"), "l'ora è quella di Roma, non UTC", oggi);
}

console.log("\n§4 — il componente la chiama, e una volta sola\n");

{
  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  ok(src.includes('from "@/lib/eventi/tocco"'), "il componente importa la funzione invece di ricomporre la frase");
  const lista = fettaOppureRosso(
    src,
    { nome: "domande.map((d) => {", dove: "l'inizio della lista delle domande" },
    { nome: "<DomandaConsegnaForm", dove: "il form della consegna, subito dopo la lista" },
    "la lista delle domande",
  );
  const chiamate = (lista.match(/rigaTocco\(/g) ?? []).length;
  ok(chiamate === 1, "`rigaTocco` è chiamata UNA volta per riga", `${chiamate} chiamate`);
  ok(lista.includes("rigaTocco(d, ora)"), "e riceve l'ora invece di leggerla da sé");
  ok(
    !/letta da|risposta dall|risposta da KIREO/i.test(src),
    "nessuna copia del testo nel componente: una seconda copia divergerebbe",
  );
  // Le due colonne arrivano fino al componente: il tipo le dichiara, e senza
  // di quelle la riga resterebbe muta senza che niente si rompa.
  ok(src.includes("stato_da_tipo: string | null"), "il tipo `Domanda` dichiara stato_da_tipo");
  ok(src.includes("stato_il: string | null"), "e stato_il");
}

console.log("\n§5 — l'ora non si legge nel render\n");

{
  const src = leggi("components/ente/ControlloDirettaEvento.tsx");
  ok(src.includes("useState(() => new Date())"), "l'ora sta nello stato, non in una lettura dentro il render");
  const pollata = fettaOppureRosso(
    src,
    { nome: "const aggiorna = useCallback", dove: "l'inizio del poll" },
    { nome: "useEffect(() =>", dove: "l'effetto che lo monta" },
    "il poll",
  );
  ok(pollata.includes("setOra(new Date())"), "e si aggiorna col poll, che è quando una riga può cambiare comunque");
  // La proprietà vera: `new Date()` compare SOLO dentro `useState(() => …)` e
  // dentro il poll, mai nel corpo del render. Due occorrenze, dichiarate.
  try {
    ancora(src, "new Date()", { volte: 2, dove: "lo stato iniziale e il poll" });
    ok(true, "`new Date()` compare due volte sole: lo stato iniziale e il poll");
  } catch (e) {
    ok(false, "`new Date()` compare due volte sole: lo stato iniziale e il poll", e.message);
  }
}

console.log("\n§6 — la funzione SQL scrive le due colonne\n");

{
  const mig = senzaCommenti(
    readFileSync(join(RADICE, "supabase/migrations/20261011110000_domanda_chi_la_tocca.sql"), "utf8"),
  );
  const funzione = fettaOppureRosso(
    mig,
    { nome: "function public.aggiorna_stato_domanda_live", volte: 2, quale: 0, dove: "la definizione" },
    { nome: "comment on function public.aggiorna_stato_domanda_live", dove: "il commento, subito dopo" },
    "aggiorna_stato_domanda_live",
  );
  ok(funzione.includes("stato_da_tipo = v_da_tipo"), "l'update scrive la parte");
  ok(funzione.includes("stato_il = now()"), "e l'ora");
  // Il tipo si decide DOVE si autorizza: un secondo controllo del ruolo più in
  // basso sarebbe una seconda definizione della stessa cosa.
  ok(
    funzione.includes("v_da_tipo := 'kireo'") && funzione.includes("v_da_tipo := 'ente'"),
    "e il tipo è deciso nei due rami che autorizzano, non in un secondo controllo",
  );
  ok(
    funzione.includes("letta_il = coalesce(letta_il, now())"),
    "`letta_il` resta l'ora del PRIMO tocco: un nome che tiene un'altra cosa è la specie di casa",
  );
  // L'anonimato strutturale: il ramo studenti della funzione di lettura non
  // deve toccare `profiles`. È la proprietà che una modifica al tipo di
  // ritorno poteva rompere senza che nessuno se ne accorgesse.
  const lettura = fettaOppureRosso(
    mig,
    { nome: "if v_pubblico = 'docenti' then", dove: "il bivio dei due rami" },
    { nome: "comment on function public.domande_live_organizzatore", dove: "il commento, dopo la funzione" },
    "i due rami della lettura",
  );
  // `else` con il conto dichiarato: la fetta parte dal bivio, quindi gli
  // `elsif` dell'autorizzazione sono già fuori e ce n'è esattamente uno. Con un
  // `indexOf` grezzo, il giorno in cui la funzione guadagnasse un terzo ramo
  // questa fetta misurerebbe quello sbagliato restando verde.
  const ramoStudenti = fettaOppureRosso(
    lettura,
    { nome: "else", dove: "il bivio verso il ramo studenti" },
    null,
    "il ramo studenti",
  );
  ok(
    !ramoStudenti.includes("public.profiles"),
    "il ramo studenti non tocca `profiles`: l'anonimato è strutturale, non una dimenticanza evitata",
  );
  ok(ramoStudenti.includes("null::text"), "e restituisce esplicitamente nessun nome");
  ok(ramoStudenti.includes("d.stato_da_tipo, d.stato_il"), "ma restituisce il tocco");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
