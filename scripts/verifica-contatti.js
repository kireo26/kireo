// /contatti: che il modulo mandi davvero, e che le quattro origini restino
// quattro in ogni elenco che le nomina.
//
// PERCHÉ ESISTE. Dal giorno in cui quella pagina è nata, `ContactForm`
// faceva `preventDefault()` e `setInviato(true)` — nessuna rete, nessuna
// riga, nessuna email — e la pagina rispondeva «Messaggio inviato!». Ogni
// persona che ha scritto a KIREO da lì ha letto una conferma e non ha mandato
// niente. Non era un modulo incompleto: era una COSA SCRITTA CHE DICHIARAVA
// UNO STATO DIVERSO DA QUELLO VERO, nel punto in cui il prodotto promette di
// ascoltare.
//
// E non era solo quella pagina: cinque testi scritti apposta per non mentire
// finiscono con «scrivici da Contatti» — l'export che non riesce, la consegna
// che il revisore non ha letto, il rifiuto delle guide, l'errore di
// `delete_own_account`. Erano tutti appoggiati a una porta che non si apriva.
//
// LE PROPRIETÀ, e sono di forma:
//
//   1. /contatti non ha un modulo suo: usa quello condiviso, che la manda
//      davvero. Un secondo modulo che parla alla stessa route sarebbe una
//      seconda copia della validazione e del messaggio di conferma, e due
//      copie divergono — è solo questione di quando.
//   2. «inviato» si segna DOPO la risposta del server, non prima. È il
//      difetto esatto, espresso come ordine fra due righe.
//   3. le origini sono lo STESSO insieme in tutti e quattro i posti che le
//      nominano: il CHECK della migrazione, la tabella della route, i testi
//      del rifiuto, le etichette delle email. Una quinta origine che ne
//      dimentichi uno non fallisce con un errore: fa leggere «undefined» a
//      una persona, oppure fa rifiutare dal database una riga che la route
//      ha accettato.
//   4. l'indirizzo personale di Mario non compare in niente che si renda.
//      Sta nella route, che gira sul server, e in nessuna pagina né
//      componente. L'indirizzo pubblico, al contrario, DEVE comparire su
//      /contatti: è la strada per chi non vuole usare un modulo, e quella
//      che tiene vere le frasi che si scusano anche il giorno in cui il
//      modulo si rompe.
//
// Esecuzione: `npm run test:contatti`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");

const ROOT = path.join(__dirname, "..");
let falliti = 0;
const ok = (cond, msg, extra) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) {
    falliti++;
    if (extra) console.log(`      → ${extra}`);
  }
};
// Spogliato dai commenti: una guardia negativa trova la forma vietata dentro
// il commento che la cita per spiegare perché è vietata.
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));
const esiste = (rel) => fs.existsSync(path.join(ROOT, rel));

console.log("\n═══ /contatti: il modulo manda davvero, e le origini sono quattro ═══\n");

// ── 1) la pagina non ha un modulo suo ──────────────────────────────────────
console.log("1) /contatti usa il modulo condiviso, non uno suo");

const pagina = leggi("app/contatti/page.tsx");
ok(/import RichiestaContattoForm from "@\/components\/landing\/RichiestaContattoForm"/.test(pagina),
  "la pagina importa il modulo condiviso");
ok(/origine="contatti"/.test(pagina), "…e lo usa con origine=contatti");
ok(!esiste("components/ContactForm.tsx"),
  "`components/ContactForm.tsx` non esiste",
  "era il modulo che segnava «inviato» senza nessuna chiamata di rete: se torna, torna con la sua bugia");
// La bugia nella sua forma letterale: una pagina che la scrive a mano non
// passa dal modulo condiviso, quindi non passa dalla proprietà 2.
ok(!/setInviato\(true\)/.test(pagina),
  "la pagina non segna «inviato» da sé",
  "chi lo fa in pagina sta tenendo uno stato che il server non ha confermato");

// ── 2) «inviato» si segna dopo la risposta ─────────────────────────────────
console.log("\n2) «inviato» si segna DOPO la risposta del server");

const form = leggi("components/landing/RichiestaContattoForm.tsx");
// Àncora alla CHIAMATA, non al nome: `fetch` compare una volta sola, e
// `setInviato(true)` una sola — se una delle due si sdoppia il conto grida
// invece di misurare l'occorrenza sbagliata.
let posFetch = null;
let posInviato = null;
let posControllo = null;
try {
  posFetch = ancora(form, 'fetch("/api/richiesta-contatto"', { volte: 1, dove: "RichiestaContattoForm" });
  posInviato = ancora(form, "setInviato(true)", { volte: 1, dove: "RichiestaContattoForm" });
  posControllo = ancora(form, "if (!risposta.ok)", { volte: 1, dove: "RichiestaContattoForm" });
} catch (e) {
  ok(false, "le àncore del modulo si leggono", e.message);
}
ok(posFetch !== null && posInviato !== null && posInviato > posFetch,
  "`setInviato(true)` viene dopo la chiamata alla route",
  "prima della chiamata è esattamente il difetto: una conferma che non dipende da niente");
ok(posControllo !== null && posInviato !== null && posInviato > posControllo,
  "…e dopo il controllo sulla risposta",
  "dopo la chiamata ma prima del controllo, un 429 o un 500 si leggerebbero come «inviato»");
ok(/setErroreGenerale\(dati\?\.errore/.test(form),
  "il rifiuto del server arriva a chi legge, invece di un testo nostro generico",
  "il limite di cortesia e la validazione hanno due messaggi diversi: scartarli li rende lo stesso");

// ── 3) le quattro origini, nei quattro posti che le nominano ───────────────
console.log("\n3) Le origini sono lo stesso insieme in tutti i posti che le nominano");

// Il CHECK vivo è quello della ULTIMA migrazione che lo definisce: `20260727170000`
// ne ha già sostituito uno, quindi leggere la prima darebbe tre valori invece
// di quattro — e un controllo che legge una definizione superata è verde su un
// mondo che non c'è più.
const migrazioni = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .sort();
let origineCheck = null;
let fileCheck = null;
for (const f of migrazioni) {
  const sql = senzaCommentiSql(fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8"));
  const m = [...sql.matchAll(/richieste_contatto_origine_check\s+check\s*\(origine in \(([^)]*)\)\)/gi)];
  if (m.length) {
    origineCheck = m[m.length - 1][1];
    fileCheck = f;
  }
}
const dalCheck = origineCheck
  ? [...origineCheck.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()
  : null;
ok(Array.isArray(dalCheck) && dalCheck.length >= 4,
  `il CHECK vivo (${fileCheck}) ammette ${dalCheck?.length ?? "?"} origini: ${dalCheck?.join(", ") ?? "non leggibile"}`,
  "sotto quattro, o l'estrattore non legge o la migrazione non è stata scritta");

const route = leggi("app/api/richiesta-contatto/route.ts");
// Ogni elenco per-origine si legge dal suo blocco, con le àncore che
// dichiarano il proprio conto.
// ⚠️ La fetta finisce al primo `}` a inizio riga, non al primo `};`: `ORIGINI`
// chiude con `} as const;`, quindi un taglio su `};` arrivava fino a quello di
// `RIFIUTO_LIMITE` e leggeva OTTO chiavi invece di quattro. Il confronto
// restava verde per coincidenza — le due tabelle hanno le stesse chiavi,
// quindi l'insieme non cambiava — ed è il motivo per cui qui sotto si
// confrontano anche le LUNGHEZZE: un'uguaglianza fra insiemi non vede i
// duplicati, e un terminatore sbagliato produce esattamente duplicati.
const chiaviDi = (src, apertura, volte, dove) => {
  try {
    const i = ancora(src, apertura, { volte, dove });
    const resto = src.slice(i + apertura.length);
    const fine = resto.search(/\n\}/);
    return [...resto.slice(0, fine === -1 ? resto.length : fine).matchAll(/^\s{2}([a-z_]+):/gm)]
      .map((m) => m[1])
      .sort();
  } catch {
    return null;
  }
};
const dalleOrigini = chiaviDi(route, "const ORIGINI = {", 1, "route");
const daiRifiuti = chiaviDi(route, "const RIFIUTO_LIMITE: Record<Origine, string> = {", 1, "route");
const dalleEtichette = chiaviDi(
  leggi("lib/email/templates.ts"),
  "const ETICHETTA_ORIGINE: Record<OrigineRichiesta, string> = {",
  1,
  "templates",
);

const elenchi = [
  ["il CHECK della migrazione", dalCheck],
  ["ORIGINI (route)", dalleOrigini],
  ["RIFIUTO_LIMITE (route)", daiRifiuti],
  ["ETICHETTA_ORIGINE (templates)", dalleEtichette],
];
for (const [nome, lista] of elenchi) {
  ok(Array.isArray(lista) && lista.length >= 4 && lista.length === new Set(lista).size,
    `${nome}: ${lista?.length ?? "non leggibile"} origini`,
    "un elenco che non si legge, o che legge due volte la stessa chiave, è un elenco che questo controllo " +
    "non sta guardando — e un duplicato è l'impronta di una fetta tagliata nel posto sbagliato");
}
const riferimento = dalCheck ?? [];
for (const [nome, lista] of elenchi.slice(1)) {
  const manca = riferimento.filter((o) => !(lista ?? []).includes(o));
  const inPiu = (lista ?? []).filter((o) => !riferimento.includes(o));
  ok(manca.length === 0 && inPiu.length === 0 && (lista ?? []).length === riferimento.length,
    `${nome} coincide col CHECK`,
    `manca: ${manca.join(", ") || "—"} · in più: ${inPiu.join(", ") || "—"} · ` +
    `${(lista ?? []).length} contro ${riferimento.length}\n` +
    "      → una origine senza riga in RIFIUTO_LIMITE fa leggere «undefined» a una persona; " +
    "una accettata dalla route e non dal CHECK la fa rifiutare dal database");
}

// L'istituto: nullable nel database, obbligatorio dove lo era.
const migrazioniTesto = migrazioni
  .map((f) => senzaCommentiSql(fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8")))
  .join("\n");
ok(/alter column istituto drop not null/i.test(migrazioniTesto),
  "`istituto` è nullable nel database",
  "senza, un messaggio da /contatti senza istituto viene rifiutato da Postgres e la persona legge un guasto nostro");
ok(/contatti: \{ notifica: \[[^\]]*\], istitutoObbligatorio: false \}/.test(route),
  "la route non pretende l'istituto per /contatti",
  "chi scrive da lì può essere uno studente: un istituto obbligatorio è una barriera sul contatto più leggero che abbiamo");
ok((route.match(/istitutoObbligatorio: true/g) || []).length === 3,
  "…e continua a pretenderlo per le tre origini delle landing",
  "il database dice «può mancare», la route dice «per queste no»: due livelli, due cose diverse");

// ── 4) i due indirizzi, ognuno dove deve stare ─────────────────────────────
console.log("\n4) L'indirizzo personale non compare in niente che si renda");

const PERSONALE = "mario.izzo" + "@hotmail.it";
const PUBBLICO = "info" + "@kireo.it";

function fileResi(dir, acc = []) {
  for (const voce of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) {
      // `app/api` non si rende: è codice che gira sul server.
      if (rel === path.join("app", "api")) continue;
      fileResi(rel, acc);
    } else if (/\.tsx$/.test(voce.name)) {
      acc.push(rel);
    }
  }
  return acc;
}
const resi = [...fileResi("app"), ...fileResi("components")];
ok(resi.length > 50, `ci sono ${resi.length} file resi da guardare`,
  "sotto cinquanta, l'enumeratore ha smesso di leggere: un verde su un insieme vuoto");
const perdite = resi.filter((f) => fs.readFileSync(path.join(ROOT, f), "utf8").includes(PERSONALE));
ok(perdite.length === 0,
  "l'indirizzo personale non sta in nessun file reso",
  `${perdite.join(", ")} — è la copia personale di Mario e non va da nessuna parte sul sito`);
ok(route.includes(PERSONALE),
  "…e nella route c'è ancora",
  "se sparisce da lì, le notifiche delle landing non arrivano più a nessuno e non se ne accorge nessuno");
ok(pagina.includes(PUBBLICO),
  `/contatti mostra ${PUBBLICO}`,
  "è la strada per chi non vuole usare un modulo, e quella che tiene vere le frasi che si scusano");

// ── 5) il guasto sul percorso eccezionale lascia una traccia ───────────────
console.log("\n5) Un 500 che non ritorniamo noi non esiste per nessuno");

// ⚠️ `createClient()` lancia quando Supabase non è configurato. Fuori da un
// try produce un 500 GREZZO: nessun corpo, nessuna traccia nei log — e
// `npm run test:log5xx` non lo vede, perché guarda i 5xx che RITORNIAMO.
// Misurato su build di produzione il 10/10/2026 prima della cura.
// ⚠️ LE ÀNCORE DICHIARANO IL LORO CONTO, e qui non è un formalismo: `try {`
// compare DUE volte in questo file (la lettura del corpo, e questo). La prima
// stesura usava un `lastIndexOf("try {", posClient)` grezzo, che trovava il
// PRIMO — quindi con `createClient()` spostato fuori dal try la condizione
// restava soddisfatta da una coppia try/catch che non c'entrava, e la
// controprova era VERDE sul difetto. Il conto dichiarato è la cosa che un
// indexOf grezzo non fa.
let posClient = null;
let posTry = null;
let posCatch = null;
try {
  posClient = ancora(route, "await createClient()", { volte: 1, dove: "route" });
  posTry = ancora(route, "try {", { volte: 2, quale: 1, dove: "route" });
  posCatch = ancora(route, "} catch", { volte: 2, quale: 1, dove: "route" });
} catch (e) {
  ok(false, "le àncore del ramo di guasto si leggono", e.message);
}
ok(posClient !== null && posTry !== null && posCatch !== null && posTry < posClient && posClient < posCatch,
  "`createClient()` sta dentro il try dell'insert",
  "fuori, un env rotto dà un 500 grezzo: la persona legge un messaggio generico e nei log non resta niente");
ok(/Errore insert richieste_contatto \(eccezione\)/.test(route),
  "…e l'eccezione lascia una riga",
  "il ramo che risponde 500 senza scrivere niente è un guasto che non è mai successo");

console.log(`\n${falliti === 0 ? "✓" : "❌"} ${falliti === 0 ? "tutte verdi" : `${falliti} asserzioni rosse`}\n`);
process.exit(falliti === 0 ? 0 : 1);
