// Le email che mandiamo: niente markup dall'utente, nessun link che non sia
// http/https, e il contenuto che non arriva dal corpo di una richiesta.
//
// PERCHÉ ESISTE. Il 5/10/2026 `/api/guida-email` è risultata **senza nessuna
// guardia**: nessuna sessione (nessun client Supabase importato nel file),
// `/api` non è in AREE_PROTETTE, nessun limite — e dal corpo arrivavano il
// destinatario, il link del bottone, il nome nel saluto e il titolo in
// grassetto, con il template che interpolava in HTML senza escape. Misurato su
// build di produzione, senza sessione e senza cookie: la richiesta arrivava
// fino a `inviaEmail` con l'indirizzo scelto da chi chiamava. In produzione la
// chiave Brevo c'è, quindi quell'email partiva — autentica, con SPF e DKIM
// validi, da `noreply@kireo.it`.
//
// Non è una falla di lettura: è un'azione nel mondo a nome nostro, verso
// persone che non hanno mai usato KIREO, e IRREVERSIBILE — un'email mandata non
// si cancella, e un dominio bruciato porta nello spam le email vere alle
// scuole.
//
// LE TRE PROPRIETÀ CHE QUESTO FILE TIENE, e sono di forma, non di gusto:
//
//   1. ogni `${…}` dentro un template passa da `esc()` o è un valore di cui si
//      conosce la provenienza (una costante nostra, non il corpo di una
//      richiesta);
//   2. l'href di un bottone passa da `linkSicuro()`;
//   3. le route che mandano email non prendono il LINK né il TITOLO dal corpo.
//
// La terza è quella che conta più delle altre due: l'escape rende innocuo il
// markup, ma un link scelto da chi chiama resta un link scelto da chi chiama.
//
// Esecuzione: `npm run test:email`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");

const ROOT = path.join(__dirname, "..");
let falliti = 0;
// ⚠️ IL CONTO SI CONTA, NON SI DICHIARA: `fatte` si alza qui dentro e il
// riepilogo lo interpola, così la proprietà in più lo cambia da sé. Un
// letterale in testa sarebbe un numero che un giorno mente detto dallo
// strumento che dovrebbe certificarlo — e la regola che lo chiede («un numero
// in una riga Verificato va accompagnato dal comando che lo ristampa») è nata
// scoprendo che di 51 suite questa era fra le 50 che non lo facevano.
let fatte = 0;
const ok = (cond, msg, extra) => {
  fatte++;
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) {
    falliti++;
    if (extra) console.log(`      → ${extra}`);
  }
};
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

console.log("\n═══ Le email: niente markup dall'utente, nessun link scelto da chi chiama ═══\n");

// ── 1) ogni interpolazione nei template è coperta ───────────────────────────
console.log("1) Ogni `${…}` nei template passa da esc(), o ha una provenienza nota");

const tmpl = leggi("lib/email/templates.ts");

// I valori di cui si conosce la provenienza: costanti nostre e composizioni
// interne. Un nome nuovo qui è una DECISIONE — e va scritta, perché ogni voce
// aggiunta è una stringa che potrà scrivere markup.
const PROVENIENZA_NOTA = [
  "SITE_URL", // lib/site.ts, costante nostra
  "ETICHETTA_ORIGINE[origine]", // mappa chiusa qui dentro
  "contenuto", // HTML già composto, passato a involucroEmail
  "bottone(", // compone a sua volta, e passa da esc()+linkSicuro()
  "involucroEmail(",
  "riga(", // una riga della tabella di notifica: scappa i suoi DUE argomenti dentro — verificato sotto
  // lib/contatti/testi.ts: la promessa dei tempi, la stessa che la pagina
  // mostra a schermo. Funzione nostra su un'unione chiusa, nessun input di
  // nessuno — e dal 10/10/2026 è una funzione e non una costante perché il
  // pronome con cui comincia dipende dall'origine.
  "promessaRisposta(origine)",
  // Una costante di testo scritta qui dentro, senza niente che arrivi da
  // fuori: è la frase «rispondi pure a questa email», tornata l'11/10/2026
  // dopo la prova dal vivo del Reply-To (vedi §2bis).
  "COME_AGGIUNGERE_QUALCOSA",
];

// ⚠️ SOLO LE INTERPOLAZIONI CHE COMPONGONO MARKUP. La prima stesura leggeva
// ogni `${…}` del file e gridava su `throw new Error(\`…${pulito.slice(0,40)}\`)`
// dentro `linkSicuro` — un messaggio d'errore, non un'email. Un controllo che
// grida su una cosa giusta è un controllo che qualcuno disattiva: il
// discriminante è che il template letterale contenga un tag (`<`), che è
// esattamente la proprietà di cui ci importa.
const letterali = [...tmpl.matchAll(/`(?:[^`\\]|\\.)*`/gs)].map((m) => m[0]).filter((l) => l.includes("<"));
const interpolazioni = letterali.flatMap((l) => [...l.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim()));
ok(interpolazioni.length > 10, `ci sono interpolazioni da guardare (${interpolazioni.length})`, "zero interpolazioni vuol dire che l'estrattore non sta leggendo: un verde su un insieme vuoto");

const scoperte = interpolazioni.filter((e) => {
  if (e.includes("esc(")) return false;
  return !PROVENIENZA_NOTA.some((p) => e.includes(p));
});
ok(
  scoperte.length === 0,
  scoperte.length === 0
    ? "nessuna interpolazione scoperta: tutte passano da esc() o hanno provenienza nota"
    : `interpolazioni scoperte: ${scoperte.map((s) => `\${${s}}`).join(", ")}`,
  "una stringa che arriva dal corpo di una richiesta e finisce in un'email senza esc() scrive il markup di un'email a nome nostro",
);

// ⚠️ LA PREMESSA DELL'ESENZIONE SI VERIFICA, altrimenti non l'abbiamo
// accettata: l'abbiamo solo allargata. `riga(` è in PROVENIENZA_NOTA perché
// scappa i suoi due argomenti DENTRO — se smettesse di farlo, l'esenzione
// coprirebbe due interpolazioni crude e questo file resterebbe verde.
const defRiga = tmpl.match(/const riga = \([^)]*\) =>[\s\S]*?;\n/);
ok(
  Boolean(defRiga) && /esc\(etichetta\)/.test(defRiga[0]) && /esc\(valore\)/.test(defRiga[0]),
  "`riga(` scappa etichetta e valore dentro di sé",
  "è la premessa su cui sta in PROVENIENZA_NOTA: senza, l'esenzione copre il vuoto",
);

// ── 2) l'escape copre il contesto attributo, non solo il testo ──────────────
console.log("\n2) esc() copre anche il contesto attributo, e linkSicuro rifiuta gli schemi");

require("./banco/ts").abilitaTypeScript();
const {
  esc,
  linkSicuro,
  templateConfermaRichiestaContatto,
  templateNotificaRichiestaContatto,
  templateFollowUpGuida,
} = require("@/lib/email/templates");

ok(esc("<b>x</b>") === "&lt;b&gt;x&lt;/b&gt;", "i tag si neutralizzano");
ok(esc('a"b') === "a&quot;b", "…e le VIRGOLETTE, che sono quelle che fanno uscire da un href=\"…\"");
ok(esc("a'b") === "a&#39;b", "…e l'apice singolo");
ok(esc("a&b") === "a&amp;b", "la e commerciale si converte per prima (altrimenti le altre si doppiano)");
ok(esc(null) === "" && esc(undefined) === "", "un valore assente non diventa la stringa «null»");

// ⚠️ CHE `bottone` LA CHIAMI, non solo che la funzione funzioni. La prima
// stesura provava solo `linkSicuro` in isolamento, e togliendola da `bottone`
// la suite restava VERDE: il controllo esercitava ciò che la funzione DECIDE e
// non ciò che il template GUARDA. L'ha detto la controprova, non una rilettura.
ok(/<a href="\$\{esc\(linkSicuro\(href\)\)\}"/.test(tmpl), "il bottone passa l'href da linkSicuro() dentro esc()");

ok(linkSicuro("https://kireo.it/x") === "https://kireo.it/x", "un https passa");
ok(linkSicuro("  http://kireo.it/x  ") === "http://kireo.it/x", "…e viene ripulito dagli spazi");
for (const cattivo of ["javascript:alert(1)", "data:text/html,x", "//kireo.it/x", "mailto:a@b.it", ""]) {
  let alzato = false;
  try {
    linkSicuro(cattivo);
  } catch {
    alzato = true;
  }
  ok(alzato, `«${cattivo || "(vuoto)"}» viene rifiutato`);
}

// ── 2bis) un invito a rispondere solo dove il Reply-To riceve ──────────────
console.log("\n2bis) Una email invita a rispondere solo dove il Reply-To riceve");

// ⚠️ NON È UNA PROPRIETÀ DEL TEMPLATE: È DI TEMPLATE **PIÙ** INVIO. Il mittente
// di ogni nostra email è `noreply@kireo.it`, che NON RICEVE — quindi «rispondi
// pure a questa email» è vera solo se chi la manda passa un `rispondiA`, e il
// template da sé non può saperlo. Fino al 10/10/2026 la frase c'era senza
// nessun Reply-To, in tutti e due i rami, e in quello delle landing dal 25
// luglio: chi rispondeva scriveva a una casella muta e non lo scopriva.
//
// L'11/10, dopo la prova dal vivo (vedi `OpzioniInvioEmail.rispondiA`), la
// frase è tornata — e questa guardia è passata da «nessuno la dice» a «la dice
// solo chi può». Il divieto secco non serve più e sarebbe peggio: terrebbe
// chiusa una porta che adesso è vera, cioè griderebbe su una cosa giusta.
const INVITO_A_RISPONDERE = /rispond\w*[^.<]{0,40}a questa email/i;
const ORIGINI_CONTATTO = ["dirigenti", "scuole", "enti", "contatti"];

// ⚠️ OGNI TEMPLATE DICHIARA SE PUÒ INVITARE, E CHI LO MANDA. Un template nuovo
// che non sta qui fa diventare rossa la proprietà sotto: nasce senza una
// risposta, che è il momento giusto per chiederla — l'unico in cui qualcuno ci
// sta pensando.
const TEMPLATE_EMAIL = [
  {
    nome: "templateConfermaRichiestaContatto",
    // Tutti e quattro i rami, e la frase deve esserci in OGNUNO: il 10/10 il
    // corpo era uno per le landing e un altro per /contatti, e la cura è stata
    // che non possano divergere. Renderli tutti e quattro è la metà che se ne
    // accorgerebbe.
    rende: () => ORIGINI_CONTATTO.map((o) => templateConfermaRichiestaContatto("Mario", o)),
    invito: "deve",
    invio: {
      file: "app/api/richiesta-contatto/route.ts",
      ancora: "templateConfermaRichiestaContatto(nomeStr",
    },
  },
  {
    nome: "templateFollowUpGuida",
    rende: () => [
      templateFollowUpGuida({ nome: "Mario", titoloGuida: "Guida", linkGuida: "https://kireo.it/g.pdf" }),
    ],
    // «Può», non «deve»: il suo invio porta il Reply-To, quindi la frase lì
    // sarebbe vera — ma non c'è, e aggiungerla è una decisione sui testi, non
    // una conseguenza di questo lavoro. Se un domani ci va, è già coperta.
    invito: "puo",
    invio: { file: "app/api/guida-email/route.ts", ancora: "inviaEmail(corpo.email" },
  },
  {
    nome: "templateNotificaRichiestaContatto",
    rende: () => [
      templateNotificaRichiestaContatto({
        origine: "contatti",
        nome: "Mario",
        ruolo: "studente",
        istituto: null,
        codiceMeccanografico: null,
        email: "chi.scrive@esempio.it",
        messaggio: "ciao",
      }),
    ],
    invito: "mai",
    perche:
      "il destinatario siamo noi, e il suo Reply-To è l'indirizzo di CHI HA SCRITTO: " +
      "un invito a rispondere qui sarebbe rivolto a noi, che lo sappiamo già",
  },
];

const esportati = [...tmpl.matchAll(/export function (template\w+)/g)].map((m) => m[1]);
ok(esportati.length >= 3, `i template esportati sono ${esportati.length}`, "sotto tre, l'estrattore non sta leggendo");
const fuoriTabella = esportati.filter((n) => !TEMPLATE_EMAIL.some((t) => t.nome === n));
ok(
  fuoriTabella.length === 0,
  fuoriTabella.length === 0
    ? "ogni template dichiara se può invitare a rispondere"
    : `template non dichiarati: ${fuoriTabella.join(", ")}`,
  "un template nuovo deve dire se invita a rispondere, e chi lo manda: la frase è vera solo con un Reply-To",
);

const rc = leggi("app/api/richiesta-contatto/route.ts");

for (const t of TEMPLATE_EMAIL) {
  const corpi = t.rende();
  const conInvito = corpi.filter((c) => INVITO_A_RISPONDERE.test(c)).length;
  if (t.invito === "deve") {
    ok(
      conInvito === corpi.length,
      `${t.nome}: tutti e ${corpi.length} i rami invitano a rispondere (${conInvito})`,
      "la frase è tornata l'11/10 dopo la prova: se sparisce, chi vuole aggiungere qualcosa resta senza strada",
    );
  } else if (t.invito === "mai") {
    ok(conInvito === 0, `${t.nome}: non invita a rispondere`, t.perche);
  }
  // ⚠️ L'INVIO SI VERIFICA SEMPRE, anche dove la frase oggi non c'è. È la
  // BASE su cui la tabella dichiara «può invitare»: una voce `puo` il cui
  // invio non si guarda è una dichiarazione che nessuno ha controllato — e
  // l'àncora resterebbe lì a invecchiare, per poi far saltare il controllo il
  // giorno in cui qualcuno aggiunge la frase, cioè nel momento peggiore.
  //
  // Àncora sulla CHIAMATA, con il conto dichiarato: nella route di contatti
  // `rispondiA` compare due volte con due valori diversi, e una regex sul file
  // intero sarebbe verde con i due scambiati.
  if (t.invio) {
    const src = t.invio.file === "app/api/richiesta-contatto/route.ts" ? rc : leggi(t.invio.file);
    const i = ancora(src, t.invio.ancora, { volte: 1, dove: t.invio.file });
    const invio = src.slice(i, i + 300);
    ok(
      /rispondiA: EMAIL_PUBBLICA/.test(invio),
      `…e il suo invio porta un Reply-To che riceve (${t.invio.file})`,
      "senza, un invito a rispondere promette una casella muta: la risposta parte e sparisce, " +
        "che è il modo peggiore in cui può fallire una cosa irreversibile",
    );
  }
}

// ⚠️ E L'AVVISO INTERNO PORTA L'INDIRIZZO DI CHI HA SCRITTO, che è la metà da
// cui dipende una risposta vera. L'11/10/2026 Mario ha letto in webmail
// l'avviso «Nuovo messaggio da /contatti» e ha premuto «Rispondi»: il mittente
// è `noreply@kireo.it`, quindi la sua risposta è andata a una casella muta. Il
// `Reply-To` fa atterrare il gesto naturale su chi ha scritto, **senza passare
// da /admin e senza copiare un indirizzo** — e si risponde dalla casella da cui
// si sta leggendo, che è il punto: un `mailto:` in /admin comporrebbe invece
// dal programma di posta di chi guarda (misurato: l'indirizzo personale).
//
// Il valore si prova sulla FETTA dell'avviso e non sul file: `rispondiA`
// compare due volte nella route con due valori diversi — `EMAIL_PUBBLICA` sulla
// conferma, l'indirizzo di chi scrive qui — e una regex sul file intero sarebbe
// verde con i due scambiati, che è precisamente il difetto peggiore dei due
// (una conferma con il Reply-To di chi l'ha ricevuta non serve a nessuno; un
// avviso con `info@` rimanda a sé stesso).
const iAvviso = ancora(rc, "conf.notifica.map", { volte: 1, dove: "route richiesta-contatto" });
const avviso = rc.slice(iAvviso, iAvviso + 300);
ok(/rispondiA: emailStr/.test(avviso),
  "…e l'avviso interno porta come Reply-To l'indirizzo di chi ha scritto",
  "senza, «Rispondi» su quell'avviso scrive a `noreply@kireo.it` e il messaggio sparisce: " +
  "è successo l'11/10/2026, a Mario, sul primo messaggio vero");
// ⚠️ DALL'11/10/2026 `EMAIL_PUBBLICA` STA NELLA TABELLA `ORIGINI`, QUALCHE
// RIGA SOPRA — è fra i DESTINATARI di ogni origine, che è la precondizione del
// `Reply-To` (vedi `npm run test:contatti`). Questa proprietà parla di un'altra
// cosa: il VALORE dell'header, che deve restare l'indirizzo di chi ha scritto.
// Riverificato per esecuzione dopo quel cambio: la fetta parte da
// `conf.notifica.map`, cioè a valle della tabella, e non la contiene.
// E la negazione non è verde sul vuoto perché è accoppiata alla positiva qui
// sopra: una fetta che perdesse la chiamata farebbe diventare rossa quella.
ok(!/EMAIL_PUBBLICA/.test(avviso),
  "…e non il nostro, che rimanderebbe l'avviso a sé stesso");
const brevo = leggi("lib/email/brevo.ts");
ok(/replyTo: opzioni\.rispondiA \? \{ email: opzioni\.rispondiA \} : undefined/.test(brevo),
  "…e il client lo mette davvero nel corpo della richiesta a Brevo",
  "un'opzione che nessuno inoltra è un Reply-To che non esiste: la metà che si dimentica");

// ⚠️ E L'OGGETTO DELL'AVVISO LO LEGGONO IN DUE, dal `Reply-To` in poi. Per noi
// è la riga di una coda; per chi ha scritto diventa l'oggetto della risposta,
// con un «Re: » davanti. Il caso vero: diceva «Nuovo messaggio da /contatti —
// Mario», e `/contatti` è un percorso del sito — per lui niente.
//
// La proprietà è sul PERCORSO e non sulla parola, ed è tarata sul testo vero:
// oggi nessuno dei quattro oggetti ha una barra, mentre «(dirigenti)» è una
// parola italiana che si legge come una categoria anche da fuori. Una guardia
// che gridasse anche su quella sarebbe una guardia che qualcuno disattiva.
const { oggettoNotifica } = require("@/lib/contatti/testi");
const oggetti = ORIGINI_CONTATTO.map((o) => oggettoNotifica(o, { nome: "Mario", istituto: "ITIS Fermi" }));
ok(oggetti.length === 4, `gli oggetti dell'avviso sono ${oggetti.length}`, "sotto quattro, l'estrattore non sta leggendo");
const conPercorso = oggetti.filter((o) => o.includes("/"));
ok(
  conPercorso.length === 0,
  conPercorso.length === 0
    ? "nessun oggetto dell'avviso porta un percorso del sito"
    : `oggetti con un percorso: ${conPercorso.join(" · ")}`,
  "col Reply-To quell'oggetto diventa l'oggetto di una risposta a chi ha scritto: un percorso lì non vuol dire niente",
);

// ── 3) LA PROPRIETÀ CHE CONTA: il contenuto non viene dal corpo ─────────────
console.log("\n3) Le route che mandano email non prendono link né titolo dal corpo");

const route = leggi("app/api/guida-email/route.ts");

ok(/createClient\(\)/.test(route), "la route legge dal database (client normale: la RLS filtra alle istituzioni attive)");
ok(/from\("guide_enti"\)/.test(route), "…e prende la guida da `guide_enti`");
ok(
  !/linkGuida\s*=\s*corpo\./.test(route),
  "il LINK non viene dal corpo della richiesta",
  "è la cura che fa scendere la gravità da phishing a spam: con il link dal corpo, un'email autentica a nome nostro manda la gente dove dice chi ha chiamato",
);
ok(!/titoloGuida\s*=\s*`?[^;]*corpo\.(istituzioneNome|titolo)/.test(route), "…e nemmeno il TITOLO");
ok(
  /guida\.istituzione_id !== corpo\.istituzioneId/.test(route),
  "la guida viene verificata contro l'istituzione indicata",
  "senza, il `guidaId` tornerebbe a essere un contenuto invece di una chiave",
);

// Il form non manda più il contenuto: se tornasse a mandarlo, la route lo
// ignorerebbe — ma la riga nel corpo è l'invito a riusarlo.
const form = leggi("components/app/GuidaEnteForm.tsx");
const dove = ancora(form, "/api/guida-email", { volte: 1, dove: "GuidaEnteForm" });
const corpoFetch = form.slice(dove, dove + 400);
ok(!/pdfUrl\s*[,}]/.test(corpoFetch.replace(/pdfUrl:\s*[^,}]*/g, "")), "il form non manda il `pdfUrl` nel corpo");
ok(/guidaId/.test(corpoFetch), "…manda il `guidaId`, cioè una chiave");

// ── 4) nessun'altra route compone un'email con un link dal corpo ────────────
console.log("\n4) Nessun'altra route manda email con un link dal corpo");

function tuttiIFile(dir) {
  const out = [];
  for (const v of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) out.push(...tuttiIFile(p));
    else if (/\.(ts|tsx)$/.test(v.name)) out.push(p);
  }
  return out;
}
const chiamanti = tuttiIFile(path.join(ROOT, "app"))
  .concat(tuttiIFile(path.join(ROOT, "lib")))
  .filter((p) => !p.endsWith(path.join("lib", "email", "brevo.ts")))
  .filter((p) => /inviaEmail\s*\(/.test(senzaCommenti(fs.readFileSync(p, "utf8"))));

ok(chiamanti.length >= 2, `i chiamanti di inviaEmail sono ${chiamanti.length}`, "sotto due, l'estrattore non sta leggendo");
for (const p of chiamanti) {
  const rel = path.relative(ROOT, p);
  const src = senzaCommenti(fs.readFileSync(p, "utf8"));
  // Un `bottone(...)`/link composto direttamente da `corpo.*`/`body.*`: la
  // forma che ha prodotto la settima falla.
  const sospette = [...src.matchAll(/\b(?:link|href|url)\w*\s*[=:]\s*(corpo|body|payload)\./gi)].map((m) => m[0]);
  ok(sospette.length === 0, `${rel}: nessun link composto dal corpo della richiesta`, sospette.join(", "));
}

console.log(
  falliti === 0
    ? `\n✅ ${fatte}/${fatte} proprietà — le email non portano markup né link scelti da chi chiama.\n`
    : `\n❌ ${fatte - falliti}/${fatte} proprietà (${falliti} rosse)\n`,
);
process.exit(falliti === 0 ? 0 : 1);
