#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:contenuti` — i contenuti dei post degli enti (30/10/2026,
// 20261119110000): la scheda del link, il file allegato, «salva», l'archivio.
// Le proprietà sul database stanno in scripts/verifica-post-contenuti.sql; qui:
//   §1 l'espressione dei link è la stessa del vincolo, e riconosce le tre
//      piattaforme e nient'altro;
//   §2 nessun iframe di Instagram, Facebook o TikTok, da nessuna parte;
//   §3 le immagini dei post si mostrano solo dal nostro spazio dei file;
//   §4 il file si scarica dal server, con la traccia prima;
//   §5 il link social è di tutti i piani;
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

console.log("§1 i link delle tre piattaforme");
const migrazioni = fs.readdirSync(path.join(ROOT, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort();
// L'ULTIMA migrazione che riscrive il vincolo di coerenza è quella che vale.
const conVincolo = migrazioni.filter((f) => /add constraint post_enti_coerenza_tipo/.test(leggi(`supabase/migrations/${f}`)));
ok(conVincolo.length >= 1, `le migrazioni che riscrivono il vincolo dei post: ${conVincolo.length} (la prima lo scriveva dentro create table)`);
const ultima = leggi(`supabase/migrations/${conVincolo[conVincolo.length - 1]}`);
const sorgenteSql = (ultima.match(/embed_url ~\* '([^']+)'/) || [])[1];
ok(sorgenteSql === C.SORGENTE_REGEX_LINK_SOCIALE, "il TypeScript usa la stessa espressione del vincolo", `${sorgenteSql} ≠ ${C.SORGENTE_REGEX_LINK_SOCIALE}`);
const casi = [
  ["https://www.instagram.com/p/abc/", "Instagram"],
  ["https://instagram.com/reel/abc", "Instagram"],
  ["https://www.facebook.com/ente/posts/1", "Facebook"],
  ["https://fb.watch/abc/", "Facebook"],
  ["https://www.tiktok.com/@ente/video/1", "TikTok"],
  ["https://vm.tiktok.com/ZM123/", "TikTok"],
  ["https://instagram.com.altrove.net/p/x", null],
  ["https://evil-instagram.com/p/x", null],
  ["http://www.instagram.com/p/x", null],
  ["https://www.youtube.com/watch?v=x", null],
  ["", null],
];
for (const [url, atteso] of casi) ok(C.piattaformaDelLink(url) === atteso, `${url || "(vuoto)"} → ${atteso ?? "nessuna"}`, String(C.piattaformaDelLink(url)));

console.log("\n§2 nessun iframe di una piattaforma");
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
ok(/target="_blank"/.test(feed) && /rel="noopener noreferrer"/.test(feed), "il link della scheda si apre fuori, senza portarsi dietro la pagina");

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

console.log("\n§5 il link social è di tutti i piani");
const form = senzaCommenti(leggi("components/ente/CreaPostForm.tsx"));
ok(!/disabled=\{t/.test(form) && !/pianoAPagamento \|\| t/.test(form), "il form non spegne un tipo per il piano");
ok(/REGEX_LINK_SOCIALE/.test(form) && !/new RegExp|\/\^https/.test(form), "il form usa l'espressione condivisa, non una sua");
ok(!/Post con embed/.test(leggi("app/istituzioni/page.tsx")) && !/Post con embed/.test(leggi("app/ente/(dashboard)/piano/page.tsx")), "il listino e la pagina del piano non lo vendono più a parte");
ok(!/post_enti_tipo_dal_piano/.test(form) && !/link_social_solo_piani_a_pagamento/.test(form), "il form non aspetta più il rifiuto del piano");

console.log("\n§6 l'archivio dei post salvati");
const finto = (risposta) => ({ rpc: async (fn) => (fn === "post_salvati_miei" ? risposta : { data: null, error: { message: "funzione sbagliata" } }) });
const riga = (stato, extra = {}) => ({
  salvataggio_id: "s1", post_id: "p1", ente_nome: "Ente", istituzione_slug: "ente", tipo: "link_social", corpo: "Testo",
  immagine_url: "https://x/i.png", link_url: "https://www.instagram.com/p/x", link_titolo: "Titolo", link_riga: "Riga",
  allegato_nome: null, pubblicato_il: "2026-10-30T10:00:00Z", salvato_il: "2026-10-30T11:00:00Z", stato, tolto_il: null, ...extra,
});
(async () => {
  ok((await S.leggiPostSalvatiMiei(finto({ data: null, error: { message: "giù" } }))) === null, "una lettura fallita è «non letto», non «niente»");
  const vuoto = await S.leggiPostSalvatiMiei(finto({ data: [], error: null }));
  ok(Array.isArray(vuoto) && vuoto.length === 0, "nessun salvataggio è una lista vuota, e si distingue dal non letto");
  ok((await S.leggiPostSalvatiMiei(finto({ data: [riga("inventato")], error: null }))) === null, "uno stato che non conosciamo non si indovina");
  const [visibile] = await S.leggiPostSalvatiMiei(finto({ data: [riga("visibile")], error: null }));
  ok(visibile.immagineUrl && visibile.linkUrl && visibile.linkRiga, "un post ancora nel flusso porta immagine, link e riga");
  for (const st of ["tolto", "cancellato", "ente_non_attivo", "non_visibile"]) {
    const [r] = await S.leggiPostSalvatiMiei(finto({ data: [riga(st, { tolto_il: "2026-10-30T12:00:00Z" })], error: null }));
    ok(r.corpo === "Testo" && r.immagineUrl === null && r.linkUrl === null && r.linkRiga === null && S.TESTI_POST_SALVATI.stato(r),
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
  ok(I.haFattoQualcosa({ ...base7, copre_attivita: false, eventi_seguiti: null, guida_scaricata: null, copre_contenuti: false, post_salvati: null, allegati_scaricati: null }) === null,
    "un consenso che non copre l'attività resta «non lo sappiamo»");
  const btn = leggi("components/app/ManifestazioneInteresseButton.tsx").replace(/\s+/g, " ");
  ok(/quali suoi post hai salvato e quali suoi file hai scaricato/.test(btn), "il pannello nomina i post salvati e i file scaricati, che il consenso nuovo copre");
  const sql = leggi("supabase/migrations/20261119110000_post_contenuti_salva.sql");
  ok(/add column copre_contenuti boolean not null default false/.test(sql) && /alter column copre_contenuti set default true/.test(sql), "le righe di prima nascono false, le nuove true");

  console.log(`\n${falliti ? "✗" : "✓"} ${fatte - falliti}/${fatte} proprietà (npm run test:contenuti)`);
  process.exit(falliti ? 1 : 0);
})();
