// LE PAGINE COME LE VEDE UNO STUDENTE — un corpus da leggere, non un controllo.
//
// PERCHÉ ESISTE. Il 28/09 un webinar creato per le 15:00 si leggeva 13:00
// nell'Agenda di uno studente, e **nessuno dei trentanove controlli poteva
// vederlo**: il dato era giusto, il codice era giusto, a mentire era la pagina
// resa. Tutto ciò che guardiamo è quello che il codice SCRIVE; questo è l'unico
// strumento che guarda quello che uno studente LEGGE.
//
// NON TROVA NIENTE DA SOLA, ed è la sua forma, non un difetto: nessuna macchina
// sa che «13:00» doveva essere «15:00». Prende il testo di quattro o cinque
// pagine vere e lo mette davanti a una persona senza che debba cliccare — come
// il rapporto del robot. Per questo NON sta in `npm test`: non è verde né rosso.
//
// ⚠️ VA PUNTATA CONTRO LA PRODUZIONE, MAI CONTRO `npm run dev` — ed è il
// vincolo che la rende utile, non una raccomandazione. In locale il processo che
// rende la pagina ha il fuso della MACCHINA, quindi le due metà (ingresso e
// uscita) si annullano e il corpus sarebbe cieco **esattamente sul difetto che
// l'ha motivata**. È la sentinella applicata a una passata: prima di leggere il
// testo si guarda se lo strumento è nella condizione di poter rispondere. Il
// comando si rifiuta di partire se `sitoUrl` è un indirizzo locale.
//
// COSA NON VEDE: l'idratazione. Un componente client renderizzato dal server
// produce l'HTML col fuso del server e poi si riscrive nel browser — qui si
// vede la metà server, che è dove stava il difetto del 28/09. Un difetto che
// nasce solo DOPO l'idratazione richiede Chromium, che c'è ma è un altro ordine
// di grandezza.
//
// E UNA PASSATA CHE NON SA COSA CERCA VEDE LE COSE SBAGLIATE, NON QUELLE
// ASSENTI: dei due difetti del 28/09 avrebbe preso le date subito, e la porta
// mancante no — un corpus dice cosa c'è scritto, non che manca un link.
//
// ⚠️ IL CORPUS È AFFIDABILE SUL CONTENUTO, NON SULLA SPAZIATURA. Ogni tag diventa
// uno spazio (è l'unico modo per non incollare due parole separate solo da un
// `<span>`), quindi al confine fra due tag ne compare uno che a schermo non c'è:
// `2 <span>eventi</span>` esce «2 evento i», `Profilo <span>80%</span>` esce
// «Profilo 80 %», e un `&` dentro un nome d'area seguito da un tag diventa
// «informatica & digitale :». **Non sono difetti tipografici**: tutti e tre
// vengono da qui, e nella prima lettura umana del 29/09 erano esattamente il
// genere di cosa su cui si aprono tre bug inesistenti.
//
// Non si ripara mettendo "" al posto dello spazio, e la ragione è che l'HTML non
// sa quanto spazio c'è: due `<span>` adiacenti possono essere incollati o
// distanziati da un `gap` di flex, e lo decide il CSS che qui non guardiamo.
// Sbagliare per eccesso di spazi lascia il testo LEGGIBILE, sbagliare per difetto
// lo incolla: la direzione giusta è questa. Quello che va scritto è che chi legge
// lo sappia — se una di quelle tre spaziature fosse davvero sbagliata, lo si vede
// solo a schermo.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { apriSessione, eGuastoDelBanco } = require("./robot/sessione");
const { config } = require("./config");

const ROOT = path.join(__dirname, "..", "..");

// LE PAGINE, con la ragione accanto: chi ne aggiunge una deve sapere perché ci
// sono queste. Tutte aprono con la sessione del robot, che è uno STUDENTE —
// scuola, ente e docente richiedono un account per ruolo, e non ce l'abbiamo.
const PAGINE = [
  ["/app", "la home: date degli eventi, affinità, consegne da fare"],
  ["/app/agenda", "dove il difetto delle date è stato visto: prossimi e passati"],
  ["/app/attivita", "il percorso di esplorazione, con le sue date"],
  ["/app/guide/informatica-digitale", "il cancello delle guide e i testi che spiegano cosa manca"],
  ["/aree/informatica-digitale", "una pagina pubblica: eventi dell'area, enti, articoli"],
];

// Lo spoglio dell'HTML. Prima i contenitori che non sono testo (script, stile,
// svg, commenti), poi le interruzioni di blocco in righe — un corpus tutto su
// una riga non si legge — poi i tag, le entità, gli spazi.
const ENTITA = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»",
  egrave: "è", eacute: "é", agrave: "à", ograve: "ò", igrave: "ì", ugrave: "ù", hellip: "…",
  mdash: "—", ndash: "–", middot: "·", euro: "€", star: "★", rsquo: "’", lsquo: "‘",
};

function testoDellaPagina(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article|nav|header|footer|button|a)\s*>/gi, "\n")
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (t, nome) => ENTITA[nome] ?? ENTITA[nome.toLowerCase()] ?? t)
    .split("\n")
    .map((r) => r.replace(/[ \t ]+/g, " ").trim())
    .filter((r) => r.length > 0)
    .join("\n");
}

// Un indirizzo locale rende il corpus cieco sul difetto che l'ha motivata.
const eLocale = (url) => /localhost|127\.0\.0\.1|0\.0\.0\.0|:300\d|\.local\b/i.test(url);

async function pagine() {
  const sitoUrl = config(["sitoUrl"]).sitoUrl;
  if (eLocale(sitoUrl)) {
    console.error(
      `\n✗ «${sitoUrl}» è un indirizzo locale, e questa passata contro il locale NON SERVE A NIENTE.\n\n` +
        `  In locale il processo che rende la pagina ha il fuso della tua macchina, quindi\n` +
        `  l'orario scritto e l'orario letto si annullano — e il corpus sarebbe cieco\n` +
        `  esattamente sul difetto per cui questo comando esiste (28/09: le 15:00 lette 13:00).\n\n` +
        `  Metti in .banco.local.json l'indirizzo della produzione.\n`,
    );
    process.exit(1);
  }

  console.log("\n═══ LE PAGINE COME LE VEDE UNO STUDENTE ═══\n");
  console.log(`  Sito: ${sitoUrl}`);
  console.log("  Sessione: quella del robot (uno studente). Scuola, ente e docente restano fuori:");
  console.log("  servono un account per ruolo, e non ce l'abbiamo.\n");
  console.log("  Quello che vedi è la METÀ SERVER: un componente client si riscrive nel browser,");
  console.log("  e quella parte qui non si vede. Il difetto delle date stava nella metà server.\n");
  console.log("  Nessuna chiamata AI, nessuna scrittura: solo GET.\n");

  const { chiama } = await apriSessione();
  const pezzi = [];

  for (const [percorso, ragione] of PAGINE) {
    const r = await chiama(percorso, null, "GET");
    const testo = r.status === 200 ? testoDellaPagina(r.testo) : "";
    // UN REDIRECT SEGUITO È LA CECITÀ PEGGIORE, e non è un'ipotesi: verificato
    // il 28/09 che `/app` senza sessione risponde **200 con il corpus della
    // pagina di login** — si leggerebbe il testo della pagina sbagliata
    // credendo che sia quella chiesta. E se l'indirizzo finale non ci arriva,
    // lo si DICE invece di tacere: un silenzio qui è indistinguibile da «sono
    // nel posto giusto».
    const dove = !r.url ? "⚠️ NON SO su quale pagina sono finito (indirizzo finale assente)" : r.url.endsWith(percorso) ? "" : `⚠️ FINITA SU ${r.url.replace(sitoUrl, "")}: non è la pagina che hai chiesto`;
    const capo =
      `──────────────────────────────────────────────────────────────\n` +
      `${percorso}   (${ragione})\n` +
      `  stato ${r.status}${dove ? `   ${dove}` : ""}` +
      `${eGuastoDelBanco(r.status) ? "   ⚠️ 401: la sessione del banco è scaduta, non è il prodotto" : ""}\n` +
      `──────────────────────────────────────────────────────────────`;
    pezzi.push(`${capo}\n${testo || "(nessun testo: vedi lo stato qui sopra)"}\n`);
  }

  const corpus = pezzi.join("\n");
  console.log(corpus);

  const dove = path.join(ROOT, `banco-pagine-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.txt`);
  fs.writeFileSync(dove, `Sito: ${sitoUrl}\nQuando: ${new Date().toISOString()}\n\n${corpus}`, "utf8");
  console.log(`\nCorpus salvato in ${path.relative(ROOT, dove)} — da leggere, non da far passare.\n`);
}

module.exports = { pagine, testoDellaPagina, eLocale, PAGINE };
