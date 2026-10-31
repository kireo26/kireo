// «Le mie cose» come lista sola (Mario, 30/10): guide e post insieme, in ordine
// di GESTO, con tre filtri nell'indirizzo, un segno su ogni riga e tre vuoti.
// Gli attesi sono scritti a mano: l'ordine giusto lo dico io, non lo chiedo alla
// funzione che lo calcola.
//
// Esecuzione: `npm run test:lemiecose`.
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");
const { senzaCommenti } = require("./lib/senza-commenti");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = require.extensions[".tsx"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const L = require("@/lib/app/leMieCose");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let fatte = 0;
let falliti = 0;
function ok(cond, msg, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else { falliti++; console.log(`  ✗ ${msg}${dettaglio ? ` [${dettaglio}]` : ""}`); }
}

const guida = (id, scaricataIl) => ({ guidaId: id, titolo: `Guida ${id}`, enteNome: "Davante", scaricataIl, stato: "pubblica", pdfUrl: "https://x/g.pdf" });
const post = (id, salvatoIl, pubblicatoIl) => ({
  salvataggioId: id, postId: `p-${id}`, enteNome: "Davante", istituzioneSlug: "davante", tipo: "testo", corpo: "c",
  immagineUrl: null, linkEsterno: null, allegatoNome: null, pubblicatoIl, salvatoIl, stato: "visibile", toltoIl: null,
});
const ordine = (lista) => lista.voci.map((v) => `${v.tipo}:${v.chiave}`).join(" ");

console.log("\n§1 l'ordine è quello del gesto, non quello della pubblicazione");
{
  // Il caso di Mario: una guida scaricata il 29, un post pubblicato il 18 e salvato il 30.
  const g = [guida("g1", "2026-10-29T10:00:00Z")];
  const p = [post("s1", "2026-10-30T09:00:00Z", "2026-10-18T09:00:00Z")];
  ok(ordine(L.listaLeMieCose(g, p, [], "tutto")) === "post:s1 guida:g1", "in cima il post salvato il 30, sotto la guida scaricata il 29", ordine(L.listaLeMieCose(g, p, [], "tutto")));
  // Il post più vecchio come pubblicazione non scende per questo.
  const p2 = [post("s1", "2026-10-28T09:00:00Z", "2026-10-29T23:00:00Z")];
  ok(ordine(L.listaLeMieCose(g, p2, [], "tutto")) === "guida:g1 post:s1", "un post pubblicato dopo ma salvato prima sta sotto", ordine(L.listaLeMieCose(g, p2, [], "tutto")));
  // Intrecciati: tre e tre.
  const gg = [guida("ga", "2026-10-01T00:00:00Z"), guida("gb", "2026-10-05T00:00:00Z"), guida("gc", "2026-10-09T00:00:00Z")];
  const pp = [post("pa", "2026-10-03T00:00:00Z", null), post("pb", "2026-10-07T00:00:00Z", null), post("pc", "2026-10-11T00:00:00Z", null)];
  ok(ordine(L.listaLeMieCose(gg, pp, [], "tutto")) === "post:pc guida:gc post:pb guida:gb post:pa guida:ga", "due sorgenti intrecciate si fondono in un ordine solo");
}

console.log("\n§2 a parità d'istante l'ordine è stabile, non quello d'arrivo");
{
  const t = "2026-10-30T09:00:00.123Z";
  const a = L.listaLeMieCose([guida("g2", t), guida("g1", t)], [post("s2", t, null), post("s1", t, null)], [], "tutto");
  const b = L.listaLeMieCose([guida("g1", t), guida("g2", t)], [post("s1", t, null), post("s2", t, null)], [], "tutto");
  ok(ordine(a) === "guida:g1 guida:g2 post:s1 post:s2", "a parità d'istante: prima il tipo, poi l'id", ordine(a));
  ok(ordine(a) === ordine(b), "lo stesso ordine qualunque sia l'ordine d'arrivo");
}

console.log("\n§3 i tre filtri, dall'indirizzo");
{
  ok(JSON.stringify(L.FILTRI_LE_MIE_COSE) === JSON.stringify(["tutto", "guide", "post", "registrazioni"]), "i filtri sono quattro, e «Tutto» è il primo");
  ok(L.TESTI_LISTA.filtri.tutto === "Tutto" && L.TESTI_LISTA.filtri.guide === "Guide" && L.TESTI_LISTA.filtri.post === "Post" && L.TESTI_LISTA.filtri.registrazioni === "Registrazioni", "ognuno ha un nome, compreso lo stato di partenza");
  ok(L.filtroDaIndirizzo(undefined) === "tutto" && L.filtroDaIndirizzo("guide") === "guide" && L.filtroDaIndirizzo("post") === "post" && L.filtroDaIndirizzo("altro") === "tutto",
    "?tipo= assente o sconosciuto è «Tutto»");
  ok(L.hrefFiltro("tutto") === "/app/le-mie-cose" && L.hrefFiltro("guide") === "/app/le-mie-cose?tipo=guide" && L.hrefFiltro("post") === "/app/le-mie-cose?tipo=post",
    "il filtro sta nell'indirizzo");
  const g = [guida("g1", "2026-10-29T10:00:00Z")];
  const p = [post("s1", "2026-10-30T09:00:00Z", null)];
  ok(ordine(L.listaLeMieCose(g, p, [], "guide")) === "guida:g1", "«Guide» mostra solo le guide");
  ok(ordine(L.listaLeMieCose(g, p, [], "post")) === "post:s1", "«Post» mostra solo i post");
}

console.log("\n§4 tre vuoti, e il «non letto» che non è un vuoto");
{
  ok(L.listaLeMieCose([], [], [], "tutto").vuoto === "Qui finisce quello che tieni: le guide che scarichi, i post e le registrazioni che salvi.", "niente di niente");
  ok(L.listaLeMieCose([], [post("s1", "2026-10-30T09:00:00Z", null)], [], "guide").vuoto === "Non hai ancora scaricato nessuna guida.", "«Guide» senza guide, anche se ci sono post");
  ok(L.listaLeMieCose([guida("g1", "2026-10-29T10:00:00Z")], [], [], "post").vuoto === "Non hai ancora salvato nessun post.", "«Post» senza post, anche se ci sono guide");
  const parz = L.listaLeMieCose(null, [post("s1", "2026-10-30T09:00:00Z", null)], [], "tutto");
  ok(parz.voci.length === 1 && JSON.stringify(parz.nonLette) === '["guide"]' && parz.vuoto === null, "una sorgente non letta si nomina, l'altra si mostra, e non si dice «vuoto»");
  const soloNonLetta = L.listaLeMieCose(null, [], [], "tutto");
  ok(soloNonLetta.vuoto === null && JSON.stringify(soloNonLetta.nonLette) === '["guide"]', "con una sorgente non letta il vuoto non si dice: non sappiamo se è vuoto");
  ok(JSON.stringify(L.listaLeMieCose(null, [], [], "post").nonLette) === "[]" && L.listaLeMieCose(null, [], [], "post").vuoto === "Non hai ancora salvato nessun post.",
    "il filtro «Post» non risente delle guide non lette");
  for (const t of [...Object.values(L.TESTI_LISTA.vuoto), ...Object.values(L.TESTI_LISTA.nonLette), ...Object.values(L.TESTI_LISTA.segno)]) {
    ok(trovaAccordi(t).length === 0, `«${t}» non accorda col genere di chi legge`);
  }
}

console.log("\n§5 la pagina: una lista, i filtri come link, il segno su ogni riga");
{
  const pg = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/app/le-mie-cose/page.tsx"), "utf8"));
  ok(/filtroDaIndirizzo\(tipo\)/.test(pg) && /listaLeMieCose\(scaricate, salvati, registrazioni, filtro\)/.test(pg), "la pagina legge ?tipo= e chiama la lista unica");
  ok(/FILTRI_LE_MIE_COSE\.map/.test(pg) && /href=\{hrefFiltro\(f\)\}/.test(pg) && /aria-current=/.test(pg), "i filtri sono link con il loro indirizzo, e quello attivo è segnato");
  ok((pg.match(/<Segno testo=\{TL\.segno\.(guida|post|registrazione)\} \/>/g) || []).length === 3, "ogni riga, guida, post o registrazione, porta il suo segno");
  ok(!/TS\.titoloEnti|TP\.titolo\b/.test(pg), "i due titoli di sezione non ci sono più");
  ok((pg.match(/<ul\b/g) || []).length === 1, "una lista sola");
  ok(/lista\.nonLette\.map/.test(pg) && /lista\.vuoto &&/.test(pg), "la pagina dice le sorgenti non lette e il vuoto");
  ok(/name="ritorno" value=\{hrefFiltro\(filtro\)\}/.test(pg), "dopo lo scaricamento di un allegato si torna al filtro di prima");
  ok(/id="salvati"/.test(pg), "l'àncora di prima (#salvati) atterra sulla lista");
  ok(!/\.range\(|\bdopo=|limit\(/.test(pg), "la lista si legge intera: niente pagine, niente cursore");
}

console.log("\n§6 le registrazioni salvate: identità copiata, dove si guarda letto ogni volta");
{
  const R = require("@/lib/app/registrazioniSalvate");
  const adesso = new Date("2026-10-31T10:00:00Z");
  const vivo = (x = {}) => ({
    evento_visibile: true, tipo: "webinar", data_inizio: "2026-10-05T15:00:00Z", data_fine: "2026-10-05T16:00:00Z",
    diretta_chiusa_il: null, youtube_video_id: "5doxLWDlAJU", registrazione_esito: "disponibile", ...x,
  });
  const dove = (x) => { const d = R.doveSiGuardaRiga(vivo(x), adesso); return `${d.dove}/${d.perche}`; };
  ok(dove({}) === "kireo/null", "disponibile: si rivede in KIREO", dove({}));
  ok(dove({ registrazione_esito: "non_incorporabile" }) === "youtube/null", "incorporamento spento: su YouTube");
  ok(dove({ registrazione_esito: "non_trovata" }) === "null/video_sparito", "il video sparito: nessun bottone, e la riga dice perché");
  ok(dove({ registrazione_esito: "non_controllato" }) === "null/non_verificabile", "non controllato: «non riusciamo a verificare», non «sparito»");
  ok(dove({ evento_visibile: false }) === "null/evento_sparito" && dove({ evento_visibile: false, tipo: null, data_inizio: null }) === "null/evento_sparito",
    "un evento cancellato o non più approvato: «non è più su KIREO»");
  for (const k of ["evento_sparito", "video_sparito", "non_verificabile"]) ok(typeof R.TESTI_REGISTRAZIONI_SALVATE.perche[k] === "string", `il caso «${k}» ha la sua riga`);

  // La lettura: una riga con l'identità di allora e lo stato di adesso.
  const riga = (x = {}) => ({
    salvataggio_id: "r1", evento_id: "ev1", titolo_evento: "Titolo di allora", ente_nome: "Davante", istituzione_slug: "davante",
    data_evento: "2026-10-05T15:00:00Z", video_id: "5doxLWDlAJU", salvata_il: "2026-10-31T09:00:00Z", ...vivo(), ...x,
  });
  const finto = (risposta) => ({ rpc: async (fn) => (fn === "registrazioni_salvate_mie" ? risposta : { data: null, error: { message: "funzione sbagliata" } }) });
  const prove = async () => {
    const a = await R.leggiRegistrazioniSalvate(finto({ data: [riga({ registrazione_esito: "non_trovata", youtube_video_id: "altro11char" })], error: null }), adesso);
    ok(a?.length === 1 && a[0].titolo === "Titolo di allora" && a[0].videoId === "5doxLWDlAJU" && a[0].videoAdesso === "altro11char" && a[0].dove === null && a[0].perche === "video_sparito",
      "la riga tiene titolo e video del gesto, e il bottone segue l'evento di adesso", JSON.stringify(a?.[0]));
    ok((await R.leggiRegistrazioniSalvate(finto({ data: null, error: { message: "x" } }), adesso)) === null, "un errore è «non letto», non «nessuna»");
    ok((await R.leggiRegistrazioniSalvate(finto({ data: [{ salvataggio_id: "r1" }], error: null }), adesso)) === null, "una riga storta è «non letto», non una riga inventata");
    ok(JSON.stringify(await R.leggiRegistrazioniSalvate(finto({ data: [], error: null }), adesso)) === "[]", "zero righe sono zero righe");
  };

  // L'ordine con tre sorgenti, e il quarto filtro.
  const reg = (id, salvataIl) => ({ salvataggioId: id, eventoId: `e-${id}`, titolo: "R", enteNome: "Davante", istituzioneSlug: null,
    dataEvento: "2026-10-05T15:00:00Z", videoId: "v", videoAdesso: "v", salvataIl, dove: "kireo", perche: null });
  const g = [guida("g1", "2026-10-29T10:00:00Z")];
  const p = [post("s1", "2026-10-30T09:00:00Z", null)];
  const rr = [reg("r1", "2026-10-31T09:00:00Z"), reg("r0", "2026-10-28T09:00:00Z")];
  ok(ordine(L.listaLeMieCose(g, p, rr, "tutto")) === "registrazione:r1 post:s1 guida:g1 registrazione:r0", "tre sorgenti in un ordine solo, quello del gesto", ordine(L.listaLeMieCose(g, p, rr, "tutto")));
  ok(ordine(L.listaLeMieCose(g, p, rr, "registrazioni")) === "registrazione:r1 registrazione:r0", "«Registrazioni» mostra solo le registrazioni");
  ok(ordine(L.listaLeMieCose(g, p, rr, "post")) === "post:s1", "«Post» non mostra le registrazioni");
  ok(L.filtroDaIndirizzo("registrazioni") === "registrazioni" && L.hrefFiltro("registrazioni") === "/app/le-mie-cose?tipo=registrazioni", "il quarto filtro sta nell'indirizzo");
  ok(L.TESTI_LISTA.segno.registrazione === "Registrazione", "il segno è «Registrazione» (Mario)");
  ok(L.listaLeMieCose(g, p, [], "registrazioni").vuoto === "Non hai ancora salvato nessuna registrazione.", "«Registrazioni» senza registrazioni, anche se ci sono guide e post");
  const nl = L.listaLeMieCose(g, p, null, "tutto");
  ok(nl.voci.length === 2 && JSON.stringify(nl.nonLette) === '["registrazioni"]' && nl.vuoto === null, "le registrazioni non lette si nominano, il resto si mostra");
  ok(JSON.stringify(L.listaLeMieCose([], [], null, "guide").nonLette) === "[]", "il filtro «Guide» non risente delle registrazioni non lette");

  // «Salva»: quattro casi.
  ok(R.statoSalva({ tipo: "senza_accesso" }, "e1") === "accedi", "senza accesso: la riga che dice di accedere, non un bottone che fallisce");
  ok(R.statoSalva({ tipo: "non_studente" }, "e1") === null && R.statoSalva({ tipo: "non_letto" }, "e1") === null, "chi non è uno studente, o una lettura fallita: niente");
  ok(R.statoSalva({ tipo: "letto", salvate: new Set(["e1"]) }, "e1") === "salvata" && R.statoSalva({ tipo: "letto", salvate: new Set() }, "e1") === "salva", "letto: «Salva» o «Salvata»");
  for (const t of [R.TESTI_REGISTRAZIONI_SALVATE.salva, R.TESTI_REGISTRAZIONI_SALVATE.salvata, R.TESTI_REGISTRAZIONI_SALVATE.accedi, ...Object.values(R.TESTI_REGISTRAZIONI_SALVATE.perche)]) {
    ok(trovaAccordi(t).length === 0, `«${t}» non accorda col genere di chi legge`);
  }

  // Dove compare: la pagina rivedi e i blocchi della card, MAI la storia delle attività.
  const card = senzaCommenti(fs.readFileSync(path.join(ROOT, "components/app/CardEvento.tsx"), "utf8"));
  ok((card.match(/<SalvaRegistrazione eventoId=\{evento\.id\} stato=\{statoSalva\(salvataggi, evento\.id\)\} \/>/g) || []).length === 2,
    "la card porta «Salva» nei due blocchi per rivedere (KIREO e YouTube), e solo lì");
  ok(/salvataggi: SalvataggiRegistrazioni;/.test(card) && !/salvataggi\?:/.test(card), "la card lo pretende: un facoltativo nasconderebbe la pagina che non l'ha letto");
  const rivedi = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/eventi/[id]/rivedi/page.tsx"), "utf8"));
  ok((rivedi.match(/<SalvaRegistrazione eventoId=\{evento\.id\} stato=\{salva\} \/>/g) || []).length === 2 && /const salva = dove \?/.test(rivedi),
    "la pagina rivedi porta «Salva» nei due rami dove si guarda, e non dove non si guarda");
  for (const f of ["app/aree/[slug]/page.tsx", "app/istituzioni/[slug]/page.tsx"]) {
    const src = senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));
    ok(/salvataggiDi\(supabase, user\?\.id \?\? null\)/.test(src) && (src.match(/<CardEvento/g) || []).length === (src.match(/salvataggi=\{salvataggi\}/g) || []).length,
      `${f}: legge i salvataggi e li passa a ogni card`);
  }
  const attivita = senzaCommenti(fs.readFileSync(path.join(ROOT, "lib/app/attivita.ts"), "utf8"));
  ok(!/registrazioni_salvate/.test(attivita), "le registrazioni salvate NON entrano in «Le mie attività»: salvare non è fare");
  const sa = senzaCommenti(fs.readFileSync(path.join(ROOT, "components/app/SalvaRegistrazione.tsx"), "utf8"));
  ok(/rpc\("salva_registrazione"/.test(sa) && /\.delete\(\)\.eq\("evento_id", eventoId\)\.select\("id"\)/.test(sa) && /data\.length === 0/.test(sa),
    "salvare chiede al database, togliere conta le righe tolte");
  ok(!/\/api\/live|presenze_live|iscrizioni_eventi|activity_log/.test(sa), "salvare non tocca presenze, iscrizioni né attività");
  const pg = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/app/le-mie-cose/page.tsx"), "utf8"));
  ok(/leggiRegistrazioniSalvate\(supabase\)/.test(pg) && /reg\.dove === "kireo"/.test(pg) && /reg\.dove === "youtube" && reg\.videoAdesso/.test(pg) && /TR\.perche\[reg\.perche\]/.test(pg),
    "la pagina mostra il bottone dello stato di adesso, e senza bottone dice perché");
  ok(/urlYoutube\(reg\.videoAdesso\)/.test(pg) && !/urlYoutube\(reg\.videoId\)/.test(pg), "il link porta al video di adesso, non a quello copiato");
  ok(/v\.tipo === "registrazione"[\s\S]*?TESTI_RIVEDI\.nonConta[\s\S]*?const p = v\.post;/.test(pg), "anche da qui, rivedere non conta come partecipazione");
  module.exports.prove = prove;
}

(async () => {
  await module.exports.prove();
  console.log("");
  if (falliti > 0) { console.error(`✗ ${falliti} su ${fatte} proprietà (npm run test:lemiecose)`); process.exit(1); }
  console.log(`✓ ${fatte}/${fatte} proprietà (npm run test:lemiecose)`);
})();
