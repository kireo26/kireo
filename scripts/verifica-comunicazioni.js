#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:comunicazioni` — il consenso alle comunicazioni di KIREO e
// l'uscita dalle newsletter degli enti (28/10/2026, 20261107100000).
//   §1 la casella della registrazione è il consenso, e viene scritta
//   §2 l'uscita da una newsletter conta le righe che ha tolto
//   §3 /disiscrizione legge il consenso vero
//   §4 i testi: tre stati distinti, nessun accordo col genere
// La parte sul database (chi può scrivere la colonna) la prova
// scripts/verifica-consenso-comunicazioni.sql.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();
const C = require("@/lib/app/comunicazioniKireo");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

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
// Un'àncora mancante o doppia è un rosso, non un crash.
function posizione(src, nome) {
  try {
    return ancora(src, nome);
  } catch (e) {
    console.log(`    ${e.message.split("\n")[0]}`);
    return -1;
  }
}
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

console.log("\n§1 — la casella è il consenso\n");
const reg = leggi("components/RegistrazioneForm.tsx");
ok(reg.includes("{TESTO_CASELLA_REGISTRAZIONE}"), "la casella mostra il testo del consenso, da un posto solo");
ok(/KIREO/.test(C.TESTO_CASELLA_REGISTRAZIONE), "il testo della casella dice che sono le comunicazioni di KIREO", C.TESTO_CASELLA_REGISTRAZIONE);
const fin = leggi("lib/finalizzaRegistrazione.ts");
const iRpc = posizione(fin, 'supabase.rpc("finalize_registration"');
const iConsenso = posizione(fin, 'impostaComunicazioniKireo(supabase, meta.newsletter, "registrazione")');
ok(iRpc > 0 && iConsenso > iRpc, "la registrazione scrive il consenso dopo aver creato il profilo", `${iRpc} / ${iConsenso}`);
ok(/typeof meta\.newsletter === "boolean"/.test(fin), "solo una risposta vera e propria diventa un consenso (nessun default)");

console.log("\n§2 — l'uscita conta quello che ha tolto\n");
const com = leggi("components/app/ComunicazioniStudente.tsx");
ok(/\.from\("newsletter_iscrizioni"\)\.delete\(\)\.eq\("id", id\)\.select\(/.test(com), "la cancellazione rilegge le righe toccate (.select)");
ok(/data\.length === 0/.test(com), "zero righe è un rifiuto, non un'uscita");
ok(/impostaComunicazioniKireo\(createClient\(\), valore, origine\)/.test(com), "il profilo scrive il consenso dalla funzione, non dalla tabella");
ok(!/\.from\("profiles"\)\.update/.test(com), "nessun update diretto di profiles");
const profilo = leggi("app/app/profilo/page.tsx");
ok(profilo.includes("<ComunicazioniStudente"), "il profilo dello studente ha la sezione");

console.log("\n§3 — /disiscrizione legge il consenso\n");
const dis = leggi("app/disiscrizione/page.tsx");
ok(dis.includes("comunicazioni_kireo") && dis.includes("<ComunicazioniStudente"), "la pagina legge il consenso e lo fa cambiare");
ok(dis.includes('origine="disiscrizione"'), "con la sua origine");
ok(!/non c&apos;è quindi alcuna preferenza da revocare/.test(dis), "la frase «non c'è niente da revocare» è uscita");
// Chi vede le scelte: chi ha qualcosa da revocare, non chi è studente oggi (28/10).
// Gli attesi sono scritti qui, non importati.
ok(C.mostraLeScelte({ ruolo: "admin", consenso: true, iscrizioni: 0 }) === true, "un admin che ha detto sì da studente vede il suo consenso e può ritirarlo (il sesto sì)");
ok(C.mostraLeScelte({ ruolo: "referente_scuola", consenso: null, iscrizioni: 2 }) === true, "chi è diventato referente con due iscrizioni ne vede l'uscita");
ok(C.mostraLeScelte({ ruolo: "studente", consenso: null, iscrizioni: 0 }) === true, "uno studente vede sempre la domanda");
ok(C.mostraLeScelte({ ruolo: "docente", consenso: null, iscrizioni: 0 }) === false, "un docente senza niente da revocare non vede una domanda che non lo riguarda");
ok(C.mostraLeScelte({ ruolo: "docente", consenso: undefined, iscrizioni: 0 }) === true, "non letto non diventa «non ricevi niente»");
const disCodice = senzaCommenti(dis);
ok(/mostraLeScelte\(\{ ruolo: profilo\?\.ruolo, consenso, iscrizioni:/.test(disCodice), "la pagina decide con mostraLeScelte");
ok(!/ruolo === "studente"/.test(disCodice), "e non filtra più sul ruolo di oggi");

console.log("\n§4 — i testi\n");
const stati = [true, false, null].map((v) => C.testoStatoConsenso(v));
ok(new Set(stati).size === 3, "tre stati, tre testi (mai chiesto non è un no)", JSON.stringify(stati));
const testi = [
  C.TESTO_CASELLA_REGISTRAZIONE,
  C.TESTO_A_COSA_SERVE,
  C.TESTO_SOLO_MAGGIORENNI,
  ...stati,
  ...[...com.matchAll(/>\s*([A-ZÈ][^<>{}]{8,})\s*</g)].map((m) => m[1]),
];
ok(testi.length >= 10, "testi letti (soglia)", String(testi.length));
const accordi = testi.flatMap((t) => trovaAccordi(t).map((a) => `${a} in «${t}»`));
ok(accordi.length === 0, "nessun accordo col genere di chi legge", accordi.join("; "));

console.log("\n§5 — un consenso vale solo se dato da maggiorenni (20261107110000)\n");
// Le date sono scritte a mano qui, e sono le stesse di
// scripts/verifica-consenso-maggiorenni.sql: due copie della regola (TS e SQL)
// devono dire la stessa cosa sugli stessi casi.
ok(C.consensoDatoDaMaggiorenne("2025-03-10T00:00:00Z", "2007-03-10") === true, "il giorno dei 18 anni vale");
ok(C.consensoDatoDaMaggiorenne("2025-03-09T12:00:00Z", "2007-03-10") === false, "il giorno prima non vale");
ok(C.consensoDatoDaMaggiorenne("2023-03-10T00:00:00Z", "2007-03-10") === false, "un sì a 16 anni non vale nemmeno dopo (non si eredita)");
ok(C.consensoDatoDaMaggiorenne(new Date(), null) === false, "senza data di nascita non vale");
ok(/consensoDatoDaMaggiorenne\(user\.created_at, dataNascita\)/.test(fin), "la registrazione guarda l'età di QUANDO ha risposto, non di adesso");
const iCasellaCondizione = posizione(reg, "{dataNascita && isMaggiorenne(dataNascita) && (");
const iCasella = posizione(reg, "{TESTO_CASELLA_REGISTRAZIONE}");
ok(iCasellaCondizione > 0 && iCasella > iCasellaCondizione, "la casella si mostra solo a una data di nascita maggiorenne", `${iCasellaCondizione} / ${iCasella}`);
ok(/dataNascita && isMaggiorenne\(dataNascita\) \? \{ newsletter \} : \{\}/.test(reg), "a un minorenne la chiave non si scrive (resta «mai chiesto»)");
const bottone = leggi("components/app/IscrivitiNewsletterButton.tsx");
ok(/eta: StatoEta;/.test(bottone), "il bottone della newsletter pretende l'età in tre stati (nessun default)");
ok(posizione(bottone, 'if (eta !== "maggiorenne" && !iscritto) return null;') > 0 && posizione(bottone, 'if (eta !== "maggiorenne" && !iscritto) return null;') < posizione(bottone, "async function handleClick()"), "a chi non riceverà niente il bottone non compare (a uno già iscritto, l'uscita resta)");
ok(leggi("app/istituzioni/[slug]/page.tsx").includes("eta={eta}"), "la pagina dell'ente gliela passa");
const iRamoMinore = posizione(com, '{eta === "minorenne" ? (');
ok(iRamoMinore > 0 && iRamoMinore < posizione(com, "Sì, voglio riceverle"), "a un minorenne il profilo non fa la domanda");
// Gli attesi dei testi sono scritti a mano: il primo è di Mario, parola per parola.
ok(C.TESTO_SOLO_MAGGIORENNI === "KIREO non invia comunicazioni facoltative a chi ha meno di 18 anni.", "la regola detta come una regola nostra (testo di Mario)", C.TESTO_SOLO_MAGGIORENNI);
for (const t of [C.TESTO_SOLO_MAGGIORENNI, C.TESTO_NEWSLETTER_SOLO_MAGGIORENNI]) {
  ok(!/non puoi/i.test(t) && trovaAccordi(t).length === 0, "nessun «non puoi» e nessun accordo", t);
}
ok(/Non siamo riusciti a toglierti/.test(com) && !/non risult/i.test(com), "un'uscita fallita dice che non è riuscita, mai che non risulti iscritto");
const stat = leggi("app/ente/(dashboard)/statistiche/page.tsx");
ok(/valore=\{stats\.newsletter\.raggiungibili\}/.test(stat), "il numero grande dell'ente è chi la riceverà");
// Due cifre uguali non si stampano una sopra l'altra (Mario, 28/10): la seconda
// solo quando differisce. Atteso scritto a mano.
ok(C.sottoNewsletterEnte(4, 4) === null, "iscritti e riceventi uguali: un numero solo");
ok(/Iscritti in tutto: 5\./.test(C.sottoNewsletterEnte(5, 3) ?? ""), "diversi: la seconda cifra, con il perché", C.sottoNewsletterEnte(5, 3));
ok(trovaAccordi(C.sottoNewsletterEnte(5, 3) ?? "").length === 0, "senza accordi di genere");
ok(/sotto=\{sottoNewsletterEnte\(stats\.newsletter\.iscritti, stats\.newsletter\.raggiungibili\)\}/.test(senzaCommenti(stat)), "la pagina dell'ente chiama sottoNewsletterEnte con i due numeri nell'ordine giusto");

console.log("§6 l'età: due gesti aperti dai 14, le comunicazioni facoltative dai 18");
// I due gesti tornano aperti (20261109100000): nessun ramo d'età nei bottoni,
// nessuna età passata dalla pagina, e la migrazione toglie i due cancelli SQL.
for (const f of ["components/app/ManifestazioneInteresseButton.tsx", "components/app/MessaggioEnteButton.tsx"]) {
  const src = leggi(f);
  ok(!/maggiorenne/i.test(src) && !/dai 18 anni/.test(src), `${path.basename(f)}: nessun blocco d'età`);
}
const paginaEnte = leggi("app/istituzioni/[slug]/page.tsx");
ok((paginaEnte.match(/eta=\{eta\}/g) ?? []).length === 1, "la pagina dell'ente passa l'età a un bottone solo (la newsletter)");
ok(/<IscrivitiNewsletterButton[^>]*eta=\{eta\}/.test(paginaEnte), "e quel bottone è la newsletter");
// L'ULTIMA definizione SQL di ciascun cancello, dalle migrazioni in ordine:
// la policy di insert e le due funzioni dei messaggi non guardano più l'età.
const migrazioni = fs.readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
function ultima(re) {
  let trovata = null;
  for (const f of migrazioni) {
    const src = fs.readFileSync(path.join(ROOT, "supabase/migrations", f), "utf8").replace(/--.*$/gm, "");
    const m = src.match(re);
    if (m) trovata = { file: f, testo: m[0] };
  }
  return trovata;
}
const policy = ultima(/create policy manifestazioni_interesse_insert_own[\s\S]*?;/);
ok(policy && !/maggiorenne/.test(policy.testo), "l'ultima policy di insert delle condivisioni non guarda l'età", policy?.file);
for (const fn of ["apri_conversazione_ente", "invia_messaggio_ente"]) {
  const d = ultima(new RegExp(`create or replace function public\\.${fn}\\([\\s\\S]*?\\$\\$;`));
  ok(d && !/maggiorenne/.test(d.testo), `l'ultima ${fn} non guarda l'età`, d?.file);
}
// La soglia delle comunicazioni sta in due righe, e le due concordano: il TS
// contro l'intervallo dell'ultima consenso_dato_da_maggiorenne (atteso da una
// fonte indipendente dal file TS: la migrazione).
const regola = ultima(/create or replace function public\.consenso_dato_da_maggiorenne\([\s\S]*?\$\$;/);
const anniSql = Number(regola?.testo.match(/interval '(\d+) years'/)?.[1]);
ok(anniSql === C.ETA_COMUNICAZIONI_FACOLTATIVE, "la soglia del TS è quella del SQL", `${C.ETA_COMUNICAZIONI_FACOLTATIVE} / ${anniSql}`);
ok(C.consensoDatoDaMaggiorenne("2025-03-10T00:00:00Z", "2007-03-10") && !C.consensoDatoDaMaggiorenne("2025-03-09T12:00:00Z", "2007-03-10"), "la regola usa la soglia: vale il giorno dei 18, non il giorno prima");
const btnNewsletter = leggi("components/app/IscrivitiNewsletterButton.tsx");
ok(/if \(eta !== "maggiorenne" && !iscritto\) return null;/.test(btnNewsletter), "la newsletter di un ente resta ai maggiorenni");

console.log("§7 l'uscita sta dove sta l'entrata, e l'eliminazione in fondo");
ok(!/disabled=\{[^}]*iscritto/.test(btnNewsletter), "«Iscritto» non è un bottone spento: si esce con lo stesso clic");
ok(/\.from\("newsletter_iscrizioni"\)\s*\.delete\(\)[\s\S]*?\.select\("id"\)/.test(btnNewsletter), "l'uscita dalla pagina dell'ente conta le righe tolte");
const paginaProfilo = leggi("app/app/profilo/page.tsx");
const iCom = posizione(paginaProfilo, "<ComunicazioniStudente");
const iPrivacy = posizione(paginaProfilo, "<BloccoPrivacy");
const iCondivisi = posizione(paginaProfilo, "<ListaManifestazioniInteresse");
ok(iCom > 0 && iCondivisi > iCom && iPrivacy > iCondivisi, "il profilo: comunicazioni, condivisioni, e in fondo privacy ed eliminazione", `${iCom} / ${iCondivisi} / ${iPrivacy}`);
ok(!/<BloccoPrivacy/.test(leggi("components/app/ProfiloForm.tsx").replace(/export function BloccoPrivacy/, "")), "ProfiloForm non monta più l'eliminazione in mezzo alle sezioni");
ok(/seguitiIniziali=\{seguiti\}/.test(paginaProfilo), "il profilo passa gli enti seguiti alle comunicazioni");
ok(/\.from\("seguiti"\)\s*\.delete\(\)[\s\S]*?\.select\("istituzione_id"\)/.test(com), "smettere di seguire conta le righe tolte");
ok(/seguiti === undefined/.test(com), "gli enti seguiti non letti si dicono, non diventano «nessuno»");
ok(trovaAccordi(C.TESTO_SEGUITI).length === 0, "il testo dei seguiti senza accordi di genere");
const ente = leggi("app/istituzioni/[slug]/page.tsx");
const riga = ente.slice(posizione(ente, "<SeguiButton"), posizione(ente, "<MessaggioEnteButton"));
ok(/<IscrivitiNewsletterButton/.test(riga) && /<ManifestazioneInteresseButton/.test(riga), "sulla pagina dell'ente i tre gesti stanno insieme, prima del messaggio");
ok((ente.match(/<IscrivitiNewsletterButton/g) ?? []).length === 1, "e la newsletter non ha più una seconda sezione sua");

console.log("§8 chi contatta un ente: uno studente con una data, e «non lo so» non è un no silenzioso");
const E = require("@/lib/eta");
const K = require("@/lib/app/contattoEnti");
// Gli attesi sono scritti a mano: la tabella che il database applica
// (puo_contattare_enti, 20261109110000) è «studente E data».
ok(K.contattoEnti("studente", "2010-05-01") === "si", "uno studente con una data contatta un ente (anche a 16 anni)");
ok(K.contattoEnti("studente", null) === "manca_data", "uno studente senza data: manca la data, non «no»");
ok(K.contattoEnti("docente", "1980-01-01") === "non_studente", "un docente, anche con una data, non condivide «il profilo da studente»");
ok(K.contattoEnti("istituzione", null) === "non_studente" && K.contattoEnti(null, null) === "non_studente", "un ente, o un ruolo non letto, no");
ok(E.statoEta(null) === "sconosciuta" && E.statoEta("") === "sconosciuta", "un'età assente è sconosciuta, non minorenne");
ok(E.statoEta("1990-01-01") === "maggiorenne" && E.statoEta(new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10)) === "minorenne", "e le due che sappiamo");
for (const f of ["components/app/ManifestazioneInteresseButton.tsx", "components/app/MessaggioEnteButton.tsx"]) {
  const src = leggi(f);
  ok(/contatto: ContattoEnti;/.test(src), `${path.basename(f)}: pretende chi può contattare (nessun default)`);
  ok(/if \(contatto !== "si" && !(id|conversazioneEsistenteId)\) return null;/.test(src), `${path.basename(f)}: senza il permesso niente bottone, ma l'uscita o la conversazione già aperta restano`);
}
ok((paginaEnte.match(/contatto=\{contatto\}/g) ?? []).length === 2, "la pagina passa chi può contattare ai due bottoni");
ok(/contattoEnti\(profilo\?\.ruolo/.test(paginaEnte), "e lo deriva dal ruolo e dalla data letti, non da una costante");
// La ragione di un gesto che manca sta SOTTO la fila, non dentro (Mario, 28/10).
const iFila = posizione(paginaEnte, "<SeguiButton");
const iFineFila = posizione(paginaEnte, "contatto={contatto}\n            manifestazioneAttivaId");
const iManca = posizione(paginaEnte, "{TESTO_MANCA_DATA_CONTATTO}");
const iMinore = posizione(paginaEnte, "{TESTO_NEWSLETTER_SOLO_MAGGIORENNI}");
const iFollower = posizione(paginaEnte, "{conteggioFollower}");
ok(iFila > 0 && iManca > iFineFila && iMinore > iFineFila && iFollower > iMinore, "le frasi stanno dopo la fila dei tre gesti, e i follower dopo le frasi", `${iFila} / ${iFineFila} / ${iManca} / ${iMinore} / ${iFollower}`);
ok(!/TESTO_NEWSLETTER_SOLO_MAGGIORENNI/.test(btnNewsletter), "il bottone della newsletter non mette più la frase al proprio posto");
ok(/eta === "sconosciuta"/.test(com) && /TESTO_MANCA_DATA_COMUNICAZIONI/.test(com), "le comunicazioni a chi non ha una data dicono che non la sappiamo");
for (const t of [K.TESTO_MANCA_DATA_CONTATTO, K.TESTO_MANCA_DATA_COMUNICAZIONI]) {
  ok(trovaAccordi(t).length === 0 && !/meno di 18|maggiorenn/i.test(t), "un testo per chi non ha una data non afferma un'età", t);
}
const layoutApp = leggi("app/app/layout.tsx");
ok(!/riservate ai maggiorenni/.test(layoutApp), "la richiesta della data in /app non promette più un blocco dei 18 anni che non c'è");

console.log("§9 le etichette dei tre gesti dicono cosa apre ciascuno");
const G = require("@/lib/app/gestiEnte");
// Gli attesi sono i fatti, scritti a mano (le notifiche ai follower, chi manda
// la newsletter, i campi che l'ente vede): non i testi.
ok(/Bacheca/.test(G.DIDASCALIA_SEGUI) && /Nessuna email/.test(G.DIDASCALIA_SEGUI), "«Segui» dice dove arrivano i post, e che non arriva nessuna email");
ok(/KIREO/.test(G.DIDASCALIA_NEWSLETTER) && /indirizzo/.test(G.DIDASCALIA_NEWSLETTER) && /18 anni/.test(G.DIDASCALIA_NEWSLETTER), "la newsletter dice chi la manda, che l'indirizzo non passa all'ente, e da che età");
ok(/nostro/.test(G.DIDASCALIA_NEWSLETTER) && !/legge/i.test(G.DIDASCALIA_NEWSLETTER), "e i 18 anni sono un impegno nostro, non una legge");
const pannello = leggi("components/app/ManifestazioneInteresseButton.tsx");
for (const campo of ["nome", "scuola", "aree"]) {
  ok(G.DIDASCALIA_CONDIVIDI.includes(campo) && pannello.includes(campo), `la didascalia della condivisione e il pannello nominano tutti e due «${campo}»`);
}
ok(/dentro KIREO/.test(G.DIDASCALIA_CONDIVIDI) && /solo tramite i messaggi di KIREO/.test(pannello), "e tutti e due dicono che il contatto resta dentro KIREO");
for (const t of [G.DIDASCALIA_SEGUI, G.DIDASCALIA_NEWSLETTER, G.DIDASCALIA_CONDIVIDI]) {
  ok(trovaAccordi(t).length === 0 && !/non puoi/i.test(t), "nessun accordo e nessun «non puoi»", t);
}
ok(/didascalia=\{DIDASCALIA_SEGUI\}/.test(paginaEnte) && /didascalia=\{DIDASCALIA_NEWSLETTER\}/.test(paginaEnte) && /didascalia=\{DIDASCALIA_CONDIVIDI\}/.test(paginaEnte), "la pagina dell'ente passa le tre didascalie");
for (const f of ["app/app/esplora/page.tsx", "app/aree/[slug]/page.tsx"]) {
  ok(!/didascalia=/.test(leggi(f)), `${f}: le card non portano la didascalia (la riga si legge accanto agli altri due gesti)`);
}
// La didascalia della newsletter sta DOPO il `return null`: quando il bottone
// non c'è, non resta una didascalia orfana.
ok(ancora(btnNewsletter, 'if (eta !== "maggiorenne" && !iscritto) return null;') < btnNewsletter.search(/\{didascalia &&[^\n]*\n\s*\{errore && \(/), "la didascalia della newsletter compare solo con il bottone");
ok(/!mostraInfo \? \([\s\S]*?\{didascalia &&[\s\S]*?\) : \(/.test(pannello), "a pannello aperto la didascalia della condivisione sparisce");

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
