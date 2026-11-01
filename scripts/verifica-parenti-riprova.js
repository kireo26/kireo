#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// I PARENTI DEL «RIPROVA» (Mario, 01/11): la regola di test:erroriauth portata
// alle scritture sul database. «Riprova fra poco» solo a un guasto; un rifiuto
// per una regola dice la regola. I casi: il registro presenze dei docenti
// («Riprova più tardi» a «non iscritto» e «non autorizzato»), l'iscrizione a un
// evento, la data di nascita, i tre salvataggi del profilo.
// §1 la classificazione (guasto / sessione / rifiuto), attesi scritti a mano;
// §2 il registro: un testo per ogni rifiuto, e l'elenco contro la funzione SQL;
// §3 i testi dello studente, e il trigger della scuola contro il suo `raise`;
// §4 nessun rifiuto dice «riprova», nessun testo accorda col genere;
// §5 i componenti non scrivono più un «riprova» fisso e contano le righe;
// §6 iscrizione e annullamento eseguiti con un client finto.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
abilitaTypeScript();
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const R = require(path.join(ROOT, "lib/rifiutiScrittura.ts"));
const D = require(path.join(ROOT, "lib/ente/certificazioneDocente.ts"));
const S = require(path.join(ROOT, "lib/app/rifiutiStudente.ts"));
const I = require(path.join(ROOT, "lib/app/iscrizioneEvento.ts"));

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

async function main() {
  console.log("\n§1 — la classificazione, attesi scritti a mano\n");
  const c = R.classeErroreScrittura;
  ok(c({ code: "" }, true) === "guasto", "senza codice è la rete: guasto");
  ok(c(null, true) === "guasto", "un'eccezione senza errore è un guasto");
  ok(c({ code: "57014" }, true) === "guasto", "un tempo scaduto (57014) è un guasto");
  ok(c({ code: "08006" }, true) === "guasto", "una connessione caduta (08006) è un guasto");
  ok(c({ code: "PGRST301" }, true) === "sessione", "un token scaduto (PGRST301) è la sessione");
  ok(c({ code: "23505" }, true) === "rifiuto", "un duplicato (23505) è un rifiuto");
  ok(c({ code: "P0001" }, true) === "rifiuto", "una raise exception è un rifiuto");
  ok(c({ code: "23505" }, false) === "sessione", "senza sessione vince la sessione");
  const finto = (risposta) => ({ auth: { getUser: async () => risposta } });
  ok((await R.sessioneAncoraViva(finto({ data: { user: { id: "u" } }, error: null }))) === true, "con un utente la sessione è viva");
  ok((await R.sessioneAncoraViva(finto({ data: { user: null }, error: { name: "AuthSessionMissingError" } }))) === false, "senza utente è persa");
  ok((await R.sessioneAncoraViva(finto({ data: { user: null }, error: { name: "AuthRetryableFetchError" } }))) === true, "se la domanda non arriva non si dice «rientra»: è la rete");

  console.log("\n§2 — il registro presenze dei docenti\n");
  const d = D.testoErroreCertificazioneDocente;
  ok(d(raise("non_iscritto"), true) === "Questa persona ha annullato l'iscrizione nel frattempo: l'elenco qui sotto è aggiornato.", "non iscritto: lo dice", d(raise("non_iscritto"), true));
  ok(d(raise("non_autorizzato"), true).startsWith("Questa partecipazione non la puoi certificare tu"), "non autorizzato: lo dice");
  ok(d(raise("evento_non_trovato"), true).startsWith("Questo incontro non risulta più"), "evento non trovato: lo dice");
  ok(d(raise("non_autorizzato"), false) === R.TESTO_SESSIONE_PERSA_SCRITTURA, "senza sessione (anon non esegue la funzione): rientrare");
  ok(d({ code: "" }, true) === "La partecipazione non è stata certificata. È un problema nostro, non tuo: riprova fra un momento.", "un guasto: riprovare può servire", d({ code: "" }, true));
  ok(d(raise("mai_visto"), true) === "La partecipazione non è stata certificata. Non sappiamo dirti perché: se ti succede di nuovo, scrivici da Contatti.", "un rifiuto mai visto non promette niente");

  // L'elenco dei rifiuti contro la funzione VIVA (l'ultima definizione nelle
  // migrazioni): un `raise` nuovo senza un testo nasce rosso.
  const dir = path.join(ROOT, "supabase/migrations");
  const file = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  function ultimaDefinizione(nome) {
    let corpo = null;
    for (const f of file) {
      const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
      const re = new RegExp(`create or replace function public\\.${nome}\\b[\\s\\S]*?\\n\\$\\$;`, "g");
      for (const m of sql.matchAll(re)) corpo = { f, testo: m[0] };
    }
    return corpo;
  }
  const raiseDi = (corpo) => [...corpo.testo.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]);
  const cert = ultimaDefinizione("certifica_partecipazione_docente");
  const raiseCert = new Set(raiseDi(cert));
  ok(raiseCert.size >= 3, `la funzione viva (${cert.f}) solleva ${raiseCert.size} rifiuti distinti`, [...raiseCert]);
  for (const r of raiseCert) ok(r in D.RIFIUTI_CERTIFICAZIONE_DOCENTE, `«${r}» ha la sua frase`);
  for (const k of Object.keys(D.RIFIUTI_CERTIFICAZIONE_DOCENTE)) ok(raiseCert.has(k), `«${k}» esiste ancora nella funzione`);

  console.log("\n§3 — i testi dello studente\n");
  ok(S.iscrizioneGiaPresente({ code: "23505" }) === true, "un'iscrizione doppia è lo stato voluto");
  ok(S.testoErroreIscrizione({ code: "23503" }, true) === "Questo incontro non c'è più su KIREO: ricarica la pagina.", "l'evento sparito lo dice");
  ok(S.testoErroreIscrizione({ code: "" }, true) === "Non siamo riusciti a iscriverti. È un problema nostro, non tuo: riprova fra un momento.", "un guasto all'iscrizione");
  ok(S.testoErroreDataNascita({ code: "23514" }, true, 14) === "Su KIREO è richiesta un'età minima di 14 anni: controlla la data inserita.", "il vincolo dell'età minima lo dice");
  ok(S.testoErroreScuola(raise("scuola_verificata_non_modificabile"), true).startsWith("Nel frattempo la tua scuola ha verificato"), "la scuola verificata nel frattempo lo dice");
  ok(S.testoErroreScuola({ code: "23503" }, true).startsWith("Questa scuola non risulta nel nostro elenco"), "una scuola fuori dall'elenco lo dice");
  ok(S.testoErroreAree({ code: "23505" }, true).startsWith("Una di queste aree risulta già salvata"), "un'area doppia lo dice");
  ok(S.testoErroreTelefono({ code: "" }, false) === R.TESTO_SESSIONE_PERSA_SCRITTURA, "il telefono senza sessione: rientrare");
  const blocco = ultimaDefinizione("blocco_cambio_scuola_verificato");
  ok(raiseDi(blocco).includes("scuola_verificata_non_modificabile"), `il trigger della scuola (${blocco.f}) solleva il rifiuto che il testo nomina`);

  console.log("\n§4 — nessun rifiuto dice «riprova», nessun accordo di genere\n");
  const rifiuti = [
    ...Object.keys(D.RIFIUTI_CERTIFICAZIONE_DOCENTE).map((k) => d(raise(k), true)),
    d(raise("mai_visto"), true),
    S.testoErroreIscrizione({ code: "23503" }, true),
    S.testoErroreIscrizione({ code: "42501" }, true),
    S.testoErroreDataNascita({ code: "23514" }, true, 14),
    S.testoErroreScuola(raise("scuola_verificata_non_modificabile"), true),
    S.testoErroreScuola({ code: "23503" }, true),
    S.testoErroreAree({ code: "23505" }, true),
    S.TESTO_ISCRIZIONE_CERTIFICATA,
    S.TESTO_NON_ATTERRATA,
    R.TESTO_SESSIONE_PERSA_SCRITTURA,
  ];
  for (const t of rifiuti) ok(!/riprova/i.test(t), `non dice di riprovare: «${t.slice(0, 60)}…»`);
  const tutti = [...rifiuti, d({ code: "" }, true), S.testoErroreTelefono({ code: "" }, true), S.testoErroreAree({ code: "" }, true)];
  const accordi = tutti.flatMap((t) => trovaAccordi(t).map((a) => `${a.forma} in «${t}»`));
  ok(tutti.length >= 15 && accordi.length === 0, `${tutti.length} testi senza accordi di genere`, accordi);

  console.log("\n§5 — i componenti\n");
  const COMPONENTI = [
    ["components/ente/RegistroPresenzeDocenti.tsx", "testoErroreCertificazioneDocente("],
    ["components/app/IscrivitiEventoButton.tsx", "iscriviAEvento("],
    ["components/docente/IscrivitiWebinarButton.tsx", "iscriviAEvento("],
    ["components/app/CompletaEtaForm.tsx", "testoErroreDataNascita("],
    ["components/app/ProfiloForm.tsx", "testoErroreScuola("],
  ];
  for (const [f, chiamata] of COMPONENTI) {
    const src = senzaCommenti(leggi(f));
    ok(src.includes(chiamata), `${f} passa da ${chiamata.replace("(", "")}`);
  }
  for (const f of ["components/ente/RegistroPresenzeDocenti.tsx", "components/app/IscrivitiEventoButton.tsx", "components/docente/IscrivitiWebinarButton.tsx", "components/app/CompletaEtaForm.tsx"]) {
    ok(!/Riprova/.test(senzaCommenti(leggi(f))), `${f} non scrive più un «riprova» fisso`);
  }
  const profilo = senzaCommenti(leggi("components/app/ProfiloForm.tsx"));
  ok(!/messaggioErrore="[^"]*Riprova/.test(profilo), "i tre salvataggi del profilo non hanno più un messaggio d'errore fisso");
  for (const f of ["testoErroreTelefono(", "testoErroreScuola(", "testoErroreAree("]) ok(profilo.includes(f), `il profilo chiama ${f.replace("(", "")}`);
  const conSelect = (profilo.match(/\.update\([^)]*\)[\s\S]{0,80}?\.select\(/g) || []).length;
  ok(conSelect >= 2, `telefono e scuola rileggono le righe scritte (${conSelect} update con .select)`);
  ok(/\.update\(\{ data_nascita[\s\S]{0,80}\.select\(/.test(senzaCommenti(leggi("components/app/CompletaEtaForm.tsx"))), "la data di nascita rilegge le righe scritte");

  console.log("\n§6 — iscrizione e annullamento, eseguiti\n");
  // Un client finto: la delete risponde le righe scritte, la rilettura la riga.
  function cliente({ insert = { error: null }, delete: canc = { data: [], error: null }, riga = { data: null, error: null } } = {}) {
    const catena = (fine) => {
      const q = { eq: () => q, select: () => q, maybeSingle: async () => fine(), then: (r, e) => Promise.resolve(fine()).then(r, e) };
      return q;
    };
    return {
      auth: { getUser: async () => ({ data: { user: { id: "u" } }, error: null }) },
      from: () => ({
        insert: async () => insert,
        delete: () => catena(() => canc),
        select: () => catena(() => riga),
      }),
    };
  }
  const silenzio = console.error;
  console.error = () => {};
  try {
    ok((await I.iscriviAEvento(cliente({ insert: { error: { code: "23505" } } }), "u", "e")).ok === true, "un'iscrizione doppia risulta fatta");
    const e1 = await I.iscriviAEvento(cliente({ insert: { error: { code: "23503" } } }), "u", "e");
    ok(!e1.ok && e1.testo.startsWith("Questo incontro non c'è più"), "un evento sparito lo dice");
    ok((await I.annullaIscrizione(cliente({ delete: { data: [{ evento_id: "e" }], error: null } }), "u", "e")).annullata === true, "una riga tolta è annullata");
    const e2 = await I.annullaIscrizione(cliente({ delete: { data: [], error: null }, riga: { data: { certificata_da_tipo: "ente" }, error: null } }), "u", "e");
    ok(!e2.annullata && e2.testo === S.TESTO_ISCRIZIONE_CERTIFICATA, "zero righe su una presenza certificata dicono perché, non «Iscriviti»", e2);
    ok((await I.annullaIscrizione(cliente({ delete: { data: [], error: null }, riga: { data: null, error: null } }), "u", "e")).annullata === true, "zero righe e nessuna riga: era già annullata");
  } finally {
    console.error = silenzio;
  }

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà (npm run test:parenti)`);
  process.exit(falliti === 0 ? 0 : 1);
}
main();
