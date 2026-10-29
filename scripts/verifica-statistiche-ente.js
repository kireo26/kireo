#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LE STATISTICHE DELL'ENTE (Mario, 27/10): «Download guida: 0» con la guida
// scaricata, e «0 iscritti · 1 partecipati» sulla stessa riga. Le due cure
// stanno nel database (20261102110000, 20261102120000, provate da
// `scripts/verifica-statistiche-ente.sql`); qui si sorveglia la metà del client
// che le fa funzionare, cioè DOVE e COME si scrive `recinto_enti`.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");
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
  const out = [];
  for (const voce of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...fileSorgenti(rel));
    else if (/\.(ts|tsx)$/.test(voce.name)) out.push(rel);
  }
  return out;
}

(async () => {
console.log("\n§1 — chi scrive il recinto, e su quale vincolo\n");
{
  // L'insieme: ogni file del prodotto che nomina la tabella in una `.from(...)`.
  const sorgenti = ["app", "components", "lib"].flatMap(fileSorgenti);
  const scrittori = sorgenti.filter((f) => /\.from\(\s*["']recinto_enti["']\s*\)\s*\.\s*(insert|upsert|update|delete)\b/.test(leggi(f)));
  ok(scrittori.length === 1 && scrittori[0] === path.join("lib", "app", "recinto.ts"),
    "una sola scrittura su recinto_enti in tutto il prodotto, in lib/app/recinto.ts", scrittori);

  // L'atteso viene dalle MIGRAZIONI, non dal file sotto esame: l'ultimo vincolo
  // unique su recinto_enti che nessuna migrazione successiva ha tolto.
  const dir = path.join(ROOT, "supabase/migrations");
  const vincoli = new Map();
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
    // Per nome: un file che crea il recinto crea anche altre tabelle, coi loro vincoli.
    for (const m of sql.matchAll(/constraint (recinto_enti_\w+) unique \(([^)]*)\)/g)) {
      vincoli.set(m[1], m[2].split(",").map((c) => c.trim()).sort().join(","));
    }
    for (const m of sql.matchAll(/alter table public\.recinto_enti drop constraint (\w+)/g)) vincoli.delete(m[1]);
  }
  ok(vincoli.size === 1, `le migrazioni lasciano un vincolo unique sul recinto (${[...vincoli.keys()].join(", ") || "nessuno"})`);
  const atteso = [...vincoli.values()][0] ?? "";
  const recinto = leggi("lib/app/recinto.ts");
  const bersaglio = (recinto.match(/onConflict:\s*"([^"]+)"/) ?? [])[1] ?? "";
  ok(bersaglio.split(",").map((c) => c.trim()).sort().join(",") === atteso,
    "il bersaglio del conflitto è il vincolo delle migrazioni", { bersaglio, atteso });
  ok(atteso.split(",").includes("origine"), "…e il vincolo comprende l'origine: una guida dopo un evento lascia la sua riga", atteso);
  ok(/if \(error\) console\.error/.test(recinto), "un errore della scrittura si scrive nel log, non si butta");

  // Ogni gesto dal browser passa da lì, ognuno con la sua origine. La guida
  // dal 29/10 no: la riga con origine `guida` la scrive il server, in
  // `registra_download_guida` (20261114100000), prima di mandare il file —
  // nel browser, dopo il download, non partiva quasi mai. E nel form non deve
  // tornare nessuna scrittura.
  const migGuida = leggi("supabase/migrations/20261114100000_guida_scaricata_dal_server.sql");
  ok(/insert into public\.recinto_enti[\s\S]{0,120}'guida'/.test(migGuida), "la riga «guida» la scrive registra_download_guida");
  for (const f of ["components/app/GuidaEnteForm.tsx", "components/ScaricaGuidaForm.tsx"]) {
    ok(!/segnaNelRecinto|recinto_enti/.test(leggi(f)), `${f} non scrive il recinto dal browser`);
  }
  for (const [f, origine] of [
    ["components/app/IscrivitiNewsletterButton.tsx", "newsletter"],
    ["components/app/IscrivitiEventoButton.tsx", "evento"],
  ]) {
    ok(new RegExp(`segnaNelRecinto\\([^)]*"${origine}"\\)`).test(leggi(f)), `${f} segna l'origine «${origine}»`);
  }
}


console.log("\n§2 — le quote contano solo l'approvato, e «non letto» non è zero\n");
{
  // Un client finto che registra i filtri di ogni lettura e risponde con un
  // conteggio. Si ESEGUE getQuoteEnte, non se ne legge il testo.
  function clienteFinto({ fallisce = null } = {}) {
    const letture = [];
    return {
      letture,
      from(tabella) {
        const filtri = [];
        letture.push({ tabella, filtri });
        const catena = {
          select() { return catena; },
          eq(c, v) { filtri.push(["eq", c, v]); return catena; },
          in(c, v) { filtri.push(["in", c, v]); return catena; },
          not(c, op, v) { filtri.push(["not", c, v]); return catena; },
          gte() { return catena; },
          lte() { return catena; },
          maybeSingle() {
            return Promise.resolve({ data: { quota_eventi_promossi: 5, quota_newsletter: 12, quota_cta_esterne: 5 }, error: null });
          },
          then(ok, ko) {
            const tipo = filtri.find((f) => f[1] === "tipo")?.[2] ?? (filtri.some((f) => f[1] === "cta_esterna_url") ? "cta" : "evidenza");
            const r = fallisce === tipo ? { count: null, error: { message: "rete" } } : { count: 2, error: null };
            return Promise.resolve(r).then(ok, ko);
          },
        };
        return catena;
      },
    };
  }
  const { getQuoteEnte } = require(path.join(ROOT, "lib/ente/quote.ts"));
  const erroreOriginale = console.error;
  console.error = () => {};
  const finto = clienteFinto();
  const q = await getQuoteEnte(finto, "ente", "premium");
  const nulle = [];
  for (const tipo of ["evidenza", "cta", "newsletter"]) {
    nulle.push([tipo, await getQuoteEnte(clienteFinto({ fallisce: tipo }), "ente", "premium")]);
  }
  console.error = erroreOriginale;

  ok(q && q.newsletterUsate === 2 && q.newsletterTotali === 12, "con le letture riuscite, le quote escono coi numeri", q);
  const di = (pred) => finto.letture.find((l) => pred(l.filtri));
  const cta = di((f) => f.some((x) => x[1] === "cta_esterna_url"));
  ok(cta && cta.filtri.some((x) => x[0] === "eq" && x[1] === "stato" && x[2] === "approvato"), "le CTA contano solo gli eventi approvati", cta?.filtri);
  {
    const l = di((f) => f.some((x) => x[1] === "tipo" && x[2] === "newsletter"));
    const stati = l?.filtri.find((x) => x[0] === "in" && x[1] === "stato")?.[2] ?? null;
    // L'atteso è scritto qui, non importato da quote.ts.
    ok(JSON.stringify([...(stati ?? [])].sort()) === JSON.stringify(["approvata", "inviata"]),
      "le newsletter contano solo approvate e inviate (non bozze, in approvazione, rifiutate)", stati);
  }
  // LE «COMUNICAZIONI MIRATE» SONO USCITE (28/10): una funzione del piano che non
  // esisteva. Nessuna lettura le conta, e nessuna superficie le offre o le
  // conta più. Torna rosso il giorno in cui qualcuno le rimette senza l'invio.
  ok(!finto.letture.some((l) => l.filtri.some((x) => x[1] === "tipo" && x[2] === "comunicazione_kireo")),
    "le quote non contano più le comunicazioni mirate");
  for (const [file, cosa] of [
    ["components/ente/CreaComunicazioneForm.tsx", "il form"],
    ["components/ente/RiquadriQuote.tsx", "i riquadri delle quote"],
    ["app/ente/(dashboard)/piano/page.tsx", "la pagina del piano"],
    ["app/istituzioni/page.tsx", "il listino pubblico"],
    ["lib/ente/quote.ts", "le quote"],
  ]) {
    const codice = senzaCommenti(leggi(file));
    ok(!/comunicazione_kireo|comunicazioniKireo|quota_comunicazioni_kireo|[Cc]omunicazion[ei] mirat|Comunicazioni KIREO/.test(codice),
      `${cosa}: nessuna comunicazione mirata offerta o contata`);
  }
  for (const [tipo, esito] of nulle) ok(esito === null, `una lettura fallita (${tipo}) dà «non letto», non zero`, esito);

  const riquadri = leggi("components/ente/RiquadriQuote.tsx");
  ok(/if \(!quote\)/.test(riquadri) && /TESTO_QUOTE_NON_LETTE/.test(riquadri), "i riquadri dicono «non letto» quando le quote non ci sono");
  for (const f of ["app/ente/(dashboard)/page.tsx", "app/ente/(dashboard)/piano/page.tsx"]) {
    ok(/<RiquadriQuote quote=\{quote\} \/>/.test(leggi(f)), `${f} passa dai riquadri condivisi`);
  }
  const form = leggi("components/ente/CreaComunicazioneForm.tsx");
  ok(/quotaRimasta !== null && quotaRimasta <= 0/.test(form), "il form non dice «quota esaurita» su una quota non letta");
}

console.log("\n§3 — il limite delle aree dipende dal tipo, e sta in un posto solo\n");
{
  const form = leggi("components/ente/ProfiloEnteForm.tsx");
  ok(!/MAX_AREE/.test(form), "il form non ha più una costante sua per il limite");
  ok(/\.rpc\("max_aree_istituzione"/.test(form), "…lo chiede alla funzione del database");
  // Non basta che il nome della costante sia sparito: un 3 scritto a mano nel
  // confronto è la stessa copia senza nome (controprova del 27/10).
  ok(/attive\.length >= massimo\b/.test(form) && !/attive\.length >= \d/.test(form),
    "…e confronta le aree con il numero letto, non con un numero scritto");
  // L'ultima definizione del trigger, dalle migrazioni.
  const dir = path.join(ROOT, "supabase/migrations");
  let ultima = "";
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
    const m = sql.match(/create or replace function public\.limite_aree_istituzione\(\)[\s\S]*?\$\$;/);
    if (m) ultima = m[0];
  }
  ok(/public\.max_aree_istituzione\(new\.istituzione_id\)/.test(ultima), "il trigger usa la stessa funzione del form");
  ok(!/>= 3\b/.test(ultima), "…e non un 3 scritto a mano");
}

console.log("\n§4 — «Per evento» e i riquadri dicono cosa contano\n");
{
  // Dal 29/10 la riga dell'evento sta in un componente, e i testi nella lib.
  const pagina = leggi("components/ente/statistiche/Parti.tsx");
  ok(!/\{s\.\w+\} (iscritti|partecipati|collegati|risposte)\b/.test(pagina), "nessun «{n} iscritti»: con 1 il plurale non accorda");
  ok(!/partecipati<\/span>|>\{?[^<]*\bpartecipati\b[^<]*</.test(pagina.replace(/s\.partecipati/g, "")), "la parola «partecipati» non compare più a schermo");
  ok(/s\.collegati != null \?/.test(pagina), "i collegati compaiono solo dove ci sono (una diretta)");
  ok(/Studenti raggiunti dall'inizio/.test(leggi("lib/ente/statistiche.ts")) && /Studenti raggiunti dall'inizio/.test(leggi("app/ente/(dashboard)/statistiche/studenti/page.tsx")),
    "«Studenti raggiunti» dice che non è un conto dell'anno, sull'indice e nella sezione");
  ok(/nonLetto \?/.test(leggi("app/ente/(dashboard)/statistiche/page.tsx")), "una lettura fallita non si presenta come «nessuna interazione»");
}


console.log("\n§5 — le colonne di istituzioni che decidono non le scrive il client\n");
{
  const dir = path.join(ROOT, "supabase/migrations");
  // L'ultimo grant di update su istituzioni, dalle migrazioni: l'atteso è
  // scritto qui (le colonne che DECIDONO), non preso dalla migrazione.
  let ultimoGrant = null;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = senzaCommentiSql(fs.readFileSync(path.join(dir, f), "utf8"));
    const m = sql.match(/grant update \(([^)]*)\) on public\.istituzioni to authenticated/);
    if (m) ultimoGrant = m[1].split(",").map((c) => c.trim());
  }
  ok(Array.isArray(ultimoGrant), "esiste un grant di update per colonna su istituzioni");
  for (const c of ["tipo", "nome", "slug", "id"]) ok(!(ultimoGrant ?? []).includes(c), `«${c}» non è fra le colonne che il client aggiorna`);
  for (const c of ["descrizione", "sito_ufficiale", "provincia", "immagine_copertina_url"]) ok((ultimoGrant ?? []).includes(c), `«${c}» resta aggiornabile dal profilo`);
  // Il profilo non deve aggiornare una colonna che non ha più.
  const form = leggi("components/ente/ProfiloEnteForm.tsx");
  const scritte = [...form.matchAll(/\.from\("istituzioni"\)\s*\.update\(\{([^}]*)\}/g)].flatMap((m) => m[1].split(",").map((x) => x.split(":")[0].trim()).filter(Boolean));
  ok(scritte.length >= 3 && scritte.every((c) => (ultimoGrant ?? []).includes(c)), "ogni colonna che il profilo scrive è fra quelle concesse", scritte);
}

console.log("\n§6 — i limiti dei file stanno anche sul server, con gli stessi numeri\n");
{
  const media = require(path.join(ROOT, "lib/ente/media.ts"));
  const sql = senzaCommentiSql(fs.readFileSync(path.join(ROOT, "supabase/migrations/20261103140000_storage_istituzioni_media_limiti.sql"), "utf8"));
  const limite = Number((sql.match(/file_size_limit = (\d+)/) ?? [])[1]);
  const tipi = [...((sql.match(/allowed_mime_types = array\[([^\]]*)\]/) ?? [])[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  ok(limite === media.MAX_GUIDA_MB * 1024 * 1024, "il tetto del bucket è quello della guida", { limite, guida: media.MAX_GUIDA_MB });
  ok(JSON.stringify(tipi) === JSON.stringify([...media.TIPI_COPERTINA, media.TIPO_GUIDA].sort()), "i tipi del bucket sono quelli che il form accetta", tipi);
  ok(!tipi.some((t) => /svg/.test(t)), "niente SVG in un bucket pubblico");
  const form = leggi("components/ente/ProfiloEnteForm.tsx");
  ok(/tipoCopertinaAmmesso\(file\.type\)/.test(form) && !/const MAX_(COPERTINA|GUIDA)_MB/.test(form), "il form usa i limiti condivisi, non una copia sua");
}

console.log("\n§6bis — il bucket delle consegne dei workshop accetta quello che accetta il form, non di più\n");
{
  const imm = require(path.join(ROOT, "lib/workshop/immagini.ts"));
  const sql = senzaCommentiSql(fs.readFileSync(path.join(ROOT, "supabase/migrations/20261104120000_storage_workshop_consegne_limiti.sql"), "utf8"));
  const limite = Number((sql.match(/file_size_limit = (\d+)/) ?? [])[1]);
  const tipi = [...((sql.match(/allowed_mime_types = array\[([^\]]*)\]/) ?? [])[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
  ok(imm.BUCKET_IMMAGINI === "workshop-consegne" && /where id = 'workshop-consegne'/.test(sql), "la migrazione scrive il bucket in cui il form carica");
  ok(limite === imm.MAX_IMMAGINE_MB * 1024 * 1024, "il tetto del bucket è quello del form", { limite, form: imm.MAX_IMMAGINE_MB });
  ok(tipi.length > 0 && JSON.stringify(tipi) === JSON.stringify([...imm.TIPI_IMMAGINE_CONSENTITI].sort()), "i tipi del bucket sono quelli che il form accetta", tipi);
  ok(/get diagnostics v_righe = row_count/.test(sql) && /if v_righe <> 1 then/.test(sql), "la migrazione si ferma se non tocca esattamente una riga");
  const form = leggi("components/workshop/elaborato/SezioneEditor.tsx");
  ok(/tipoImmagineAmmesso\(file\.type\)/.test(form) && !/const (MAX_IMMAGINE_MB|TIPI_IMMAGINE_CONSENTITI|BUCKET_IMMAGINI)/.test(form), "il form usa i limiti condivisi, non una copia sua");
  const accept = (form.match(/accept="([^"]*)"/) ?? [])[1];
  ok(JSON.stringify((accept ?? "").split(",").sort()) === JSON.stringify(tipi), "la finestra di scelta propone gli stessi tipi", accept);
}

console.log("\n§7 — la provincia è una scelta da un elenco\n");
{
  const form = leggi("components/ente/ProfiloEnteForm.tsx");
  ok(/<Combobox\s+id="provincia"/.test(form) && /OPZIONI_PROVINCIA = PROVINCE_ITALIANE/.test(form), "il profilo dell'ente la fa scegliere dall'elenco delle province");
  ok(!/<input\s+id="provincia"/.test(form), "…e non è più un campo di testo libero");
  const esplora = leggi("app/app/esplora/page.tsx");
  ok(/<select\s+name="provincia"/.test(esplora) && /PROVINCE_ITALIANE\.map/.test(esplora), "Esplora cerca con lo stesso elenco");
  const { PROVINCE_ITALIANE } = require(path.join(ROOT, "lib/province.ts"));
  const scuole = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/scuole-secondarie-superiori.json"), "utf8")));
  const fuori = scuole.filter((p) => !PROVINCE_ITALIANE.includes(p));
  ok(PROVINCE_ITALIANE.length === 107 && fuori.length === 0, "l'elenco ha le 107 province, e ogni provincia del dataset delle scuole ci sta", fuori);
}

console.log("\n§8 — chi revisiona vede la quota\n");
{
  const { testoQuotaRevisione } = require(path.join(ROOT, "lib/ente/quote.ts"));
  const q = { newsletterUsate: 5, newsletterTotali: 5, ctaUsate: 0, ctaTotali: 2, evidenzaUsate: 0, evidenzaTotali: 0 };
  const piena = testoQuotaRevisione(q, "newsletter");
  ok(piena.piena && /5 di 5/.test(piena.testo) && /si supera/.test(piena.testo), "a quota piena lo dice", piena);
  ok(!testoQuotaRevisione(q, "cta").piena && /0 di 2/.test(testoQuotaRevisione(q, "cta").testo), "sotto quota dice quante");
  ok(/non siamo riusciti/i.test(testoQuotaRevisione(null, "cta").testo), "una quota non letta non si scrive 0 di 0");
  ok(/testoQuotaRevisione\(/.test(leggi("app/admin/page.tsx")), "la coda delle comunicazioni la mostra");
  ok(/testoQuotaRevisione\(await getQuotePerRevisione/.test(leggi("components/admin/PlanciaAdminEvento.tsx")), "la plancia dell'evento la mostra per una CTA");
}


console.log("\n§8 — una guida pubblica per ente, e l'archivio (20261114100000)\n");
{
  const g = require(path.join(ROOT, "lib/ente/guida.ts"));
  const una = { id: "1", titolo: "Guida vecchia", pdf_url: "https://x/1.pdf", created_at: "2026-10-01T10:00:00Z", archiviata_il: null };
  const due = { id: "2", titolo: "Guida nuova", pdf_url: "https://x/2.pdf", created_at: "2026-10-20T10:00:00Z", archiviata_il: null };
  const vecchia = { ...una, archiviata_il: "2026-10-20T10:00:00Z" };
  ok(/«Guida vecchia» smette di essere quella pubblica/.test(g.testoPrimaDelCaricamento([una])), "prima di caricare, il pannello nomina la guida che smette di essere pubblica");
  ok(/resta qui in archivio/.test(g.testoPrimaDelCaricamento([una])), "…e dice che resta, non che sparisce");
  ok(!/smette/.test(g.testoPrimaDelCaricamento([])), "senza una guida pubblica non nomina niente");
  ok(g.testoSceltaNecessaria([una, due]) !== null && g.testoSceltaNecessaria([due, vecchia]) === null, "la scelta si chiede solo a chi ne ha due pubbliche (Davante)");
  ok(g.pubbliche([due, vecchia]).length === 1 && g.archiviate([due, vecchia]).length === 1, "pubbliche e archiviate si dividono sulla data di archivio");
  ok(/in archivio dal/.test(g.rigaArchiviata(vecchia)), "un'archiviata dice da quando");
  ok(/Contati dal/.test(g.sottoDownloadGuida("2026-10-29T12:00:00Z")) && /non sono stati registrati/.test(g.sottoDownloadGuida("2026-10-29T12:00:00Z")),
    "sotto «Download guida»: da quando si conta, e che i download di prima non ci sono");
  ok(!/\d/.test(g.sottoDownloadGuida(null)), "una data non letta non si inventa");
  const pannello = leggi("components/ente/ProfiloEnteForm.tsx");
  ok(/testoPrimaDelCaricamento\(guide\)/.test(pannello), "il pannello mostra la riga prima del caricamento");
  ok(/scegli_guida_pubblica/.test(pannello), "…e sceglie la pubblica con la funzione, non con un update");
  ok(/rileggi\(\)/.test(pannello) && !/setGuide\(\(prev\)/.test(pannello), "dopo una scrittura rilegge l'elenco invece di aggiungere in locale (il trigger archivia le altre)");
  ok(/sottoDownloadGuida\(/.test(leggi("app/ente/(dashboard)/statistiche/guide/page.tsx")), "la sezione Guide dice da quando conta i download");
  ok(/\.is\("archiviata_il", null\)/.test(leggi("lib/app/istituzioni.ts")), "la pagina pubblica legge la sola guida pubblica");
}

console.log("\n§9 — le quattro sezioni (20261115100000)\n");
{
  const S = require(path.join(ROOT, "lib/ente/statistiche.ts"));
  const rip = (righe, altre = 0) => ({ righe, altre });
  const valido = {
    eventi: { in_programma: 1, passati: 2, iscritti: 3, collegati: 2, certificate: 1, iscritti_dirette_finite: 3, iscritti_collegati: 2, permanenza_media_pct: 75, permanenza_su: 2,
      lista: [{ evento_id: "e1", titolo: "Uno", data_inizio: "2026-10-20T10:00:00Z", tipo: "webinar", passato: true, iscritti: 3, collegati: 2, certificate: 1, risposte: 0, domanda_posta: false }] },
    studenti: { totale: 8, nuovi_mese: 2, soglia: 5, per_area: rip([{ chiave: "informatica-digitale", n: 6 }], 2), per_anno_diploma: rip([]), per_indirizzo: rip([]), per_provincia: rip([{ chiave: null, n: 8 }]) },
    newsletter: { iscritti: 2, raggiungibili: 2, nuovi_mese: 1, persi_mese: 1, persi_contati_dal: "2026-10-29T08:00:00Z" },
    guide: { scaricamenti: 3, scaricamenti_mese: 3, studenti: 1, contati_dal: "2026-10-29T08:00:00Z", per_guida: [] },
  };
  ok(S.leggiStatistiche(valido) !== null, "una risposta completa si legge");
  // «Non letto» non è zero: ogni pezzo mancante, o un conteggio null, dà null.
  const senza = (f) => { const c = JSON.parse(JSON.stringify(valido)); f(c); return S.leggiStatistiche(c); };
  ok(senza((c) => delete c.guide) === null, "senza la sezione delle guide: non letto, non zeri");
  ok(senza((c) => { c.eventi.iscritti = null; }) === null, "un conteggio null non diventa zero");
  ok(senza((c) => { c.studenti.per_area.altre = undefined; }) === null, "una ripartizione senza «altre» non si legge");
  ok(S.leggiStatistiche(null) === null && S.leggiStatistiche("x") === null, "una risposta assente non si legge");

  // Una guida cancellata dall'ente resta nel dettaglio (20261116100000).
  const conCancellata = senza((c) => { c.guide.per_guida = [{ guida_id: "g9", titolo: "Programma eventi", caricata_il: "2026-10-12T08:00:00Z", archiviata_il: null, cancellata: true, scaricamenti: 4, studenti: 1 }]; });
  const gc = conCancellata?.guide.per_guida[0];
  ok(gc?.cancellata === true, "una guida cancellata si legge come tale");
  ok(S.T.guide.periodo(gc) === "Caricata il 12 ottobre 2026, poi cancellata. I suoi scaricamenti restano nel conto.", `il suo periodo lo dice [${gc && S.T.guide.periodo(gc)}]`);

  const righe = S.righeMostrate(rip([{ chiave: "informatica-digitale", n: 6 }], 2), S.etichettaArea);
  ok(righe.length === 1 && righe[0].n === 6, "il resto sotto la soglia NON entra nella lista come un gruppo (29/10)", righe);

  // LA SOGLIA COME CONDIZIONE (29/10, Mario): una forma sola, provata nei tre
  // casi, con gli attesi scritti a mano.
  const oggiS = new Date("2026-10-29T12:00:00Z");
  const stud = (o) => ({ totale: 8, nuovi_mese: 0, soglia: 5, per_area: rip([]), per_anno_diploma: rip([]), per_indirizzo: rip([]), per_provincia: rip([]), ...o });
  // (1) tutti sotto, con pochi studenti
  const sotto3 = S.presentaRipartizioni(stud({ totale: 3, per_area: rip([], 4), per_anno_diploma: rip([], 3), per_indirizzo: rip([], 3), per_provincia: rip([], 3) }), oggiS);
  ok(sotto3.tipo === "condizione" && sotto3.testo === "Studenti raggiunti finora: 3. Sono ancora troppo pochi perché le ripartizioni possano comparire: servono almeno 5 studenti per gruppo, per non far riconoscere nessuno.",
    "tutti sotto, 3 studenti: una frase sola con il numero, la condizione e la ragione", sotto3);
  // (1-bis) tutti sotto, con abbastanza studenti divisi in gruppi piccoli: «troppo pochi» sarebbe falso
  const sotto8 = S.presentaRipartizioni(stud({ per_area: rip([], 8), per_anno_diploma: rip([], 8), per_indirizzo: rip([], 8), per_provincia: rip([], 8) }), oggiS);
  ok(sotto8.tipo === "condizione" && /finora: 8, ma/.test(sotto8.testo) && !/troppo pochi perché/.test(sotto8.testo) && /5 studenti/.test(sotto8.testo),
    "tutti sotto, 8 studenti in gruppi piccoli: la frase non dice «troppo pochi»", sotto8);
  // (2) tutti sopra, nessun resto
  const sopra = S.presentaRipartizioni(stud({ totale: 12, per_area: rip([{ chiave: "informatica-digitale", n: 12 }]), per_anno_diploma: rip([{ chiave: "2027", n: 12 }]),
    per_indirizzo: rip([{ chiave: "Liceo", n: 12 }]), per_provincia: rip([{ chiave: "Napoli", n: 12 }]) }), oggiS);
  ok(sopra.tipo === "gruppi" && sopra.mostrate.length === 4 && sopra.mostrate.every((r) => r.resto === null) && sopra.nascoste === null,
    "tutti sopra: quattro tabelle, nessun resto, nessuna riga sulle nascoste", sopra);
  ok(/5 studenti in su/.test(sopra.ragione) && /non ha scelto di farsi vedere/.test(sopra.ragione) && /Interessati/.test(sopra.ragione), "la ragione è una sola, sopra le tabelle, e dice la differenza con gli Interessati");
  // (3) misto
  const misto = S.presentaRipartizioni(stud({ per_area: rip([{ chiave: "informatica-digitale", n: 6 }], 2), per_anno_diploma: rip([], 8), per_indirizzo: rip([], 8),
    per_provincia: rip([{ chiave: "Napoli", n: 7 }], 1) }), oggiS);
  ok(misto.tipo === "gruppi" && misto.mostrate.map((r) => r.chiave).join(",") === "area,provincia", "misto: si mostrano solo le ripartizioni con un gruppo", misto.mostrate.map((r) => r.chiave));
  ok(misto.mostrate[0].resto === "Altre 2 scelte, in aree scelte da troppo pochi studenti per essere mostrate da sole.", "per area il resto conta scelte, non studenti", misto.mostrate[0].resto);
  ok(misto.mostrate[1].resto === "Un altro studente in un gruppo troppo piccolo per essere mostrato da solo.", "il resto di uno è al singolare", misto.mostrate[1].resto);
  ok(misto.nascoste === "Per anno di corso e per indirizzo: nessun gruppo arriva ancora a 5 studenti, quindi queste ripartizioni non compaiono ancora.",
    "misto: le ripartizioni senza gruppi nominate in una riga sola, non come tabelle vuote", misto.nascoste);
  ok(S.T.studenti.resto(7) === "Altri 7 studenti in gruppi troppo piccoli per essere mostrati da soli." && S.T.studenti.resto(0) === null, "il resto con il numero, e niente se è zero");
  ok(S.presentaRipartizioni(stud({ totale: 0 }), oggiS).tipo === "nessuno", "con zero studenti resta la frase di prima");
  const paginaStud = leggi("app/ente/(dashboard)/statistiche/studenti/page.tsx");
  ok(/presentaRipartizioni\(stats\.studenti, oggi\)/.test(paginaStud) && !/righeMostrate/.test(paginaStud), "la pagina passa da presentaRipartizioni, non compone le tabelle da sé");
  const conAltri = ["app", "components", "lib"].flatMap(fileSorgenti).filter((f) => /Altri gruppi/.test(leggi(f).replace(/\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")));
  ok(conAltri.length === 0, `«Altri gruppi» non è più a schermo da nessuna parte (${conAltri.join(", ") || "nessuno"})`);
  // Due anni di diploma già passati hanno la stessa etichetta: si sommano.
  const anni = S.righeMostrate(rip([{ chiave: "2020", n: 5 }, { chiave: "2021", n: 6 }]), S.etichettaAnnoDiploma(new Date("2026-10-29T12:00:00Z")), 5);
  ok(anni.length === 1 && anni[0].n === 11 && anni[0].etichetta === "Già diplomato", "due anni di diploma passati diventano un gruppo «Già diplomato»", anni);
  ok(S.etichettaProvincia(null) === "Provincia non indicata", "una provincia mancante lo dice");

  ok(S.T.guide.riepilogo(40, 3) === "Scaricamenti in tutto: 40 · studenti iscritti a KIREO fra chi le ha scaricate: 3", "le guide dicono i due numeri distinti", S.T.guide.riepilogo(40, 3));
  ok(/Interessati/.test(S.T.cima) && /mai un nome/.test(S.T.cima) && /5 studenti/.test(S.T.cima) && /revocarlo/.test(S.T.cima),
    "la frase in cima dice la differenza con gli Interessati, invece di negare che un elenco esista");
  ok(!/nessun elenco di studenti, mai/.test(fs.readFileSync(path.join(ROOT, "app/ente/(dashboard)/statistiche/page.tsx"), "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")),
    "…e la frase falsa di prima non è più a schermo");
  ok(!/apertur|clic/i.test(S.T.newsletter.invii), "la newsletter non promette aperture né clic");

  // L'INDICE E LE QUATTRO SEZIONI (29/10): una lettura sola, e i numeri dell'indice
  // dallo stesso oggetto delle sezioni.
  const DIR_S = "app/ente/(dashboard)/statistiche";
  const pagine = ["page.tsx", "eventi/page.tsx", "studenti/page.tsx", "newsletter/page.tsx", "guide/page.tsx"].map((f) => [f, leggi(`${DIR_S}/${f}`)]);
  for (const [f, src] of pagine) {
    ok(/caricaStatisticheEnte\(\)/.test(src) && !/\.rpc\(|\.from\(|stats_istituzione|stats_eventi_istituzione/.test(src), `${f}: legge da caricaStatisticheEnte, e da nient'altro`);
    ok(!/Guide pubblicate/.test(src), `${f}: «Guide pubblicate» non c'è`);
  }
  for (const [f, src] of pagine.slice(1)) ok(/<TestaSezione /.test(src) && /stats === null \?/.test(src), `${f}: il ritorno all'indice in cima, e «non letto» detto come tale`);
  // L'insieme di chi chiama statistiche_ente: un posto solo in tutto il prodotto.
  const sorgenti = ["app", "components", "lib"].flatMap(fileSorgenti);
  const chiamanti = sorgenti.filter((f) => /rpc\(\s*"statistiche_ente"/.test(leggi(f)));
  ok(sorgenti.length > 200 && chiamanti.length === 1 && chiamanti[0] === path.join("lib", "ente", "caricaStatistiche.ts"),
    `statistiche_ente si chiama in un posto solo (${chiamanti.join(", ") || "nessuno"}, su ${sorgenti.length} file letti)`);
  ok(/leggiStatistiche\(/.test(leggi("lib/ente/caricaStatistiche.ts")) && /cache\(/.test(leggi("lib/ente/caricaStatistiche.ts")), "il caricatore legge la forma con leggiStatistiche, una volta per richiesta");
  const indice = leggi(`${DIR_S}/page.tsx`);
  ok(/riquadriIndice\(stats\)/.test(indice) && /\{T\.cima\}/.test(indice), "l'indice mostra i riquadri e la frase sull'anonimato");
  ok(pagine.slice(1).every(([, src]) => !/T\.cima/.test(src)), "…e la frase sta sull'indice, non in una sezione sola");
  ok(!/RigaEvento|Tabella/.test(indice), "l'indice non porta elenchi né tabelle: solo i quattro riquadri");
  // Gli attesi scritti a mano, sull'oggetto valido di sopra.
  const R = S.riquadriIndice(S.leggiStatistiche(valido));
  ok(R.map((r) => r.chiave).join(",") === "eventi,studenti,newsletter,guide", "quattro riquadri, in quest'ordine");
  ok(R.map((r) => r.valore).join(",") === "2,8,2,3", "i numeri grandi sono quelli delle sezioni (passati 2, studenti 8, riceveranno 2, scaricamenti 3)", R.map((r) => r.valore));
  ok(R[0].sotto === "Il 67% di chi si era iscritto alle dirette si è collegato.", "eventi: 2 collegati su 3 iscritti fanno 67%", R[0].sotto);
  ok(R[1].sotto === "Nuovi questo mese: 2" && R[3].sotto === "Studenti iscritti a KIREO che le hanno scaricate: 1", "le righe sotto vengono dagli stessi campi", [R[1].sotto, R[3].sotto]);
  ok(/uscite: 1/.test(R[2].sotto) && /questo mese: 1/.test(R[2].sotto), "newsletter: nuove e uscite del mese", R[2].sotto);
  const senzaDirette = S.riquadriIndice(senza((c) => { c.eventi.iscritti_dirette_finite = 0; c.eventi.iscritti_collegati = 0; }));
  ok(!/%/.test(senzaDirette[0].sotto), "senza iscritti alle dirette concluse nessuna percentuale inventata", senzaDirette[0].sotto);
  ok(R.every((r) => r.href.startsWith("/ente/statistiche/")), "ogni riquadro porta alla sua sezione");

  const route = leggi("app/api/scarica-guida/ente/[guidaId]/route.ts");
  ok(/if \(!collegato\) await contaScaricamentoSenzaAccesso\(/.test(route), "la route conta lo scaricamento di chi non ha fatto l'accesso, prima di rispondere");
  ok(/contaScaricamentoSenzaAccesso\(PROCESSO[\s\S]*NextResponse\.redirect\(link, 303\)/.test(route) && !/NextResponse\.redirect\(link, 303\)[\s\S]*contaScaricamentoSenzaAccesso\(PROCESSO/.test(route), "…prima del rimando al file");
  const contatore = leggi("lib/guide/contatoreScaricamenti.ts");
  ok(/rpc\("incrementa_scaricamenti_guida", \{ p_guida_id: guidaId \}\)/.test(contatore), "il contatore manda solo l'id della guida");
  ok(/segnalaGuasto\(/.test(contatore), "…e un conteggio fallito diventa un guasto, non un file negato");
}

console.log("");
console.log(`${falliti === 0 ? "✅" : "❌"} ${fatte - falliti}/${fatte} proprietà (npm run test:statistiche)`);
process.exit(falliti === 0 ? 0 : 1);
})();
