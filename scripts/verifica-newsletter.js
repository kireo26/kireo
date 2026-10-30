#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:newsletter` — la newsletter degli enti (30/10). Le proprietà
// del database stanno in `scripts/verifica-newsletter.sql` (replica); qui le
// metà che si provano senza: i numeri uguali fra TS e SQL, l'ora italiana, il
// motore che non nomina `comunicazioni` né le guide, il giro dell'invio con un
// database e un Brevo finti, i testi, l'uscita che non disiscrive aprendosi, i
// piani a due.

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  if (cond) console.log(`  ✓ ${testo}`);
  else {
    falliti++;
    console.log(`  ✗ ${testo}`);
    if (dettaglio !== "") console.log(`      → ${typeof dettaglio === "string" ? dettaglio : JSON.stringify(dettaglio)}`);
  }
}
const leggi = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const MIGRAZIONE = leggi("supabase/migrations/20261117110000_newsletter_motore.sql");

const R = require("@/lib/newsletter/regole");
const I = require("@/lib/newsletter/invio");
const T = require("@/lib/email/templates");
const P = require("@/lib/ente/pianoSuccessivo");

(async () => {
  console.log("\n§1 — gli stessi numeri in TypeScript e nel database\n");
  {
    const sql = (fn) => MIGRAZIONE.match(new RegExp(`function public\\.${fn}\\(\\)[\\s\\S]*?select (\\d+)`))?.[1];
    ok(String(R.MAX_NEWSLETTER_AL_GIORNO) === sql("max_newsletter_al_giorno"), `al giorno: ${R.MAX_NEWSLETTER_AL_GIORNO} e ${sql("max_newsletter_al_giorno")}`);
    ok(String(R.GIORNI_VALIDITA) === sql("giorni_validita_newsletter"), `validità: ${R.GIORNI_VALIDITA} e ${sql("giorni_validita_newsletter")}`);
    // Gli attesi scritti a mano: sono la decisione di Mario del 30/10.
    ok(R.MAX_NEWSLETTER_AL_GIORNO === 5 && R.GIORNI_VALIDITA === 3 && R.GIORNI_ANTICIPO_CONSIGLIATI === 4, "5 al giorno, 3 giorni di validità, 4 di anticipo consigliati");
    ok(R.ultimoGiornoDiPartenza("2027-10-10") === "2027-10-12", "3 giorni = il giorno scelto e i due successivi", R.ultimoGiornoDiPartenza("2027-10-10"));
    const free = MIGRAZIONE.match(/update public\.piani set quota_newsletter = (\d+) where nome = 'free'/)?.[1];
    const premium = leggi("supabase/migrations/20260722100000_piani_promozione_eventi.sql").match(/set quota_newsletter = case nome[\s\S]*?when 'premium' then (\d+)/)?.[1];
    ok(String(P.QUOTA_NEWSLETTER.free) === free && free === "3", `free: listino ${P.QUOTA_NEWSLETTER.free}, database ${free}`);
    ok(String(P.QUOTA_NEWSLETTER.premium) === premium && premium === "12", `premium: listino ${P.QUOTA_NEWSLETTER.premium}, database ${premium}`);
    // L'aritmetica della scadenza è scritta accanto ai due valori, nei due posti.
    const piano = (t) => t.replace(/\n\s*(\/\/|--)\s*/g, " ");
    for (const [f, testo] of [["lib/newsletter/regole.ts", piano(leggi("lib/newsletter/regole.ts"))], ["la migrazione", piano(MIGRAZIONE)]]) {
      ok(/NON è la coda a garantire/.test(testo) && /era sbagliata/.test(testo), `${f}: la scadenza dice che garantisce lei, non la coda, e la versione di prima è cancellata`);
    }
  }

  console.log("\n§2 — l'invio parte alle 7:30 ora italiana, d'estate e d'inverno\n");
  {
    ok(R.eOraDiInvio(new Date("2027-07-01T05:30:00Z")) === true, "d'estate le 5:30 UTC sono le 7:30");
    ok(R.eOraDiInvio(new Date("2027-07-01T06:30:00Z")) === false, "…e le 6:30 UTC sono le 8:30: niente");
    ok(R.eOraDiInvio(new Date("2027-12-01T06:30:00Z")) === true, "d'inverno le 6:30 UTC sono le 7:30");
    ok(R.eOraDiInvio(new Date("2027-12-01T05:30:00Z")) === false, "…e le 5:30 UTC sono le 6:30: niente");
    ok(R.giornoItaliano(new Date("2027-12-31T23:30:00Z")) === "2028-01-01", "il giorno è quello italiano, non quello UTC");
    const cron = JSON.parse(leggi("vercel.json")).crons.filter((c) => c.path === "/api/cron/newsletter").map((c) => c.schedule).sort();
    ok(JSON.stringify(cron) === JSON.stringify(["30 5 * * *", "30 6 * * *"]), "vercel.json chiama la newsletter alle 5:30 e alle 6:30 UTC", cron);
    const route = senzaCommenti(leggi("app/api/cron/newsletter/route.ts"));
    const guardia = ancora(route, "eOraDiInvio(", { dove: "la guardia dell'ora" });
    ok(guardia < ancora(route, "giroInvio(", { dove: "il giro" }), "la route guarda l'ora italiana PRIMA di lavorare");
    ok(/Europe\/Rome|ora italiana/.test(leggi("app/api/cron/newsletter/route.ts")), "accanto al cron è scritto che l'ora è italiana, e perché");
  }

  console.log("\n§3 — il motore non nomina `comunicazioni` né le guide\n");
  {
    const file = ["lib/newsletter/invio.ts", "lib/newsletter/regole.ts", "app/api/cron/newsletter/route.ts"];
    for (const f of file) {
      const codice = senzaCommenti(leggi(f));
      ok(!/comunicazioni|guide_enti|scaricament|recinto_enti|guida/i.test(codice), `${f}: niente \`comunicazioni\`, niente guide`);
    }
    // E nel database: le funzioni del motore leggono i destinatari solo da
    // `newsletter_iscrizioni` (la migrazione intera non nomina le guide fuori dai commenti).
    const sql = MIGRAZIONE.split("\n").filter((r) => !/^\s*--/.test(r)).join("\n");
    ok(!/from public\.comunicazioni|guide_enti|scaricamenti_guide|recinto_enti/.test(sql), "la migrazione non legge `comunicazioni` né le guide");
    ok(/from public\.newsletter_iscrizioni ni[\s\S]*?consenso_dato_da_maggiorenne\(ni\.created_at, p\.data_nascita\)/.test(sql),
      "i destinatari vengono da `newsletter_iscrizioni`, con l'età di quando si sono iscritti");
  }

  console.log("\n§4 — il giro dell'invio, con un database e un Brevo finti\n");
  {
    const chiamate = [];
    const coda = [
      { consegna_id: "c1", email: "a@x.it", nome: "A", oggetto: "Open day", corpo: "Vieni <b>sabato</b>.", ente_nome: "Ente", codice_uscita: "11111111-1111-1111-1111-111111111111", newsletter_id: "n1" },
      { consegna_id: "c2", email: "b@x.it", nome: "B", oggetto: "Open day", corpo: "x", ente_nome: "Ente", codice_uscita: "22222222-2222-2222-2222-222222222222", newsletter_id: "n1" },
      { consegna_id: "c3", email: "c@x.it", nome: "C", oggetto: "Open day", corpo: "x", ente_nome: "Ente", codice_uscita: "33333333-3333-3333-3333-333333333333", newsletter_id: "n1" },
    ];
    let giri = 0;
    const db = {
      rpc(fn, args) {
        chiamate.push([fn, args]);
        if (fn === "prepara_newsletter_del_giorno") return Promise.resolve({ data: 1, error: null });
        if (fn === "newsletter_da_inviare") return Promise.resolve({ data: giri++ === 0 ? coda : [], error: null });
        if (fn === "segna_consegna_newsletter") return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: null, error: { message: "sconosciuta" } });
      },
    };
    const mandate = [];
    const invia = async (dest, oggetto, html, opzioni) => {
      mandate.push({ dest, html, opzioni });
      return dest === "b@x.it" ? { ok: false, motivo: "errore_api" } : { ok: true };
    };
    const esito = await I.giroInvio(db, invia, "2027-10-10");
    ok(esito.inviate === 2 && esito.fallite === 1, "due inviate e una fallita, contate separate", esito);
    const segni = chiamate.filter(([fn]) => fn === "segna_consegna_newsletter").map(([, a]) => `${a.p_id}:${a.p_ok}`).sort();
    ok(JSON.stringify(segni) === JSON.stringify(["c1:true", "c2:false", "c3:true"]), "ogni consegna scrive il SUO esito", segni);
    ok(chiamate.filter(([fn]) => fn === "newsletter_da_inviare").length === 1, "una coda più corta di un lotto chiude il giro");
    const prima = mandate.find((m) => m.dest === "a@x.it");
    ok(prima && prima.html.includes("&lt;b&gt;sabato&lt;/b&gt;") && !prima.html.includes("<b>sabato"), "il testo dell'ente arriva come testo, non come markup");
    ok(prima && prima.html.includes("/disiscrizione/newsletter/11111111-1111-1111-1111-111111111111"), "ogni email ha la sua uscita, con il codice di quell'iscrizione");
    ok(prima && prima.opzioni.intestazioni["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click"
      && prima.opzioni.intestazioni["List-Unsubscribe"].includes("/api/newsletter/uscita/11111111"), "…e le intestazioni di uscita con un clic (RFC 8058)");
    // Un guasto del database non si dice «zero inviate e basta».
    const rotto = { rpc: (fn) => Promise.resolve(fn === "prepara_newsletter_del_giorno" ? { data: null, error: { message: "giù" } } : { data: [], error: null }) };
    const e2 = await I.giroInvio(rotto, invia, "2027-10-10");
    ok(e2.preparate === null && e2.guasti.some((g) => g.passo === "prepara"), "una preparazione fallita è un guasto, e «preparate» resta non letto");
    // Un Brevo che lancia non ferma le altre.
    giri = 0;
    const lancia = async (dest) => {
      if (dest === "a@x.it") throw new Error("rete");
      return { ok: true };
    };
    const e3 = await I.giroInvio(db, lancia, "2027-10-10");
    ok(e3.inviate === 2 && e3.fallite === 1, "un'eccezione su una email non ferma le altre", e3);
  }

  console.log("\n§5 — com'è andata, per l'ente: «per email», sempre\n");
  {
    const righe = R.testoEsitoNewsletter({ destinatari: 120, inviate: 112, inCoda: 0, fallite: 0, scadute: 8 });
    ok(righe[0] === "Inviata a 120 studenti.", "il numero dei destinatari", righe[0]);
    ok(righe.some((r) => r === "8 non l'hanno ricevuta per email perché erano in coda con altre newsletter e questa era scaduta: la trovano dentro KIREO."),
      "le scadute con il testo di Mario", righe);
    const una = R.testoEsitoNewsletter({ destinatari: 1, inviate: 0, inCoda: 0, fallite: 0, scadute: 1 });
    ok(una[0] === "Inviata a 1 studente." && una.some((r) => r.startsWith("1 non l'ha ricevuta") && r.endsWith("la trova dentro KIREO.")), "al singolare", una);
    ok(/non siamo riusciti/i.test(R.testoEsitoNewsletter(null)[0]), "non letto non è zero");
    ok(!righe.some((r) => /non l'hanno ricevuta\.|non l'hanno ricevuta$/.test(r)), "mai «non l'hanno ricevuta» senza «per email»");
  }

  console.log("\n§6 — ogni rifiuto del database ha il suo testo\n");
  {
    const codici = [...new Set([...MIGRAZIONE.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]))].filter((c) => c !== "non_autorizzato" && c !== "consegna_non_trovata" && c !== "non_trovata");
    ok(codici.length >= 10, `i codici letti dalla migrazione: ${codici.length}`, codici);
    const generico = R.messaggioErroreNewsletter(null);
    const senza = codici.filter((c) => R.messaggioErroreNewsletter(`ERROR: ${c}`) === generico);
    ok(senza.length === 0, "nessun codice cade sul messaggio generico", senza);
  }

  console.log("\n§7 — l'uscita dalla posta non disiscrive aprendosi\n");
  {
    const pagina = senzaCommenti(leggi("app/disiscrizione/newsletter/[codice]/page.tsx"));
    ok(!/esci_newsletter_con_codice/.test(pagina), "la pagina non chiama l'uscita: la chiama il bottone");
    ok(/method="post"/.test(pagina), "…un bottone in un form che fa una POST");
    const route = senzaCommenti(leggi("app/api/newsletter/uscita/[codice]/route.ts"));
    ok(/export async function POST/.test(route) && !/export async function GET/.test(route), "la route dell'uscita risponde solo a una POST");
    ok(/List-Unsubscribe=One-Click/.test(route), "…compresa quella con un clic del client di posta");
    // Dal 30/10 le due funzioni dell'uscita le esegue solo il server.
    ok(/grant execute on function public\.esci_newsletter_con_codice\(uuid\) to service_role;/.test(MIGRAZIONE)
      && !/esci_newsletter_con_codice\(uuid\) to anon/.test(MIGRAZIONE), "l'uscita la esegue solo la service role, non un visitatore");
  }

  console.log("\n§8 — i piani sono due\n");
  {
    ok(JSON.stringify(Object.keys(P.ETICHETTA_PIANO).sort()) === JSON.stringify(["free", "premium"]), "ETICHETTA_PIANO: free e premium", Object.keys(P.ETICHETTA_PIANO));
    for (const f of ["app/istituzioni/page.tsx", "app/ente/(dashboard)/piano/page.tsx", "app/contatti/page.tsx", "lib/ente/pianoSuccessivo.ts"]) {
      ok(!/\bPlus\b|"plus"|'plus'/.test(senzaCommenti(leggi(f))), `${f}: il plus non c'è più`);
    }
    ok(/QUOTA_NEWSLETTER\.free/.test(leggi("app/istituzioni/page.tsx")), "il listino pubblico legge le newsletter dalla costante, non da un numero scritto");
    ok(/raise exception 'piano plus ancora in uso/.test(MIGRAZIONE), "la migrazione si ferma se il plus è ancora in uso, invece di toglierlo");
  }

  console.log("\n§9 — i testi non cambiano con chi legge\n");
  {
    const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
    const U = require("@/lib/newsletter/uscita");
    const testi = [
      ...Object.values(R.TESTI_NEWSLETTER).map((t) => (typeof t === "function" ? t("2027-10-10", 3) : t)),
      ...R.testoEsitoNewsletter({ destinatari: 3, inviate: 1, inCoda: 1, fallite: 0, scadute: 1 }),
      ...Object.values(U.TESTI_USCITA).map((t) => (typeof t === "function" ? t("Ente") : t)),
      T.templateNewsletter({ enteNome: "Ente", oggetto: "O", corpo: "C", linkLeggi: "https://kireo.it/a", linkUscita: "https://kireo.it/b" }),
    ];
    const accordi = testi.flatMap((t) => trovaAccordi(String(t)));
    ok(accordi.length === 0, "nessuna forma accordata col genere", accordi);
  }

  console.log("\n§10 — l'ente sa della decisione: dentro KIREO e per email\n");
  {
    const A = require("@/lib/ente/avvisoDecisione");
    const ok1 = A.testoAvvisoDecisione({ cosa: "evento", id: "e1", titolo: "Open day", approvata: true, nota: null });
    ok(ok1.righe[0] === "KIREO ha approvato il tuo evento «Open day»." && ok1.link.endsWith("/diretta/e1"), "un evento approvato, con il link all'evento", ok1);
    const ko = A.testoAvvisoDecisione({ cosa: "newsletter", id: "n1", titolo: "Novità", approvata: false, nota: "Promette un esito." });
    ok(ko.righe.some((r) => r === "Il motivo: Promette un esito.") && ko.righe.some((r) => /giorno che avevi scelto intanto si è liberato/.test(r)),
      "una newsletter non approvata porta il motivo, e dice che il giorno si è liberato", ko.righe);
    const nl = A.testoAvvisoDecisione({ cosa: "newsletter", id: "n1", titolo: "Novità", approvata: true, nota: null, giorno: "2027-10-10" });
    ok(nl.righe.some((r) => /parte il 10 ottobre 2027 alle 7:30/.test(r)), "una newsletter approvata dice quando parte", nl.righe);
    // La decisione si RILEGGE dal database: l'avviso prende solo cosa e quale.
    ok(/export async function avvisaEnteDellaDecisione\(cosa: CosaDecisa, id: string\)/.test(leggi("lib/ente/avvisoDecisione.ts")),
      "l'email non prende il testo da chi chiama: riceve solo cosa e quale, e rilegge stato e nota");
    ok(/fetch\("\/api\/admin\/decisione"/.test(leggi("components/admin/AzioneApprovazione.tsx"))
      && /avvisaEnteDellaDecisione\(cosa, id\)/.test(leggi("app/api/admin/decisione/route.ts")),
      "la decisione dell'admin passa dal server, e lì parte l'avviso");
    ok(/create trigger eventi_avvisa_ente[\s\S]*?create trigger newsletter_avvisa_ente/.test(MIGRAZIONE),
      "la notifica dentro KIREO la scrive un trigger, per gli eventi e per le newsletter, da qualunque strada");
  }

  console.log("");
  console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà`);
  process.exit(falliti === 0 ? 0 : 1);
})();
