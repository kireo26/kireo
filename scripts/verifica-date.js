// Le date: una zona sola, dichiarata, e nessuno che formatti per conto suo.
//
// PERCHÉ ESISTE. Il 28/09, al primo giro con una persona: un webinar creato per
// le 15:00 veniva letto 13:00 — nell'admin, nella lista dell'ente e
// nell'AGENDA DELLO STUDENTE. Il dato era giusto; era la formattazione a
// mentire, perché un componente server su Vercel gira a UTC e
// `toLocaleString("it-IT")` senza `timeZone` prende l'orologio della macchina.
// Cinquantatré chiamate, nessuna che dichiarasse la zona.
//
// LE DUE METÀ, e la seconda è quella che avrebbe preso il difetto:
//   - una guardia lessicale che vieta `toLocale*` e `Intl.*Format` fuori da
//     `lib/formato.ts`, così una chiamata nuova non può rinascere sparsa;
//   - una prova di COMPORTAMENTO: si formatta un istante noto e si pretende
//     l'ora di Roma. Una guardia lessicale da sola direbbe «la parola timeZone
//     c'è» e non che l'ora giusta esca.
//
// E L'ALTRA METÀ, chiusa il 28/09 nello stesso giro: `<input
// type="datetime-local">` restituisce «2026-09-28T15:00» senza fuso, e `new
// Date` di quella stringa la legge nella zona DEL BROWSER DI CHI COMPILA. Per un
// ente italiano le due metà si annullano — chi prova non vede niente di strano,
// e il difetto aspetta il primo evento caricato da un'altra zona. La prova gira
// la stessa stringa con il fuso di sistema spostato cinque volte.
//
// LA SENTINELLA. La prova di comportamento gira con il processo a UTC (lo
// impone questo file) e verifica PRIMA che un formattatore senza `timeZone`
// dia una risposta DIVERSA. Senza quella verifica, su una macchina già a Roma
// il controllo sarebbe verde anche con la zona tolta: verde esattamente nel
// caso per cui esiste.
//
// E IL SORGENTE SI LEGGE SPOGLIATO DAI COMMENTI: questo file stesso nomina
// `toLocaleString` una dozzina di volte per spiegare perché è vietato, e su un
// sorgente grezzo la guardia griderebbe sulla propria documentazione. È la
// classe resa affidabile il 28/09 — e senza quel lavoro questa guardia sarebbe
// nata cieca il giorno dopo.
//
// Esecuzione: `npm run test:date`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

// Prima di qualunque Date: il processo sta a UTC, cioè nella stessa condizione
// di Vercel. Va messo qui, prima dei require, perché Node legge TZ presto.
process.env.TZ = "UTC";

const fs = require("fs");
const path = require("path");
const { senzaCommenti } = require("./lib/senza-commenti");
const { abilitaTypeScript, ROOT } = require("./banco/ts");

abilitaTypeScript();
const {
  formattaData,
  formattaDataOra,
  formattaNumero,
  istanteDaOrarioItaliano,
  millisecondiDaOrarioItaliano,
} = require("@/lib/formato");

let falliti = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falliti++;
};

const CASA = path.join("lib", "formato.ts");
const CARTELLE = ["app", "components", "lib"];

function sorgenti(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sorgenti(p, acc);
    else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

console.log("\n═══ Le date: una zona sola ═══\n");

// ── 1) il comportamento: l'ora che esce è quella di Roma ────────────────────
console.log("1) Quello che esce (processo a UTC, come Vercel)");

// L'istante che ha aperto il caso: un webinar creato per le 15:00 italiane
// d'estate è mezzogiorno-e-uno a Greenwich meno due ore.
const ESTATE = "2026-09-28T13:00:00.000Z";
const INVERNO = "2027-01-15T14:00:00.000Z";

// LA SENTINELLA, prima di tutto: senza `timeZone` la risposta dev'essere
// DIVERSA, altrimenti questa prova non sa distinguere niente.
const senzaZona = new Date(ESTATE).toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" });
ok(
  !/15:00/.test(senzaZona),
  `la prova sa discriminare: senza timeZone esce «${senzaZona}», che non è l'ora italiana`,
);

ok(/15:00/.test(formattaDataOra(ESTATE)), "d'estate (UTC+2) un evento delle 15:00 si legge 15:00");
ok(/15:00/.test(formattaDataOra(INVERNO)), "d'inverno (UTC+1) lo stesso vale: l'ora legale la gestisce la zona, non noi");
ok(formattaDataOra(ESTATE, "full").startsWith("lunedì"), "lo stile `full` porta il giorno della settimana");
ok(formattaData(ESTATE) === "28 settembre 2026", "una data senza ora resta quella del giorno italiano");

// Le colonne `date` (data di nascita, firma della convenzione) tornano come
// "2009-05-14" e `new Date` le legge a mezzanotte UTC: Roma è sempre AVANTI,
// quindi il giorno non scivola. In una zona dietro UTC scivolerebbe, e questa
// riga è lì perché se un giorno la zona cambiasse ce ne accorgeremmo.
ok(formattaData("2009-05-14") === "14 maggio 2009", "una data-sola non scivola al giorno prima");

ok(formattaNumero(180000) === "180.000", "i numeri restano con i separatori italiani");

// ── 1bis) L'INGRESSO: un orario di scuola italiana, non di chi lo digita ─────
//
// LA METÀ SIMMETRICA, e per un ente italiano si annulla con l'altra: chi prova
// oggi non vede niente di strano, e il difetto aspetta il giorno in cui
// qualcuno carica un evento dall'estero o da una macchina configurata male.
// Quindi non basta scriverlo: si esegue la stessa stringa con il fuso di
// sistema spostato, e si pretende lo stesso istante.
console.log("\n1bis) Quello che entra (lo stesso orario da cinque fusi)");

const ZONE_DI_PROVA = ["UTC", "Europe/Rome", "Asia/Tokyo", "America/Los_Angeles", "Pacific/Kiritimati"];
const ORARIO_SCUOLA = "2026-09-28T15:00";

// Node rilegge `TZ` a ogni `Date` (verificato su questa versione, non dedotto:
// la sentinella qui sotto fallirebbe se non fosse vero), quindi lo spostamento
// si fa qui invece che in cinque processi figli.
function inOgniZona(f) {
  const prima = process.env.TZ;
  try {
    return ZONE_DI_PROVA.map((z) => {
      process.env.TZ = z;
      return f();
    });
  } finally {
    process.env.TZ = prima;
  }
}

// LA SENTINELLA: il modo ingenuo — `new Date(stringa)` — deve dare CINQUE
// risposte diverse. Se ne desse una sola, questa prova non saprebbe distinguere
// niente e sarebbe verde anche con la correzione tolta.
const ingenui = new Set(inOgniZona(() => new Date(ORARIO_SCUOLA).toISOString()));
ok(
  ingenui.size === ZONE_DI_PROVA.length,
  `la prova sa discriminare: senza la conversione lo stesso «15:00» dà ${ingenui.size} istanti diversi su ${ZONE_DI_PROVA.length} fusi`,
);

const nostri = new Set(inOgniZona(() => istanteDaOrarioItaliano(ORARIO_SCUOLA)));
ok(
  nostri.size === 1 && nostri.has("2026-09-28T13:00:00.000Z"),
  `«15:00» dà lo stesso istante da tutti e ${ZONE_DI_PROVA.length} i fusi: ${[...nostri].join(" / ")}`,
);
ok(
  istanteDaOrarioItaliano("2027-01-15T15:00") === "2027-01-15T14:00:00.000Z",
  "…e d'inverno l'offset è un'ora, non due: lo sa la zona, non una nostra tabella",
);

// I DUE GIORNI DEL CAMBIO D'ORA, e questi due casi non sono decorativi: sono i
// soli che esercitano la SECONDA passata dell'offset. Cercati eseguendo le due
// versioni su ogni mezz'ora dei quattro giorni intorno alle transizioni —
// «subito dopo il cambio» (le 03:30 di marzo, le 04:00 di ottobre) esce giusto
// anche con una passata sola, quindi non prova niente. Con una passata sola
// l'orario qui sotto finisce alle 23:30 del GIORNO PRIMA.
ok(
  istanteDaOrarioItaliano("2026-03-29T01:30") === "2026-03-29T00:30:00.000Z",
  "l'ora prima del cambio di primavera non scivola al giorno prima",
);
ok(
  istanteDaOrarioItaliano("2026-10-25T01:30") === "2026-10-24T23:30:00.000Z",
  "…né l'ora prima del cambio d'autunno scivola in avanti",
);
ok(
  istanteDaOrarioItaliano("2026-03-29T03:30") === "2026-03-29T01:30:00.000Z",
  "e un orario subito dopo un cambio resta quello che dice",
);
ok(istanteDaOrarioItaliano("2026-03-29T02:30") !== null, "un'ora che quel giorno non esiste scivola in avanti, non fallisce");

ok(istanteDaOrarioItaliano("ciao") === null, "una stringa che non è un orario dà null, mai un istante inventato");
ok(istanteDaOrarioItaliano("") === null, "…e così un campo vuoto");
ok(
  Number.isNaN(millisecondiDaOrarioItaliano("ciao")),
  "…e in numeri dà NaN, quindi un confronto con un campo malformato è sempre falso (nessun avviso per sbaglio)",
);
ok(
  millisecondiDaOrarioItaliano("2026-09-28T15:00") === new Date("2026-09-28T13:00:00.000Z").getTime(),
  "la versione in millisecondi è lo stesso istante dell'altra: una sola definizione",
);

// ── 2) la zona è dichiarata su OGNI formattatore di casa ────────────────────
console.log("\n2) Dentro lib/formato.ts");

const casa = senzaCommenti(fs.readFileSync(path.join(ROOT, CASA), "utf8"));
ok(/const ZONA = "Europe\/Rome"/.test(casa), "la zona è Europe/Rome, fissa e non presa dal browser");

// Ogni formattatore di DATA deve dichiararla — `toLocale*` e `Intl.DateTimeFormat`
// insieme, perché la cinquantatreesima chiamata col difetto era in QUESTO file e
// usava la seconda forma: un formattatore condiviso non è al sicuro per il fatto
// di essere condiviso. I numeri restano fuori: non hanno zona.
const formattatoriData = [
  ...(casa.match(/toLocale(?:Date|Time)?String\("it-IT", \{[^}]*\}/g) ?? []),
  ...(casa.match(/Intl\.DateTimeFormat\("[a-zA-Z-]+", \{[^}]*\}/g) ?? []),
];
const senzaTimeZone = formattatoriData.filter((f) => !/timeZone: ZONA/.test(f));
ok(
  formattatoriData.length >= 3 && senzaTimeZone.length === 0,
  senzaTimeZone.length === 0
    ? `tutti e ${formattatoriData.length} i formattatori di data dichiarano la zona`
    : `formattatori senza zona: ${senzaTimeZone.join(" / ")}`,
);

// ── 3) nessuno formatta per conto suo ───────────────────────────────────────
console.log("\n3) Fuori da lib/formato.ts");

const sparsi = [];
for (const dir of CARTELLE) {
  for (const f of sorgenti(path.join(ROOT, dir))) {
    const rel = path.relative(ROOT, f);
    if (rel === CASA) continue;
    const src = senzaCommenti(fs.readFileSync(f, "utf8"));
    src.split("\n").forEach((riga, i) => {
      if (/\.toLocale(?:Date|Time)?String\(/.test(riga) || /Intl\.(?:DateTime|Number)Format\b/.test(riga)) {
        sparsi.push(`${rel}:${i + 1}`);
      }
    });
  }
}
ok(
  sparsi.length === 0,
  sparsi.length === 0
    ? "nessuna formattazione sparsa: passano tutte da formattaData/formattaDataOra/formattaNumero"
    : `formattazioni fuori casa (una zona non dichiarata è due ore di errore per ogni studente):\n     ${sparsi.join("\n     ")}`,
);

// E CHI RACCOGLIE UN ORARIO passa dalla conversione, non da `new Date`. Oggi il
// form degli eventi è l'unico con un `datetime-local`; questa riga esiste per il
// secondo, che nascerebbe col difetto perché è la forma che viene in mente.
const raccoglitori = [];
for (const dir of CARTELLE) {
  for (const f of sorgenti(path.join(ROOT, dir))) {
    const src = senzaCommenti(fs.readFileSync(f, "utf8"));
    if (!/type="datetime-local"/.test(src)) continue;
    if (!/istanteDaOrarioItaliano|millisecondiDaOrarioItaliano/.test(src)) raccoglitori.push(path.relative(ROOT, f));
  }
}
ok(
  raccoglitori.length === 0,
  raccoglitori.length === 0
    ? "chi raccoglie un orario lo converte da orario italiano, invece di leggerlo nella zona del browser"
    : `raccolgono un orario senza convertirlo:\n     ${raccoglitori.join("\n     ")}`,
);

console.log(falliti === 0 ? "\n✅ Una zona sola, dichiarata, e nessuno che formatti per conto suo.\n" : `\n❌ ${falliti} asserzioni rosse\n`);
process.exit(falliti === 0 ? 0 : 1);
