// npm run test:fine — LA FINE DELL'INCONTRO È UNA SOLA (giro del 25/10 pomeriggio).
//
// Dal 26/10 una diretta si chiude anche prima della fine programmata, e da quel
// giorno `data_fine` e «quando l'incontro è finito» sono due momenti diversi. Il
// giro del 25/10 l'ha mostrato su un evento vero, chiuso alle 14:24 e programmato
// fino alle 14:30: la domanda finale si poteva ancora cambiare con gli studenti
// che la leggevano; la pagina dello studente diceva «In diretta» due righe sopra
// «è stato chiuso»; il report dell'ente diceva 14:00 → 14:30 accanto a una
// copertura calcolata su 24 minuti.
//
// LA PROPRIETÀ, nella sola forma che si può sorvegliare: OGNI posto che nomina
// la fine programmata dichiara se risponde a «è finito?» (allora legge anche la
// chiusura) o se lavora APPOSTA sulla finestra programmata (allora la ragione è
// scritta qui). È il sovrainsieme con le esclusioni scritte: un file nuovo che
// nomina `data_fine` nasce rosso finché qualcuno non dice cos'è — che è il
// momento giusto per chiederselo, perché è l'unico in cui qualcuno ci sta
// pensando.
//
// ⚠️ IL LIMITE, dichiarato: è lessicale. Un file «effettivo» deve LEGGERE la
// chiusura, ma niente qui prova che la usi nel confronto giusto — quello lo
// provano le asserzioni di comportamento in fondo, sulle funzioni che decidono.
// Sbaglia per difetto (un file che legge la chiusura e confronta male passa),
// non per eccesso.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript } = require("./banco/ts");
abilitaTypeScript();
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");

const RADICE = path.join(__dirname, "..");
let fatte = 0;
let falliti = 0;
function ok(cond, cosa, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${cosa}`);
  else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio !== undefined ? `\n      → ${typeof dettaglio === "string" ? dettaglio : JSON.stringify(dettaglio)}` : ""}`);
  }
}

// ── la classificazione ──────────────────────────────────────────────────────
// «effettiva»: risponde a «l'incontro è finito?» — deve leggere la chiusura.
// «riceve»: un componente che riceve la fine dal chiamante — il chiamante deve
//   passargli quella effettiva (verificato sotto, per nome).
// «programmata»: lavora apposta sulla finestra programmata, con la ragione.
const CLASSI = {
  "lib/live.ts": ["effettiva", "dove nasce `fineEffettiva`"],
  "lib/app/consegneDaFare.ts": ["effettiva", "le consegne aperte e la loro scadenza partono dalla fine effettiva"],
  "lib/eventi/portaConsegna.ts": ["effettiva", "la porta della consegna si apre alla fine effettiva"],
  "lib/eventi/domandaConsegna.ts": ["effettiva", "la domanda si cambia fino alla fine effettiva (il caso del 25/10)"],
  "components/ente/DomandaConsegnaForm.tsx": ["effettiva", "riceve la chiusura e la passa a `statoDomandaConsegna`"],
  "lib/app/eventi.ts": ["effettiva", "prossimi/passati: una diretta chiusa è passata"],
  "lib/docente/eventi.ts": ["effettiva", "come sopra, nell'area docente"],
  "components/app/CardEvento.tsx": ["effettiva", "iscrizione ed «Entra» sulla fine effettiva"],
  "components/docente/CardWebinarDocente.tsx": ["effettiva", "come sopra, nell'area docente"],
  "components/live/PannelloLive.tsx": ["effettiva", "la pagina dello studente passa tutta allo stato «conclusa» alla chiusura"],
  "app/app/eventi/[id]/live/page.tsx": ["effettiva", "legge la chiusura e la passa al pannello e alla rilettura"],
  "app/docente/webinar/[id]/live/page.tsx": ["effettiva", "legge la chiusura e la passa al pannello"],
  "app/api/eventi/[id]/consegna/route.ts": ["effettiva", "legge la chiusura per `statoPortaConsegna`"],
  "lib/eventi/exportPresenze.ts": ["effettiva", "la testa del report dice la durata vera"],
  "lib/eventi/chiaveTrasmissione.ts": ["effettiva", "una chiave mai arrivata su una diretta chiusa è «mai arrivata»"],
  "app/api/attestato/[id]/route.ts": ["effettiva", "la durata stampata su un attestato è quella vera"],
  "lib/eventi/chiusuraDiretta.ts": ["effettiva", "la chiusura stessa: fasi, ricevuta, durata vera"],
  "components/ente/ControlloDirettaEvento.tsx": ["effettiva", "la console legge la chiusura dal poll"],
  "lib/eventi/moderazione.ts": ["effettiva", "legge le colonne della chiusura per la pagina della diretta"],
  "app/diretta/[id]/page.tsx": ["effettiva", "intestazione e report sulla fine effettiva"],
  "app/admin/page.tsx": ["effettiva", "passa la chiusura alla console"],
  "app/ente/(dashboard)/eventi/page.tsx": ["effettiva", "passa la chiusura alla console, al report e alla chiave"],
  "lib/scuola/eventi.ts": ["effettiva", "la durata vera per l'avviso delle zero ore"],
  "app/scuola/(dashboard)/eventi/page.tsx": ["effettiva", "l'avviso delle zero ore sulla durata vera"],
  "app/api/admin/presenze/[id]/route.ts": ["effettiva", "l'esito sa se la diretta è chiusa"],
  "app/api/scuola/presenze/[id]/route.ts": ["effettiva", "come sopra"],
  "components/EntraDirettaLink.tsx": ["riceve", "la fine la decidono i due chiamanti (CardEvento, CardWebinarDocente)"],
  "components/live/BoxDomandeLive.tsx": ["riceve", "la fine la decide PannelloLive"],
  "components/ente/CreaEventoForm.tsx": ["programmata", "scrive la finestra programmata: non c'è ancora nessuna chiusura"],
  "components/ente/SpostaFinestraForm.tsx": ["programmata", "sposta la finestra programmata; il database rifiuta una diretta già chiusa"],
  "lib/eventi/orePcto.ts": ["programmata", "l'avviso sulle ore dichiarate si dà creando l'evento, sulla durata dichiarata"],
  "lib/live/presenza.ts": [
    "programmata",
    "la soglia DURANTE la diretta (`minutiNecessari`) e la misura della fine del video («quanto prima della fine programmata»): a chiusura avvenuta la pagina passa a «conclusa», e l'esito si calcola sulla durata vera in `testoChiusuraStudente`",
  ],
  "lib/live/misuraLive.ts": ["programmata", "misura quanto prima della fine PROGRAMMATA arriva il segnale di fine: è il dato"],
  "app/api/live/fine-video/route.ts": ["programmata", "come sopra"],
};

const DIRS = ["app", "components", "lib"];
function elenca(dir) {
  const fuori = [];
  for (const voce of fs.readdirSync(path.join(RADICE, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) fuori.push(...elenca(rel));
    else if (/\.(ts|tsx)$/.test(voce.name)) fuori.push(rel);
  }
  return fuori;
}
const NOMINA_FINE = /\bdata_fine\b|\bdataFine\b/;
const LEGGE_CHIUSURA = /\bfineEffettiva\b|\bdiretta_chiusa_il\b|\bchiusaIl\b/;

console.log("\n═══ La fine dell'incontro è una sola ═══\n");

console.log("§1 — ogni posto che nomina la fine programmata dichiara cosa ne fa\n");
const candidati = DIRS.flatMap(elenca).filter((rel) => NOMINA_FINE.test(senzaCommenti(fs.readFileSync(path.join(RADICE, rel), "utf8"))));
// LA SOGLIA DICHIARATA: sotto, l'elenco non sta leggendo — e una proprietà sui
// candidati sarebbe verde su un insieme vuoto.
ok(candidati.length >= 30, `il sovrainsieme trova ${candidati.length} file che nominano la fine programmata (soglia 30)`);
const nonClassificati = candidati.filter((rel) => !CLASSI[rel]);
ok(nonClassificati.length === 0, "ogni file che nomina `data_fine` è classificato (effettiva / riceve / programmata)", nonClassificati);
const orfani = Object.keys(CLASSI).filter((rel) => !candidati.includes(rel));
ok(orfani.length === 0, "nessuna classificazione orfana (un file che non nomina più `data_fine` si toglie da qui)", orfani);
const effettiviMuti = candidati.filter(
  (rel) => CLASSI[rel]?.[0] === "effettiva" && !LEGGE_CHIUSURA.test(senzaCommenti(fs.readFileSync(path.join(RADICE, rel), "utf8"))),
);
ok(effettiviMuti.length === 0, "ogni file «effettivo» legge davvero la chiusura", effettiviMuti);
const conti = { effettiva: 0, riceve: 0, programmata: 0 };
for (const rel of candidati) if (CLASSI[rel]) conti[CLASSI[rel][0]]++;
console.log(`    (${conti.effettiva} sulla fine effettiva, ${conti.riceve} la ricevono dal chiamante, ${conti.programmata} sulla programmata di proposito)`);

console.log("\n§2 — chi riceve la fine riceve quella effettiva\n");
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(RADICE, rel), "utf8"));
for (const rel of ["components/app/CardEvento.tsx", "components/docente/CardWebinarDocente.tsx"]) {
  const s = leggi(rel);
  // L'àncora dichiara quante volte compare (una): un secondo «Entra» nella card
  // farebbe guardare il blocco sbagliato senza dirlo.
  const i = ancora(s, "<EntraDirettaLink");
  const blocco = s.slice(i, i + 300);
  ok(/dataFine=\{fine\}/.test(blocco) && /const fine = fineEffettiva\(/.test(s), `${rel}: «Entra» riceve la fine effettiva`, blocco);
}
{
  const s = leggi("components/live/PannelloLive.tsx");
  const i = ancora(s, "<BoxDomandeLive");
  const blocco = s.slice(i, i + 400);
  ok(/dataFine=\{fine\}/.test(blocco), "PannelloLive passa al box delle domande la fine effettiva", blocco);
  ok(/const stato = chiusa \? "conclusa"/.test(s), "PannelloLive: una chiusura porta la pagina intera a «conclusa» (non cambia una frase sola)");
  ok(/const chiusa = Boolean\(chiusaIl\) \|\| chiusaDaOrganizzatore/.test(s), "…sia la chiusura letta dal server sia quella vista dal battito");
}

console.log("\n§3 — le funzioni SQL vive che nominano la fine leggono anche la chiusura\n");
{
  const DIR = path.join(RADICE, "supabase/migrations");
  const fn = new Map();
  for (const nome of fs.readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()) {
    const sql = fs.readFileSync(path.join(DIR, nome), "utf8");
    const re = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z_0-9]+)\s*\([\s\S]*?\)\s*returns[\s\S]*?\$(\w*)\$([\s\S]*?)\$\2\$/gi;
    let m;
    while ((m = re.exec(sql))) fn.set(m[1], { file: nome, corpo: senzaCommentiSql(m[3]) });
  }
  ok(fn.size >= 80, `l'estrattore legge ${fn.size} funzioni dalle migrazioni`);
  // Le tre finestre del 25/10: si nominano, perché sono quelle che passavano dalla
  // fine programmata — un corpo vivo senza `data_fine` non le farebbe comparire
  // nel sovrainsieme qui sotto.
  for (const nome of ["domanda_consegna_modificabile", "consegna_evento_aperta", "evento_in_finestra_diretta"]) {
    ok(/fine_effettiva_evento\(/.test(fn.get(nome)?.corpo ?? ""), `${nome}: la definizione viva passa da fine_effettiva_evento`, fn.get(nome)?.file);
  }
  const ESCLUSE_SQL = {};
  const conFine = [...fn.entries()].filter(([, f]) => /\bdata_fine\b/.test(f.corpo));
  ok(conFine.length >= 5, `${conFine.length} funzioni vive nominano data_fine (soglia 5)`);
  const muti = conFine.filter(([n, f]) => !ESCLUSE_SQL[n] && !/fine_effettiva_evento|diretta_chiusa_il/.test(f.corpo)).map(([n, f]) => `${n} (${f.file})`);
  ok(muti.length === 0, "ogni funzione viva che nomina data_fine legge anche la chiusura", muti);
}

console.log("\n§4 — il comportamento, sulle funzioni che decidono\n");
const L = require("@/lib/live");
// Il 25/10/2026 è il giorno del cambio d'ora: dalle 03:00 Roma è UTC+1.
const INIZIO = "2026-10-25T13:00:00Z"; // 14:00 a Roma
const FINE = "2026-10-25T13:30:00Z"; // 14:30
const CHIUSA = "2026-10-25T13:24:00Z"; // 14:24
const alle = (iso) => new Date(iso);
ok(L.fineEffettiva(INIZIO, FINE, CHIUSA) === CHIUSA, "chiusa alle 14:24 di una diretta fino alle 14:30: finisce alle 14:24");
ok(L.fineEffettiva(INIZIO, FINE, null) === FINE, "non chiusa: la fine programmata");
ok(L.fineEffettiva(INIZIO, FINE, "2026-10-25T14:00:00Z") === FINE, "chiusa DOPO la fine programmata: non sposta niente");
ok(L.fineEffettiva(INIZIO, null, null) === L.fineDiretta(INIZIO, null), "senza data di fine: le tre ore di sempre");
{
  const { statoDomandaConsegna } = require("@/lib/eventi/domandaConsegna");
  const ev = { data_inizio: INIZIO, data_fine: FINE, diretta_chiusa_il: CHIUSA, domanda_consegna: "Una domanda vera." };
  const p = statoDomandaConsegna(ev, alle("2026-10-25T13:26:00Z"));
  ok(!p.modificabile && p.stato === "chiusa_con_domanda", "alle 14:26, chiusa alle 14:24: la domanda NON si cambia più (il caso del 25/10)", p);
  ok(/14:24/.test(p.testo) && !/14:30/.test(p.testo), "…e il testo dice la fine vera, non quella programmata", p.testo);
  const pPrima = statoDomandaConsegna({ ...ev, diretta_chiusa_il: null }, alle("2026-10-25T13:26:00Z"));
  ok(pPrima.modificabile, "…mentre una diretta non chiusa alle 14:26 è ancora modificabile (la proprietà è la chiusura, non l'ora)");
}
{
  const { eventoNonFinito } = require("@/lib/app/eventi");
  const ev = { data_inizio: INIZIO, data_fine: FINE, diretta_chiusa_il: CHIUSA };
  ok(!eventoNonFinito(ev, alle("2026-10-25T13:26:00Z")), "chiusa alle 14:24: alle 14:26 sta fra i passati");
  ok(eventoNonFinito({ ...ev, diretta_chiusa_il: null }, alle("2026-10-25T13:26:00Z")), "…non chiusa sta ancora fra i prossimi");
}
{
  const { scadenzaConsegna } = require("@/lib/app/consegneDaFare");
  ok(
    scadenzaConsegna(INIZIO, L.fineEffettiva(INIZIO, FINE, CHIUSA)) === new Date(new Date(CHIUSA).getTime() + 48 * 3600_000).toISOString(),
    "le 48 ore della consegna partono dalla chiusura",
  );
}
{
  const E = require("@/lib/eventi/exportPresenze");
  const ev = {
    titolo: "test 25 ottobre player",
    data_inizio: INIZIO,
    data_fine: FINE,
    diretta_chiusa_il: CHIUSA,
    diretta_chiusa_da_tipo: "ente",
    diretta_durata_minuti: 24,
    diretta_chiusa_certificati: 1,
  };
  const testa = E.testaReportEnte(ev);
  ok(/14:00/.test(testa) && /14:24/.test(testa) && !/14:30/.test(testa), "la testa del report dice 14:00 → 14:24, non 14:30", testa);
  ok(/durata 24 minuti/.test(testa) && /chiuso dall'organizzatore/.test(testa), "…con la durata vera e chi l'ha chiuso", testa);
  const righe = E.righeChiusuraReport(ev);
  ok(righe.some((r) => r[0] === "Certificazioni automatiche" && r[1] === 1), "…e quante certificazioni", righe);
  ok(righe.some((r) => r[0] === "Soglia di presenza per la certificazione" && r[1] === "18 minuti su 24"), "…e la soglia: 18 minuti su 24", righe);
  const corta = E.righeChiusuraReport({ ...ev, diretta_durata_minuti: 16 });
  ok(corta.some((r) => /sotto i 20 minuti/.test(String(r[1]))), "sotto i 20 minuti la soglia dice che non si certifica", corta);
  const aperta = E.testaReportEnte({ ...ev, diretta_chiusa_il: null, diretta_durata_minuti: null, diretta_chiusa_da_tipo: null });
  ok(/14:30/.test(aperta) && /non è ancora stata chiusa/.test(aperta), "non chiusa: la finestra programmata, e lo dice", aperta);
  ok(E.righeChiusuraReport({ ...ev, diretta_chiusa_il: null }).length === 0, "…e nessuna riga di certificazioni su una diretta non chiusa");
  const [sez] = E.sezioniReportEnte(ev, { totale_iscritti: 1, totale_presenti: 1, copertura_media: 91.7, numero_domande: 0 }, []);
  ok(sez.righe.some((r) => r[0] === "Certificazioni automatiche"), "il report vero (`sezioniReportEnte`) porta le righe della chiusura");
}

console.log("\n§5 — il CSV: «non misurata» dove non c'era niente da misurare, e i decimali d'accordo fra loro\n");
{
  const E = require("@/lib/eventi/exportPresenze");
  // La riga del 22/09 nel CSV di Mario: certificata dalla scuola, nessun battito.
  const dad = { stato_finale: "partecipato", certificata_da_tipo: "scuola", primo_ping: null, minuti_presenza: null, minuti_contati: 0, copertura_percento: 0 };
  const celle = E.celleMisura(dad);
  ok(celle.every((c) => c === E.PRESENZA_NON_MISURATA), "certificata a mano senza battito: le tre celle dicono «non misurata», non 0", celle);
  ok(E.notaPresenzaNonMisurata([dad]) === E.NOTA_PRESENZA_NON_MISURATA, "…e la nota sotto la sezione lo spiega");
  const auto = { ...dad, certificata_da_tipo: "sistema", primo_ping: "x", minuti_presenza: 23.5, minuti_contati: 22, copertura_percento: 91.7 };
  ok(JSON.stringify(E.celleMisura(auto)) === JSON.stringify([22, 23.5, 91.7]), "certificata dal conteggio: i numeri veri", E.celleMisura(auto));
  const manualeCollegato = { ...auto, certificata_da_tipo: "scuola" };
  ok(E.celleMisura(manualeCollegato)[0] === 22, "certificata a mano MA collegata: i minuti sono misure vere ed escono");
  const maiCollegato = { stato_finale: "iscritto", certificata_da_tipo: null, primo_ping: null, minuti_presenza: null, minuti_contati: 0, copertura_percento: 0 };
  ok(E.celleMisura(maiCollegato)[1] === 0, "iscritto e mai collegato: zero resta zero (lì è un fatto)");
  ok(E.notaPresenzaNonMisurata([auto, maiCollegato]) === null, "nessuna riga non misurata: nessuna nota");
  // I decimali: tutti col punto, le ore a due cifre.
  ok(E.oreRiconosciutePerExport({ stato_finale: "partecipato", ore_riconosciute: 0.4 }, true) === "0.40", "ore 0,4 → «0.40»: due cifre, col punto");
  ok(E.oreRiconosciutePerExport({ stato_finale: "partecipato", ore_riconosciute: "3.00" }, true) === "3.00", "…anche quando PostgREST la manda come stringa");
  const riga = [...E.celleMisura(auto), E.oreRiconosciutePerExport({ stato_finale: "partecipato", ore_riconosciute: 0.4 }, true)];
  ok(riga.every((c) => !String(c).includes(",")), "nella stessa riga nessun decimale ha la virgola", riga);
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà\n`);
process.exit(falliti === 0 ? 0 : 1);
