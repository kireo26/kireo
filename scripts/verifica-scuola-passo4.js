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
const { etichettaCertificatore, ETICHETTA_CERTIFICATORE, nomeDelCertificatore, leggiNomiCertificatori, TESTO_CERTIFICATORE_NON_LETTO } = require("@/lib/scuola/certificatore");

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
  // Il testo è di Mario (01/11): la rassicurazione cade in fondo, dove resta.
  ok(
    TESTO_ORE_NON_LETTE === "Non siamo riusciti a leggere le tue ore certificate. Ricarica la pagina: le ore non sono perse.",
    "il testo del non letto, parola per parola",
    TESTO_ORE_NON_LETTE,
  );
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
  // ⚠️ RISCRITTA il 04/11: guardava il ripiego («Certificato (tipo)»), che è
  // cambiato; letta così sarebbe rimasta verde per niente. Ora guarda la tabella.
  ok(ammessi !== null && ammessi.length >= 4 && ammessi.every((t) => ETICHETTA_CERTIFICATORE[t]), `ogni tipo ammesso dal database ha un'etichetta (${ammessi ? ammessi.join(", ") : "nessuno letto"})`);
  ok(!etichettaCertificatore("marziano").includes("marziano"), "un tipo che non conosciamo non esce grezzo nella frase");

  console.log("\n§ il nome di chi ha certificato (04/11, 20261207110000)\n");
  const mappa = new Map([["u1", "Giulia Lapide"]]);
  ok(nomeDelCertificatore(mappa, "scuola", "u1") === "Giulia Lapide", "il nome letto si mostra");
  ok(nomeDelCertificatore(mappa, "kireo", "u1") === "Giulia Lapide", "anche per chi non è la scuola: il CSV lo stampa per tutti");
  ok(nomeDelCertificatore(mappa, "sistema", "u1") === undefined, "il conteggio automatico non ha un nome");
  ok(nomeDelCertificatore(null, "scuola", "u1") === TESTO_CERTIFICATORE_NON_LETTO, "non letto si dice, non si tace");
  ok(nomeDelCertificatore(mappa, "scuola", "u9") === undefined, "una persona che la funzione non restituisce non ha nome");
  {
    let chiesto = null;
    const finto = (risposta) => ({ rpc: async (f, a) => { chiesto = { f, a }; return risposta; } });
    const m = await leggiNomiCertificatori(finto({ data: [{ user_id: "u1", nome: "Giulia", cognome: "Lapide" }], error: null }), ["u1", "u1", null]);
    ok(chiesto?.f === "nomi_dei_certificatori" && chiesto.a.p_ids.length === 1 && m.get("u1") === "Giulia Lapide", "chiede alla funzione, una volta per persona");
    ok((await leggiNomiCertificatori(finto({ data: null, error: { message: "x" } }), ["u1"])) === null, "una lettura fallita è null, non una mappa vuota");
  }
  for (const rel of ["lib/scuola/studenteDettaglio.ts", "lib/scuola/eventi.ts"]) {
    const src = leggi(rel);
    ok(src.includes("leggiNomiCertificatori(") && src.includes("nomeDelCertificatore("), `${rel}: il nome passa dalla funzione`);
    ok(!/profiles!certificata_da_user/.test(src), `${rel}: niente embed su profiles, che perdeva la lapide e il tutor disattivato`);
  }
  ok(/\{r\.certificataDaNome && <span[^>]*>certificata da \{r\.certificataDaNome\}/.test(leggi("components/scuola/RegistroPresenzeEvento.tsx")), "il registro a schermo mostra il nome, quando c'è");
  ok(!/certificataDaTipo === "scuola" && p\.certificataDaNome/.test(scheda), "la scheda mostra il nome per ogni tipo, non solo la scuola");

  console.log("\n§ i nomi dei colleghi e chi ha verificato (04/11, 20261208100000)\n");
  {
    const N = require(path.join(ROOT, "lib/scuola/nomiStaff.ts"));
    const finto = (risposta) => ({ rpc: async (f, a) => { finto.ultimo = { f, a }; return risposta; } });
    ok(N.testoVerificatore({ esito: "letto", nome: "Sara Spenta" }) === "da Sara Spenta", "chi ha verificato si dice col nome");
    ok(N.testoVerificatore({ esito: "nessuno" }) === "Chi l'ha verificato non è registrato", "nessun autore registrato si dice così");
    ok(N.testoVerificatore({ esito: "non_letto" }) === "Non siamo riusciti a leggere chi l'ha verificato", "e il non letto in un altro modo");
    const v1 = await N.leggiVerificatore(finto({ data: [{ user_id: "u", nome: "Sara", cognome: "Spenta" }], error: null }), "s1");
    ok(v1.esito === "letto" && v1.nome === "Sara Spenta" && finto.ultimo.f === "verificatore_dello_studente" && finto.ultimo.a.p_student === "s1", "chiede alla funzione con lo studente", v1);
    ok((await N.leggiVerificatore(finto({ data: [], error: null }), "s1")).esito === "nessuno", "zero righe: nessuno");
    ok((await N.leggiVerificatore(finto({ data: null, error: { message: "x" } }), "s1")).esito === "non_letto", "una lettura fallita: non letto, mai nessuno");
    const m = await N.leggiNomiDelloStaff(finto({ data: [{ user_id: "t1", nome: "Tino", cognome: "Tutor" }], error: null }));
    ok(finto.ultimo.f === "nomi_dello_staff" && N.nomeDelCollega(m, "t1") === "Tino Tutor", "i nomi dello staff dalla funzione");
    ok((await N.leggiNomiDelloStaff(finto({ data: null, error: { message: "x" } }))) === null, "una lettura fallita è null");
    ok(N.nomeDelCollega(null, "t1") === N.TESTO_NOME_NON_LETTO, "e la pagina dice che non ha letto");
    const staffSrc = leggi("app/scuola/(dashboard)/staff/page.tsx");
    ok(!/profiles!/.test(staffSrc) && /leggiNomiDelloStaff\(supabase\)/.test(staffSrc) && /nomeDelCollega\(nomi, t\.user_id\)/.test(staffSrc), "la pagina Staff non legge più il profilo dei colleghi");
    ok(/<p className="[^"]*">\{testoVerificatore\(studente\.verificatore\)\}<\/p>/.test(scheda), "la scheda dice chi ha verificato, o perché non lo dice");
    ok(/leggiVerificatore\(supabase, studentId\)/.test(leggi("lib/scuola/studenteDettaglio.ts")), "e il dettaglio lo legge");
    const mig = fs.readFileSync(path.join(ROOT, "supabase/migrations/20261208100000_nomi_dello_staff_e_chi_ha_verificato.sql"), "utf8");
    ok(/drop policy if exists profiles_select_scuola_staff on public\.profiles;/.test(mig), "la policy sui profili dei colleghi esce");
    const tornata = fs.readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f > "20261208100000").filter((f) => /create policy profiles_select_scuola_staff/.test(fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8")));
    ok(tornata.length === 0, "e nessuna migrazione dopo la rimette", tornata);
  }

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà${falliti ? `, ${falliti} rotte` : ""}`);
  process.exit(falliti === 0 ? 0 : 1);
})();
