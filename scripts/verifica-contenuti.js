#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:contenuti` — i contenuti dei post degli enti (30/10/2026,
// 20261119110000 e 20261120100000): il link su qualsiasi post, il file
// allegato, «salva», l'archivio. Le proprietà sul database stanno in
// scripts/verifica-post-contenuti.sql; qui:
//   §1 l'espressione dei link è la stessa del vincolo (solo https), e
//      l'etichetta del bottone la decide l'indirizzo;
//   §2 nessun iframe, e NESSUNA RICHIESTA verso Instagram, Facebook o TikTok da
//      nessun punto del progetto: un link e un nome sono verdi, una richiesta
//      è rossa;
//   §3 le immagini dei post si mostrano solo dal nostro spazio dei file;
//   §4 il file si scarica dal server, con la traccia prima;
//   §5 il link è di tutti i piani, e il tipo link_social è uscito;
//   §6 l'archivio dei post salvati: «non letto» non è «niente», e di un post
//      che non è più nel flusso resta il testo;
//   §7 gli Interessati: un consenso di prima non si allarga ai salvataggi.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();
const C = require("@/lib/post/contenuti");
const S = require("@/lib/app/postSalvati");
const I = require("@/lib/ente/interessati");

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
const leggi = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

console.log("§1 il link: solo https, e l'etichetta dall'indirizzo");
const migrazioni = fs.readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
// L'ULTIMA migrazione che scrive il vincolo del link è quella che vale.
const conVincolo = migrazioni.filter((f) => /add constraint post_enti_link_esterno_https/.test(leggi(`supabase/migrations/${f}`)));
ok(conVincolo.length >= 1, `le migrazioni che scrivono il vincolo del link: ${conVincolo.length}`);
const ultima = leggi(`supabase/migrations/${conVincolo[conVincolo.length - 1]}`);
const sorgenteSql = (ultima.match(/link_esterno ~\* '([^']+)'/) || [])[1];
ok(sorgenteSql === C.SORGENTE_REGEX_LINK_ESTERNO, "il TypeScript usa la stessa espressione del vincolo", `${sorgenteSql} ≠ ${C.SORGENTE_REGEX_LINK_ESTERNO}`);
// Gli attesi sono scritti a mano: nessuno viene da lib/post/contenuti.ts.
const casi = [
  ["https://www.instagram.com/p/abc/", "Instagram"],
  ["https://instagram.com/reel/abc", "Instagram"],
  ["https://www.facebook.com/ente/posts/1", "Facebook"],
  ["https://fb.watch/abc/", "Facebook"],
  ["https://www.tiktok.com/@ente/video/1", "TikTok"],
  ["https://vm.tiktok.com/ZM123/", "TikTok"],
  ["https://www.ente.it/open-day", "sito"],
  ["https://ente.it", "sito"],
  // Un nome che somiglia a una piattaforma non lo è: si apre «il sito».
  ["https://instagram.com.altrove.net/p/x", "sito"],
  ["https://evil-instagram.com/p/x", "sito"],
  ["http://www.instagram.com/p/x", null],
  ["http://www.ente.it", null],
  ["javascript:alert(1)", null],
  ["data:text/html,<b>x</b>", null],
  ["https://ente", null],
  ["https://www.ente.it/con spazio", null],
  ["", null],
];
for (const [url, atteso] of casi) ok(C.destinazioneDelLink(url) === atteso, `${url || "(vuoto)"} → ${atteso ?? "non valido"}`, String(C.destinazioneDelLink(url)));
ok(C.etichettaLink("sito") === "Apri il sito" && C.etichettaLink("Instagram") === "Apri su Instagram", "le etichette: «Apri il sito», «Apri su Instagram»");
ok(!C.linkEsternoValido("https://ente.it/" + "a".repeat(2000)), "un link oltre i 2000 caratteri non passa, come nel database");

console.log("\n§2 nessun iframe, e nessuna richiesta verso le piattaforme");
const daGuardare = [];
for (const dir of ["components", "app", "lib"]) {
  const giro = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`;
      if (e.isDirectory()) giro(rel);
      else if (/\.(tsx|ts)$/.test(e.name)) daGuardare.push(rel);
    }
  };
  giro(dir);
}
ok(daGuardare.length > 300, `file letti: ${daGuardare.length} (pavimento 300)`);
const conIframeSocial = daGuardare.filter((f) => {
  const s = senzaCommenti(leggi(f));
  return /<iframe/i.test(s) && /(instagram|tiktok|facebook)/i.test(s);
});
ok(conIframeSocial.length === 0, "nessun file mette un iframe accanto a una piattaforma social", conIframeSocial.join(", "));
const feed = senzaCommenti(leggi("components/app/FeedPost.tsx"));
ok(!/tiktok\.com\/embed|\/embed`|embed\/v2/.test(feed), "il feed non costruisce più l'indirizzo «embed» di una piattaforma");
ok(!/<iframe/i.test(feed), "il feed non ha nessun iframe, di nessun tipo");
ok(!/<iframe/i.test(feed), "il feed non ha nessun iframe, di nessun tipo");
ok(/target="_blank"/.test(feed) && /rel="noopener noreferrer"/.test(feed), "il link si apre in una finestra nuova, senza portarsi dietro la pagina");

// LA GUARDIA SULLE RICHIESTE (Mario, 30/10: «chiamare Meta fa fallire la
// prova»). Tre casi da distinguere, e la guardia li distingue riga per riga:
//   un LINK verso instagram.com (href)              → la funzione, verde;
//   il NOME della piattaforma nel codice            → l'etichetta, verde;
//   una RICHIESTA verso quegli host                 → ciò che vietiamo, rossa.
// Una richiesta è un indirizzo di quegli host su una riga che lo carica
// (fetch, src di un'immagine, di uno script o di un iframe, un import, un
// preconnect, url() in un foglio di stile), oppure un fetch del link di un
// post (che porterebbe dove vuole l'ente, social compresi). ⚠️ È lessicale e
// sbaglia per difetto: una richiesta costruita in tre righe non la vede. Il
// pavimento sta sui file letti e sulle occorrenze trovate in tutto, buone e
// cattive insieme, che non scendono quando il progetto migliora.
const HOST_SOCIAL = /\b(?:[a-z0-9-]+\.)*(?:instagram\.com|facebook\.com|facebook\.net|fb\.watch|fbcdn\.net|cdninstagram\.com|tiktok\.com|tiktokcdn\.com)\b/i;
const CARICA = /\bfetch\s*\(|\baxios\b|XMLHttpRequest|sendBeacon|\bsrc\s*=|<script|<iframe|<img|\bimport\s*\(|preconnect|dns-prefetch|\burl\s*\(|@import/i;
function richiesteVersoSocial(sorgente) {
  const righe = senzaCommenti(sorgente).split("\n");
  const rosse = [];
  let occorrenze = 0;
  righe.forEach((r, i) => {
    if (HOST_SOCIAL.test(r)) {
      occorrenze++;
      if (CARICA.test(r)) rosse.push(i + 1);
    }
    if (/\bfetch\s*\([^)]*link_?[eE]sterno/.test(r)) rosse.push(i + 1);
  });
  return { rosse, occorrenze };
}
// Taratura, prima dei file veri: i tre casi, scritti a mano.
ok(richiesteVersoSocial('<a href="https://www.instagram.com/p/x" target="_blank">').rosse.length === 0, "taratura: un link verso instagram.com è verde");
ok(richiesteVersoSocial('if (di("instagram.com")) return "Instagram";').rosse.length === 0, "taratura: il nome della piattaforma è verde");
ok(richiesteVersoSocial('await fetch("https://graph.instagram.com/me/media")').rosse.length === 1, "taratura: una richiesta verso quell'host è rossa");
ok(richiesteVersoSocial('<img src="https://scontent.cdninstagram.com/x.jpg" />').rosse.length === 1, "taratura: un'immagine caricata da lì è rossa");
ok(richiesteVersoSocial("const r = await fetch(post.link_esterno);").rosse.length === 1, "taratura: un fetch del link di un post è rosso");
// Anche gli script (il banco gioca dalla porta, e uno strumento che chiama Meta è
// una chiamata come le altre), tranne questo file: le sue tarature sono
// richieste scritte apposta.
const script = [];
const giroScript = (d) => {
  for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
    const rel = `${d}/${e.name}`;
    if (e.isDirectory()) giroScript(rel);
    else if (/\.(js|ts|mjs|sh)$/.test(e.name) && rel !== "scripts/verifica-contenuti.js") script.push(rel);
  }
};
giroScript("scripts");
const daGuardareRichieste = [...daGuardare, ...script, "next.config.ts", "middleware.ts"].filter((f) => fs.existsSync(path.join(ROOT, f)));
ok(daGuardareRichieste.length >= 500, `i file guardati per le richieste: ${daGuardareRichieste.length} (pavimento 500)`);
let occorrenzeTotali = 0;
const conRichieste = [];
for (const f of daGuardareRichieste) {
  const { rosse, occorrenze } = richiesteVersoSocial(leggi(f));
  occorrenzeTotali += occorrenze;
  if (rosse.length) conRichieste.push(`${f}:${rosse.join(",")}`);
}
ok(occorrenzeTotali >= 3, `le occorrenze dei nomi delle piattaforme che il lettore trova: ${occorrenzeTotali} (pavimento 3: lib/post/contenuti.ts vive di nomi)`);
ok(conRichieste.length === 0, "nessuna richiesta verso Instagram, Facebook o TikTok da nessun file del progetto", conRichieste.join(" "));

console.log("\n§3 le immagini solo dal nostro spazio");
const base = "https://abc.supabase.co";
const nostra = `${base}/storage/v1/object/public/post-enti-media/e1/a.png`;
ok(C.immagineDelPost(nostra, base) === nostra, "un'immagine del bucket dei post si mostra");
ok(C.immagineDelPost("https://ente.example/pixel.png", base) === null, "un'immagine di un altro server no");
ok(C.immagineDelPost(`${base}.evil.net/storage/v1/object/public/post-enti-media/a.png`, base) === null, "nemmeno con il nostro dominio come prefisso di un altro");
ok(C.immagineDelPost(`${base}/storage/v1/object/public/istituzioni-media/e1/a.png`, base) === null, "né da un altro bucket");
ok(C.immagineDelPost(nostra, undefined) === null, "senza sapere qual è il nostro dominio, nessuna immagine");
const usaGuardia = ["components/app/FeedPost.tsx", "app/app/guide/page.tsx", "app/admin/page.tsx"].filter((f) => /immagineDelPost\(/.test(leggi(f)));
ok(usaGuardia.length === 3, `il feed, l'archivio e la coda dell'admin passano dalla guardia: ${usaGuardia.length}/3`);
ok(!/src=\{post\.immagine_url\}/.test(feed), "il feed non mostra immagine_url così com'è");

console.log("\n§4 il file passa dal server");
const route = senzaCommenti(leggi("app/api/scarica-allegato/[postId]/route.ts"));
const iRpc = ancora(route, 'rpc("registra_download_allegato"');
const iRedirect = ancora(route, "NextResponse.redirect(pubblico.publicUrl");
ok(iRpc >= 0 && iRedirect > iRpc, "la traccia si scrive prima di rimandare al file");
ok(/storage\.from\("istituzioni-media"\)\.getPublicUrl\(percorso\)/.test(route), "l'indirizzo lo costruisce la route dal percorso del database");
ok(!/form\?\.get\("(percorso|url|file)/.test(route), "il percorso non viene mai dal corpo della richiesta");
const percorso = C.percorsoAllegato("e1000000-0000-0000-0000-0000000000e1", 123);
ok(percorso.split("/")[0] === "e1000000-0000-0000-0000-0000000000e1" && percorso.endsWith(".pdf"), "il percorso sta nella cartella dell'ente e finisce in .pdf, come vuole il vincolo");
ok(C.nomeAllegato("  \u0007") === "Documento.pdf" && C.nomeAllegato("a".repeat(300)).length === C.MAX_NOME_ALLEGATO, "il nome del file è ripulito e sta nel limite del database");
const feedForm = ancora(feed, "/api/scarica-allegato/");
ok(feedForm >= 0 && /method="post"/.test(feed), "il feed scarica con una POST nativa");

console.log("\n§5 il link è di tutti i piani, e il tipo link_social è uscito");
const form = senzaCommenti(leggi("components/ente/CreaPostForm.tsx"));
ok(!/disabled=\{t/.test(form) && !/pianoAPagamento \|\| t/.test(form), "il form non spegne un tipo per il piano");
ok(/normalizzaLinkEsterno\(link\)/.test(form) && !/new RegExp|\/\^https/.test(form), "il form usa la regola condivisa, non una sua");
ok(!/link_social/.test(form) && !/link_titolo|link_riga|Immagine della scheda/.test(form), "il form non offre più il tipo link social né la scheda");
ok(/link_esterno: linkDaSalvare,/.test(form) && !/tipo === "[a-z]+" \? link/.test(form) && C.normalizzaLinkEsterno(" ").url === null, "il link si scrive su qualunque tipo, vuoto vuol dire nessun link");
ok(!/etichett[ae].*useState|setEtichetta/.test(form), "l'ente non scrive l'etichetta del bottone");
ok(/<LinkEsterno url=\{post\.link_esterno\} \/>/.test(feed), "il feed mette il link sotto ogni post");
const ultimaLink = leggi("supabase/migrations/20261120100000_post_link_esterno.sql");
ok(/tipo <> 'link_social'/.test(ultimaLink), "il database rifiuta un post nuovo di tipo link_social, non solo il form");
ok(!/Post con embed/.test(leggi("app/istituzioni/page.tsx")) && !/Post con embed/.test(leggi("app/ente/(dashboard)/piano/page.tsx")), "il listino e la pagina del piano non lo vendono più a parte");
ok(!/post_enti_tipo_dal_piano/.test(form) && !/link_social_solo_piani_a_pagamento/.test(form), "il form non aspetta più il rifiuto del piano");

console.log("\n§6 l'archivio dei post salvati");
const finto = (risposta) => ({ rpc: async (fn) => (fn === "post_salvati_miei" ? risposta : { data: null, error: { message: "funzione sbagliata" } }) });
const riga = (stato, extra = {}) => ({
  salvataggio_id: "s1", post_id: "p1", ente_nome: "Ente", istituzione_slug: "ente", tipo: "immagine", corpo: "Testo",
  immagine_url: "https://x/i.png", link_esterno: "https://www.instagram.com/p/x",
  allegato_nome: null, pubblicato_il: "2026-10-30T10:00:00Z", salvato_il: "2026-10-30T11:00:00Z", stato, tolto_il: null, ...extra,
});
(async () => {
  ok((await S.leggiPostSalvatiMiei(finto({ data: null, error: { message: "giù" } }))) === null, "una lettura fallita è «non letto», non «niente»");
  const vuoto = await S.leggiPostSalvatiMiei(finto({ data: [], error: null }));
  ok(Array.isArray(vuoto) && vuoto.length === 0, "nessun salvataggio è una lista vuota, e si distingue dal non letto");
  ok((await S.leggiPostSalvatiMiei(finto({ data: [riga("inventato")], error: null }))) === null, "uno stato che non conosciamo non si indovina");
  const [visibile] = await S.leggiPostSalvatiMiei(finto({ data: [riga("visibile")], error: null }));
  ok(visibile.immagineUrl && visibile.linkEsterno, "un post ancora nel flusso porta immagine e link");
  ok((await S.leggiPostSalvatiMiei(finto({ data: [riga("visibile", { tipo: "link_social" })], error: null }))) === null, "un tipo uscito non si indovina: la riga è «non letta»");
  for (const st of ["tolto", "cancellato", "ente_non_attivo", "non_visibile"]) {
    const [r] = await S.leggiPostSalvatiMiei(finto({ data: [riga(st, { tolto_il: "2026-10-30T12:00:00Z" })], error: null }));
    ok(r.corpo === "Testo" && r.immagineUrl === null && r.linkEsterno === null && S.TESTI_POST_SALVATI.stato(r),
      `«${st}»: resta il testo, e la riga dice perché; niente immagine né link`);
  }
  const [tolto] = await S.leggiPostSalvatiMiei(finto({ data: [riga("tolto", { tolto_il: "2026-10-30T12:00:00Z" })], error: null }));
  ok(/30 ottobre 2026/.test(S.TESTI_POST_SALVATI.stato(tolto)) && !/motivo/i.test(S.TESTI_POST_SALVATI.stato(tolto)), "un post tolto dice quando, e non il motivo (quello è dell'ente)");
  ok(S.TESTI_POST_SALVATI.stato(visibile) === null, "a un post ancora nel flusso non si aggiunge nessuna nota");
  const pagina = senzaCommenti(leggi("app/app/guide/page.tsx"));
  ok(/leggiPostSalvatiMiei\(supabase\)/.test(pagina) && /TP\.nonLetto/.test(pagina) && /TP\.nessuno/.test(pagina), "l'archivio in Guide legge i salvataggi e distingue non letto da vuoto");
  ok(/p\.stato === "visibile" && p\.postId/.test(pagina), "il file si offre dall'archivio solo se il post è ancora nel flusso");

  console.log("\n§7 gli Interessati e il consenso");
  const base7 = { student_id: "1", nome: "N", cognome: "C", scuola_denominazione: null, scuola_provincia: null, anno_diploma: 2027, aree_interesse: [], creata_il: "2026-10-01T10:00:00Z", conversazione_id: null };
  ok(I.haFattoQualcosa({ ...base7, copre_attivita: true, eventi_seguiti: 0, guida_scaricata: false, copre_contenuti: true, post_salvati: 1, allegati_scaricati: 0 }) === true,
    "con il consenso nuovo, un post salvato è «ha fatto qualcosa»");
  ok(I.haFattoQualcosa({ ...base7, copre_attivita: true, eventi_seguiti: 0, guida_scaricata: false, copre_contenuti: false, post_salvati: null, allegati_scaricati: null }) === false,
    "con il consenso di prima i salvataggi non si contano (non li vediamo)");
  // Il caso che decide: righe di salvataggi PRESENTI con il consenso di prima.
  // Con post_salvati null il controllo sul consenso non si eserciterebbe.
  ok(I.haFattoQualcosa({ ...base7, copre_attivita: true, eventi_seguiti: 0, guida_scaricata: false, copre_contenuti: false, post_salvati: 2, allegati_scaricati: 1 }) === false,
    "con il consenso di prima, anche dei salvataggi contati non accendono «ha fatto qualcosa»");
  ok(I.haFattoQualcosa({ ...base7, copre_attivita: false, eventi_seguiti: null, guida_scaricata: null, copre_contenuti: false, post_salvati: null, allegati_scaricati: null }) === null,
    "un consenso che non copre l'attività resta «non lo sappiamo»");
  const btn = leggi("components/app/ManifestazioneInteresseButton.tsx").replace(/\s+/g, " ");
  ok(/quali suoi post hai salvato e quali suoi file hai scaricato/.test(btn), "il pannello nomina i post salvati e i file scaricati, che il consenso nuovo copre");
  const sql = leggi("supabase/migrations/20261119110000_post_contenuti_salva.sql");
  ok(/add column copre_contenuti boolean not null default false/.test(sql) && /alter column copre_contenuti set default true/.test(sql), "le righe di prima nascono false, le nuove true");

  // §7 — Il motivo di una rimozione non arriva allo studente (Mario, 30/10).
  // Allo studente si dice perché un post non è più nel flusso e quando, mai il
  // testo che KIREO ha scritto all'ente: è un giudizio su un terzo. Si guarda
  // ogni file delle superfici dello studente (app/app, components/app, lib/app),
  // con un pavimento sui file letti, perché un lettore cieco qui sarebbe verde.
  {
    const fs = require("fs");
    const path = require("path");
    const radici = ["app/app", "components/app", "lib/app"];
    const files = [];
    const giro = (d) => {
      for (const e of fs.readdirSync(path.join(process.cwd(), d), { withFileTypes: true })) {
        const r = path.join(d, e.name);
        if (e.isDirectory()) giro(r);
        else if (/\.(tsx?|js)$/.test(e.name)) files.push(r);
      }
    };
    radici.forEach(giro);
    ok(files.length > 60, `le superfici dello studente lette: ${files.length} file`);
    const vietati = /motivi_post_enti|motivo_rimozione|motivo_rifiuto/;
    const colpevoli = files.filter((f) => vietati.test(senzaCommenti(fs.readFileSync(f, "utf8"))));
    ok(colpevoli.length === 0, "nessuna superficie dello studente legge il motivo di una rimozione", colpevoli.join(", "));
    ok(vietati.test("x.rpc('motivi_post_enti')") && !vietati.test("// motivo"), "taratura: la forma vietata si riconosce");
  }

  // §8 — Lo https lo mettiamo noi (Mario, 30/10). Attesi scritti a mano.
  console.log("\n§8 il link si sistema, e quello che si salva è quello che si vede");
  {
    const n = C.normalizzaLinkEsterno;
    const casi = [
      ["www.davante.it", "https://www.davante.it", false],
      ["davante.it", "https://davante.it", false],
      ["instagram.com/p/xxxx/", "https://instagram.com/p/xxxx/", false],
      ["http://www.davante.it", "https://www.davante.it", true],
      ["HTTP://davante.it/a?b=1", "https://davante.it/a?b=1", true],
      ["https://www.davante.it/x", "https://www.davante.it/x", false],
      ["  davante.it  ", "https://davante.it", false],
      ["davante.it:8080/p", "https://davante.it:8080/p", false],
    ];
    for (const [dentro, fuori, alzato] of casi) {
      const e = n(dentro);
      ok(e.ok && e.url === fuori && e.alzatoAHttps === alzato, `«${dentro}» → ${fuori}${alzato ? ", e si dice" : ""}`, JSON.stringify(e));
      ok(e.ok && C.linkEsternoValido(e.url), `«${dentro}»: il risultato passa la regola del vincolo`);
    }
    const rossi = [
      ["www.dav ante.it", "spazio"],
      ["https://davante.it/a b", "spazio"],
      ["davante", "nonIndirizzo"],
      ["https://", "nonIndirizzo"],
      ["localhost:3000", "nonIndirizzo"],
      ["javascript:alert(1)", "schemaVietato"],
      ["data:text/html,ciao", "schemaVietato"],
      ["file:///etc/passwd", "schemaVietato"],
      ["mailto:a@b.it", "schemaVietato"],
      ["ftp://davante.it", "schemaVietato"],
    ];
    for (const [dentro, errore] of rossi) {
      const e = n(dentro);
      ok(!e.ok && e.errore === errore, `«${dentro}» resta rosso: ${errore}`, JSON.stringify(e));
    }
    ok(n("").ok && n("   ").url === null, "un campo vuoto è nessun link");
    const P = require("@/lib/ente/post");
    ok(P.TESTI_POST.erroreLink.spazio === "L'indirizzo contiene uno spazio." &&
      P.TESTI_POST.erroreLink.nonIndirizzo === "Non sembra un indirizzo: ci vuole un dominio, come davante.it" &&
      P.TESTI_POST.erroreLink.schemaVietato === "Si possono mettere solo indirizzi di pagine web.", "un messaggio per causa, i testi di Mario");
    ok(/sistemaLink\(\)/.test(form) && /onBlur=\{/.test(form) && /link_esterno: linkDaSalvare/.test(form), "il form sistema all'uscita dal campo e alla pubblicazione, e salva il valore sistemato");
    const cambio = form.slice(ancora(form, "onChange={(e) => {\n            setLink"), ancora(form, "onBlur={"));
    ok(cambio.length > 0 && !/normalizzaLinkEsterno|sistemaLink/.test(cambio), "mentre si scrive non si sistema niente");
    ok(/alzatoAHttps && <p/.test(form), "un http alzato a https si dice sotto il campo");
    // c) si alza e si dice, non si verifica: il form non fa nessuna richiesta all'indirizzo.
    ok(!/fetch\(/.test(form), "il form non fa nessuna richiesta all'indirizzo scritto");
  }

  // §9 — L'immagine di un post non si taglia (Mario, 30/10).
  console.log("\n§9 l'immagine di un post mantiene le proporzioni, ovunque");
  {
    ok(!/object-cover|object-fill|aspect-/.test(C.CLASSE_IMMAGINE_POST) && /max-h-/.test(C.CLASSE_IMMAGINE_POST) && /max-w-full/.test(C.CLASSE_IMMAGINE_POST) && /h-auto/.test(C.CLASSE_IMMAGINE_POST) && /w-auto/.test(C.CLASSE_IMMAGINE_POST),
      "la classe: proporzioni sue, un tetto all'altezza, mai più larga del post, niente riempimento", C.CLASSE_IMMAGINE_POST);
    const superfici = ["components/app/FeedPost.tsx", "app/app/guide/page.tsx", "app/admin/page.tsx"];
    for (const f of superfici) {
      const src = senzaCommenti(leggi(f));
      const img = [...src.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
      const delPost = img.filter((t) => /immagine/.test(t));
      ok(delPost.length > 0 && delPost.every((t) => /className=\{CLASSE_IMMAGINE_POST\}/.test(t)), `${f}: l'immagine del post usa la classe comune`, delPost.join(" | "));
    }
  }

  // §10 — Il post della notifica compare una volta sola (Mario, 30/10: misurato,
  // un post solo mostrato due volte).
  console.log("\n§10 il post di una notifica non si mostra due volte");
  {
    const pg = senzaCommenti(leggi("app/app/bacheca/page.tsx"));
    ok(/notificaNelFlusso\s*=/.test(pg) && /notificaNelFlusso \? null :/.test(pg), "se il post è già nel flusso, il blocco in cima non c'è");
    ok(/etichetta=\{notificaNelFlusso && /.test(pg), "e il segno sta sulla sua riga");
    const fp = senzaCommenti(leggi("components/app/FeedPost.tsx"));
    ok(/id=\{`post-\$\{post\.id\}`\}/.test(fp), "ogni post del flusso ha un'àncora, dove porta la notifica");
  }

  console.log(`\n${falliti ? "✗" : "✓"} ${fatte - falliti}/${fatte} proprietà (npm run test:contenuti)`);
  process.exit(falliti ? 1 : 0);
})();
