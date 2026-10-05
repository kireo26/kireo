// La barra dell'area studente e la pagina del percorso, provate senza browser.
//
// PERCHÉ ESISTE. Il 26/09 abbiamo trovato DUE riassunti scritti a mano della
// regola delle guide, tutti e due fermi alla versione di prima: nessuno dei due
// era sbagliato il giorno in cui è stato scritto, ed è cambiato il mondo
// intorno. Da qui nascono le due proprietà che questo file sorveglia, e sono
// proprietà diverse:
//
//   · L'ORDINE DEI PASSI È UN DATO, e vive in un posto solo. La barra e la
//     pagina non possono dire due cose diverse su quali passi ci sono e in che
//     ordine — quindi nessuna delle due tiene una lista sua;
//   · LA PAGINA NON NOMINA NESSUNA SOGLIA. «Prima esplori, poi ti metti alla
//     prova» non invecchia; «le missioni si aprono dopo i tre test» invecchia
//     alla prima modifica della regola, e il difetto non si vede rileggendo.
//     Le condizioni le dicono già le pagine di ciascun passo, GENERATE dalla
//     regola vera.
//
// E la terza, che non è di scrittura: NIENTE È DISABILITATO. La barra mostra
// l'ordine, non il permesso — una voce spenta non può dire perché è spenta, e
// tutto il lavoro sulle guide sta nel fatto che il rifiuto nomina il passo che
// manca.
//
// Esecuzione: `npm run test:barra`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
abilitaTypeScript();

const { PASSI_PERCORSO, passoDiHref } = require("@/lib/percorso/passi");
const T = require("@/lib/percorso/testoPercorso");

let falliti = 0;
const ok = (cond, msg) => {
  if (!cond) {
    console.error("  ✗ " + msg);
    falliti++;
  } else {
    console.log("  ✓ " + msg);
  }
};

// I CONTROLLI LESSICALI GIRANO SUL CODICE SENZA I COMMENTI, e la ragione l'ha
// mostrata una controprova di questo stesso file: la verifica che
// `getPassoCorrente` fosse in `cache()` cercava «cache(» e trovava il COMMENTO
// che spiega perché ci deve stare — quindi restava verde con la `cache()` tolta.
// Un controllo soddisfatto da una frase che descrive l'intenzione è la specie di
// casa: un commento che dichiara quello che il codice dovrebbe fare.
const { senzaCommenti } = require("./lib/senza-commenti");
// ÀNCORE CON IL CONTO DICHIARATO: un nome che compare due volte fa misurare
// l'occorrenza sbagliata, e non produce un rosso — produce un verde sul pezzo
// di codice sbagliato. Vedi `scripts/lib/ancora.js` per le volte che è costato.
const { ancora, fetta } = require("./lib/ancora");

const leggi = (p) => senzaCommenti(fs.readFileSync(path.join(ROOT, p), "utf8"));
const srcBarra = leggi("components/app/AppShell.tsx");
const srcPagina = leggi("app/app/percorso/page.tsx");
const srcLayout = leggi("app/app/layout.tsx");

console.log("\n═══ La barra dei passi e la pagina del percorso ═══\n");

// ── 1) I cinque passi, in un posto solo ──────────────────────────────────────
console.log("1) L'ordine dei passi è un dato, e sta in un posto solo");

const ATTESI = ["aree", "guide", "test", "missioni", "workshop"];
ok(PASSI_PERCORSO.map((p) => p.chiave).join(",") === ATTESI.join(","), `i cinque passi sono in ordine: ${ATTESI.join(" → ")}`);
ok(new Set(PASSI_PERCORSO.map((p) => p.chiave)).size === PASSI_PERCORSO.length, "nessuna chiave ripetuta");
ok(new Set(PASSI_PERCORSO.map((p) => p.href)).size === PASSI_PERCORSO.length, "nessun href ripetuto");
ok(
  PASSI_PERCORSO.every((p) => p.href.startsWith("/app/") && p.nome.length > 0),
  "ogni passo ha un href nell'area privata e un nome",
);

// Gli href devono essere ROTTE VERE: un passo che punta a una pagina che non
// esiste è una voce morta nella barra, e la barra è la prima cosa che si clicca.
for (const p of [...PASSI_PERCORSO, { chiave: "percorso", href: "/app/percorso" }]) {
  const cartella = path.join(ROOT, "app", p.href);
  const esiste = fs.existsSync(path.join(cartella, "page.tsx"));
  ok(esiste, esiste ? `«${p.chiave}» → ${p.href} è una rotta vera` : `«${p.chiave}» punta a ${p.href}, che non esiste: voce morta nella barra`);
}

// `passoDiHref`: la destinazione di `prossimaTappa` deve risolversi nella VOCE
// giusta, e non deve risolversi dove non c'è un passo.
ok(passoDiHref("/app/test/da-dove-parti") === "test", "una pagina interna di un passo risolve nel passo (un test)");
ok(passoDiHref("/app/guide/informatica-digitale") === "guide", "…e una guida di un'area risolve in Guide");
ok(passoDiHref("/app/escape") === "missioni", "l'href esatto del passo risolve nel passo");
ok(passoDiHref("/app") === null, "la Home NON è un passo del percorso");
ok(passoDiHref("/app/profilo") === null, "…e nemmeno il Profilo");
// Il prefisso deve essere un SEGMENTO, non una sottostringa: `/app/areeXYZ` non
// è una pagina di Aree, e farlo combaciare accenderebbe il segno su una voce
// sbagliata.
ok(passoDiHref("/app/areeXYZ") === null, "il confronto è per segmento: «/app/areeXYZ» non è una pagina di Aree");
ok(passoDiHref(null) === null && passoDiHref(undefined) === null, "senza href non si indovina nessun passo");

// ── 2) La barra legge quella costante, e non ne tiene una sua ────────────────
console.log("\n2) La barra legge i passi dalla costante, e i due gruppi sono due");

ok(/from "@\/lib\/percorso\/passi"/.test(srcBarra), "la barra importa i passi da `lib/percorso/passi`");
ok(/PASSI_PERCORSO\.map\(/.test(srcBarra), "…e li mappa, invece di riscriverli");
// Una seconda lista dei cinque nomi scritta a mano nella barra sarebbe la
// divergenza che questo file esiste per impedire.
const nomiAMano = PASSI_PERCORSO.filter((p) => new RegExp(`label:\\s*"${p.nome}"`).test(srcBarra));
ok(
  nomiAMano.length === 0,
  nomiAMano.length === 0
    ? "nessun nome di passo è scritto a mano fra le voci della barra"
    : `scritti a mano nella barra: ${nomiAMano.map((p) => p.nome).join(", ")} — la barra e la pagina possono divergere`,
);
ok(/GRUPPO_PERCORSO/.test(srcBarra) && /GRUPPO_RESTO/.test(srcBarra), "i due gruppi esistono e hanno un nome");
ok(/<hr /.test(srcBarra), "…e una riga li separa nella barra desktop");
// Agenda sta nel resto: gli eventi non sono un passo del viaggio.
const iAgenda = ancora(srcBarra, 'label: "Agenda"', { volte: 1, dove: "la barra" });
const iGruppoResto = ancora(srcBarra, "const GRUPPO_RESTO", { volte: 1, dove: "la barra" });
ok(iAgenda > iGruppoResto && iGruppoResto !== -1, "Agenda sta nel gruppo «il resto», non fra i passi");

// ── 3) NIENTE È DISABILITATO ────────────────────────────────────────────────
console.log("\n3) Niente è disabilitato, e niente è sbiadito");

ok(!/aria-disabled/.test(srcBarra), "nessuna voce è marcata aria-disabled");
ok(!/pointer-events-none/.test(srcBarra), "nessuna voce ha i clic disattivati");
ok(!/<button[^>]*disabled/.test(srcBarra), "nessuna voce è un bottone disabilitato");
// Ogni voce è un <Link>: se una diventasse uno <span> non cliccabile, sarebbe
// una voce spenta che non può dire perché.
const voci = (srcBarra.match(/GRUPPO_PERCORSO\.map|GRUPPO_RESTO\.map|NAV_ITEMS\.map/g) ?? []).length;
ok(voci >= 3, `le voci si rendono per gruppo (${voci} punti di render), non una a una a mano`);
ok(/<Link/.test(srcBarra) && !/non cliccabile/.test(srcBarra), "le voci sono link, tutte");

// ── 4) IL SEGNO SUL PASSO CORRENTE ──────────────────────────────────────────
console.log("\n4) Il segno viene da prossimaTappa, e senza dato non si segna niente");

// La prop del COMPONENTE, non quella dell'helper interno: le due si chiamano
// uguale, e una controprova ha mostrato che cercare la stringa nel file trovava
// la seconda mentre la prima era già cambiata.
const firmaShell = fetta(srcBarra, { nome: "export default function AppShell(", volte: 1, dove: "la barra" });
ok(
  /passoCorrente: ChiavePasso \| null;/.test(firmaShell.slice(0, 600)),
  "la barra riceve il passo corrente e ammette di non saperlo (null è un valore ammesso, non un parametro assente)",
);

// IL SEGNO SI RENDE IN TUTTE E DUE LE BARRE, e si controllano separatamente.
// L'espressione che decide se accendere il segno compare due volte — desktop e
// mobile — quindi cercarla una volta sola diceva «esiste», non «viene usata»:
// spegnendo il render del desktop il controllo restava verde.
const corpoVoceBarra = fetta(
  srcBarra,
  { nome: "function VoceBarra(", volte: 1, dove: "la barra" },
  { nome: "export default function AppShell(", volte: 1, dove: "la barra" },
);
// IL SEGNO HA DUE METÀ, e si controllano entrambe: qualcosa che si VEDE (il
// puntino arancione) e qualcosa che si LEGGE (il testo per chi usa un lettore di
// schermo). Un segno fatto di solo colore non arriva a chi non lo vede — e una
// controprova che tolga il puntino lasciando la condizione passerebbe, se si
// guardasse solo la condizione.
const segno = (blocco, dove) => {
  ok(/item\.passo !== undefined && item\.passo === passoCorrente/.test(blocco), `${dove}: il segno si accende solo su una voce che È un passo`);
  ok(/\{eIlPasso &&/.test(blocco), `${dove}: …e quella condizione rende qualcosa`);
  ok(/rounded-full bg-kireo-orange/.test(blocco), `${dove}: …qualcosa che si vede (il puntino)`);
  ok(/sr-only">il tuo prossimo passo/.test(blocco), `${dove}: …e qualcosa che si legge, per chi il puntino non lo vede`);
};
segno(corpoVoceBarra, "desktop");
// La barra mobile è l'ULTIMO blocco con `md:hidden` (il primo è l'header del
// telefono): `indexOf` prendeva quello sbagliato e dava rosso su codice giusto.
// DUE occorrenze, e si vuole la SECONDA: la prima è l'header del telefono, e
// prenderla dava rosso su codice giusto. Il conto è dichiarato, quindi il
// giorno che `md:hidden` compare una terza volta il controllo lo dice invece
// di spostarsi in silenzio.
const barraMobile = fetta(srcBarra, { nome: "md:hidden", volte: 2, quale: 1, dove: "la barra" });
segno(barraMobile, "mobile");

ok(/getPassoCorrente/.test(srcLayout) && /passoCorrente=\{chiave\}/.test(srcLayout), "il layout lo calcola e lo passa alla barra");
const srcPasso = leggi("lib/percorso/passoCorrente.ts");
ok(/=\s*cache\(async/.test(srcPasso), "…una volta per richiesta: il layout e la home condividono la stessa lettura");
ok(/chiave: null/.test(srcPasso), "e su errore la chiave resta null: un segno sbagliato vale meno di nessun segno");
ok(/getProssimaTappa/.test(srcPasso), "il passo corrente viene da prossimaTappa, non da una seconda regola");

// ── 5) La pagina: le due liste coincidono nei due versi ─────────────────────
console.log("\n5) La pagina del percorso ha una prosa per ogni passo, e nessuna orfana");

const conProsa = Object.keys(T.PROSA_PASSI);
const senzaProsa = PASSI_PERCORSO.filter((p) => !conProsa.includes(p.chiave));
ok(
  senzaProsa.length === 0,
  senzaProsa.length === 0 ? "ogni passo ha la sua prosa" : `passi senza prosa: ${senzaProsa.map((p) => p.chiave).join(", ")} — un numero senza frase`,
);
const orfane = conProsa.filter((c) => !PASSI_PERCORSO.some((p) => p.chiave === c));
ok(orfane.length === 0, orfane.length === 0 ? "nessuna prosa è orfana" : `prosa senza passo: ${orfane.join(", ")}`);
const passi = T.passiConProsa();
ok(passi.map((p) => p.chiave).join(",") === ATTESI.join(","), "la pagina numera i passi nell'ordine della costante");
ok(passi.every((p, i) => p.numero === i + 1), "…e li numera da 1");
ok(/passiConProsa\(\)/.test(srcPagina), "la pagina chiama la funzione invece di elencare i passi a mano");
ok(!/Le aree|Le guide|I workshop/.test(srcPagina), "nessun titolo di passo è scritto dentro la pagina");

// ── 6) LA PAGINA NON NOMINA NESSUNA SOGLIA ──────────────────────────────────
console.log("\n6) La pagina racconta la forma del viaggio, non le soglie");

// Le forme in cui una condizione rientrerebbe. Sono TARATE SUL TESTO VERO: il
// testo dice «Tre passaggi», «tre documenti», «più ogni passo chiede che il
// precedente abbia lasciato qualcosa» e «quando la domanda diventa difficile» — tutte
// legittime. Un elenco che gridasse su quelle sarebbe un elenco che qualcuno
// disattiva, quindi si vieta la forma CONDIZIONALE, non le parole.
const VIETATE = [
  { re: /dopo\s+(i\s+|le\s+|il\s+|la\s+)?(un|una|due|tre|quattro|cinque|\d+)\s/i, cosa: "«dopo i tre test», «dopo due guide»" },
  { re: /serv(e|ono)\s+(i\s+|le\s+|un\s+|una\s+)?(un|una|due|tre|\d+)\s/i, cosa: "«servono due guide»" },
  { re: /richiede/i, cosa: "«richiede»: è il verbo di una condizione" },
  { re: /sblocc/i, cosa: "«si sblocca»: è il vocabolario delle soglie" },
  { re: /almeno\s+(un|una|due|tre|\d+)/i, cosa: "«almeno due»" },
  { re: /quando\s+(hai|avrai|avrà|avete)/i, cosa: "«quando hai fatto»" },
  { re: /devi\s+(prima|aver)/i, cosa: "«devi prima»" },
  { re: /prima\s+di\s+poter/i, cosa: "«prima di poter»" },
];

const testo = T.testoInteroPercorso();
ok(testo.length > 400, `il testo della pagina si legge da qui (${testo.length} caratteri)`);
const trovate = VIETATE.filter((v) => v.re.test(testo));
ok(
  trovate.length === 0,
  trovate.length === 0
    ? `nessuna delle ${VIETATE.length} forme condizionali compare nel testo`
    : `il testo nomina una soglia: ${trovate.map((v) => v.cosa).join("; ")} — è il momento in cui la pagina comincia a invecchiare`,
);
// La riga che parla della regola c'è, e parla senza condizioni.
//
// L'ANCORA È LA SOSTANZA, NON LA FRASE. Fino al 27/09 questa asserzione cercava
// «si apre quando quello prima ha lasciato qualcosa», cioè mezza frase
// trascritta: Mario ne ha riscritta la voce e il controllo è diventato rosso su
// un testo giusto. Una frase copiata dentro il controllo è una seconda copia del
// testo, e diverge alla prima riscrittura — la malattia che questo file esiste
// per sorvegliare, in formato minuscolo. Si tiene la sostanza della regola (un
// passo chiede qualcosa a quello prima) in tre parole, e tutto il resto della
// voce resta libero.
ok(/lasciato qualcosa/.test(T.CHIUSURA_PERCORSO), "l'unica riga che parla della regola c'è, e dice che un passo chiede qualcosa a quello prima");
ok(T.CHIUSURA_PERCORSO.length > 60 && testo.includes(T.CHIUSURA_PERCORSO), "…e fa parte del testo della pagina: non è una costante che nessuno rende");
ok(!/test|guid/i.test(T.CHIUSURA_PERCORSO), "…e non nomina nessun passo in particolare");

// L'ACCORDO DI GENERE: questo testo lo legge uno studente, e KIREO non sa chi
// è. Si usano i pattern del PRODOTTO (`lib/lingua/accordoGenere.ts`), non una
// copia: una copia qui divergerebbe da quella con cui il prodotto si sorveglia.
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const accordi = trovaAccordi(testo);
ok(
  accordi.length === 0,
  accordi.length === 0
    ? "il testo non concorda col genere di chi legge"
    : `forme accordate: ${accordi.map((a) => JSON.stringify(a)).join(", ")}`,
);

// ── 7) Controprove ──────────────────────────────────────────────────────────
console.log("\n7) Controprove: la guardia si accorge davvero");

const CONDIZIONI_FINTE = [
  "Le missioni si aprono dopo i tre test.",
  "Per i test servono due guide della stessa area.",
  "Il workshop richiede un'esperienza precedente.",
  "Le missioni si sbloccano più avanti.",
  "Serve almeno una guida per cominciare.",
  "Le missioni si aprono quando hai finito i test.",
  "Devi prima leggere due guide.",
  "Prima di poter fare una missione, fai i test.",
];
for (const frase of CONDIZIONI_FINTE) {
  const beccata = VIETATE.some((v) => v.re.test(frase));
  ok(beccata, beccata ? `becca «${frase}»` : `NON becca «${frase}»: una soglia entrerebbe senza che nessuno la veda`);
}
// E non becca le frasi legittime del testo vero: una guardia che grida su una
// cosa giusta è una guardia che qualcuno disattiva.
const LEGITTIME = [
  "Tre passaggi. Non hanno voti e non si possono sbagliare: servono a far vedere verso cosa ti giri.",
  "Per ogni area tre documenti, uno più a fondo dell'altro.",
  "Puoi cominciare subito. Più si va avanti, più ogni passo chiede che il precedente abbia lasciato qualcosa.",
  "Diciotto campi in cui si può lavorare.",
  "Quello che decidi qui dice più di quello che dichiari.",
];
for (const frase of LEGITTIME) {
  const falsoPositivo = VIETATE.find((v) => v.re.test(frase));
  ok(!falsoPositivo, falsoPositivo ? `grida a torto su «${frase}» (${falsoPositivo.cosa})` : `lascia passare «${frase.slice(0, 44)}…»`);
}

// ── 8) LA CARD: il primo gradino non nega una cosa vera ─────────────────────
// Il 5/10, in produzione, uno studente certificato su due dirette leggeva
// «Comincia da una guida»: «comincia» parla della PERSONA, e la persona aveva
// già cominciato. «Il primo passo è» parla della SCALA, che davvero comincia lì
// — e vale per tutti gli studenti, in tutti gli stati, senza nessuna query.
console.log("\n8) Il primo gradino parla della scala, non della persona");

const srcTappa = leggi("lib/percorso/prossimaTappa.ts");
const srcCard = leggi("components/app/CardProssimaTappa.tsx");

ok(/Il primo passo è una guida/.test(srcTappa), "il primo gradino dice «Il primo passo è una guida»");
// LA FORMA VIETATA, non solo sostituita: ci si torna per abitudine, e il motivo
// per cui non va bene non si vede rileggendo la frase.
ok(
  !/testo:\s*["'`]Comincia da una guida/.test(srcTappa),
  "e non torna a «Comincia da una guida», che nega una cosa vera a chi ha già fatto qualcosa",
);

// LA NOTA È UN DI PIÙ: il primo gradino chiude il difetto da solo. Un testo che
// si degrada bene vale più di un testo giusto in un caso solo.
ok(/nota\?: string/.test(srcTappa), "la seconda riga è FACOLTATIVA nel tipo");
ok(
  /\{tappa\.nota && /.test(srcCard),
  "e la card la rende solo se c'è, invece di lasciare una riga vuota",
);
// NOMINA L'ESPLORAZIONE, NON IL PROFILO: «contano nel tuo profilo» sarebbe vero
// solo dopo 20261004160000 e solo per le presenze `certificata_da_tipo =
// 'sistema'` — una frase falsa per alcuni, nel punto in cui gli diciamo che
// quello che hanno fatto non è andato perso.
ok(
  /Dove hai esplorato finora/.test(srcTappa),
  "la nota nomina «Dove hai esplorato finora», che è un riquadro sulla stessa pagina",
);
ok(
  !/nota:[\s\S]{0,200}?nel tuo profilo/.test(srcTappa),
  "e non nomina il profilo, dove una presenza entra solo dopo la migrazione e solo se certificata dal sistema",
);
// Il riquadro che la nota nomina deve esistere con QUEL nome: una frase
// verificabile da chi legge vale solo se chi legge lo trova.
ok(
  /Dove hai esplorato finora/.test(leggi("app/app/page.tsx")),
  "…e quel riquadro esiste in home con quel nome esatto",
);

// IL BOOLEANO: sì/no, nessun numero, e degrada verso il NO. Una lettura fallita
// non deve produrre una nota che afferma una cosa su quello che lo studente ha
// fatto.
const corpoPresenze = fetta(srcTappa, { nome: "async function leggiPresenzeCertificate(", volte: 1, dove: "la scala" });
ok(
  /\.limit\(1\)/.test(corpoPresenze.slice(0, 700)),
  "le presenze si leggono a sì/no (limit 1), non si contano",
);
ok(
  /catch\s*\{\s*return false;/.test(corpoPresenze.slice(0, 900)),
  "…e su errore la risposta è NO, non una nota a caso",
);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(
    `✗ ${falliti} controlli falliti.\n` +
      "  L'ordine dei passi è un dato e sta in un posto solo; la pagina racconta la forma\n" +
      "  del viaggio e non le soglie, perché una soglia scritta a mano invecchia alla prima\n" +
      "  modifica della regola e il difetto non si vede rileggendo.\n",
  );
  process.exit(1);
}
console.log("✓ La barra mostra l'ordine e non il permesso, e la pagina non nomina nessuna soglia.\n");
