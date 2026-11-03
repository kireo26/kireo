#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA LAPIDE E IL SUO NUMERO (Mario, 03/11). Chi ha firmato anche una cosa sola
// e si cancella lascia nome e indirizzo, e l'indirizzo non si registra più;
// chi non ha firmato niente sparisce e l'indirizzo torna libero. Prima del clic
// si dice il NUMERO, dopo il clic si dice cosa è successo.
//
// ⚠️ Le colonne delle firme non sono scritte qui: si leggono dalle migrazioni
// (lo stesso lettore della cascata), e con una replica (`CONN`) da
// `pg_constraint`. Una sedicesima colonna nasce rossa finché qualcuno non le
// scrive le sue parole in `lib/account/firme.ts` — altrimenti fra sei mesi
// qualcuno firma con una colonna nuova, si cancella, e la pagina gli dice «1
// altra firma» senza dire cosa.
//
// Con `CONN` lancia anche `scripts/verifica-lapide-indirizzo.sql`, che cancella
// per davvero due volte (con una firma e senza). Senza replica lo dice.
//
// Uso: npm run test:cancellazione   (CONN="host=/tmp port=54329 user=postgres dbname=postgres" per la replica)

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { leggiMigrazioni } = require("./lib/cascata-profili");
abilitaTypeScript();
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const F = require(path.join(ROOT, "lib/account/firme.ts"));
const A = require(path.join(ROOT, "lib/account/cancellazione.ts"));
const I = require(path.join(ROOT, "lib/auth/indirizzoCancellato.ts"));

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
const leggi = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

console.log("\n§1 — ogni colonna che blocca ha le sue parole\n");
const { archi } = leggiMigrazioni();
const bloccanti = archi.filter((a) => a.madre === "profiles" && !a.cascata);
ok(bloccanti.length >= 15, `il lettore vede le chiavi che bloccano (${bloccanti.length}, pavimento 15)`);
const perTabellaMig = {};
for (const a of bloccanti) perTabellaMig[a.figlia] = (perTabellaMig[a.figlia] ?? 0) + 1;
const perTabellaParole = {};
for (const k of Object.keys(F.PAROLE_DELLE_FIRME)) {
  const t = k.split(".")[0];
  perTabellaParole[t] = (perTabellaParole[t] ?? 0) + 1;
}
const tabelle = new Set([...Object.keys(perTabellaMig), ...Object.keys(perTabellaParole)]);
const diverse = [...tabelle]
  .filter((t) => (perTabellaMig[t] ?? 0) !== (perTabellaParole[t] ?? 0))
  .map((t) => `${t}: ${perTabellaMig[t] ?? 0} nelle migrazioni, ${perTabellaParole[t] ?? 0} con le parole`);
ok(diverse.length === 0, "le colonne con le parole sono quelle che le migrazioni lasciano, tabella per tabella", diverse);

console.log("\n§2 — il numero detto con le sue parole (attesi scritti a mano)\n");
const firme = [
  { tabella: "student_profiles", colonna: "verificato_da", n: 10 },
  { tabella: "iscrizioni_eventi", colonna: "certificata_da_user", n: 4 },
  { tabella: "eventi", colonna: "diretta_chiusa_da_user", n: 0 },
];
ok(F.descriviFirme(firme) === "10 verifiche di studenti e 4 certificazioni di presenza", "dieci verifiche e quattro presenze", F.descriviFirme(firme));
ok(F.descriviFirme([{ tabella: "student_profiles", colonna: "verificato_da", n: 1 }]) === "1 verifica di uno studente", "il singolare");
ok(
  F.descriviFirme([
    { tabella: "post_enti", colonna: "tolto_da", n: 2 },
    { tabella: "nuova", colonna: "firmata_da", n: 1 },
  ]) === "2 rimozioni di post e 1 altra firma",
  "una colonna senza parole non si tace: «1 altra firma»",
);
const prima = A.presentaCancellazione({ puo: true, ruolo: "tutor_scuola", resta_il_nome: true, firme }, "giulia@test.it");
ok(
  prima.bottone &&
    prima.testo ===
      "Il tuo account sparisce, ma il tuo nome resterà su 10 verifiche di studenti e 4 certificazioni di presenza. L'indirizzo giulia@test.it non potrà più essere usato per registrarsi.",
  "prima del clic: quante firme, quali, e che l'indirizzo non torna libero",
  prima.testo,
);
ok(!/presenze che hai certificato/.test(prima.testo), "nessun testo fisso che nomina la cosa sbagliata");
const zero = A.presentaCancellazione({ puo: true, ruolo: "docente", resta_il_nome: false, firme: [{ ...firme[0], n: 0 }] }, "r@t.it");
ok(zero.testo === "Non resterà nulla di te: il profilo sparisce per intero e questo indirizzo tornerà libero.", "zero firme: il testo di Mario");

console.log("\n§3 — un conteggio che manca non diventa «non resterà niente»\n");
const L = A.leggiStatoCancellazione;
ok(L({ puo: true, ruolo: "docente", resta_il_nome: false }) === null, "senza le firme contate: non letto, quindi nessun bottone");
ok(L({ puo: true, ruolo: "docente", resta_il_nome: false, firme: [] }) === null, "un elenco vuoto non è un conteggio");
ok(L({ puo: true, ruolo: "docente", resta_il_nome: false, firme: [{ tabella: "t", colonna: "c", n: 3 }] }) === null, "resta_il_nome che contraddice il conteggio: non letto");
ok(L({ puo: true, ruolo: "docente", resta_il_nome: true, firme: [{ tabella: "t", colonna: "c", n: "3" }] }) === null, "un numero scritto male: non letto");
ok(A.presentaCancellazione(null, "x").bottone === false && /contare/.test(A.TESTI_ACCOUNT.nonLetto), "e il testo dice che non abbiamo contato, e che non si procede");

console.log("\n§4 — dopo il clic si dice cosa è successo\n");
ok(/non potrà più essere usato/.test(A.testoDopoLaCancellazione("cancellato_resta_il_nome", "g@t.it")), "la lapide lo dice");
ok(/di nuovo libero/.test(A.testoDopoLaCancellazione("cancellato", "r@t.it")), "la cancellazione intera lo dice");
ok(A.testoErroreCancellazione({ code: "P0001", message: "stato_cambiato" }, true) === A.TESTI_ACCOUNT.statoCambiato, "una firma comparsa nel frattempo ha la sua frase");
const comp = senzaCommenti(leggi("components/account/CancellaAccount.tsx"));
ok(/rpc\("delete_own_account", \{ p_resta_il_nome_visto: stato\.resta_il_nome \}\)/.test(comp), "al clic si manda quello che la persona ha letto");
ok(/testoDopoLaCancellazione\(\s*\(data/.test(comp), "l'esito restituito si legge, non si butta");
ok(!/router\.push\("\/"\)/.test(comp), "e non si torna alla home in silenzio");

console.log("\n§5 — la registrazione consulta le lapidi\n");
const moduli = [];
(function giro(d) {
  for (const x of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const p = path.join(d, x.name);
    if (x.isDirectory()) giro(p);
    else if (/\.tsx?$/.test(x.name) && /auth\.signUp\(/.test(senzaCommenti(leggi(p)))) moduli.push(p);
  }
})("components");
ok(moduli.length >= 5, `i moduli che registrano (${moduli.length}, pavimento 5)`);
for (const m of moduli) {
  const s = senzaCommenti(leggi(m));
  const i = s.search(/indirizzoDiUnAccountCancellato\(/);
  ok(i >= 0 && i < s.search(/auth\.signUp\(/) && /setErroreGenerale\(TESTO_INDIRIZZO_CANCELLATO\)/.test(s), `${m}: chiede prima di registrare, e dice la regola`);
}
ok(!/già|esiste|in uso/i.test(I.TESTO_INDIRIZZO_CANCELLATO), "la frase non assomiglia a «account già esistente»");
const route = senzaCommenti(leggi("app/api/registrazione/indirizzo/route.ts"));
ok(/createServiceRoleClient\(\)/.test(route) && /rpc\("indirizzo_di_un_account_cancellato", \{ p_email: email \}\)/.test(route), "la route chiede con la service role, e passa solo l'indirizzo");

console.log("\n§6 — i testi non accordano col genere\n");
const testi = [
  ...Object.values(A.TESTI_ACCOUNT),
  A.TESTO_NON_RESTA_NIENTE,
  prima.testo,
  A.testoDopoLaCancellazione("cancellato", "x"),
  A.testoDopoLaCancellazione("cancellato_resta_il_nome", "x"),
  I.TESTO_INDIRIZZO_CANCELLATO,
  ...Object.values(F.PAROLE_DELLE_FIRME).flat(),
];
const accordati = testi.filter((t) => trovaAccordi(t).length > 0);
ok(testi.length > 30 && accordati.length === 0, `${testi.length} testi, nessuno accorda`, accordati);

console.log("\n§7 — sulla replica: le colonne vere, e due cancellazioni per davvero\n");
const CONN = process.env.CONN;
if (!CONN) {
  console.log("  · non ho guardato: senza CONN non c'è una replica (la lancia npm run sql:tutti)");
} else {
  const colonne = execFileSync("psql", [CONN, "-At", "-c",
    "select c.conrelid::regclass::text || '.' || a.attname from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1] where c.contype = 'f' and c.confrelid = 'public.profiles'::regclass and c.confdeltype in ('a','r') and array_length(c.conkey,1) = 1 order by 1"],
    { encoding: "utf8" }).trim().split("\n").map((x) => x.replace(/^public\./, ""));
  const senza = colonne.filter((c) => !F.PAROLE_DELLE_FIRME[c]);
  const morte = Object.keys(F.PAROLE_DELLE_FIRME).filter((k) => !colonne.includes(k));
  ok(senza.length === 0 && morte.length === 0, `le ${colonne.length} colonne del catalogo hanno le parole, e nessuna parola è di una colonna che non c'è`, { senza, morte });
  const uscita = execFileSync("psql", [CONN, "-q", "-f", path.join(ROOT, "scripts/verifica-lapide-indirizzo.sql")], { encoding: "utf8" });
  ok(/\b0 ROTTE su 9\b/.test(uscita), "verifica-lapide-indirizzo.sql: 9 su 9", uscita.split("\n").filter((r) => /ROTT/.test(r)).join("\n"));
}

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:cancellazione)`);
process.exit(falliti === 0 ? 0 : 1);
