/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// Domande e consegne nell'export (11/10/2026). La metà database sta in
// `scripts/verifica-export-domande-consegne.sql`.
//
// Le proprietà che conta tenere:
//
//   §1 UNA SEZIONE VUOTA LO DICE, e dice COSA non c'è. «Zero domande» e «non le
//      abbiamo esportate» si somigliano in un file aperto un mese dopo — e
//      «nessun dato» va bene per tutto, quindi non dice niente.
//   §2 LE DUE CAUSE DEL VUOTO SONO DUE. Una sezione che non si è POTUTA leggere
//      non è una sezione vuota, ed è un problema nostro: va detto.
//   §3 NIENTE NOMI, STRUTTURALMENTE. La proprietà non è «la route non stampa
//      quella colonna»: le due funzioni SQL non nominano `profiles` in nessun
//      ramo. Una query non può provarlo (prova che nel risultato non ci sono);
//      si legge dal sorgente della migrazione.
//   §4 L'ENTE RESTA FUORI DALLE CONSEGNE, e la differenza fra le due guardie è
//      deliberata: le domande l'ente le vede già, i testi no.
//   §5 LA ROUTE COMPONE LE TRE SEZIONI, e un fallimento delle due nuove non
//      butta via la prima — che è la ragione per cui questo export esiste.

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti.js");
const { fetta } = require("./lib/ancora.js");
const ts = require("typescript");

const RADICE = join(__dirname, "..");
const MIGRAZIONE = "supabase/migrations/20261011120000_export_domande_consegne.sql";
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

function caricaModulo(rel) {
  const js = ts.transpileModule(readFileSync(join(RADICE, rel), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const modulo = { exports: {} };
  new Function("require", "module", "exports", js)(
    () => {
      throw new Error(`${rel} non deve importare niente`);
    },
    modulo,
    modulo.exports,
  );
  return modulo.exports;
}

const { generaCsv, generaCsvSezioni } = caricaModulo("lib/csv.ts");

console.log("\n§1 — una sezione vuota lo dice, e dice cosa non c'è\n");

{
  const csv = generaCsvSezioni([
    { titolo: "Presenze", intestazioni: ["Nome"], righe: [["Mario"]], seNonCeNiente: "Nessuno si è collegato." },
    { titolo: "Domande", intestazioni: ["Testo"], righe: [], seNonCeNiente: "Nessuno ha fatto domande." },
  ]);
  const righe = csv.replace(/^﻿/, "").split("\r\n");
  ok(righe[0] === "Presenze", "il titolo della sezione sta su una riga sua", righe[0]);
  ok(righe[1] === "Nome" && righe[2] === "Mario", "e sotto ci sono intestazioni e righe");
  ok(righe[3] === "", "una riga vuota separa le sezioni", JSON.stringify(righe[3]));
  ok(righe[5] === "Nessuno ha fatto domande.", "la sezione vuota dice cosa non c'è", righe[5]);
  ok(!righe.includes("Testo"), "e NON stampa le sue intestazioni: una tabella vuota si legge come un dato mancante");
  ok(csv.startsWith("﻿"), "il BOM in testa al file");
  ok((csv.match(/﻿/g) ?? []).length === 1, "una volta sola, non per sezione");
  // La direzione in cui questo blocco sarebbe vacuo: se la sezione piena non
  // stampasse le sue righe, «la vuota è diversa» sarebbe vero per niente.
  ok(csv.includes("Mario"), "la sezione piena stampa davvero le sue righe (il confronto non è vacuo)");
}

{
  // Le frasi del vuoto sono DIVERSE fra le sezioni: una frase sola («nessun
  // dato») va bene per tutto, quindi non dice niente.
  const csv = generaCsvSezioni([
    { titolo: "A", intestazioni: ["x"], righe: [], seNonCeNiente: "Non ci sono domande." },
    { titolo: "B", intestazioni: ["x"], righe: [], seNonCeNiente: "Non ci sono risposte." },
  ]);
  ok(csv.includes("Non ci sono domande.") && csv.includes("Non ci sono risposte."), "due sezioni vuote dicono due cose diverse");
}

{
  // `generaCsv` non è stata toccata: resta la tabella sola, RFC 4180.
  const uno = generaCsv(["a", "b"], [[1, 2]]);
  ok(uno === "﻿a,b\r\n1,2", "`generaCsv` resta quello che era (una tabella, nessun titolo)", JSON.stringify(uno));
  // E l'escape vale anche nei titoli e nelle frasi del vuoto, che passano
  // dallo stesso campo: un titolo con una virgola spezzerebbe la riga.
  const virgola = generaCsvSezioni([{ titolo: 'Presenze, "ieri"', intestazioni: ["x"], righe: [], seNonCeNiente: "Niente, niente." }]);
  ok(virgola.includes('"Presenze, ""ieri"""'), "un titolo con virgole e virgolette è scappato", virgola.split("\r\n")[0]);
  ok(virgola.includes('"Niente, niente."'), "e anche la frase del vuoto");
}

console.log("\n§2 — le due cause del vuoto sono due\n");

{
  const src = leggi("app/api/admin/presenze/[id]/route.ts");
  // La route distingue «non c'era niente» da «non ho potuto leggere»: due
  // frasi, scelte da un ternario sull'errore della RPC.
  ok(
    /erroreDomande\s*\n?\s*\?\s*"Non è stato possibile leggere le domande/.test(src) ||
      src.includes('erroreDomande\n        ? "Non è stato possibile leggere le domande'),
    "le domande: una lettura fallita ha la sua frase, diversa da «nessuno ne ha fatte»",
  );
  ok(src.includes("Nessuno ha fatto domande durante la diretta."), "e il vuoto vero ha la sua");
  ok(
    src.includes("non perché non ce ne fossero"),
    "e la frase del guasto dice esplicitamente che non è un'affermazione sugli studenti",
  );
  // ⚠️ IL TERZO CASO, che nessuno aveva chiesto: nessuna domanda finale POSTA.
  // Senza, una sezione vuota direbbe «nessuno ha risposto» su un evento in cui
  // non c'era niente a cui rispondere.
  // ⚠️ LE TRE FRASI SI PROVANO TUTTE E TRE, parola per parola (sono di Mario),
  // E SI PROVA CHE SIANO TRE. La prima stesura di questa proprietà guardava la
  // presenza di UNA sola e si chiamava «sono due cose diverse»: una frase che
  // esiste non dice niente sull'altra, e il secondo e il terzo caso sono
  // esattamente quelli che collassano se qualcuno li unifica.
  const VUOTI = [
    "Nessuno ha fatto domande durante la diretta.",
    "La domanda finale è stata posta, e nessuno ha risposto.",
    "Per questo incontro non è stata posta nessuna domanda finale, quindi non ci sono risposte.",
  ];
  for (const frase of VUOTI) ok(src.includes(frase), `la frase del vuoto c'è parola per parola: «${frase}»`);
  ok(new Set(VUOTI).size === 3, "e sono TRE frasi distinte: tre cause del vuoto, tre cose da dire");
  // ⚠️ IL DISCRIMINE FRA LA SECONDA E LA TERZA, che è la ragione per cui la
  // terza esiste: nella seconda l'ente ha fatto il suo pezzo e nessuno ha
  // risposto; nella terza il pezzo mancante è dell'ente. Chi apre il file fra
  // un mese, senza quella riga, dà la colpa ai ragazzi.
  ok(/^La domanda finale è stata posta/.test(VUOTI[1]), "la seconda dice che la domanda C'ERA");
  ok(/non è stata posta nessuna domanda finale/.test(VUOTI[2]), "la terza dice che non c'era");
  ok(src.includes("domanda_consegna"), "e la route legge la colonna che le distingue");
  // E un errore su una delle due sezioni nuove NON butta via le presenze.
  ok(
    /if \(error\) \{[\s\S]{0,200}status: 500/.test(src),
    "un fallimento delle PRESENZE resta bloccante: è la ragione per cui l'export esiste",
  );
  ok(
    !/if \(erroreDomande\)[\s\S]{0,120}status: 500/.test(src),
    "un fallimento delle domande no: il file esce comunque, con la sezione che lo dice",
  );
  ok(
    src.includes("console.error(\"Errore esporta_domande_evento:") && src.includes("console.error(\"Errore esporta_consegne_evento:"),
    "e i due fallimenti non bloccanti lasciano comunque una traccia",
  );
}

console.log("\n§3 — niente nomi, strutturalmente\n");

{
  const mig = senzaCommentiSql(readFileSync(join(RADICE, MIGRAZIONE), "utf8"));
  // LA PROPRIETÀ: nessuna delle due funzioni nomina `profiles`. Non «non
  // stampa il nome» — non lo può nemmeno leggere.
  ok(!mig.includes("public.profiles"), "nessuna delle due funzioni nomina `profiles`", "trovato `public.profiles`");
  ok(!/\bjoin\b/i.test(mig), "e non c'è nessuna join: una forma senza join è una forma dove non si può aggiungere un nome");
  // E un solo ramo nella funzione delle domande: `domande_live_organizzatore`
  // ne ha due perché per i docenti mostra il nome, qui no — e una forma senza
  // rami è una forma in cui non si può aggiungere un nome a metà.
  const domande = fettaOppureRosso(
    mig,
    { nome: "create or replace function public.esporta_domande_evento", dove: "la definizione delle domande" },
    { nome: "comment on function public.esporta_domande_evento", dove: "il suo commento" },
    "esporta_domande_evento",
  );
  ok((domande.match(/return query/g) ?? []).length === 1, "la funzione delle domande ha UN solo `return query`");
  ok(!domande.includes("v_pubblico"), "e non guarda nemmeno il pubblico: non c'è un ramo per cui il nome comparirebbe");
}

console.log("\n§4 — l'ente resta fuori dalle consegne\n");

{
  const mig = senzaCommentiSql(readFileSync(join(RADICE, MIGRAZIONE), "utf8"));
  const consegne = fettaOppureRosso(
    mig,
    { nome: "create or replace function public.esporta_consegne_evento", dove: "la definizione delle consegne" },
    { nome: "comment on function public.esporta_consegne_evento", dove: "il suo commento" },
    "esporta_consegne_evento",
  );
  ok(consegne.includes("is distinct from 'admin'"), "la guardia delle consegne è admin-only");
  ok(
    !consegne.includes("current_istituzione_id"),
    "e NON nomina l'istituzione: l'ente non entra, ed è la decisione del 27/09 («quello che scrivono resta loro»)",
  );
  // La sorella invece sì: le due guardie sono diverse di proposito, e se
  // diventassero uguali vorrebbe dire che una delle due ha cambiato politica.
  const domande = fettaOppureRosso(
    mig,
    { nome: "create or replace function public.esporta_domande_evento", dove: "la definizione delle domande" },
    { nome: "comment on function public.esporta_domande_evento", dove: "il suo commento" },
    "esporta_domande_evento",
  );
  ok(
    domande.includes("current_istituzione_id"),
    "le domande sì: l'ente le vede già nel pannello, un CSV non gli aggiunge niente",
  );
  // Entrambe revocate ad anon: una funzione nuova nasce eseguibile da anon per
  // i default privileges di Supabase.
  ok(
    (mig.match(/revoke all on function[\s\S]*?from public, anon;/g) ?? []).length === 2,
    "entrambe revocate da `public, anon`",
  );
}

console.log("\n§5 — la route compone le tre sezioni\n");

{
  const src = leggi("app/api/admin/presenze/[id]/route.ts");
  ok(src.includes("generaCsvSezioni"), "la route usa il compositore a sezioni");
  ok(!src.includes("generaCsv("), "e non più quello a tabella singola");
  const sezioni = fettaOppureRosso(
    src,
    { nome: "const sezioni: SezioneCsv[]", dove: "l'elenco delle sezioni" },
    { nome: "const csv = generaCsvSezioni", dove: "la composizione, subito dopo" },
    "l'elenco delle sezioni",
  );
  ok((sezioni.match(/titolo:/g) ?? []).length === 3, "tre sezioni", `${(sezioni.match(/titolo:/g) ?? []).length}`);
  ok((sezioni.match(/seNonCeNiente:/g) ?? []).length === 3, "e ognuna dice cosa scrivere quando è vuota");
  ok(/anonime/.test(sezioni), "i titoli delle due sezioni nuove dicono che sono anonime");
  // Le due RPC si chiamano, non si riscrive la query.
  ok(src.includes('rpc("esporta_domande_evento"'), "le domande arrivano dalla RPC dedicata");
  ok(src.includes('rpc("esporta_consegne_evento"'), "e le consegne pure");
  ok(
    !src.includes('from("domande_live")') && !src.includes('from("consegne_evento")'),
    "e nessuna delle due si legge in diretto: sarebbe una seconda definizione di cosa esce",
  );
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
