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
const { ancora, fetta } = require("./lib/ancora");
const { abilitaTypeScript } = require("./banco/ts");

const ROOT = path.join(__dirname, "..");
let falliti = 0;
// `fatte` esiste perché il numero finisca nella riga di riepilogo. Una riga
// «Verificato» di CLAUDE.md che dice «64 proprietà» va accompagnata dal comando
// che lo RISTAMPA, e questa suite diceva solo «tutte verdi»: il 64 si otteneva
// contando le righe con un grep, cioè non si otteneva. Il conto lo DICHIARA la
// suite — dedurlo dall'output significherebbe contare anche le righe di prosa
// indentate, con un errore di cui nessuno conosce la direzione.
let fatte = 0;
const ok = (cond, msg, extra) => {
  fatte++;
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
console.log("\n2) «inviato» si segna DOPO la risposta, e dice solo quello che è successo");

const form = leggi("components/landing/RichiestaContattoForm.tsx");
// Àncora alla CHIAMATA, non al nome: `fetch` compare una volta sola, e
// `setInviato({` una sola — se una delle due si sdoppia il conto grida
// invece di misurare l'occorrenza sbagliata.
let posFetch = null;
let posInviato = null;
let posControllo = null;
try {
  posFetch = ancora(form, 'fetch("/api/richiesta-contatto"', { volte: 1, dove: "RichiestaContattoForm" });
  posInviato = ancora(form, "setInviato({", { volte: 1, dove: "RichiestaContattoForm" });
  posControllo = ancora(form, "if (!risposta.ok)", { volte: 1, dove: "RichiestaContattoForm" });
} catch (e) {
  ok(false, "le àncore del modulo si leggono", e.message);
}
ok(posFetch !== null && posInviato !== null && posInviato > posFetch,
  "la conferma si segna dopo la chiamata alla route",
  "prima della chiamata è esattamente il difetto: una conferma che non dipende da niente");
ok(posControllo !== null && posInviato !== null && posInviato > posControllo,
  "…e dopo il controllo sulla risposta",
  "dopo la chiamata ma prima del controllo, un 429 o un 500 si leggerebbero come «inviato»");
ok(/setErroreGenerale\(dati\?\.errore/.test(form),
  "il rifiuto del server arriva a chi legge, invece di un testo nostro generico",
  "il limite di cortesia e la validazione hanno due messaggi diversi: scartarli li rende lo stesso");

// ⚠️ LA PAGINA NON AFFERMA UN'EMAIL CHE PUÒ NON ESSERE PARTITA. Il 10/10/2026
// Brevo ha bloccato la conferma di un messaggio vero (IP di Vercel non
// autorizzato): la riga è arrivata in coda e la pagina ha detto comunque «Ti
// abbiamo mandato un'email di conferma: se non la vedi, controlla la posta
// indesiderata» — e ha mandato una persona a cercare nello spam una cosa che
// non c'era. Un'affermazione falsa accanto a una vera, di cui eredita la
// credibilità: la stessa forma del file di export che scriveva `[]` dove non
// aveva guardato.
ok(/inviato\.confermaInviata \? conferma\.testo : conferma\.testoSenzaConferma/.test(form),
  "il testo della conferma dipende dall'esito dell'invio",
  "un testo solo, con la frase sull'email dentro, afferma una cortesia che può non essere arrivata");
// La direzione in cui sbaglia: verso il TACERE, non verso l'affermare.
ok(/confermaInviata: dati\?\.confermaInviata === true/.test(form),
  "…e se la risposta non dice niente sull'email, si assume che non sia partita",
  "sbagliare verso il silenzio toglie una cortesia a chi l'ha avuta; verso l'affermazione dice una cosa falsa a chi non l'ha avuta");
// E lo `state` non torna un booleano: con un booleano la condizione di sopra
// non si può nemmeno scrivere.
ok(/useState<\{ confermaInviata: boolean \} \| null>\(null\)/.test(form),
  "lo stato porta l'esito dell'invio, non un «fatto/non fatto»",
  "un booleano non può distinguere «non ancora inviato» da «riga scritta, conferma no»");

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
// La distinzione «richiesta»/«messaggio»: un posto solo per un fatto solo,
// perché serve all'oggetto della conferma E a quello della risposta dalla
// coda. Un quinto posto che le nomina è un quinto posto da tenere in passo.
const daiNomi = chiaviDi(
  leggi("lib/contatti/testi.ts"),
  "export const COSA_E_ARRIVATO: Record<",
  1,
  "contatti/testi",
);

const elenchi = [
  ["il CHECK della migrazione", dalCheck],
  ["ORIGINI (route)", dalleOrigini],
  ["RIFIUTO_LIMITE (route)", daiRifiuti],
  ["ETICHETTA_ORIGINE (templates)", dalleEtichette],
  ["COSA_E_ARRIVATO (contatti/testi)", daiNomi],
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

// ⚠️ IL RIFIUTO DEVE DIRE CHE LA COSA NON È PASSATA, e fino al 10/10/2026 le
// landing non lo dicevano: «Hai già inviato una richiesta di recente: ti
// ricontatteremo presto!» è vero, ed è vero della PRIMA richiesta — non della
// cosa appena successa, cioè che la seconda è stata buttata via. Chi scrive
// due volte scrive per AGGIUNGERE qualcosa, e quella cosa sparisce mentre la
// persona esce convinta di averla mandata. Con il punto esclamativo sopra.
// L'estrattore legge TUTTE E TRE le forme di letterale, non solo quella che
// il codice usa oggi: se leggesse solo i template literal, una riscrittura fra
// doppie virgolette farebbe fallire il LETTORE invece delle due proprietà sulla
// sostanza — e un rosso che nomina il difetto sbagliato manda a riparare la
// cosa giusta. (Misurato: succedeva, con la controprova del 10/10.)
const letterale = (nome) =>
  new RegExp(`${nome}\\s*[:=]\\s*(?:\`([^\`]*)\`|"([^"]*)"|'([^']*)')`);
const rifiuti = [
  ["landing", "RIFIUTO_LANDING"],
  ["contatti", "contatti"],
].map(([dove, nome]) => {
  const m = route.match(letterale(nome));
  return [dove, m ? (m[1] ?? m[2] ?? m[3]) : null];
});
ok(rifiuti.every(([, t]) => typeof t === "string" && t.length > 40),
  `i ${rifiuti.length} testi del rifiuto si leggono`,
  "se non si leggono, le tre proprietà qui sotto sono verdi su un insieme vuoto");
const taccionoSulRifiuto = rifiuti
  .filter(([, t]) => !/non è stat[ao] inviat[ao]/.test(t ?? ""))
  .map(([d]) => d);
ok(taccionoSulRifiuto.length === 0,
  "ogni rifiuto dice che quello che la persona ha scritto NON è stato inviato",
  `${taccionoSulRifiuto.join(", ")} — una frase rassicurante al posto del fatto lascia credere ` +
  "che sia andato tutto bene, e quello che la persona stava aggiungendo sparisce");
const festeggiano = rifiuti.filter(([, t]) => (t ?? "").includes("!")).map(([d]) => d);
ok(festeggiano.length === 0,
  "…e nessuno lo festeggia con un punto esclamativo",
  `${festeggiano.join(", ")} — non c'è niente da festeggiare in un messaggio che non è arrivato`);
const senzaStrada = rifiuti
  .filter(([, t]) => !/EMAIL_PUBBLICA/.test(t ?? ""))
  .map(([d]) => d);
ok(senzaStrada.length === 0,
  "…e ognuno dà la strada per la cosa che la persona stava cercando di aggiungere",
  `${senzaStrada.join(", ")} — un no che non dice cosa fare manda a cercare`);

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
// ⚠️ LA PAGINA NON CONTIENE PIÙ IL LETTERALE, e non è un peggioramento: dal
// 10/10/2026 l'indirizzo pubblico sta in `lib/site.ts`, accanto all'URL
// canonico, perché viveva in cinque posti. Quindi la proprietà si prova in due
// metà invece di una: che la costante lo contenga, e che la pagina la RENDA —
// un `import` che nessuno usa lascerebbe la pagina senza indirizzo con questo
// controllo verde.
ok(leggi("lib/site.ts").includes(PUBBLICO),
  `\`EMAIL_PUBBLICA\` è ${PUBBLICO}`,
  "è la strada per chi non vuole usare un modulo, e quella che tiene vere le frasi che si scusano");
ok(/import \{ EMAIL_PUBBLICA \} from "@\/lib\/site"/.test(pagina) &&
   /\{EMAIL_PUBBLICA\}/.test(pagina) &&
   /mailto:\$\{EMAIL_PUBBLICA\}/.test(pagina),
  "…e /contatti la rende, come testo cliccabile",
  "un import non usato è un indirizzo che non compare: la pagina tornerebbe a non avere una strada fuori dal modulo");

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

// ── 6) un invio fallito lascia una traccia, non solo un log ────────────────
console.log("\n6) Un'email che non parte lascia una riga in `guasti`");

// Gli IP autorizzati su Brevo erano UNDICI: è già successo dieci volte, quindi
// un invio fallito qui è un evento NORMALE. Quello del 10/10/2026 lo abbiamo
// scoperto solo perché Mario stava guardando se l'email arrivava — e un guasto
// che vive solo in un log di un fornitore (poche ore) è un guasto che non
// possediamo.
ok(/specie: "email_contatto"/.test(route),
  "la route registra un guasto quando un'email non parte",
  "senza, il prossimo blocco di Brevo dura quanto gli undici precedenti: finché nessuno guarda, non è successo niente");
for (const motivo of ["conferma_non_inviata", "notifica_non_inviata"]) {
  ok(route.includes(`motivo: "${motivo}"`), `…e distingue il motivo «${motivo}»`,
    "la cortesia a chi scrive e l'avviso a noi non mancano nello stesso modo: " +
    "nel primo caso la riga è comunque in coda, nel secondo a mancare è l'avviso che ci farebbe guardare");
}
ok(/segnalaGuasto\(/.test(route),
  "…in un gesto solo con la riga di log",
  "due chiamate separate si dimenticano una alla volta, e si dimenticano nel ramo d'errore, che è quello che nessuno rilegge");
ok(/confermaInviata: esitoConferma\.ok/.test(route),
  "la route dice al modulo se la conferma è partita",
  "senza questo, la pagina non ha modo di sapere cosa affermare e torna ad affermare sempre");

// ── 7) la coda: quando, e un modo per rispondere ───────────────────────────
console.log("\n7) La coda dice a che ora, e da lì si può rispondere");

const admin = leggi("app/admin/page.tsx");
// La fetta della coda: dalla sua query al riquadro. L'àncora dichiara il
// proprio conto, perché `created_at` nella pagina compare dappertutto.
let coda = null;
try {
  const i = ancora(admin, "richiesteContatto.map", { volte: 1, dove: "admin" });
  coda = admin.slice(i, i + 2200);
} catch (e) {
  ok(false, "la fetta della coda si legge", e.message);
}
// ⚠️ IL POSITIVO NON BASTA, e l'ha detto una controprova: `formattaDataOra`
// compare DUE volte in questa fetta — nella riga della data e dentro il
// `quando` del bottone «Rispondi» — quindi un `test()` che cerca solo quella
// restava VERDE con la riga riportata a `formattaData`. Mode 6: un'àncora su
// un nome condiviso misura l'occorrenza sbagliata. Si prova il DIVIETO
// insieme al positivo.
ok(coda !== null && /formattaDataOra\(r\.created_at/.test(coda) && !/formattaData\(r\.created_at/.test(coda),
  "la riga porta data E ora, e non la sola data",
  "in un elenco di lavoro QUANDO è parte dell'informazione: dice cosa è urgente, cosa è vecchio, " +
  "e se due righe sono la stessa persona che ha riprovato. Il 10/10/2026 due messaggi a undici minuti " +
  "di distanza dicevano la stessa data e dalla coda non si distinguevano");
ok(coda !== null && /href=\{mailtoRisposta\(\{/.test(coda),
  "…e c'è un «Rispondi» che apre il programma di posta già pronto",
  "il gesto vero è rispondere: senza, lo si fa altrove copiando l'indirizzo a mano");

// ⚠️ LA COSA CHE IL BOTTONE NON DEVE FARE. Aprire una bozza non è averla
// mandata, e KIREO non può saperlo: segnare la riga come gestita sarebbe
// scrivere uno stato che non abbiamo osservato — la specie di casa, in un
// bottone nuovo, il giorno in cui lo scriviamo.
//
// La fetta va dal `mailtoRisposta` alla CHIUSURA DEL SUO ELEMENTO, non a
// un'etichetta: la prima stesura tagliava su «Rispondi\n», e cambiando quella
// parola la fetta diventava un carattere — cioè il controllo era verde su
// qualunque cosa. Se la chiusura non si trova, è rosso e lo dice, invece di
// misurare un vuoto.
let fettaRispondi = null;
let perche = "";
try {
  // Fra l'`href` del «Rispondi» e il bottone «Gestita», che nel JSX gli sta
  // subito dopo: le due àncore dichiarano il loro conto, quindi se una si
  // sdoppia il controllo grida, e se qualcuno le inverte `fetta` dice che sono
  // invertite invece di restituire un vuoto.
  fettaRispondi = fetta(
    coda ?? "",
    { nome: "href={mailtoRisposta({", volte: 1, dove: "coda admin" },
    { nome: "<ToggleGestitaRichiesta", volte: 1, dove: "coda admin" },
  );
} catch (e) {
  perche = e.message;
}
ok(fettaRispondi !== null,
  "l'elemento di «Rispondi» si legge dall'`href` fino al bottone «Gestita»",
  `${perche}\n       senza la fetta, l'asserzione qui sotto guarderebbe un vuoto e sarebbe verde su niente`);
ok(fettaRispondi !== null && !/gestita|Toggle|onClick|\.update\(/.test(fettaRispondi),
  "«Rispondi» non segna la riga come gestita, e non scrive niente",
  "restano due gesti distinti, e «gestita» resta quello che è: una persona che dichiara di aver chiuso la cosa");

// Il mailto si prova come VALORE: una regex dice che la funzione è chiamata,
// non che produce un link che un client di posta apre.
abilitaTypeScript();
const {
  mailtoRisposta,
  COSA_E_ARRIVATO,
  confermaPerOrigine,
  promessaRisposta,
} = require("@/lib/contatti/testi");
const { templateConfermaRichiestaContatto } = require("@/lib/email/templates");

// ── 7bis) la promessa dei tempi, su TUTTE E DIECI le superfici ──────────────
console.log("\n7bis) Una promessa sola, su tutte e dieci le superfici che la mostrano");

// ⚠️ IL 10/10 QUESTO BLOCCO GUARDAVA DUE POSTI E LE PROMESSE ERANO DUE. Lo
// schermo di /contatti e la sua email erano allineati; le tre landing
// dicevano «Ti risponderemo entro 24 ore» a schermo e «Ti ricontatteremo
// entro 24 ore» nell'email, cioè una promessa diversa per lo stesso gesto —
// e la stessa persona può vedere tutte e due (un dirigente che scrive da
// /dirigenti e un mese dopo da /contatti). Non potevano essere vere entrambe.
// Mario ha deciso di allineare tutto a «di solito entro un giorno o due».
//
// Quindi la guardia non guarda più «i due posti»: guarda LE SEI SUPERFICI che
// una promessa di risposta raggiunge — quattro conferme a schermo e i due
// rami dell'email — e pretende che portino la stessa finestra. È la specie
// nuova: *un testo si legge accanto agli altri che la stessa persona può
// vedere, e quello che sbaglia non è quasi mai la frase — è il fatto che ce ne
// sia un'altra.* Nessuna guardia può prendere due stringhe corrette che si
// contraddicono; questa può, perché confronta.
const ORIGINI_TUTTE = Object.keys(COSA_E_ARRIVATO);
// L'email si prova CHIAMANDOLA: una regex dice che la costante è interpolata,
// non che la frase arriva a chi apre il messaggio.
// ⚠️ DIECI, NON SEI. La prima stesura di questo blocco (10/10) guardava i soli
// `testo` e la controprova «24 ore rimesse sulle landing» NON ha morso: anche
// `testoSenzaConferma` è una superficie che una persona legge — è quella che
// vede quando l'email non parte, cioè il caso che il 10/10 è successo davvero —
// e porta la promessa anche lei. Un controllo che non vede un ingresso è verde
// su quell'ingresso, e lo dice con lo stesso verde di uno che lo guarda.
const superfici = [
  ...ORIGINI_TUTTE.flatMap((o) => [
    [`conferma a schermo (${o})`, confermaPerOrigine(o).testo],
    [`conferma senza email (${o})`, confermaPerOrigine(o).testoSenzaConferma],
  ]),
  ...["contatti", "dirigenti"].map((o) => [
    `email di conferma (${o === "contatti" ? "ramo /contatti" : "ramo landing"})`,
    templateConfermaRichiestaContatto("Mario", o),
  ]),
];
ok(superfici.length === 10, `${superfici.length} superfici guardate`,
  "sotto dieci, questo blocco ha smesso di leggerne una e tace su quella");
const FINESTRA = "di solito entro un giorno o due";
const senzaFinestra = superfici.filter(([, t]) => !t.includes(FINESTRA)).map(([d]) => d);
ok(senzaFinestra.length === 0,
  `tutte e ${superfici.length} portano la stessa finestra («${FINESTRA}»)`,
  `${senzaFinestra.join(", ")} — una promessa diversa per lo stesso gesto, e la stessa persona può vederle tutte e due`);
// La finestra vecchia è VIETATA, non solo sostituita: «entro 24 ore» è una
// promessa rigida fatta da un progetto di una persona sola, e il primo
// messaggio che arriva il venerdì sera la rompe senza che nessuno se ne
// accorga, perché nessuno conta le ore.
const con24 = superfici.filter(([, t]) => /24\s*ore/.test(t)).map(([d]) => d);
ok(con24.length === 0, "…e nessuna promette più «entro 24 ore»",
  `${con24.join(", ")} — se torna a essere un impegno, si cambia la finestra in un posto solo`);
const annacquate = superfici.filter(([, t]) => /il prima possibile/.test(t)).map(([d]) => d);
ok(annacquate.length === 0, "…e nessuna la annacqua con un «il prima possibile»",
  `${annacquate.join(", ")} — davanti a una finestra concreta quella frase la indebolisce`);
// Il pronome, in DUE METÀ perché una sola sarebbe circolare: confrontare la
// frase resa con `COSA_E_ARRIVATO[o].pronome` prova solo che la funzione legga
// la tabella, non che la tabella abbia ragione.
//
// La metà che conta è l'ACCORDO con quello che il lettore ha appena letto: il
// `nome` dice «il tuo messaggio» o «la tua richiesta», e da lì il pronome è
// determinato. «Lo leggiamo» dopo «Richiesta inviata» non regge, ed è il
// prezzo che si pagherebbe per una costante invece di una funzione.
const disaccordi = ORIGINI_TUTTE.filter((o) => {
  const { nome, pronome, titoloConferma } = COSA_E_ARRIVATO[o];
  const atteso = nome.startsWith("il ") ? "Lo" : nome.startsWith("la ") ? "La" : null;
  const titoloConcorda = nome.startsWith("il ")
    ? /^Messaggio/.test(titoloConferma)
    : /^Richiesta/.test(titoloConferma);
  return atteso === null || pronome !== atteso || !titoloConcorda;
}).map((o) => `${o} (${COSA_E_ARRIVATO[o].nome} / «${COSA_E_ARRIVATO[o].pronome}» / ${COSA_E_ARRIVATO[o].titoloConferma})`);
ok(disaccordi.length === 0,
  "…e il pronome concorda con quello che il lettore ha appena letto",
  `${disaccordi.join("; ")} — il pronome, il nome e il titolo della conferma parlano della stessa cosa`);
const nonLeggono = ORIGINI_TUTTE.filter(
  (o) => !promessaRisposta(o).startsWith(`${COSA_E_ARRIVATO[o].pronome} leggiamo`),
);
ok(nonLeggono.length === 0,
  "…e la promessa lo prende dalla tabella invece di cablarlo",
  `${nonLeggono.join(", ")} — un pronome cablato nella funzione è il pronome di una sola origine`);

const senzaEmail = ORIGINI_TUTTE.filter((o) => {
  const c = confermaPerOrigine(o);
  return !c.testo.includes("email di conferma") || c.testoSenzaConferma.includes("email");
});
ok(senzaEmail.length === 0,
  "per tutte e quattro, il testo di quando l'email non parte non la nomina affatto",
  `${senzaEmail.join(", ")} — e non si scusa: dal punto di vista di chi scrive non è successo ` +
  "niente di male. Le landing dicevano «Controlla anche la posta indesiderata», che PRESUPPONE " +
  "l'email: detta a chi non ha ricevuto niente, lo manda a cercare una cosa che non esiste");
const link = mailtoRisposta({
  origine: "contatti",
  nome: "Mario Izzo",
  email: "mario@esempio.it",
  messaggio: "Prima riga\nSeconda riga",
  quando: "10 ottobre 2026 alle 13:26",
});
ok(link.startsWith("mailto:mario%40esempio.it?"), "il mailto porta l'indirizzo di chi ha scritto");
ok(decodeURIComponent(link).includes("Re: il tuo messaggio a KIREO"),
  "…l'oggetto richiama quello che è arrivato (un messaggio, su /contatti)");
ok(decodeURIComponent(mailtoRisposta({ origine: "dirigenti", nome: "x", email: "a@b.it", messaggio: "m", quando: "oggi" }))
     .includes("Re: la tua richiesta a KIREO"),
  "…e una richiesta, sulle landing");
ok(decodeURIComponent(link).includes("> Prima riga\n> Seconda riga"),
  "…e il testo originale è citato riga per riga");
// ⚠️ LA PRIMA STESURA DI QUESTA ASSERZIONE ERA VACUA, e vale la pena che
// resti scritto: diceva `indexOf("body=".length)`, cioè cercava la stringa
// «5», che non c'è — quindi provava soltanto che «---» esistesse, non che lo
// spazio vuoto venisse PRIMA. Un'asserzione che non può fallire per il motivo
// che dichiara è peggio di una che manca, perché la si conta.
const corpoDelLink = decodeURIComponent((link.match(/&body=(.*)$/) ?? [, ""])[1]);
ok(corpoDelLink.startsWith("\n\n---"),
  "…sotto lo spazio vuoto per scrivere",
  `il corpo comincia con «${corpoDelLink.slice(0, 12).replace(/\n/g, "\\n")}»: senza righe vuote in testa, chi risponde scrive dentro la citazione`);
// ⚠️ IL TRONCAMENTO SI DICE. Mezzo messaggio con l'aria di essere intero è la
// specie di casa, e i client di posta tagliano un mailto lungo ognuno a modo
// suo.
const lungo = decodeURIComponent(
  mailtoRisposta({ origine: "contatti", nome: "x", email: "a@b.it", messaggio: "a".repeat(3000), quando: "oggi" }),
);
ok(lungo.includes("la citazione è accorciata"),
  "un messaggio troppo lungo dice di essere stato accorciato",
  "un taglio silenzioso mette mezzo messaggio davanti a chi risponde con l'aria di essere tutto");
ok(!decodeURIComponent(link).includes("accorciata"),
  "…e un messaggio corto non lo dice");
// ⚠️ LA NOTA LA LEGGE CHI RICEVE. Fino al 10/10/2026 diceva «il testo completo
// è nella coda su /admin»: una frase scritta per Mario, recapitata a un
// estraneo, che rimanda a un indirizzo che non può aprire. In un `mailto:` non
// esiste la distinzione fra nota per chi compone e testo per chi riceve.
ok(!/admin|coda/i.test(lungo),
  "…e la nota non rimanda a una coda interna che chi legge non può aprire",
  "tutto quello che si scrive in un `mailto:` parte: non c'è un posto per gli appunti");
ok(Object.keys(COSA_E_ARRIVATO).length === 4,
  `COSA_E_ARRIVATO copre le ${Object.keys(COSA_E_ARRIVATO).length} origini`);

// ⚠️ LA CONFERMA NON È PIÙ UNA PROP, e questa è la metà che lo tiene vero. Era
// un testo nel componente e uno in `lib/contatti/testi.ts`, con due promesse
// dei tempi diverse; e passarla da fuori lasciava a una pagina la possibilità
// di passare quella sbagliata — /contatti che dice «Richiesta inviata».
const formContatto = senzaCommenti(
  fs.readFileSync(path.join(ROOT, "components/landing/RichiestaContattoForm.tsx"), "utf8"),
);
ok(/confermaPerOrigine\(origine\)/.test(formContatto),
  "il form chiede la conferma all'origine che ha già",
  "una conferma passata da fuori è una conferma che una pagina può passare sbagliata");
ok(!/conferma\??:\s*\{/.test(formContatto) && !/titolo:\s*"/.test(formContatto),
  "…e non ne tiene una propria né la riceve come prop",
  "due testi in due file sono due copie: divergono, è solo questione di quando");

// ── 8) i nomi dei piani: quelli veri, in ogni pagina che li nomina ─────────
console.log("\n8) Un piano nominato in una pagina è uno di quelli che esistono");

// ⚠️ PERCHÉ. Su /contatti c'era «i piani Standard e Premium»: i piani sono
// Free/Plus/Premium dal 13 luglio 2026, quindi una copia stantia è rimasta tre
// mesi su una pagina pubblica — e nessuno l'avrebbe vista, perché quello che è
// cambiato non è la pagina: è il mondo intorno.
//
// L'unico posto che ELENCA i nomi è `ETICHETTA_PIANO`, e le pagine pubbliche
// non ci leggono (quella di /istituzioni è una tabella statica con i prezzi,
// che in `ETICHETTA_PIANO` non ci sono; quella di /contatti è prosa). Farle
// leggere da lì non chiuderebbe il caso — i prezzi resterebbero duplicati, e
// una frase composta interpolando due costanti si legge peggio del rischio che
// toglie. Quello che è mancato non è un posto unico: è che nessuno rileggesse
// la pagina. Quindi la cura è questa guardia, non un refactor.
//
// ⚠️ TARATA SUL TESTO VERO, non a occhio: misurata il 10/10/2026, trova 5
// occorrenze in 221 file resi e TUTTE E CINQUE sono nomi di piano legittimi.
// Un controllo che gridasse su una frase giusta è un controllo che qualcuno
// disattiva.
const { ETICHETTA_PIANO } = require("@/lib/ente/pianoSuccessivo");
const nomiVeri = Object.values(ETICHETTA_PIANO);
ok(nomiVeri.length >= 3, `\`ETICHETTA_PIANO\` elenca ${nomiVeri.length} piani: ${nomiVeri.join(", ")}`,
  "sotto tre, l'unico elenco dei nomi non si sta leggendo: un verde su un insieme vuoto");

const nominati = [];
for (const f of resi) {
  const src = senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));
  for (const m of src.matchAll(/pian[oi]\s+([A-Z][a-zA-Z]+)(?:\s+e\s+([A-Z][a-zA-Z]+))?/g)) {
    for (const nome of [m[1], m[2]].filter(Boolean)) nominati.push({ f, nome, frase: m[0].replace(/\s+/g, " ") });
  }
}
ok(nominati.length >= 5, `ci sono ${nominati.length} nomi di piano nominati nelle pagine`,
  "sotto cinque, l'estrattore ha smesso di leggere e questa sezione è verde su niente");
const fantasmi = nominati.filter((n) => !nomiVeri.includes(n.nome));
ok(fantasmi.length === 0,
  "ogni piano nominato in una pagina è uno di quelli che esistono",
  fantasmi.map((n) => `${n.f}: «${n.frase}» — «${n.nome}» non è fra ${nomiVeri.join("/")}`).join("\n       "));

console.log(
  `\n${falliti === 0 ? "✓" : "❌"} ${falliti === 0 ? `${fatte}/${fatte} proprietà verificate` : `${falliti} asserzioni rosse su ${fatte}`}\n`,
);
process.exit(falliti === 0 ? 0 : 1);
