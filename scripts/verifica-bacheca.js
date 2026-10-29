#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:bacheca` — la Bacheca dello studente (28/10/2026), le tre
// decisioni di Mario:
//   §1 si ordina per quando il post è diventato visibile, non per creazione (e
//      la data la scrive il database: `visibile_dal`, 20261113110000, provata in
//      scripts/verifica-post-pubblicati.sql; fino al 29/10 era `approvato_il`);
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
    visibile_dal: quando, istituzioni: { nome: "Ente", slug: "ente" },
  });
  {
    const c = clientFinto({ seguiti: { data: [{ istituzione_id: "e1" }], error: null }, post_enti: { data: [riga(1, "2026-10-28T10:00:00.000001+00:00")], error: null } });
    const e = await B.getFeedBacheca(c, "s1", null);
    const passi = c.chiamate.find((x) => x.tabella === "post_enti").passi;
    const ordini = passi.filter((p) => p[0] === "order").map((p) => `${p[1]} ${p[2].ascending ? "asc" : "desc"}`);
    ok(ordini.join(",") === "visibile_dal desc,id desc", "si ordina per quando il post è diventato visibile, poi per id, decrescente", ordini.join(","));
    ok(passi.some((p) => p[0] === "eq" && p[1] === "visibile" && p[2] === true) && !passi.some((p) => p[0] === "eq" && p[1] === "stato"),
      "cosa è visibile lo dice la colonna del database, e la Bacheca non ripete l'elenco degli stati");
    ok(passi.some((p) => p[0] === "limit" && p[1] === B.POST_PER_PAGINA + 1), "legge un post in più, per sapere se ce n'è un'altra pagina");
    ok(!passi.some((p) => p[0] === "range"), "niente range: una pagina comincia dopo l'ultimo post visto, non dopo i primi N");
    ok(e.stato === "post" && e.post[0].pubblicato_il === "2026-10-28T10:00:00.000001+00:00", "la data di ogni post è quella di pubblicazione");
    ok(e.stato === "post" && e.cursoreSuccessivo === null, "con un post solo non c'è una pagina dopo");
  }
  const src = leggi("lib/app/bacheca.ts");
  ok(!/\.sort\(/.test(src), "nessun riordino in JavaScript: l'ordine lo decide il database");
  ok(!/created_at/.test(src), "la Bacheca non legge più created_at");
  ok(/pubblicato_il/.test(leggi("components/app/FeedPost.tsx")) && !/created_at/.test(leggi("components/app/FeedPost.tsx")), "il post mostra la data di pubblicazione");
  ok(!/approvato_il/.test(src), "la Bacheca non legge più approvato_il (dal 29/10 è storia)");
  {
    // Nessuno manda una data dal browser: l'unica scrittura del client sui post
    // è l'insert dell'ente, e non nomina date.
    const form = leggi("components/ente/CreaPostForm.tsx");
    const insert = (form.match(/\.from\("post_enti"\)\.insert\(\{[\s\S]*?\}\);/) ?? [""])[0];
    ok(insert.includes("corpo"), "l'insert dell'ente si trova (una prova su un insert vuoto non prova niente)");
    ok(!/created_at|visibile_dal|approvato_il|stato/.test(insert), "l'insert dell'ente non manda date né uno stato", insert.replace(/\s+/g, " ").slice(0, 120));
    ok(!fs.existsSync(path.join(ROOT, "components/admin/AzioneApprovazionePost.tsx")), "l'approvazione dei post non c'è più");
  }

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
    ok(or && or[1] === `visibile_dal.lt.${quando},and(visibile_dal.eq.${quando},id.lt.${id})`, "il filtro del cursore: prima, oppure stesso istante e id minore", or && or[1]);
  }
  // La simulazione: 23 post con istanti che differiscono di microsecondi, due
  // nello stesso istante; si scorre pagina per pagina applicando la stessa
  // regola del filtro, e a metà arriva un post nuovo.
  {
    const base = Date.parse("2026-10-28T10:00:00Z");
    const fmt = (us) => new Date(base + Math.floor(us / 1000)).toISOString().slice(0, 23) + String(us % 1000).padStart(3, "0") + "+00:00";
    let tutti = Array.from({ length: 23 }, (_, i) => riga(i + 1, fmt(i === 6 ? 5 * 7 : i * 7)));
    const cmp = (a, b) => (a.visibile_dal === b.visibile_dal ? (a.id < b.id ? 1 : -1) : a.visibile_dal < b.visibile_dal ? 1 : -1);
    const pagina = (cur) =>
      tutti
        .filter((r) => !cur || r.visibile_dal < cur.quando || (r.visibile_dal === cur.quando && r.id < cur.id))
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

  console.log("§4 il post di una notifica: c'è, non c'è più, o non l'abbiamo letto");
  {
    const { linkNotifica } = require("@/lib/notifiche/etichette");
    const id = "90000000-0000-0000-0000-000000000007";
    ok(linkNotifica("nuovo_post", id) === `/app/bacheca?post=${id}`, "la notifica di un post porta al post, non alla Bacheca e basta", linkNotifica("nuovo_post", id));
    ok(linkNotifica("post_tolto", id) === `/ente/bacheca#post-${id}` && linkNotifica("post_pubblicato", id) === `/admin#post-${id}`, "l'ente arriva al suo post tolto, l'admin al post nuovo");
    ok(B.leggiIdPost(id) === id && B.leggiIdPost("x),or(1") === null && B.leggiIdPost(undefined) === null, "solo un id finisce nel filtro");
    const c = clientFinto({ post_enti: { data: null, error: null } });
    const e1 = await B.getPostDellaNotifica(c, id);
    const passi = c.chiamate[0].passi;
    ok(e1.stato === "non_piu_visibile", "zero righe: il post non c'è più", e1.stato);
    ok(passi.some((p) => p[0] === "eq" && p[1] === "visibile" && p[2] === true), "…e si chiede solo un post visibile");
    const e2 = await B.getPostDellaNotifica(clientFinto({ post_enti: { data: null, error: { message: "giù" } } }), id);
    ok(e2.stato === "non_letto", "una lettura fallita non dice «non c'è più»", e2.stato);
    const e3 = await B.getPostDellaNotifica(clientFinto({ post_enti: { data: riga(7, "2026-10-29T08:00:00+00:00"), error: null } }), id);
    ok(e3.stato === "post" && e3.post.pubblicato_il === "2026-10-29T08:00:00+00:00", "il post c'è: si mostra", e3.stato);
    ok(!/non hanno ancora pubblicato/.test(T.nessunPost), "«nessun post» non afferma che gli enti non hanno pubblicato (falso se un post è stato tolto)", T.nessunPost);
    const pg = leggi("app/app/bacheca/page.tsx");
    ok(/getPostDellaNotifica\(/.test(pg) && /TESTI_BACHECA\.postNonPiu/.test(pg) && /TESTI_BACHECA\.postNonLetto/.test(pg), "la pagina dice i tre casi");
  }

  console.log("§5 il tetto: 3 post nelle ultime 24 ore");
  {
    const P = require("@/lib/ente/post");
    // Il numero del database: l'ULTIMA definizione di max_post_nelle_24_ore.
    const dir = path.join(ROOT, "supabase/migrations");
    let sql = null;
    for (const f of fs.readdirSync(dir).sort()) {
      const t = fs.readFileSync(path.join(dir, f), "utf8");
      const m = [...t.matchAll(/function public\.max_post_nelle_24_ore\(\)[\s\S]*?select (\d+)/g)];
      if (m.length) sql = Number(m[m.length - 1][1]);
    }
    ok(sql === 3 && P.MAX_POST_NELLE_24_ORE === 3, "il tetto è 3, nel database e nello specchio", `database ${sql}, TS ${P.MAX_POST_NELLE_24_ORE}`);
    const adesso = new Date("2026-10-29T12:00:00Z");
    const ore = (h) => new Date(adesso.getTime() - h * 3600e3).toISOString();
    ok(P.prossimoPostDalle([ore(1), ore(2)], adesso) === null, "due post nelle 24 ore: si pubblica");
    ok(P.prossimoPostDalle([ore(1), ore(2), ore(30)], adesso) === null, "un post di 30 ore fa non conta");
    const d = P.prossimoPostDalle([ore(1), ore(5), ore(20), ore(23)], adesso);
    ok(d && d.toISOString() === "2026-10-29T16:00:00.000Z", "quattro in finestra (dal SQL Editor): devono uscirne due, cioè il terzo più recente, di 20 ore fa, alle 16:00", d && d.toISOString());
    const m = P.testoTettoRaggiunto(new Date("2026-10-30T07:00:00Z"));
    ok(/30 ottobre 2026/.test(m) && /08:00/.test(m), "il rifiuto dice quando tornare, in ora italiana", m);
    const pg = leggi("app/ente/(dashboard)/bacheca/page.tsx");
    ok(/prossimoPostDalle\(/.test(pg) && /avvisoTetto=\{dalle \? testoTettoRaggiunto\(dalle\) : null\}/.test(pg), "la pagina dell'ente calcola il tetto e lo passa al form");
    ok(/troppi_post_nelle_24_ore/.test(leggi("components/ente/CreaPostForm.tsx")) && !/troppi_post_in_revisione/.test(leggi("components/ente/CreaPostForm.tsx")), "il form conosce il rifiuto nuovo, non quello della coda");
    ok(P.etichettaStatoPost("sconosciuto").label === "sconosciuto" && P.etichettaStatoPost("tolto").label === "Tolto da KIREO", "uno stato sconosciuto si mostra col suo nome, non come «in approvazione»");
    ok(P.rigaMotivo("tolto", null, "x", null) === P.TESTI_POST.motivoNonLetto && P.rigaMotivo("pubblicato", null, "x", null) === null,
      "un motivo non letto lo dice; un post pubblicato non ha una riga di motivo");
    const mm = new Map([["x", { motivo_rifiuto: null, motivo_rimozione: "Promozione a tempo" }]]);
    ok(/Motivo: Promozione a tempo/.test(P.rigaMotivo("tolto", mm, "x", "2026-10-29T08:00:00Z")), "l'ente legge il motivo della rimozione");
    ok(Object.values(P.TESTI_POST).every((t) => trovaAccordi(t).length === 0), "nessun accordo di genere nei testi dei post");
  }

  console.log("§6 togliere un post: la motivazione prima, la conferma con le notifiche");
  {
    const R = require("@/lib/admin/rimozionePost");
    ok(R.erroreRimozione("  ") !== null && R.erroreRimozione("Promozione a tempo") === null, "senza motivazione non si toglie");
    ok(/Non siamo riusciti a contare/.test(R.testoConfermaRimozione(null)), "notifiche non contate: lo dice, non dice zero");
    ok(/nessuna notifica/.test(R.testoConfermaRimozione(0)) && /1 notifica/.test(R.testoConfermaRimozione(1)) && /3 notifiche/.test(R.testoConfermaRimozione(3)), "la conferma dice il numero delle notifiche già partite");
    const t = leggi("components/admin/TogliPost.tsx");
    const daConferma = ancora(t, "function chiediConferma()");
    ok(t.slice(daConferma, ancora(t, "async function togli()")).includes("erroreRimozione("), "la motivazione si controlla prima di chiedere conferma");
    ok(/rpc\("togli_post"/.test(t) && !/\.update\(/.test(t), "si toglie con la funzione, non con un update dal client");
    const admin = leggi("app/admin/page.tsx");
    ok(/notifiche=\{erroreNotifichePost \? null :/.test(admin), "una conta fallita arriva alla conferma come «non contate»");
    ok(!/AzioneApprovazionePost|Post in approvazione/.test(admin), "la coda dei post è uscita da /admin");
    ok([R.erroreRimozione(""), R.testoConfermaRimozione(1), R.testoConfermaRimozione(4)].every((x) => trovaAccordi(x).length === 0), "nessun accordo di genere");
  }

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
  process.exit(falliti === 0 ? 0 : 1);
})();
