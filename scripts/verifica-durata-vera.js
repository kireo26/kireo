#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA DURATA VERA E LE ORE RICONOSCIUTE (Mario, 26/10) — la metà che non si prova
// sulla replica. La metà SQL è `scripts/verifica-durata-vera.sql` (14 proprietà
// contro una replica, transazione con ROLLBACK).
//
// Qui: (1) i due numeri che vivono in due posti (il minimo di 20 minuti) sono lo
// stesso; (2) LE STRADE DELLE ORE — nessun calcolo di ore riconosciute legge
// `eventi.ore_pcto`, e ogni funzione che scrive una partecipazione scrive anche
// le ore; (3) i testi di Mario (conferma, ricevuta, prima dell'inizio) escono
// dalle funzioni che il prodotto chiama, parola per parola.
const { readFileSync, readdirSync, statSync } = require("node:fs");
const { join } = require("node:path");
const esbuild = require("esbuild");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti.js");

const RADICE = join(__dirname, "..");
let fatte = 0;
let falliti = 0;
function ok(cond, cosa, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${cosa}`);
  else {
    falliti++;
    console.log(`  ✗ ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}

// Il modulo VERO, compilato con le sue dipendenze: una frase si prova chiamando
// la funzione che il prodotto chiama, non cercandola nel sorgente.
function carica(rel) {
  const r = esbuild.buildSync({
    entryPoints: [join(RADICE, rel)],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    logLevel: "silent",
    // Gli import `@/…` li risolve il `paths` di tsconfig.json, che esbuild legge.
    absWorkingDir: RADICE,
    tsconfig: join(RADICE, "tsconfig.json"),
  });
  const m = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(m, m.exports, require);
  return m.exports;
}
const leggi = (rel) => readFileSync(join(RADICE, rel), "utf8");

const MIGRAZIONE = "supabase/migrations/20261026100000_durata_vera_ore_riconosciute.sql";
const C = carica("lib/eventi/chiusuraDiretta.ts");
const P = carica("lib/live/presenza.ts");
const E = carica("lib/eventi/exportPresenze.ts");

console.log("\n§1 · il minimo è uno solo");
{
  const m = /function public\.minuti_minimi_certificazione\(\)[\s\S]*?\$\$\s*select\s+(\d+)\s*\$\$/.exec(leggi(MIGRAZIONE));
  ok(m && Number(m[1]) === C.MINUTI_MINIMI_CERTIFICAZIONE, "il minimo di TypeScript è quello del database", m ? `${m[1]} vs ${C.MINUTI_MINIMI_CERTIFICAZIONE}` : "non trovato nella migrazione");
}

console.log("\n§2 · le strade delle ore: nessuna risale a eventi.ore_pcto");
{
  // (a) TypeScript: una lettura delle ore DICHIARATE passando da una
  // partecipazione ha la forma di un embed — `eventi(… ore_pcto …)` dentro una
  // select di un'altra tabella. Le card leggono `eventi` direttamente, ed è
  // giusto: lì le ore sono un annuncio, non un riconoscimento.
  const file = [];
  const giro = (d) => {
    for (const n of readdirSync(join(RADICE, d))) {
      const rel = join(d, n);
      if (statSync(join(RADICE, rel)).isDirectory()) giro(rel);
      else if (/\.(ts|tsx)$/.test(n)) file.push(rel);
    }
  };
  ["app", "lib", "components"].forEach(giro);
  ok(file.length > 100, `l'elenco dei file si è letto (${file.length})`, "sotto cento l'estrattore non sta leggendo");
  const embed = file.filter((f) => /eventi\s*\([^)]*\bore_pcto\b/.test(senzaCommenti(leggi(f))));
  ok(embed.length === 0, "nessun file legge le ore dichiarate attraverso una partecipazione", embed.join(", "));
  ok(/select\("ore_riconosciute"\)/.test(senzaCommenti(leggi("lib/app/eventi.ts"))), "il contatore dello studente somma le ore emesse");
  ok(/ore_riconosciute/.test(senzaCommenti(leggi("lib/scuola/studenteDettaglio.ts"))), "la scheda dello studente legge le ore emesse");

  // (b) SQL: l'ULTIMA definizione di ogni funzione e vista conta.
  const ultime = new Map();
  for (const f of readdirSync(join(RADICE, "supabase/migrations")).sort()) {
    const s = senzaCommentiSql(leggi(join("supabase/migrations", f)));
    const re = /create\s+(?:or\s+replace\s+)?(function|view)\s+public\.(\w+)[\s\S]*?(?=\bcreate\s+(?:or\s+replace\s+)?(?:function|view)\s+public\.|$)/gi;
    let m;
    while ((m = re.exec(s))) ultime.set(m[2], m[0]);
  }
  ok(ultime.size > 80, `le definizioni si sono lette (${ultime.size})`, "sotto ottanta l'estrattore non sta leggendo");
  for (const nome of ["stats_scuola", "esporta_presenze_admin", "esporta_presenze_scuola"]) {
    const d = ultime.get(nome) ?? "";
    ok(d.includes("ore_riconosciute") && !/\bore_pcto\b/.test(d.replace(/as ore_pcto_totali/g, "")), `${nome}: legge le ore emesse e mai quelle dichiarate`);
  }
  // Chi scrive una partecipazione scrive anche le ore: l'insieme è DERIVATO.
  const scrittori = [...ultime].filter(([, d]) => /set\s+stato\s*=\s*'partecipato'|values\s*\([^)]*'partecipato'/i.test(d));
  ok(scrittori.length >= 3, `chi scrive una partecipazione si è trovato (${scrittori.map(([n]) => n).join(", ")})`, "sotto tre l'estrattore non sta leggendo");
  for (const [nome, d] of scrittori) ok(d.includes("ore_riconosciute"), `${nome} scrive anche le ore riconosciute`);
}

console.log("\n§3 · la chiusura e i suoi testi");
{
  const inizio = "2026-10-25T08:00:00Z";
  const fine = "2026-10-25T08:45:00Z";
  const a = (min) => new Date(new Date(inizio).getTime() + min * 60000 + 30000);
  ok(C.durataSeChiusaAdesso(inizio, fine, a(28)) === 28, "a 28 minuti e mezzo la durata è 28 (troncata, come nel database)");
  ok(C.durataSeChiusaAdesso(inizio, fine, a(90)) === 45, "dopo la fine la durata è quella programmata, mai di più");
  ok(
    C.testoConfermaChiusura(inizio, fine, a(28)) ===
      "Chiudendo adesso, l'incontro risulterà durato 28 minuti. La soglia sarà calcolata su quelli, e le ore riconosciute non potranno superarli. Non si torna indietro.",
    "la conferma porta il numero (testo di Mario)",
  );
  ok(
    C.testoConfermaChiusura(inizio, fine, a(16)) ===
      "Chiudendo adesso l'incontro risulterà durato 16 minuti: sotto il minimo di 20, non certificherà ore a nessuno.",
    "sotto il minimo la conferma lo dice prima del clic (testo di Mario)",
  );
  ok(!C.chiusuraDisponibile("prima", fine), "prima dell'inizio non si chiude");
  ok(C.chiusuraDisponibile("viva", fine), "durante la diretta si chiude");
  ok(C.chiusuraDisponibile("finita_non_chiusa", fine), "dopo la fine si chiude ancora");
  ok(!C.chiusuraDisponibile("viva", null), "senza una fine non si chiude");
  const riga = (durata, certificati) =>
    C.testoStatoChiusura({ tipo: "chiusa", quando: "2026-10-25T08:35:00Z", daTipo: "ente", ricevuta: { presenti: 1, certificati, durataMinuti: durata } });
  ok(/^Diretta chiusa il .+, dall'organizzatore\. Durata: 20 minuti\. Presenti: 1\. Certificazioni automatiche: 1\.$/.test(riga(20, 1)), "la ricevuta porta la durata, prima dei presenti", riga(20, 1));
  ok(/Durata: 16 minuti\. Sotto i 20 minuti minimi, l'incontro non certifica ore\./.test(riga(16, 0)), "sotto il minimo la ricevuta dice perché, invece di «nessuno ha raggiunto la soglia»", riga(16, 0));
  ok(!/soglia di presenza/.test(riga(16, 0)), "…e non accusa gli studenti");
  ok(/Durata: 1 minuto\./.test(riga(1, 0)), "un minuto al singolare");
  ok(C.statoChiusura({ chiusaIl: "x", chiusaDaTipo: "ente", presenti: 1, certificati: 1, durata: null }).ricevuta === null, "senza la durata la ricevuta degrada verso il dire meno");
}

console.log("\n§4 · lo studente");
{
  ok(P.esitoBattito(200, { ok: false, motivo: "diretta_chiusa" }) === "chiusa", "un battito respinto per chiusura è «chiusa», non «rifiutato»");
  ok(P.esitoBattito(200, { ok: false, motivo: "evento_non_in_corso" }) === "rifiutato", "gli altri rifiuti restano rifiuti");
  ok(P.TESTO_VIDEO_PRIMA_DELL_INIZIO === "La diretta non è ancora cominciata: il video si attiva all'orario di inizio.", "il testo prima dell'inizio è quello di Mario, parola per parola");
  ok(!/riprodur|incorpor|errore|non va/i.test(P.TESTO_VIDEO_PRIMA_DELL_INIZIO), "…e non nomina nessun guasto");
  const pannello = senzaCommenti(leggi("components/live/PannelloLive.tsx"));
  ok(/battito === "chiusa"/.test(pannello) && /testoChiusuraStudente\(/.test(pannello), "la pagina dice com'è andata quando la diretta viene chiusa");
  ok(/from\("iscrizioni_eventi"\)\.select\("stato, ore_riconosciute"\)/.test(pannello) && /diretta_durata_minuti/.test(pannello), "…leggendo l'esito vero: la propria iscrizione e la durata scritta dalla chiusura");
  ok(/clearInterval\(intervallo\)/.test(senzaCommenti(leggi("lib/useHeartbeatDiretta.ts"))) && /e === "chiusa"/.test(senzaCommenti(leggi("lib/useHeartbeatDiretta.ts"))), "e smette di battere");
}

console.log("\n§4bis · i testi della chiusura per lo studente (Mario, 26/10)");
{
  const A = "L'incontro è stato chiuso da chi l'ha organizzato.";
  const t = (o) => P.testoChiusuraStudente({ durata: 40, stato: "iscritto", ore: null, contati: 14, pubblico: "studenti", ...o });
  ok(t({ stato: "partecipato", ore: 0.5, contati: 28 }) === `${A} Hai seguito 28 minuti: le ore ti vengono riconosciute.`, "certificato", t({ stato: "partecipato", ore: 0.5, contati: 28 }));
  // soglia sulla durata VERA: 20 minuti → ne servono 15.
  ok(t({ durata: 20, contati: 14 }) === `${A} Hai seguito 14 minuti: ne servivano 15.`, "sotto la soglia, calcolata sulla durata vera", t({ durata: 20, contati: 14 }));
  const corto = t({ durata: 16, contati: 16 });
  ok(corto === "L'incontro è stato chiuso da chi l'ha organizzato dopo 16 minuti. Un incontro più corto di 20 minuti non riconosce ore: non dipende da te.", "sotto i 20 minuti", corto);
  ok(/non dipende da te/.test(t({ durata: 3, stato: "partecipato", ore: 0, contati: 3 })), "…anche a chi risulterebbe certificato: il minimo viene prima");
  ok(t({ stato: null }) === `${A} La tua presenza si è fermata a 14 minuti.`, "esito non leggibile: la forma corta");
  ok(t({ durata: null, contati: null }) === A, "…e senza un numero letto, nessun numero");
  ok(t({ durata: 40, contati: 35 }) === `${A} La tua presenza si è fermata a 35 minuti.`, "minuti sopra la soglia ma riga non certificata: non si dice «ne servivano»");
  ok(!/ore ti vengono riconosciute/.test(t({ stato: "partecipato", ore: 0, contati: 30 })), "certificato con 0 ore: non promette ore");
  ok(!/ore ti vengono riconosciute/.test(t({ stato: "partecipato", ore: 1, contati: 30, pubblico: "docenti" })), "un docente non riceve ore");
  ok(t({ contati: 1, durata: 1 }).includes("dopo 1 minuto"), "un minuto al singolare");
  ok(C.TESTO_CHIUSURA_PRIMA_DELL_INIZIO === "Questo incontro non è ancora cominciato: si può chiudere solo a diretta iniziata.", "l'errore prima dell'inizio è quello di Mario");
  ok(/TESTO_CHIUSURA_PRIMA_DELL_INIZIO/.test(senzaCommenti(leggi("components/ente/ControlloDirettaEvento.tsx"))), "…e la console lo usa");
}

console.log("\n§4quater · lo storico dice com'è andata, al passato (26/10)");
{
  const t = (o) =>
    P.testoEsitoStorico({ diretta: true, finito: true, chiuso: true, durata: 20, stato: "iscritto", ore: null, contati: 14, pubblico: "studenti", ...o });
  ok(t({}) === "Hai seguito 14 minuti: ne servivano 15.", "sotto la soglia: la frase di Mario, al passato", t({}));
  ok(t({ stato: "partecipato", ore: 0.4, contati: 18 }) === "Hai seguito 18 minuti: le ore sono riconosciute.", "certificato con ore", t({ stato: "partecipato", ore: 0.4, contati: 18 }));
  ok(/presenza riconosciuta/.test(t({ stato: "partecipato", ore: 0, contati: 18 })), "certificato senza ore: non promette ore");
  ok(/non dipende da te/.test(t({ durata: 16, contati: 16 })), "incontro sotto i 20 minuti: non dipende da te");
  ok(t({ finito: false }) === null, "un incontro non ancora finito non ha esito");
  ok(/non l'ha ancora chiuso/.test(t({ chiuso: false }) ?? ""), "finito e non chiuso: lo dice invece di tacere (le ore sospese)");
  ok(t({ contati: null }) === null, "senza i minuti letti, nessun numero");
  ok(t({ durata: 40, contati: 35 }) === "Hai seguito 35 minuti.", "sopra la soglia e non certificato: non dice «ne servivano»");
  ok(t({ diretta: false, stato: "partecipato" }) === "Presenza certificata.", "un incontro in presenza certificato dalla scuola");
  ok(t({ diretta: false, stato: "iscritto" }) === null, "…e non certificato: niente");
  // UNA classificazione per le due voci: lo stesso caso deve finire nello
  // stesso ramo alla chiusura e nello storico.
  const casi = [
    { durata: 20, stato: "iscritto", ore: null, contati: 14 },
    { durata: 40, stato: "partecipato", ore: 0.5, contati: 30 },
    { durata: 12, stato: "iscritto", ore: null, contati: 12 },
    { durata: 40, stato: "iscritto", ore: null, contati: 35 },
  ];
  for (const c of casi) {
    const e = { ...c, pubblico: "studenti" };
    const tipo = P.classificaEsito(e).tipo;
    const chiusura = P.testoChiusuraStudente(e);
    const storico = P.testoEsitoStorico({ ...e, diretta: true, finito: true, chiuso: true });
    const firma = { sotto_soglia: /ne servivano/, certificato: /riconosciut/, corto: /non dipende da te/, incerto: /minuti/ }[tipo];
    ok(firma.test(chiusura) && firma.test(storico ?? ""), `stesso esito (${tipo}) alla chiusura e nello storico`, `${chiusura} | ${storico}`);
  }
  const att = senzaCommenti(leggi("lib/app/attivita.ts"));
  ok(/testoEsitoStorico\(/.test(att), "lo storico chiama la funzione");
  ok(!/ne servivano|SOGLIA_PRESENZA|MINUTI_MINIMI/.test(att), "…e non si riscrive la regola");
  ok(/fineEffettiva\(/.test(att), "…e «finito» è la fine effettiva, non la programmata");
  ok(/voce\.esito/.test(senzaCommenti(leggi("app/app/attivita/page.tsx"))), "la pagina rende l'esito");
  ok(!/\{voce\.oreCertificate\}h/.test(leggi("app/app/attivita/page.tsx")), "le ore dello storico non escono grezze (col punto)");
}

console.log("\n§4quinquies · una diretta di diciotto ore non passa in silenzio (26/10)");
{
  const D = carica("lib/eventi/durataDiretta.ts");
  const h = (n) => n * 3_600_000;
  ok(D.avvisoDurataDiretta(0, h(18)) !== null && /18 ore/.test(D.avvisoDurataDiretta(0, h(18))), "diciotto ore: si fa confermare, e il numero è in ore", D.avvisoDurataDiretta(0, h(18)));
  ok(D.avvisoDurataDiretta(0, h(1)) === null && D.avvisoDurataDiretta(0, h(D.ORE_DIRETTA_DA_CONFERMARE)) === null, "un'ora, e la soglia stessa: niente");
  ok(D.avvisoDurataDiretta(null, h(18)) === null && D.avvisoDurataDiretta(NaN, h(18)) === null, "senza le due date, niente");
  for (const f of ["components/ente/CreaEventoForm.tsx", "components/ente/SpostaFinestraForm.tsx"]) {
    const src = senzaCommenti(leggi(f));
    ok(/avvisoDurataDiretta\(/.test(src) && /!confermaDurata/.test(src) && /setConfermaDurata\(false\)/.test(src), `${f}: chiede la conferma, la blocca senza, e la azzera se cambiano le date`);
  }
  ok(/next\.dataFine = avvisoDurata/.test(senzaCommenti(leggi("components/ente/CreaEventoForm.tsx"))), "nel form di creazione il no sta sul campo della fine");
  // Il numero dei minuti necessari in ore, sopra l'ora.
  ok(P.neServono(15, "presente") === "ne servono 15" && P.neServono(1, "presente") === "ne serve 1", "sotto l'ora la forma di Mario resta");
  ok(P.neServono(1103, "presente") === "ne servono 18 ore e 23 minuti", "1103 si scrive in ore", P.neServono(1103, "presente"));
  ok(P.neServono(60, "passato") === "ne serviva 1 ora", "un'ora al singolare, anche il verbo");
}

console.log("\n§4ter · la certificazione della scuola non ha tetto né minimo, e la scuola non legge un avviso che lo dice");
{
  // Decisione di Mario, 25/10: il tetto della durata vera e il minimo dei 20
  // minuti sono regole su ciò che misuriamo NOI; nella certificazione manuale
  // KIREO è il registro, non il testimone. La prova di comportamento è
  // scripts/verifica-certificazione-manuale.sql (due proprietà separate:
  // automatica con tetto, manuale senza). Qui si sorveglia che il testo che lo
  // negava non torni.
  ok(typeof C.avvisoCertificazioneSenzaOre === "undefined", "l'avviso «non riconosce ore» non esiste più (sarebbe falso)");
  const reg = senzaCommenti(leggi("components/scuola/RegistroPresenzeEvento.tsx"));
  ok(!/non riconosce ore|non si certificano ore/.test(reg), "il registro della scuola non dice che le ore non ci saranno");
  // L'ULTIMA definizione viva di certifica_presenza non passa dal tetto.
  const fs = require("node:fs");
  const dir = "supabase/migrations";
  const conCert = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .filter((f) => /create or replace function public\.certifica_presenza\(/.test(fs.readFileSync(`${dir}/${f}`, "utf8")));
  const ultima = conCert[conCert.length - 1];
  const corpo = senzaCommentiSql(fs.readFileSync(`${dir}/${ultima}`, "utf8").split(/create or replace function public\.certifica_presenza\(/)[1].split(/\$\$;/)[0]);
  ok(conCert.length >= 2, "l'estrattore trova le definizioni di certifica_presenza", conCert.join(", "));
  ok(!/ore_riconoscibili_evento/.test(corpo), `l'ultima definizione (${ultima}) non applica il tetto dell'automatica`);
  ok(/coalesce\(e\.ore_pcto, 0\)/.test(corpo), "…e riconosce le ore dichiarate per l'evento");
  // …mentre la chiusura automatica le passa ancora di lì.
  const chiusure = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .filter((f) => /create function public\.chiudi_diretta_evento\(/.test(fs.readFileSync(`${dir}/${f}`, "utf8")));
  const ultimaC = fs.readFileSync(`${dir}/${chiusure[chiusure.length - 1]}`, "utf8").split(/create function public\.chiudi_diretta_evento\(/)[1].split(/\$\$;/)[0];
  ok(/ore_riconoscibili_evento/.test(senzaCommentiSql(ultimaC)), "la chiusura automatica il tetto lo applica ancora");
}

console.log("\n§5 · il CSV dice le ore");
{
  ok(E.oreRiconosciutePerExport({ stato_finale: "partecipato", ore_riconosciute: 0.47 }, true) === "0.47", "certificato: le ore emesse, col punto come gli altri decimali del file (25/10 pomeriggio)");
  ok(E.oreRiconosciutePerExport({ stato_finale: "iscritto", ore_riconosciute: null }, true) === "0.00", "non certificato su una diretta chiusa: zero, che è un fatto — a due cifre");
  ok(E.oreRiconosciutePerExport({ stato_finale: "iscritto", ore_riconosciute: null }, false) === "", "diretta non ancora chiusa: vuoto, perché non è ancora deciso");
  for (const r of ["app/api/admin/presenze/[id]/route.ts", "app/api/scuola/presenze/[id]/route.ts"]) {
    const s = senzaCommenti(leggi(r));
    ok(/INTESTAZIONE_ORE_RICONOSCIUTE/.test(s) && /oreRiconosciutePerExport\(r,/.test(s), `${r}: colonna e valore`);
  }
}

console.log(`\n${falliti ? "✗" : "✓"} ${fatte - falliti}/${fatte} proprietà (npm run test:durata)`);
process.exit(falliti ? 1 : 0);
