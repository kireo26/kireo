#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA PAGINA EVENTI DELL'ENTE (Mario, 27/10): tre voci sotto «Eventi», un
// elenco che dice cosa c'è e quando, e la plancia nella pagina dell'evento.
//
// Le funzioni pure si CHIAMANO (la divisione, l'ordine, le frasi); i file si
// leggono solo per le proprietà di posto — dove sta la console, dove porta
// «Apri» — che sono quelle che la richiesta decide.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();
const E = require("@/lib/ente/eventiEnte");

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? `\n      → ${typeof dettaglio === "string" ? dettaglio : JSON.stringify(dettaglio)}` : ""}`);
  }
}
const leggi = (f) => senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));

const ORA = new Date("2026-10-27T10:00:00Z");
const ev = (id, o) => ({
  id, titolo: id, tipo: "webinar", data_inizio: "2026-11-01T10:00:00Z", data_fine: "2026-11-01T11:00:00Z",
  stato: "approvato", pubblico: "studenti", filone: null, diretta_chiusa_il: null, diretta_chiusa_presenti: null, ...o,
});

console.log("\n§1 — in programmazione (per gruppi), i rifiutati, i passati\n");
{
  const eventi = [
    ev("lontano", { data_inizio: "2026-12-10T10:00:00Z", data_fine: "2026-12-10T11:00:00Z" }),
    ev("vicino_rev", { data_inizio: "2026-10-28T10:00:00Z", data_fine: "2026-10-28T11:00:00Z", stato: "in_approvazione" }),
    ev("in_corso", { data_inizio: "2026-10-27T09:30:00Z", data_fine: "2026-10-27T10:30:00Z" }),
    ev("bozza", { data_inizio: "2026-11-05T10:00:00Z", data_fine: "2026-11-05T11:00:00Z", stato: "bozza" }),
    ev("rifiutato_futuro", { data_inizio: "2026-11-02T10:00:00Z", data_fine: "2026-11-02T11:00:00Z", stato: "rifiutato" }),
    ev("rifiutato_passato", { data_inizio: "2026-09-02T10:00:00Z", data_fine: "2026-09-02T11:00:00Z", stato: "rifiutato" }),
    ev("chiusa_in_anticipo", { data_inizio: "2026-10-27T09:00:00Z", data_fine: "2026-10-27T11:00:00Z", diretta_chiusa_il: "2026-10-27T09:50:00Z", diretta_chiusa_presenti: 3 }),
    ev("ieri", { data_inizio: "2026-10-26T10:00:00Z", data_fine: "2026-10-26T11:00:00Z" }),
    ev("mese_scorso", { data_inizio: "2026-09-26T10:00:00Z", data_fine: "2026-09-26T11:00:00Z" }),
  ];
  const { inProgrammazione, rifiutati, passati } = E.dividiEventiEnte(eventi, ORA);
  const forma = inProgrammazione.map((g) => `${g.titolo}: ${g.eventi.map((e) => e.id).join(",")}`);
  // L'atteso è scritto a mano: gruppi, intestazioni e ordine.
  ok(
    JSON.stringify(forma) === JSON.stringify(["Approvati: in_corso,lontano", "In attesa di revisione: vicino_rev", "Bozze: bozza"]),
    "in programmazione: un gruppo per stato, con la sua intestazione, i più vicini in cima — uno in corso è ancora qui",
    forma,
  );
  const dentro = inProgrammazione.flatMap((g) => g.eventi);
  ok(!dentro.some((e) => e.stato === "rifiutato"), "nessun rifiutato sotto «In programmazione»: il titolo è un'affermazione su tutto quello che contiene");
  ok(rifiutati.map((e) => e.id).join(",") === "rifiutato_passato,rifiutato_futuro", "i rifiutati hanno un gruppo loro, di qualunque data", rifiutati.map((e) => e.id));
  ok(passati.map((e) => e.id).join(",") === "chiusa_in_anticipo,ieri,mese_scorso", "passati: dal più recente; una diretta chiusa prima della fine è passata; un rifiutato non è «passato»", passati.map((e) => e.id));
  ok(dentro.length + rifiutati.length + passati.length === eventi.length, "nessun evento sparisce fra le tre liste");
  const ignoto = E.dividiEventiEnte([ev("strano", { stato: "sospeso" })], ORA).inProgrammazione;
  ok(ignoto.length === 1 && ignoto[0].eventi.length === 1, "uno stato che i gruppi non conoscono non sparisce: ha un gruppo suo");
  const pagina = leggi("app/ente/(dashboard)/eventi/page.tsx");
  ok(/rifiutati\.map\(/.test(pagina) && />Rifiutati</.test(pagina) && /g\.titolo/.test(pagina), "la pagina rende i gruppi con le loro intestazioni, e i rifiutati con la loro");
}

console.log("\n§2 — la coda della revisione\n");
{
  const due = [ev("a", { stato: "in_approvazione" }), ev("b", { stato: "in_approvazione" }), ev("c")];
  ok(E.testoCodaRevisione(due) === "2 di 4 in attesa di revisione", "«2 di 4 in attesa di revisione»", E.testoCodaRevisione(due));
  ok(E.MAX_EVENTI_IN_REVISIONE === 4, "il massimo è 4, come il trigger del database");
  const trigger = fs.readFileSync(path.join(ROOT, "supabase/migrations/20260722100000_piani_promozione_eventi.sql"), "utf8");
  ok(new RegExp(`v_conteggio >= ${E.MAX_EVENTI_IN_REVISIONE} then`).test(trigger), "…e la copia del database dice lo stesso numero (se cambia una, cambia l'altra)");
  ok(!/const MAX_EVENTI_IN_REVISIONE = /.test(leggi("components/ente/CreaEventoForm.tsx")), "il form non ha più una sua copia del numero");
}

console.log("\n§3 — area e com'è andata\n");
{
  ok(E.areaEventoEnte(ev("x"), ["informatica-digitale"]) !== null, "l'area dell'evento si nomina");
  ok(E.areaEventoEnte(ev("x"), []) === null, "senza aree: niente, non un trattino inventato");
  ok(E.areaEventoEnte(ev("x", { pubblico: "docenti", filone: "inesistente" }), ["informatica-digitale"]) === null, "per i docenti conta il filone, non le aree");
  ok(E.esitoEventoPassato(ev("x", { diretta_chiusa_il: "2026-10-26T11:00:00Z", diretta_chiusa_presenti: 12 }), null) === "Chiusa · 12 presenti", "una diretta chiusa: quanti presenti");
  ok(E.esitoEventoPassato(ev("x", { diretta_chiusa_il: "2026-10-26T11:00:00Z", diretta_chiusa_presenti: 1 }), null) === "Chiusa · 1 presente", "…al singolare");
  ok(/^Non chiusa/.test(E.esitoEventoPassato(ev("x"), null)), "una diretta non chiusa lo dice");
  ok(E.esitoEventoPassato(ev("x", { stato: "rifiutato" }), null) === null, "un evento mai approvato non ha un «com'è andata»");
  ok(E.esitoEventoPassato(ev("x", { tipo: "altro", pubblico: "docenti" }), 3) === "3 presenze certificate", "un incontro ai docenti: le presenze del registro");
  ok(!/0 presenze/.test(E.esitoEventoPassato(ev("x", { tipo: "altro", pubblico: "docenti" }), null)), "…e un conto non letto non diventa «0 presenze»");
  ok(/scuola/.test(E.esitoEventoPassato(ev("x", { tipo: "altro" }), null)), "un incontro in presenza per studenti: le presenze le registra la scuola");
  const esiti = [
    E.esitoEventoPassato(ev("x"), null),
    E.esitoEventoPassato(ev("x", { diretta_chiusa_il: "2026-10-26T11:00:00Z", diretta_chiusa_presenti: 2 }), null),
    E.esitoEventoPassato(ev("x", { tipo: "altro", pubblico: "docenti" }), 2),
    E.esitoEventoPassato(ev("x", { tipo: "altro" }), null),
  ].join(" ");
  ok(!/\bore\b/i.test(esiti), "nei passati nessuna etichetta delle ore", esiti);
}

console.log("\n§4 — le tre voci, e dove sta la plancia\n");
{
  const schede = leggi("components/ente/SchedeEventi.tsx");
  for (const [href, label] of [["/ente/eventi", "In programmazione"], ["/ente/eventi/passati", "Eventi passati"], ["/ente/eventi/nuovo", "Crea evento"]]) {
    ok(schede.includes(`href: "${href}", label: "${label}"`), `la voce «${label}» porta a ${href}`);
    const file = href === "/ente/eventi" ? "app/ente/(dashboard)/eventi/page.tsx" : `app/ente/(dashboard)/eventi/${href.split("/").pop()}/page.tsx`;
    ok(fs.existsSync(path.join(ROOT, file)), `…e la pagina esiste (${file})`);
  }
  ok(leggi("app/ente/(dashboard)/eventi/layout.tsx").includes("<SchedeEventi"), "le schede stanno nel layout della sezione: ci sono in tutte e tre");
  const riga = leggi("components/ente/RigaEventoEnte.tsx");
  ok(riga.includes("href={`/diretta/${evento.id}`}") && />\s*Apri\s*</.test(riga), "ogni riga ha «Apri», verso la pagina dell'evento");
  // La lista non è la plancia: nessuna delle due liste monta i pezzi che
  // facevano «molto confusionaria» la pagina di prima.
  const PLANCIA = ["ControlloDirettaEvento", "ReportEventoButton", "ChiaveTrasmissione", "RegistroPresenzeDocenti", "MettiInEvidenzaButton", "CreaEventoForm"];
  for (const f of ["app/ente/(dashboard)/eventi/page.tsx", "app/ente/(dashboard)/eventi/passati/page.tsx", "components/ente/RigaEventoEnte.tsx"]) {
    const src = leggi(f);
    const dentro = PLANCIA.filter((c) => new RegExp(`<${c}\\b`).test(src));
    ok(dentro.length === 0, `${f}: nessun pezzo della plancia nella lista`, dentro);
  }
  ok(/<CreaEventoForm\b/.test(leggi("app/ente/(dashboard)/eventi/nuovo/page.tsx")), "la creazione sta sotto «Crea evento»");
  ok(leggi("components/ente/RispondiPropostaForm.tsx").includes("/ente/eventi/nuovo?proposta="), "«Crea l'evento collegato» porta alla creazione, con la proposta");
  const diretta = leggi("app/diretta/[id]/page.tsx");
  ok(/parte === "ente" && <PlanciaEnteEvento/.test(diretta), "la pagina dell'evento monta la plancia dell'ente");
  const plancia = leggi("components/ente/PlanciaEnteEvento.tsx");
  for (const c of ["MettiInEvidenzaButton", "RegistroPresenzeDocenti", "ChiaveTrasmissione"]) ok(new RegExp(`<${c}\\b`).test(plancia), `…con ${c}`);
  ok(/statoChiaveTrasmissione\(/.test(plancia) && /console\.error\("\[ente\/eventi\] chiavi_trasmissione:/.test(plancia), "la chiave la chiede alla funzione, e una lettura fallita si logga");
  // ⚠️ Ancorata al MONTAGGIO della console, non alla condizione: la stessa
  // condizione sta anche sul form del video dell'admin, e la prima stesura
  // restava verde con la console per tutti (il modo 6, trovato dalla controprova).
  ok(/evento\.tipo === "webinar" && \(\s*<>\s*<section[^>]*>\s*<ControlloDirettaEvento/.test(diretta), "la console e il report solo per una diretta: un incontro in presenza non ha «presenti ora»");
}

console.log("");
// Dopo «Crea» il modulo torna e la conferma dice dove guardare (Mario, 30/10:
// «una frase che indica un posto vuoto fa dubitare di una cosa andata bene»).
{
  const form = require("fs").readFileSync(require("path").join(ROOT, "components/ente/CreaEventoForm.tsx"), "utf8");
  const pagina = require("fs").readFileSync(require("path").join(ROOT, "app/ente/(dashboard)/eventi/nuovo/page.tsx"), "utf8");
  const riga = require("fs").readFileSync(require("path").join(ROOT, "components/ente/RigaEventoEnte.tsx"), "utf8");
  const E = require("@/lib/ente/eventiEnte");
  ok(!/if \(inviato\)/.test(form) && !/setInviato/.test(form), "il form dell'evento non si sostituisce più con una conferma");
  ok(/router\.replace\(`\/ente\/eventi\/nuovo\?creato=\$\{evento\.id\}`/.test(form), "dopo la creazione la pagina va all'evento letto dall'insert");
  ok(/key=\{`nuovo-\$\{creatoRiletto\?\.id/.test(pagina) && /\.eq\("organizzatore_id", contesto\.istituzioneId\)\s*\.maybeSingle\(\)/.test(pagina) && /creatoRiletto && \(/.test(pagina),
    "la pagina rilegge l'evento creato, mostra la conferma solo se c'è, e rimonta il modulo vuoto");
  ok(!/qui sotto/.test(E.TESTI_EVENTO_CREATO.dettaglio) && /In programmazione/.test(E.TESTI_EVENTO_CREATO.dettaglio), "la conferma non indica un posto vuoto: nomina «In programmazione»");
  ok(/href=\{`\/ente\/eventi#evento-\$\{creatoRiletto\.id\}`\}/.test(pagina) && /id=\{`evento-\$\{evento\.id\}`\}/.test(riga), "e ci porta, sulla riga dell'evento");
}

console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:eventiente)`);
process.exit(falliti === 0 ? 0 : 1);
