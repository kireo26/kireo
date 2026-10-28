#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:bacheca` — la Bacheca dello studente (28/10/2026), le tre
// decisioni di Mario:
//   §1 si ordina per approvazione, non per creazione (e la data la scrive il
//      database: 20261110100000, provata in scripts/verifica-post-approvato.sql);
//   §2 niente riordino dopo il `range`: si scorre con un cursore, e un post
//      arrivato a metà non fa saltare né ripetere niente;
//   §3 una lettura fallita non dice «non segui nessun ente».
// ⚠️ Il limite: il filtro del cursore si prova sulla stringa che va a
// PostgREST e su una simulazione della stessa regola, non contro PostgREST.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");
abilitaTypeScript();
const B = require("@/lib/app/bacheca");
const { TESTI_BACHECA: T } = require("@/lib/app/testiBacheca");
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
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// Un client finto: ogni tabella risponde quello che le si dà, e registra le
// chiamate della catena.
function clientFinto(risposte) {
  const chiamate = [];
  return {
    chiamate,
    from(tabella) {
      const catena = { tabella, passi: [] };
      chiamate.push(catena);
      const p = new Proxy(
        {},
        {
          get(_t, nome) {
            if (nome === "then") {
              const r = risposte[tabella];
              return (ok) => ok(typeof r === "function" ? r(catena) : r);
            }
            return (...arg) => {
              catena.passi.push([nome, ...arg]);
              return p;
            };
          },
        },
      );
      return p;
    },
  };
}

(async () => {
  console.log("§1 l'ordine è quello della pubblicazione");
  const riga = (n, quando) => ({
    id: `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`,
    istituzione_id: "e1", tipo: "testo", corpo: `post ${n}`, immagine_url: null, embed_url: null,
    approvato_il: quando, istituzioni: { nome: "Ente", slug: "ente" },
  });
  {
    const c = clientFinto({ seguiti: { data: [{ istituzione_id: "e1" }], error: null }, post_enti: { data: [riga(1, "2026-10-28T10:00:00.000001+00:00")], error: null } });
    const e = await B.getFeedBacheca(c, "s1", null);
    const passi = c.chiamate.find((x) => x.tabella === "post_enti").passi;
    const ordini = passi.filter((p) => p[0] === "order").map((p) => `${p[1]} ${p[2].ascending ? "asc" : "desc"}`);
    ok(ordini.join(",") === "approvato_il desc,id desc", "si ordina per approvazione, poi per id, decrescente", ordini.join(","));
    ok(passi.some((p) => p[0] === "limit" && p[1] === B.POST_PER_PAGINA + 1), "legge un post in più, per sapere se ce n'è un'altra pagina");
    ok(!passi.some((p) => p[0] === "range"), "niente range: una pagina comincia dopo l'ultimo post visto, non dopo i primi N");
    ok(e.stato === "post" && e.post[0].pubblicato_il === "2026-10-28T10:00:00.000001+00:00", "la data di ogni post è quella di pubblicazione");
    ok(e.stato === "post" && e.cursoreSuccessivo === null, "con un post solo non c'è una pagina dopo");
  }
  const src = leggi("lib/app/bacheca.ts");
  ok(!/\.sort\(/.test(src), "nessun riordino in JavaScript: l'ordine lo decide il database");
  ok(!/created_at/.test(src), "la Bacheca non legge più created_at");
  ok(/pubblicato_il/.test(leggi("components/app/FeedPost.tsx")) && !/created_at/.test(leggi("components/app/FeedPost.tsx")), "il post mostra la data di pubblicazione");
  ok(!/approvato_il/.test(leggi("components/admin/AzioneApprovazionePost.tsx")), "l'admin non manda più la data dal browser");

  console.log("§2 il cursore: microsecondi intatti, e niente salti");
  const quando = "2026-10-28T14:23:24.472898+00:00";
  const id = "90000000-0000-0000-0000-000000000001";
  const letto = B.leggiCursore(B.codificaCursore({ pubblicato_il: quando, id }));
  ok(letto && letto.quando === quando && letto.id === id, "il cursore torna com'è partito, microsecondi compresi", JSON.stringify(letto));
  for (const sbagliato of [undefined, "", "x~y", `${quando}~non-un-id`, `domani~${id}`, `${quando}~${id}~altro`, `${quando}),or(stato.eq.rifiutato~${id}`]) {
    ok(B.leggiCursore(sbagliato) === null, `un cursore illeggibile riparte dall'inizio: ${String(sbagliato).slice(0, 40)}`);
  }
  {
    const c = clientFinto({ seguiti: { data: [{ istituzione_id: "e1" }], error: null }, post_enti: { data: [], error: null } });
    await B.getFeedBacheca(c, "s1", { quando, id });
    const or = c.chiamate.find((x) => x.tabella === "post_enti").passi.find((p) => p[0] === "or");
    ok(or && or[1] === `approvato_il.lt.${quando},and(approvato_il.eq.${quando},id.lt.${id})`, "il filtro del cursore: prima, oppure stesso istante e id minore", or && or[1]);
  }
  // La simulazione: 23 post con istanti che differiscono di microsecondi, due
  // nello stesso istante; si scorre pagina per pagina applicando la stessa
  // regola del filtro, e a metà arriva un post nuovo.
  {
    const base = Date.parse("2026-10-28T10:00:00Z");
    const fmt = (us) => new Date(base + Math.floor(us / 1000)).toISOString().slice(0, 23) + String(us % 1000).padStart(3, "0") + "+00:00";
    let tutti = Array.from({ length: 23 }, (_, i) => riga(i + 1, fmt(i === 6 ? 5 * 7 : i * 7)));
    const cmp = (a, b) => (a.approvato_il === b.approvato_il ? (a.id < b.id ? 1 : -1) : a.approvato_il < b.approvato_il ? 1 : -1);
    const pagina = (cur) =>
      tutti
        .filter((r) => !cur || r.approvato_il < cur.quando || (r.approvato_il === cur.quando && r.id < cur.id))
        .sort(cmp)
        .slice(0, B.POST_PER_PAGINA + 1);
    const visti = [];
    let cur = null;
    for (let giro = 0; giro < 10; giro++) {
      const c = clientFinto({ seguiti: { data: [{ istituzione_id: "e1" }], error: null }, post_enti: { data: pagina(cur), error: null } });
      const e = await B.getFeedBacheca(c, "s1", cur);
      visti.push(...e.post.map((p) => p.id));
      if (giro === 0) tutti = [...tutti, riga(99, fmt(1e6))];
      if (!e.cursoreSuccessivo) break;
      cur = B.leggiCursore(e.cursoreSuccessivo);
    }
    ok(visti.length === 23 && new Set(visti).size === 23, "23 post scorsi: nessuno ripetuto e nessuno saltato, anche con un post arrivato a metà", `${visti.length} visti, ${new Set(visti).size} diversi`);
  }

  console.log("§3 «non letto» non si scrive come «non segui nessuno»");
  {
    const e1 = await B.getFeedBacheca(clientFinto({ seguiti: { data: null, error: { message: "giù" } } }), "s1", null);
    ok(e1.stato === "non_letto", "gli enti seguiti non letti: non letto", e1.stato);
    const e2 = await B.getFeedBacheca(clientFinto({ seguiti: { data: [], error: null } }), "s1", null);
    ok(e2.stato === "nessun_ente", "nessun ente seguito: nessun ente", e2.stato);
    const e3 = await B.getFeedBacheca(clientFinto({ seguiti: { data: [{ istituzione_id: "e1" }], error: null }, post_enti: { data: null, error: { message: "giù" } } }), "s1", null);
    ok(e3.stato === "non_letto", "i post non letti: non letto, anche se gli enti seguiti ci sono", e3.stato);
    const e4 = await B.getFeedBacheca(clientFinto({ seguiti: { data: [{ istituzione_id: "e1" }], error: null }, post_enti: { data: [], error: null } }), "s1", null);
    ok(e4.stato === "post" && e4.post.length === 0, "enti seguiti senza post: nessun post, non «nessun ente»");
  }
  const pagina = leggi("app/app/bacheca/page.tsx");
  const iNonLetto = ancora(pagina, 'esito.stato === "non_letto"');
  ok(pagina.slice(iNonLetto, ancora(pagina, 'esito.stato === "nessun_ente"')).includes("TESTI_BACHECA.nonLetta"), "la pagina dice «non letta» quando non ha letto");
  ok(!/TESTI_BACHECA\.nessunEnte[\s\S]*TESTI_BACHECA\.nessunEnte/.test(pagina), "e dice «non segui nessun ente» in un posto solo");
  const valori = Object.values(T);
  ok(new Set(valori).size === valori.length, "ogni testo della Bacheca dice una cosa diversa");
  ok(!/segu/i.test(T.nonLetta) && !/segui ancora nessun/i.test(T.nessunPost), "«non letta» e «nessun post» non parlano di chi segui");
  ok(valori.every((t) => trovaAccordi(t).length === 0), "nessun accordo di genere");

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
  process.exit(falliti === 0 ? 0 : 1);
})();
