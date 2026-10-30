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
  ok(ordine(L.listaLeMieCose(g, p, "tutto")) === "post:s1 guida:g1", "in cima il post salvato il 30, sotto la guida scaricata il 29", ordine(L.listaLeMieCose(g, p, "tutto")));
  // Il post più vecchio come pubblicazione non scende per questo.
  const p2 = [post("s1", "2026-10-28T09:00:00Z", "2026-10-29T23:00:00Z")];
  ok(ordine(L.listaLeMieCose(g, p2, "tutto")) === "guida:g1 post:s1", "un post pubblicato dopo ma salvato prima sta sotto", ordine(L.listaLeMieCose(g, p2, "tutto")));
  // Intrecciati: tre e tre.
  const gg = [guida("ga", "2026-10-01T00:00:00Z"), guida("gb", "2026-10-05T00:00:00Z"), guida("gc", "2026-10-09T00:00:00Z")];
  const pp = [post("pa", "2026-10-03T00:00:00Z", null), post("pb", "2026-10-07T00:00:00Z", null), post("pc", "2026-10-11T00:00:00Z", null)];
  ok(ordine(L.listaLeMieCose(gg, pp, "tutto")) === "post:pc guida:gc post:pb guida:gb post:pa guida:ga", "due sorgenti intrecciate si fondono in un ordine solo");
}

console.log("\n§2 a parità d'istante l'ordine è stabile, non quello d'arrivo");
{
  const t = "2026-10-30T09:00:00.123Z";
  const a = L.listaLeMieCose([guida("g2", t), guida("g1", t)], [post("s2", t, null), post("s1", t, null)], "tutto");
  const b = L.listaLeMieCose([guida("g1", t), guida("g2", t)], [post("s1", t, null), post("s2", t, null)], "tutto");
  ok(ordine(a) === "guida:g1 guida:g2 post:s1 post:s2", "a parità d'istante: prima il tipo, poi l'id", ordine(a));
  ok(ordine(a) === ordine(b), "lo stesso ordine qualunque sia l'ordine d'arrivo");
}

console.log("\n§3 i tre filtri, dall'indirizzo");
{
  ok(JSON.stringify(L.FILTRI_LE_MIE_COSE) === JSON.stringify(["tutto", "guide", "post"]), "i filtri sono tre, e «Tutto» è il primo");
  ok(L.TESTI_LISTA.filtri.tutto === "Tutto" && L.TESTI_LISTA.filtri.guide === "Guide" && L.TESTI_LISTA.filtri.post === "Post", "ognuno ha un nome, compreso lo stato di partenza");
  ok(L.filtroDaIndirizzo(undefined) === "tutto" && L.filtroDaIndirizzo("guide") === "guide" && L.filtroDaIndirizzo("post") === "post" && L.filtroDaIndirizzo("altro") === "tutto",
    "?tipo= assente o sconosciuto è «Tutto»");
  ok(L.hrefFiltro("tutto") === "/app/le-mie-cose" && L.hrefFiltro("guide") === "/app/le-mie-cose?tipo=guide" && L.hrefFiltro("post") === "/app/le-mie-cose?tipo=post",
    "il filtro sta nell'indirizzo");
  const g = [guida("g1", "2026-10-29T10:00:00Z")];
  const p = [post("s1", "2026-10-30T09:00:00Z", null)];
  ok(ordine(L.listaLeMieCose(g, p, "guide")) === "guida:g1", "«Guide» mostra solo le guide");
  ok(ordine(L.listaLeMieCose(g, p, "post")) === "post:s1", "«Post» mostra solo i post");
}

console.log("\n§4 tre vuoti, e il «non letto» che non è un vuoto");
{
  ok(L.listaLeMieCose([], [], "tutto").vuoto === "Qui finisce quello che tieni: le guide che scarichi e i post che salvi.", "niente di niente");
  ok(L.listaLeMieCose([], [post("s1", "2026-10-30T09:00:00Z", null)], "guide").vuoto === "Non hai ancora scaricato nessuna guida.", "«Guide» senza guide, anche se ci sono post");
  ok(L.listaLeMieCose([guida("g1", "2026-10-29T10:00:00Z")], [], "post").vuoto === "Non hai ancora salvato nessun post.", "«Post» senza post, anche se ci sono guide");
  const parz = L.listaLeMieCose(null, [post("s1", "2026-10-30T09:00:00Z", null)], "tutto");
  ok(parz.voci.length === 1 && JSON.stringify(parz.nonLette) === '["guide"]' && parz.vuoto === null, "una sorgente non letta si nomina, l'altra si mostra, e non si dice «vuoto»");
  const soloNonLetta = L.listaLeMieCose(null, [], "tutto");
  ok(soloNonLetta.vuoto === null && JSON.stringify(soloNonLetta.nonLette) === '["guide"]', "con una sorgente non letta il vuoto non si dice: non sappiamo se è vuoto");
  ok(JSON.stringify(L.listaLeMieCose(null, [], "post").nonLette) === "[]" && L.listaLeMieCose(null, [], "post").vuoto === "Non hai ancora salvato nessun post.",
    "il filtro «Post» non risente delle guide non lette");
  for (const t of [...Object.values(L.TESTI_LISTA.vuoto), ...Object.values(L.TESTI_LISTA.nonLette), ...Object.values(L.TESTI_LISTA.segno)]) {
    ok(trovaAccordi(t).length === 0, `«${t}» non accorda col genere di chi legge`);
  }
}

console.log("\n§5 la pagina: una lista, i filtri come link, il segno su ogni riga");
{
  const pg = senzaCommenti(fs.readFileSync(path.join(ROOT, "app/app/le-mie-cose/page.tsx"), "utf8"));
  ok(/filtroDaIndirizzo\(tipo\)/.test(pg) && /listaLeMieCose\(scaricate, salvati, filtro\)/.test(pg), "la pagina legge ?tipo= e chiama la lista unica");
  ok(/FILTRI_LE_MIE_COSE\.map/.test(pg) && /href=\{hrefFiltro\(f\)\}/.test(pg) && /aria-current=/.test(pg), "i filtri sono link con il loro indirizzo, e quello attivo è segnato");
  ok((pg.match(/<Segno testo=\{TL\.segno\.(guida|post)\} \/>/g) || []).length === 2, "ogni riga, guida o post, porta il suo segno");
  ok(!/TS\.titoloEnti|TP\.titolo\b/.test(pg), "i due titoli di sezione non ci sono più");
  ok((pg.match(/<ul\b/g) || []).length === 1, "una lista sola");
  ok(/lista\.nonLette\.map/.test(pg) && /lista\.vuoto &&/.test(pg), "la pagina dice le sorgenti non lette e il vuoto");
  ok(/name="ritorno" value=\{hrefFiltro\(filtro\)\}/.test(pg), "dopo lo scaricamento di un allegato si torna al filtro di prima");
  ok(/id="salvati"/.test(pg), "l'àncora di prima (#salvati) atterra sulla lista");
  ok(!/\.range\(|\bdopo=|limit\(/.test(pg), "la lista si legge intera: niente pagine, niente cursore");
}

console.log("");
if (falliti > 0) { console.error(`✗ ${falliti} su ${fatte} proprietà (npm run test:lemiecose)`); process.exit(1); }
console.log(`✓ ${fatte}/${fatte} proprietà (npm run test:lemiecose)`);
