#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LE SCRITTURE CHE NON AVVENGONO SENZA CHE NESSUNO LO SAPPIA (Mario, 27/10).
// Il censimento sta in CLAUDE.md («Il censimento delle scritture mute»); qui si
// sorvegliano le cure fatte, e la regola della casa sui `catch` che scrivono
// «vuoto» al posto di «non letto».
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();

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
function fileSorgenti(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((v) => {
    const rel = path.join(dir, v.name);
    return v.isDirectory() ? fileSorgenti(rel) : /\.(ts|tsx)$/.test(v.name) ? [rel] : [];
  });
}

console.log("\n§1 — escape/finalizza: prima la copia nuova, poi via le vecchie\n");
{
  const r = leggi("app/api/escape/finalizza/route.ts");
  const corpo = (r.match(/async function sostituisci[\s\S]*?\n  \}\n/) ?? [""])[0];
  const iIns = corpo.search(/\.insert\(riga\)\.select\("id"\)/);
  const iDel = corpo.search(/\.delete\(\)\.eq\("attempt_id"[^)]*\)\.neq\("id", nuova\.id\)/);
  ok(iIns >= 0 && iDel > iIns, "l'inserimento viene prima della cancellazione, e la cancellazione risparmia la riga nuova", { iIns, iDel });
  ok(/if \(erroreInsert \|\| !nuova\)[\s\S]*?return;/.test(corpo), "un inserimento fallito si ferma prima di cancellare (resta la copia di prima)");
  ok((corpo.match(/segnalaGuasto\(/g) ?? []).length === 2, "i due fallimenti lasciano un guasto, non un silenzio");
  ok(!/await supabase\.from\("(journal_entry|portfolio_item)"\)\.(delete|insert)\(/.test(r), "nessuna scrittura su diario o portfolio senza guardarne il risultato");
}

console.log("\n§2 — le iscrizioni d'ufficio dicono quanti sono entrati\n");
{
  const { testoEsitoIscrizione, TESTO_ESITO_NON_LETTO } = require(path.join(ROOT, "lib/scuola/esitoIscrizione.ts"));
  ok(testoEsitoIscrizione(null).testo === TESTO_ESITO_NON_LETTO, "un esito non letto (la funzione di prima, void) non si racconta come un successo");
  const pieno = testoEsitoIscrizione({ iscritti: 18, gia_iscritti: 0, non_verificati: 0, altra_scuola: 0 });
  ok(pieno.testo === "Iscritti adesso: 18." && !pieno.avviso, "tutti dentro: una riga sola, senza avviso", pieno);
  const misto = testoEsitoIscrizione({ iscritti: 14, gia_iscritti: 2, non_verificati: 3, altra_scuola: 1 });
  ok(/Iscritti adesso: 14/.test(misto.testo) && /già iscritti prima: 2/.test(misto.testo) && /non verificati: 3/.test(misto.testo) && /della tua scuola: 1/.test(misto.testo) && misto.avviso,
    "chi resta fuori è contato e nominato col perché, e la riga è un avviso", misto);
  ok(!/\b1 \w+i\b/.test(testoEsitoIscrizione({ iscritti: 1, gia_iscritti: 1, non_verificati: 1, altra_scuola: 1 }).testo),
    "con 1 nessun plurale da accordare («Etichetta: numero»)");
  ok(testoEsitoIscrizione({ gruppo: true }).testo.includes("gruppo"), "una classe a distanza dice che è iscritta come gruppo");
  // Il testo è di Mario: l'atteso è scritto qui, parola per parola.
  ok(testoEsitoIscrizione({ iscritti: 0, gia_iscritti: 20, non_verificati: 0, altra_scuola: 0 }).testo === "Erano già iscritti tutti e 20: nessuna iscrizione nuova.",
    "tutti già iscritti: davanti il fatto rassicurante, non uno zero");
  ok(!/^Iscritti adesso: 0/.test(testoEsitoIscrizione({ iscritti: 0, gia_iscritti: 1, non_verificati: 0, altra_scuola: 0 }).testo),
    "…anche con uno solo");
  ok(/^Iscritti adesso: 0/.test(testoEsitoIscrizione({ iscritti: 0, gia_iscritti: 3, non_verificati: 2, altra_scuola: 0 }).testo),
    "ma se qualcuno è rimasto fuori, lo zero resta e il resto lo spiega");
  for (const f of ["components/scuola/IscriviTuttiVerificatiButton.tsx", "components/scuola/IscriviClasseEventoForm.tsx"]) {
    const c = leggi(f);
    ok(/const \{ data, error \} = await supabase\.rpc\("iscrivi_/.test(c) && /testoEsitoIscrizione\(data\)/.test(c), `${f} legge l'esito della funzione`);
    ok(!/Fatto ✓|Classe iscritta ✓/.test(c), `${f} non dice più «fatto» senza i numeri`);
  }
}

console.log("\n§3 — il tetto giornaliero è detto a chi lo subisce\n");
{
  const { noteTettoGiornaliero } = require(path.join(ROOT, "lib/app/attivita.ts"));
  const riga = { id: "r1", area_slug: "salute", tipo_attivita: "partecipazione_webinar", created_at: "2026-10-20T16:05:00Z" };
  const due = [
    { certificataIl: "2026-10-20T15:00:00Z", tipoEvento: "webinar", aree: ["salute"] },
    { certificataIl: "2026-10-20T17:30:00Z", tipoEvento: "webinar", aree: ["salute", "economia"] },
  ];
  ok(noteTettoGiornaliero([riga], due).get("r1") === 2, "due dirette della stessa area lo stesso giorno: la riga dice 2");
  ok(!noteTettoGiornaliero([riga], due.slice(0, 1)).has("r1"), "una sola: nessuna nota");
  ok(!noteTettoGiornaliero([riga], [due[0], { ...due[1], certificataIl: "2026-10-21T09:00:00Z" }]).has("r1"), "giorni diversi: nessuna nota");
  ok(!noteTettoGiornaliero([riga], [due[0], { ...due[1], aree: ["economia"] }]).has("r1"), "aree diverse: nessuna nota");
  ok(!noteTettoGiornaliero([riga], [due[0], { ...due[1], tipoEvento: "workshop" }]).has("r1"), "un workshop è un altro tipo di attività: non si somma");
  // Il giorno del tetto è quello dell'indice, in UTC: alle 00:30 italiane è ancora il giorno prima.
  ok(noteTettoGiornaliero([{ ...riga, created_at: "2026-10-20T22:30:00Z" }], [due[0], { ...due[1], certificataIl: "2026-10-20T23:10:00Z" }]).get("r1") === 2,
    "il giorno è quello in UTC, come nell'indice activity_log_cap_giornaliero_idx");
  ok(/\{voce\.nota && /.test(leggi("app/app/attivita/page.tsx")), "la pagina mostra la nota sotto la riga");
}

console.log("\n§4 — «non letto» non si scrive come «vuoto»: il cricchetto\n");
{
  // LA REGOLA DELLA CASA (Mario, 27/10): da oggi una lettura che fallisce non
  // si scrive `catch { return []; }`, perché per chi legge la pagina «non
  // letto» diventa «non c'è niente». Le 16 che ci sono si sistemano quando si
  // passa di lì; questo numero può solo scendere.
  const TETTO = 16;
  const letti = ["app", "lib", "components"].flatMap(fileSorgenti);
  let catchTutti = 0;
  const trovati = letti.flatMap((f) => {
    const s = fs.readFileSync(path.join(ROOT, f), "utf8");
    catchTutti += (s.match(/\bcatch\s*(\([^)]*\))?\s*\{/g) ?? []).length;
    return [...s.matchAll(/catch\s*(\([^)]*\))?\s*\{\s*(\/\/[^\n]*\n\s*)*return\s+\[\];?\s*\}/g)].map(() => f);
  });
  // ⚠️ IL PAVIMENTO NON STA SU `trovati` (27/10, Mario): quello è il numero che
  // deve scendere, e un pavimento lì griderebbe contro un miglioramento. Sta su
  // due quantità che una cura non tocca: i file letti, e i `catch` trovati in
  // tutto — curarne uno vuol dire cambiare `return []` in `return null`, e il
  // `catch` resta. Un lettore cieco li fa cadere a zero. Misurati il 27/10: 400
  // file, 137 catch; i pavimenti stanno sotto con margine.
  ok(letti.length >= 300, `il cricchetto legge i sorgenti (${letti.length} file, pavimento 300): a zero sarebbe verde su niente`);
  ok(catchTutti >= 100, `il cricchetto trova i catch che ci sono, buoni e cattivi (${catchTutti}, pavimento 100)`);
  ok(trovati.length <= TETTO, `catch che scrivono «vuoto» al posto di «non letto»: ${trovati.length} (tetto ${TETTO})`,
    trovati.length > TETTO ? "ne è nato uno nuovo: una lettura fallita deve dirlo (null, o un errore), non restituire []" : "");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:scritture)`);
process.exit(falliti === 0 ? 0 : 1);
