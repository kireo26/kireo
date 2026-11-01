// IL RIORDINO DELL'AREA ADMIN, LOTTO 1 (Mario, 31/10): la fonte unica di «cosa
// aspetta te», il menu, i criteri scritti una volta, il flusso che non
// inventa date, gli elenchi che dicono quanti sono. Gli attesi sono scritti a
// mano. («Niente sparisce» lo sorveglia un'altra suite: `npm run test:admin`.)
//
// Esecuzione: `npm run test:riordino`.
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
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true, jsx: "react-jsx" },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

let fatte = 0;
let falliti = 0;
function ok(cond, msg, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    falliti++;
    console.log(`  ✗ ${msg}${dettaglio ? ` [${dettaglio}]` : ""}`);
  }
}
const leggi = (rel) => senzaCommenti(fs.readFileSync(path.join(ROOT, rel), "utf8"));

// Un client finto: ogni tabella risponde con quello che le si dice; ogni
// metodo della catena restituisce la catena, e l'attesa restituisce la risposta.
function clientFinto(risposte) {
  const visti = [];
  const catena = (tabella) => {
    const r = risposte[tabella] ?? { data: [], count: 0, error: null };
    const c = {};
    for (const m of ["select", "eq", "in", "neq", "not", "gte", "order", "limit", "range", "or", "ilike"]) c[m] = () => c;
    c.then = (ok, ko) => Promise.resolve(r).then(ok, ko);
    return c;
  };
  return {
    visti,
    from: (t) => (visti.push(t), catena(t)),
    rpc: async () => ({ data: [], error: null }),
  };
}

const D = require("@/lib/admin/coseDaDecidere");

(async () => {
  console.log("\n§1 la fonte unica: sette voci, e un conto fallito non è zero");
  {
    const tutto = clientFinto({
      istituzioni: { count: 2, error: null },
      scuole_profili: { count: 1, error: null },
      eventi: { data: [], error: null },
      newsletter_enti: { count: 3, error: null },
      richieste_upgrade: { count: 0, error: null },
      richieste_contatto: { count: 4, error: null },
      avvisi_email_enti: { data: [{ cosa: "evento", riferimento_id: "e1", esito: "non_partita", created_at: "2026-10-31T10:00:00Z" }], error: null },
    });
    const cose = await D.coseDaDecidere(tutto);
    const n = Object.fromEntries(cose.map((c) => [c.chiave, c.numero]));
    ok(cose.length === 7, "sette voci", cose.length);
    ok(JSON.stringify(cose.map((c) => c.chiave)) === JSON.stringify(["istituzioni", "scuole", "eventi", "newsletter", "upgrade", "contatti", "email"]),
      "nell'ordine di chi deve muoversi per primo");
    ok(n.istituzioni === 2 && n.scuole === 1 && n.eventi === 0 && n.newsletter === 3 && n.upgrade === 0 && n.contatti === 4 && n.email === 1,
      "i numeri sono quelli letti, e zero è zero", JSON.stringify(n));

    const rotto = clientFinto({
      istituzioni: { count: null, error: { message: "giù" } },
      scuole_profili: { count: 1, error: null },
      eventi: { data: null, error: { message: "giù" } },
      newsletter_enti: { count: null, error: null },
      avvisi_email_enti: { data: null, error: { message: "giù" } },
    });
    const m = Object.fromEntries((await D.coseDaDecidere(rotto)).map((c) => [c.chiave, c.numero]));
    ok(m.istituzioni === null && m.eventi === null && m.email === null, "una lettura fallita dà null, non zero", JSON.stringify(m));
    ok(m.newsletter === null, "un conto che non arriva (count assente) è null, non zero");
    ok(m.scuole === 1, "e le altre voci restano lette");
    ok(D.TESTI_COSE_DA_DECIDERE.nonLetto === "non letto", "a schermo «non letto»");
  }

  console.log("\n§2 chi legge la fonte unica, e chi non conta da sé");
  {
    const oggi = leggi("app/admin/page.tsx");
    ok(/coseDaDecidere\(supabase\)/.test(oggi) && /<CoseDaDecidere /.test(oggi), "«Oggi» legge la fonte unica e la mostra");
    ok(!/\.from\(/.test(oggi) && !/count:/.test(oggi), "«Oggi» non conta niente da sé, e non ha elenchi");
    const notifiche = leggi("app/admin/notifiche/page.tsx");
    ok(/coseDaDecidere\(supabase\)/.test(notifiche) && /<CoseDaDecidere /.test(notifiche), "la cima di «Notifiche» legge la stessa fonte");
    const riquadro = leggi("components/admin/CoseDaDecidere.tsx");
    ok(/c\.numero === null \? T\.nonLetto : c\.numero/.test(riquadro), "il riquadro scrive «non letto» dove il numero è null");
    ok(/tutteZero = cose\.every\(\(c\) => c\.numero === 0\)/.test(riquadro), "«niente da decidere» solo se tutte le voci sono lette e a zero");
  }

  console.log("\n§3 i criteri stanno in un posto, e li usano chi conta e chi decide");
  {
    const usi = [
      ["istituzioniInAttesa", "app/admin/enti/page.tsx"],
      ["upgradeInAttesa", "app/admin/enti/page.tsx"],
      ["scuoleInAttesa", "app/admin/scuole/page.tsx"],
      ["contattiDaGestire", "app/admin/notifiche/page.tsx"],
      ["newsletterDaApprovare", "app/admin/newsletter/ElencoNewsletter.tsx"],
    ];
    // Senza spazi: una catena che va a capo prima di `.filtra(` è la stessa chiamata (il modo 5).
    for (const [criterio, file] of usi) ok(leggi(file).replace(/\s+/g, "").includes(`CRITERI.${criterio}.filtra(`), `${criterio}: lo usa anche ${file}`);
    const eventi = leggi("app/admin/eventi/layout.tsx");
    ok(/contaDaApprovare\(supabase\)/.test(eventi) && /contaDaApprovare\(supabase\)/.test(leggi("lib/admin/coseDaDecidere.ts")), "gli eventi: il numero della scheda e quello di «Oggi» vengono dalla stessa funzione");
    ok(/coseDaDecidere\(supabase\)/.test(leggi("app/admin/newsletter/layout.tsx")), "le newsletter: il numero della scheda viene dalla fonte unica");
  }

  console.log("\n§4 il menu: le voci di Mario, e nessuna che porti a una pagina che non c'è");
  {
    const { VOCI_MENU_ADMIN, GIORNI_FINESTRA_ADMIN } = require("@/lib/admin/menu");
    ok(JSON.stringify(VOCI_MENU_ADMIN.map((v) => v.label)) === JSON.stringify(["Oggi", "Notifiche", "Scuole", "Enti", "Eventi", "Post", "Newsletter", "Sistema"]),
      "Oggi · Notifiche · Scuole · Enti · Eventi · Post · Newsletter · Sistema");
    for (const v of VOCI_MENU_ADMIN) {
      const f = path.join(ROOT, "app", v.href.slice(1), "page.tsx");
      ok(fs.existsSync(f), `${v.label} ha la sua pagina`);
    }
    ok(!VOCI_MENU_ADMIN.some((v) => /statistic|dashboard/i.test(v.label + v.href)), "la dashboard non ha ancora un posto");
    ok(GIORNI_FINESTRA_ADMIN === 30, "una finestra sola, 30 giorni");
    ok(/inizioFinestraAdmin\(\)/.test(leggi("app/admin/sistema/page.tsx")) && /inizioFinestraAdmin\(adesso\)/.test(leggi("lib/admin/flusso.ts")), "la usano i guasti e il flusso, dalla stessa funzione");
  }

  console.log("\n§5 il flusso: solo le date che la tabella sa dimostrare");
  {
    const F = require("@/lib/admin/flusso");
    for (const d of F.DEFINIZIONI) {
      const colonne = d.colonne.split(",").map((c) => c.trim().split("(")[0]);
      ok(colonne.includes(d.data), `${d.chiave}: la colonna della finestra (${d.data}) è fra quelle lette`);
    }
    const nl = F.DEFINIZIONI.find((d) => d.chiave === "newsletter");
    const r = nl.riga({ id: "n1", oggetto: "O", stato: "in_approvazione", created_at: "2026-10-30T10:00:00Z", approvata_il: null, istituzioni: { nome: "Davante" } });
    ok(r.date.length === 1 && r.date[0].etichetta === "scritta il", "una newsletter non approvata non dice una data di approvazione", JSON.stringify(r.date));
    const g = await F.leggiFlusso(clientFinto({ eventi: { data: null, count: null, error: { message: "giù" } } }), new Date("2026-10-31T10:00:00Z"));
    const ev = g.find((x) => x.chiave === "eventi");
    ok(ev.totale === null && ev.righe.length === 0, "un gruppo che non si legge è «non letto», non vuoto");
    ok(g.find((x) => x.chiave === "post").totale === 0, "e un gruppo letto e vuoto è zero");
    ok(!F.DEFINIZIONI.some((d) => /updated_at/.test(d.colonne)), "nessuna data presa da updated_at, che vuol dire un'altra cosa");
  }

  console.log("\n§6 gli elenchi dicono quanti sono");
  {
    const P = require("@/lib/admin/pagine");
    ok(P.testoTotale(12, 1, 12) === "In tutto: 12", "sotto la pagina: il totale");
    ok(P.testoTotale(312, 2, 50) === "Mostrati 51–100 di 312", "oltre: dove sei e quanti sono");
    ok(P.testoTotale(null, 1, 0) === "Non siamo riusciti a contare quanti sono in tutto.", "un totale non letto si dice");
    ok(P.paginaDa("abc") === 1 && P.paginaDa("3") === 3 && P.paginaDa("-2") === 1, "una pagina storta è la prima");
    for (const f of ["app/admin/enti/page.tsx", "app/admin/scuole/page.tsx", "app/admin/post/ElencoPost.tsx", "app/admin/newsletter/ElencoNewsletter.tsx", "app/admin/sistema/page.tsx"]) {
      const s = leggi(f);
      ok(/count: "exact"/.test(s) && /testoTotale\(/.test(s), `${f}: legge il totale e lo scrive`);
    }
    const E = require("@/lib/admin/eventiAdmin");
    const ev = [{ id: "1", titolo: "Open day università", ente: "Ateneo" }, { id: "2", titolo: "Diretta", ente: "Accademia di Brera" }];
    ok(E.cercaEventiAdmin(ev, "UNIVERSITA").map((e) => e.id).join() === "1", "la ricerca degli eventi ignora maiuscole e accenti");
    ok(E.cercaEventiAdmin(ev, "brera").map((e) => e.id).join() === "2", "e cerca anche nel nome dell'ente");
    ok(E.cercaEventiAdmin(ev, "  ").length === 2, "una ricerca vuota non filtra");
  }

  console.log("\n§7 i rimandi portano dove le cose sono adesso");
  {
    const { linkNotifica } = require("@/lib/notifiche/etichette");
    ok(linkNotifica("post_pubblicato", "p1") === "/admin/post#post-p1", "la notifica di un post nuovo porta alla pagina dei post");
    ok(!/in cima a questa pagina/.test(leggi("lib/admin/avvisiEnte.ts")), "l'avviso dopo una decisione non manda più «in cima a questa pagina»");
    const D2 = require("@/lib/admin/coseDaDecidere");
    const { FILTRI_ENTI } = require("@/lib/admin/enti");
    for (const v of (await D2.coseDaDecidere(clientFinto({})))) {
      // Dal lotto 2 (01/11) due voci portano a un filtro dell'elenco degli
      // enti (`?stato=`): la pagina deve esserci, e il filtro deve essere uno
      // di quelli che la pagina conosce, altrimenti si apre «Tutti».
      const [conQuery, ancora] = v.href.split("#");
      const [p, query] = conQuery.split("?");
      if (query) {
        const stato = new URLSearchParams(query).get("stato");
        ok(p === "/admin/enti" && FILTRI_ENTI.some((f) => f.chiave === stato), `«${v.etichetta}» porta a un filtro che l'elenco degli enti conosce`, v.href);
      }
      const f = path.join(ROOT, "app", p.slice(1), "page.tsx");
      const ok1 = fs.existsSync(f) && (!ancora || leggi(path.relative(ROOT, f)).includes(`id="${ancora}"`) || fs.readFileSync(f, "utf8").includes(`id="${ancora}"`));
      ok(ok1, `«${v.etichetta}» porta a una pagina che c'è${ancora ? `, con l'àncora #${ancora}` : ""}`, v.href);
    }
  }

  console.log("");
  if (falliti > 0) {
    console.error(`✗ ${falliti} su ${fatte} proprietà (npm run test:riordino)`);
    process.exit(1);
  }
  console.log(`✓ ${fatte}/${fatte} proprietà (npm run test:riordino)`);
})();
