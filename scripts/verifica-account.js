#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// La guardia della pagina dell'account (02/11): una pagina sola per tutti i
// ruoli, la cancellazione con le regole di Mario del 01/11, il cambio della
// password da dentro, il passaggio della scuola. Gli attesi sono scritti a mano.
//
// Uso: npm run test:mioaccount

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const A = require(path.join(ROOT, "lib/account/cancellazione.ts"));

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
const raise = (m) => ({ code: "P0001", message: m });

console.log("\n§1 — cosa dice la sezione, e se il bottone c'è\n");
// Il numero prima del clic e i suoi casi stanno in `npm run test:cancellazione`.
const p = (s) => A.presentaCancellazione(s, "x@test.it");
ok(p(null).bottone === false && p(null).testo.includes("Non siamo riusciti a contare"), "uno stato non letto non dà il bottone, e lo dice");
const ref = p({ puo: false, ruolo: "referente_scuola", motivo: "referente_senza_successore", tutor_attivi: 0 });
ok(ref.bottone === false && ref.linkStaff === true, "il referente senza successore: niente bottone, il link a Staff");
ok(ref.testo === "Prima di andartene devi passare la scuola a qualcun altro: promuovi un tutor a referente, oppure invitane uno.", "…con il testo di Mario, parola per parola");
ok(p({ puo: false, ruolo: "istituzione", motivo: "ruolo_non_previsto" }).bottone === false, "un ente: niente bottone");
ok(p({ puo: false, ruolo: "admin", motivo: "ruolo_non_previsto" }).testo.includes("admin"), "un admin: il suo testo, niente bottone");
const firma = [{ tabella: "student_profiles", colonna: "verificato_da", n: 2 }];
const tut = p({ puo: true, ruolo: "tutor_scuola", resta_il_nome: true, firme: firma, esito: "cancellato_resta_il_nome" });
ok(tut.bottone && tut.testo.includes("2 verifiche di studenti"), "chi ha firmato: il bottone, e il numero detto PRIMA del clic");
const doc = p({ puo: true, ruolo: "docente", resta_il_nome: false, firme: [{ ...firma[0], n: 0 }], esito: "anonimizzato" });
ok(doc.bottone && !doc.testo.includes("resterà su"), "chi non ha firmato non legge di firme che non ha");

console.log("\n§2 — lo stato si legge nella forma, o non si legge\n");
ok(A.leggiStatoCancellazione(null) === null, "null → non letto");
ok(A.leggiStatoCancellazione({ puo: "sì" }) === null, "una forma strana → non letto, mai un bottone");
ok(A.leggiStatoCancellazione({ puo: false, motivo: "inventato" }) === null, "un motivo che non conosciamo → non letto");
const letto = A.leggiStatoCancellazione({ puo: true, ruolo: "docente", resta_il_nome: true, firme: firma, esito: "cancellato_resta_il_nome" });
ok(letto && letto.puo && letto.resta_il_nome === true, "la forma vera passa");

console.log("\n§3 — i rifiuti dicono la regola, «riprova» solo a un guasto\n");
const e = A.testoErroreCancellazione;
ok(e(raise("referente_senza_successore"), true) === A.TESTO_REFERENTE_SENZA_SUCCESSORE, "il rifiuto del referente dice la regola");
ok(!/riprova/i.test(e(raise("referente_senza_successore"), true)), "…e non dice di riprovare");
ok(/riprova fra un momento/.test(e({ code: "" }, true)), "un guasto di rete dice di riprovare");
ok(!/riprova/i.test(e(raise("sconosciuto"), true)), "un rifiuto sconosciuto non promette che riprovare serva");
ok(e(raise("referente_senza_successore"), false).includes("Rientra"), "a sessione persa, rientrare");
ok(A.testoErrorePassaggio(raise("tutor_non_valido"), true) === A.TESTI_PASSAGGIO.tutorNonValido, "il passaggio a un tutor non valido lo dice");

console.log("\n§4 — la password\n");
ok(A.erroriPassword("", "abcdefgh", "abcdefgh").includes(A.TESTI_PASSWORD.attualeMancante), "senza la password attuale non si cambia");
ok(A.erroriPassword("x", "corta", "corta").includes(A.TESTI_PASSWORD.troppoCorta), "otto caratteri almeno");
ok(A.erroriPassword("x", "abcdefgh", "abcdefgi").includes(A.TESTI_PASSWORD.diverse), "le due nuove devono coincidere");
ok(A.erroriPassword("x", "abcdefgh", "abcdefgh").length === 0, "un cambio giusto passa");
const pw = senzaCommenti(leggi("components/account/CambiaPassword.tsx"));
ok(/signInWithPassword[\s\S]*updateUser/.test(pw), "prima si verifica quella attuale, poi si scrive la nuova");
ok(/messaggioErroreAuth\(/.test(pw), "gli errori di Supabase passano dalla strada unica dei form di accesso");

console.log("\n§5 — i testi non accordano col genere\n");
const testi = [
  ...Object.values(A.TESTI_ACCOUNT), A.TESTO_NON_RESTA_NIENTE, A.TESTO_REFERENTE_SENZA_SUCCESSORE,
  ...Object.values(A.TESTI_PASSWORD), ...Object.values(A.TESTI_PASSAGGIO), A.testoConfermaPassaggio("Anna Rossi"),
];
const accordati = testi.filter((t) => trovaAccordi(t).length > 0);
ok(testi.length > 15 && accordati.length === 0, `${testi.length} testi, nessuno accorda`, accordati);
ok(!/Sei sicur/.test(leggi("components/account/CancellaAccount.tsx")), "la domanda prima di cancellare non è più «Sei sicuro?»");

console.log("\n§6 — una pagina sola, e ogni area ci porta\n");
const cancella = senzaCommenti(leggi("components/account/CancellaAccount.tsx"));
ok(/!vista\.bottone \?/.test(cancella), "il bottone esiste solo quando la regola lo concede");
ok(!/disabled=\{[^}]*vista/.test(cancella), "…e non è mai un bottone spento con una spiegazione accanto");
const chiamanti = ["app", "components", "lib"].flatMap(function giro(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? giro(path.join(d, x.name)) : /\.tsx?$/.test(x.name) && senzaCommenti(leggi(path.join(d, x.name))).includes('rpc("delete_own_account"') ? [path.join(d, x.name)] : [],
  );
});
ok(chiamanti.length === 1 && chiamanti[0] === path.join("components", "account", "CancellaAccount.tsx"), "la cancellazione la chiama un posto solo", chiamanti);
ok(!/BloccoPrivacy|delete_own_account/.test(senzaCommenti(leggi("components/app/ProfiloForm.tsx"))), "il profilo dello studente non ne ha una seconda copia");
ok(/href="\/account"/.test(leggi("app/app/profilo/page.tsx")), "…e porta all'account");
for (const f of ["components/app/AppShell.tsx", "components/scuola/ScuolaShell.tsx", "components/ente/EnteShell.tsx", "components/docente/DocenteShell.tsx"]) {
  const s = leggi(f);
  ok((s.match(/<LinkMioAccount variante="(barra|icona)" \/>/g) || []).length === 2, `${f}: il link all'account nella barra e sul telefono`);
}
ok(/<LinkMioAccount/.test(leggi("app/admin/layout.tsx")), "l'admin ci arriva accanto a «Esci»");
ok(/AREE_PROTETTE = \[[^\]]*"\/account"/.test(leggi("lib/supabase/proxy.ts")), "il proxy protegge /account");
const pagina = senzaCommenti(leggi("app/account/page.tsx"));
ok(/rpc\("stato_cancellazione_mio_account"\)/.test(pagina) && /erroreStato \? null/.test(pagina), "la pagina legge lo stato dal database, e un errore è «non letto»");
ok(/ruolo === "studente" \?[\s\S]*<ScaricaIMieiDati/.test(pagina) && /esportaNonDisponibile/.test(pagina), "«Scarica i miei dati» c'è per lo studente, e per gli altri si dice che manca");

console.log("\n§7 — Staff: il passaggio e il link dell'invito\n");
const staff = leggi("app/scuola/(dashboard)/staff/page.tsx");
ok(/!inAttesa && t\.attivo \? \(\s*<PassaReferenteButton/.test(staff), "«Rendi referente» solo su un tutor attivo");
ok(/inAttesa && t\.codice_invito \? <CopiaLinkInvito/.test(staff), "«Copia il link» sulle righe in attesa");
const { linkInvitoTutor } = require(path.join(ROOT, "lib/scuola/linkInvito.ts"));
ok(linkInvitoTutor("https://kireo.it", "TUTOR-AAAA-BBBB-CCCC-DDDD") === "https://kireo.it/scuola/invito?codice=TUTOR-AAAA-BBBB-CCCC-DDDD", "il link è quello del riquadro verde");
ok(/linkInvitoTutor\(/.test(leggi("components/scuola/InvitaTutorForm.tsx")), "…e il riquadro verde lo costruisce dalla stessa funzione");

console.log("\n§8 — la migrazione: il trigger prima che la chiave esca\n");
const mig = senzaCommentiSql(leggi("supabase/migrations/20261202100000_cancellazione_account.sql"));
const iTrigger = ancora(mig, "create trigger cancella_profilo_con_l_utente", { dove: "migrazione" });
const iDrop = ancora(mig, "drop constraint if exists profiles_id_fkey", { dove: "migrazione" });
ok(iTrigger > 0 && iDrop > iTrigger, "se Supabase non lascia creare il trigger, la chiave resta al suo posto", `${iTrigger} / ${iDrop}`);
ok(/confdeltype in \('a', 'r'\)/.test(mig), "le firme si leggono dal catalogo: una colonna di responsabilità nuova entra da sola");

console.log(`\n${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:mioaccount)`);
process.exit(falliti === 0 ? 0 : 1);
