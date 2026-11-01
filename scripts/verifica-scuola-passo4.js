#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:scuolapasso4` — i difetti piccoli del capitolo della scuola
// (01/11, passo 4):
//   §1 le ore certificate non lette sono null, mai zero, e lo si dice
//   §2 la home della scuola: eventi distinti e prossimi davvero (attesi a mano)
//   §3 un numero non letto della home non si scrive come zero
//   §4 chi ha certificato si dice sempre, anche l'ente
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");

abilitaTypeScript();
const { getOrePctoDaEventi } = require("@/lib/app/eventi");
const { TESTO_ORE_NON_LETTE } = require("@/lib/app/pcto");
const { riepilogoIscrizioniClassi, PROSSIME_ISCRIZIONI_MASSIMO } = require("@/lib/scuola/home");
const { etichettaCertificatore } = require("@/lib/scuola/certificatore");

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}${dettaglio ? ` — ${dettaglio}` : ""}`);
  }
}
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// Un client finto che risponde con quello che gli si dà.
function clientFinto(risposta) {
  const q = {
    select: () => q,
    eq: () => q,
    then: (res, rej) => Promise.resolve(risposta).then(res, rej),
  };
  return { from: () => q };
}

(async () => {
  console.log("\n§1 — le ore non lette\n");
  const silenzio = console.error;
  console.error = () => {};
  const nonLette = await getOrePctoDaEventi(clientFinto({ data: null, error: { message: "boom" } }), "u");
  console.error = silenzio;
  ok(nonLette === null, "una lettura fallita dà null, non 0", String(nonLette));
  const lette = await getOrePctoDaEventi(clientFinto({ data: [{ ore_riconosciute: "0.40" }, { ore_riconosciute: 1 }], error: null }), "u");
  ok(Math.abs(lette - 1.4) < 1e-9, "una lettura riuscita somma le ore", String(lette));
  const vuote = await getOrePctoDaEventi(clientFinto({ data: [], error: null }), "u");
  ok(vuote === 0, "nessuna presenza certificata è zero, ed è vero", String(vuote));
  ok(/le ore non sono perse/i.test(TESTO_ORE_NON_LETTE), "il testo del non letto dice che le ore non sono perse");
  for (const rel of ["components/app/ContatorePCTO.tsx", "app/app/attivita/page.tsx"]) {
    const src = leggi(rel);
    ok(/oreCertificate === null/.test(src) && src.includes("TESTO_ORE_NON_LETTE"), `${rel} dice il non letto invece di uno zero`);
  }

  console.log("\n§2 — la home della scuola\n");
  const ora = new Date("2026-11-10T10:00:00Z");
  const ev = (titolo, inizio, fine, chiusa = null) => ({ titolo, data_inizio: inizio, data_fine: fine, diretta_chiusa_il: chiusa });
  const righe = [
    { evento_id: "A", evento: ev("A", "2026-11-12T09:00:00Z", "2026-11-12T10:00:00Z"), classe: "5A" },
    { evento_id: "A", evento: ev("A", "2026-11-12T09:00:00Z", "2026-11-12T10:00:00Z"), classe: "5B" },
    { evento_id: "P", evento: ev("P", "2026-11-01T09:00:00Z", "2026-11-01T10:00:00Z"), classe: "5A" },
    // cominciata, fine programmata nel futuro, ma chiusa prima di adesso: è passata
    { evento_id: "C", evento: ev("C", "2026-11-10T09:00:00Z", "2026-11-10T12:00:00Z", "2026-11-10T09:30:00Z"), classe: "4A" },
    { evento_id: "B", evento: ev("B", "2026-11-11T09:00:00Z", "2026-11-11T10:00:00Z"), classe: "4A" },
    { evento_id: "D", evento: ev("D", "2026-11-20T09:00:00Z", "2026-11-20T10:00:00Z"), classe: "4A" },
    { evento_id: "E", evento: ev("E", "2026-11-21T09:00:00Z", "2026-11-21T10:00:00Z"), classe: "4A" },
    { evento_id: "F", evento: ev("F", "2026-11-22T09:00:00Z", "2026-11-22T10:00:00Z"), classe: "4A" },
    { evento_id: "X", evento: null, classe: "4A" },
  ];
  const r = riepilogoIscrizioniClassi(righe, ora);
  ok(r.eventiInProgramma === 5, "si contano gli EVENTI distinti in programma (A, B, D, E, F), non le righe", String(r.eventiInProgramma));
  const titoli = r.prossime.map((p) => `${p.titolo}/${p.classe}`).join(" ");
  ok(titoli === "B/4A A/5A A/5B D/4A E/4A", "le prossime, in ordine di data, senza i passati e il chiuso prima", titoli);
  ok(PROSSIME_ISCRIZIONI_MASSIMO === 5 && r.prossime.length === 5, "al più cinque");
  const molte = Array.from({ length: 8 }, (_, i) => ({
    evento_id: `M${i}`,
    evento: ev(`M${i}`, `2026-12-0${i + 1}T09:00:00Z`, `2026-12-0${i + 1}T10:00:00Z`),
    classe: "3A",
  }));
  ok(riepilogoIscrizioniClassi(molte, ora).eventiInProgramma === 8, "il conto non ha il tetto dell'elenco: otto eventi sono otto");

  console.log("\n§3 — la pagina\n");
  const home = leggi("app/scuola/(dashboard)/page.tsx");
  ok(!/\.limit\(/.test(home), "la lettura delle iscrizioni non ha un limite che il conto erediterebbe");
  ok(!/\?\?\s*0\b/.test(home), "nessun «?? 0» nella home: un numero non letto non diventa zero");
  ok(/riepilogoIscrizioniClassi\(/.test(home), "il numero e l'elenco vengono dalla stessa funzione");
  ok((home.match(/<Numero valore=/g) || []).length >= 4, "i quattro numeri passano da Numero, che dice il non letto");
  ok(/riepilogo === null/.test(home), "le iscrizioni non lette lo dicono");

  console.log("\n§4 — chi ha certificato\n");
  ok(etichettaCertificatore("ente") === "Certificato dall'ente che ha organizzato l'incontro", "l'ente ha la sua etichetta");
  ok(etichettaCertificatore("scuola") === "Certificato dalla tua scuola", "la scuola");
  ok(etichettaCertificatore("kireo") === "Certificato da KIREO", "KIREO");
  ok(/automatic/i.test(etichettaCertificatore("sistema")), "il conteggio automatico");
  ok(etichettaCertificatore(null) !== "Certificato" && /non è registrato/.test(etichettaCertificatore(null)), "senza tipo lo dice, mai «Certificato» e basta");
  const scheda = leggi("app/scuola/(dashboard)/studenti/[id]/page.tsx");
  ok(/etichettaCertificatore\(p\.certificataDaTipo\)/.test(scheda), "la scheda studente chiama etichettaCertificatore");
  ok(!/\?\?\s*"Certificato"/.test(scheda), "la scheda non ha più il ripiego «Certificato»");
  // Il CHECK del database e l'elenco dicono gli stessi quattro.
  let ammessi = null;
  for (const f of fs.readdirSync(path.join(ROOT, "supabase/migrations")).sort()) {
    const m = fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8").match(/certificata_da_tipo in \(([^)]*)\)/);
    if (m) ammessi = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  ok(ammessi !== null && ammessi.every((t) => !etichettaCertificatore(t).startsWith("Certificato (")), `ogni tipo ammesso dal database ha un'etichetta (${ammessi ? ammessi.join(", ") : "nessuno letto"})`);

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà${falliti ? `, ${falliti} rotte` : ""}`);
  process.exit(falliti === 0 ? 0 : 1);
})();
