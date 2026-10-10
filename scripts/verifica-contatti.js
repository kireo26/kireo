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
  "const NOME_RICHIESTA: Record<OrigineContatto, string> = {",
  1,
  "contatti/testi",
);

const elenchi = [
  ["il CHECK della migrazione", dalCheck],
  ["ORIGINI (route)", dalleOrigini],
  ["RIFIUTO_LIMITE (route)", daiRifiuti],
  ["ETICHETTA_ORIGINE (templates)", dalleEtichette],
  ["NOME_RICHIESTA (contatti/testi)", daiNomi],
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
    "nel primo caso la riga è comunque in coda, nel secondo a mancare è il pizzico");
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
const { mailtoRisposta, NOME_RICHIESTA, CONFERMA_CONTATTI, PROMESSA_RISPOSTA } = require("@/lib/contatti/testi");
const { templateConfermaRichiestaContatto } = require("@/lib/email/templates");

// ── 7bis) la promessa dei tempi, detta uguale nei due posti ────────────────
console.log("\n7bis) La promessa dei tempi è la stessa a schermo e nell'email");

// Lo schermo diceva «ti rispondiamo il prima possibile» e l'email «…— di
// solito entro un giorno o due»: la stessa promessa detta due volte, e detta
// diversa. Chi legge solo lo schermo riceve meno; chi legge tutti e due si
// chiede quale vale. La cura per due copie non è tenerle in passo a mano: è
// che ce ne sia una — e questa è la guardia che lo tiene vero, perché la
// costante si può importare e poi non usare.
ok(CONFERMA_CONTATTI.testo.includes(PROMESSA_RISPOSTA),
  "la conferma a schermo monta la promessa dalla costante",
  "riscritta a mano, le due copie divergono al primo che ne tocca una");
// L'email si prova CHIAMANDOLA: una regex dice che la costante è interpolata,
// non che la frase arriva a chi apre il messaggio.
const htmlConferma = templateConfermaRichiestaContatto("Mario", "contatti");
ok(htmlConferma.includes(PROMESSA_RISPOSTA),
  "…e l'email di conferma la porta davvero nel corpo",
  "è la metà che un controllo lessicale non vede: il template potrebbe interpolare e non renderla");
ok(!/il prima possibile/.test(CONFERMA_CONTATTI.testo) && !/il prima possibile/.test(htmlConferma),
  "…e nessuno dei due la annacqua con un «il prima possibile»",
  "davanti a una finestra concreta quella frase la indebolisce invece di rafforzarla");
ok(CONFERMA_CONTATTI.testo.includes("email di conferma") &&
   !CONFERMA_CONTATTI.testoSenzaConferma.includes("email"),
  "il testo di quando l'email non parte non la nomina affatto",
  "e non si scusa: dal punto di vista di chi scrive non è successo niente di male — " +
  "«non siamo riusciti a mandarti la conferma» lo farebbe dubitare di una cosa che ha funzionato");
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
ok(lungo.includes("messaggio troncato"),
  "un messaggio troppo lungo dice di essere stato troncato",
  "un taglio silenzioso mette mezzo messaggio davanti a chi risponde con l'aria di essere tutto");
ok(!decodeURIComponent(link).includes("troncato"),
  "…e un messaggio corto non lo dice");
ok(Object.keys(NOME_RICHIESTA).length === 4, `NOME_RICHIESTA copre le ${Object.keys(NOME_RICHIESTA).length} origini`);

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

console.log(`\n${falliti === 0 ? "✓" : "❌"} ${falliti === 0 ? "tutte verdi" : `${falliti} asserzioni rosse`}\n`);
process.exit(falliti === 0 ? 0 : 1);
