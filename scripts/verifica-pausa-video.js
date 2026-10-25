#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA PAUSA LUNGA NON CONTA — osservata, non dedotta (Mario, 25/10 sera).
//
// Il 25/10 la lettura del codice diceva: dopo il primo avvio il conteggio non
// guarda la pausa, quindi uno studente che lascia il video fermo con la pagina in
// primo piano accumula presenza. Era una PREVISIONE. Questo file la osserva: monta
// il `PannelloLive` VERO in un browser vero (Playwright), con un YouTube finto che
// dice «in riproduzione» e poi «in pausa», manda avanti l'orologio della pagina e
// CONTA le richieste a /api/live/ping. Nessuna copia del cablaggio: la pagina è
// quella che aprono gli studenti, e sono suoi i timer che decidono i battiti.
//
// Le stub sono tre, e nessuna tocca la regola: il client Supabase (la lettura del
// contatore), `next/link` e `next/navigation`. Tutto il resto è codice di prodotto.
//
// La stessa proprietà ha due vite: scritta PRIMA della cura misurava il difetto
// (il 25/10 sera: rossa, battiti durante cinque minuti di pausa), e DOPO sorveglia
// la correzione. Vedi `MS_PAUSA_TOLLERATA` in lib/live/presenza.ts.
const path = require("path");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const RADICE = path.join(__dirname, "..");
const P = path.join(__dirname, "pausa");
let fatte = 0;
let falliti = 0;
function ok(cond, msg, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    falliti++;
    console.log(`  ✗ ${msg}${dettaglio ? `\n      ${dettaglio}` : ""}`);
  }
}

const STUB = {
  "@/lib/supabase/client": path.join(P, "stub-supabase.ts"),
  "next/link": path.join(P, "stub-next-link.tsx"),
  "next/navigation": path.join(P, "stub-next-navigation.ts"),
};

async function costruisci() {
  const r = await esbuild.build({
    entryPoints: [path.join(P, "ingresso.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
    plugins: [
      {
        name: "alias",
        setup(b) {
          b.onResolve({ filter: /^(@\/lib\/supabase\/client|next\/link|next\/navigation)$/ }, (a) => ({ path: STUB[a.path] }));
          b.onResolve({ filter: /^@\// }, async (a) => b.resolve("./" + a.path.slice(2), { resolveDir: RADICE, kind: a.kind }));
        },
      },
    ],
  });
  return r.outputFiles[0].text;
}

// YouTube finto: il player si dice pronto, e il banco decide gli stati.
const YT_FINTO = `
  window.YT = { Player: class {
    constructor(_el, o) { window.__eventi = o.events; setTimeout(() => o.events.onReady && o.events.onReady(), 0); }
    destroy() {}
  } };
  window.__errore = (n) => window.__eventi && window.__eventi.onError && window.__eventi.onError({ data: n });
  window.__stato = (n) => window.__eventi && window.__eventi.onStateChange && window.__eventi.onStateChange({ data: n });
`;

async function main() {
  const codice = await costruisci();
  const inizio = new Date("2026-10-25T08:00:00Z");
  const fine = new Date(inizio.getTime() + 60 * 60000);
  const browser = await chromium.launch();
  try {
    const apri = async (oraIniziale, battiti) => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("  (errore nella pagina)", e.message));
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (url.endsWith("/api/live/ping")) {
        battiti.push(url);
        return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      }
      if (url.includes("/api/")) return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
      if (url === "http://kireo.test/") {
        return route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><meta charset="utf-8"><div id="radice"></div><script>window.__props=${JSON.stringify({
            dataInizio: inizio.toISOString(),
            dataFine: fine.toISOString(),
          })};${YT_FINTO}</script><script>${codice.replace(/<\/script/g, "<\\/script")}</script>`,
        });
      }
      return route.abort();
    });
    await page.clock.install({ time: oraIniziale });
    await page.goto("http://kireo.test/");
    await page.clock.runFor(3000);
    return page;
    };
    const battiti = [];
    const page = await apri(new Date(inizio.getTime() + 60000), battiti);

    // Le richieste arrivano al banco in modo asincrono rispetto all'orologio
    // finto: prima di contare si lascia che quelle già partite atterrino.
    const assesta = () => new Promise((r) => setTimeout(r, 300));
    const avanza = async (ms) => { await page.clock.runFor(ms); await assesta(); };
    const quanti = () => battiti.length;
    await page.evaluate(() => window.__stato(1));
    await avanza(61000);
    const primaDellaPausa = quanti();
    ok(primaDellaPausa >= 2, "con il video in riproduzione la pagina batte (premessa: il banco funziona)", `battiti=${primaDellaPausa}`);

    await page.evaluate(() => window.__stato(2));
    await avanza(90000);
    const entroLaTolleranza = quanti() - primaDellaPausa;
    await avanza(5 * 60000);
    const oltre = quanti() - primaDellaPausa - entroLaTolleranza;
    ok(oltre === 0, "oltre la pausa tollerata, con la pagina in primo piano, non parte nessun battito", `battiti nei cinque minuti dopo la tolleranza: ${oltre}`);
    ok(entroLaTolleranza >= 1, "una pausa breve conta ancora (la regola del 18/10, per il buffering)", `battiti nei primi 90s di pausa: ${entroLaTolleranza}`);

    const testo = await page.innerText("#radice");
    ok(testo.includes("Il video è fermo, quindi la presenza non sta avanzando. Riprendi la riproduzione per farla ripartire."), "lo studente legge perché il conteggio è fermo");

    const fermi = quanti();
    await page.evaluate(() => window.__stato(1));
    await avanza(2000);
    ok(quanti() > fermi, "quando il video riparte, il conteggio riparte subito");

    // Un buffering lungo è un video che non si muove: stessa regola della pausa.
    const primaBuffer = quanti();
    await page.evaluate(() => window.__stato(3));
    await avanza(90000 + 5 * 60000);
    const dopoBuffer = quanti();
    await page.evaluate(() => window.__stato(1));
    ok(dopoBuffer - primaBuffer <= 2, "anche un caricamento infinito smette di contare", `battiti in 6,5 minuti di buffering: ${dopoBuffer - primaBuffer}`);

    // IL RIENTRO: «Adesso riprende» si dice solo con il video in riproduzione.
    const vis = (v) => page.evaluate((x) => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => x });
      document.dispatchEvent(new Event("visibilitychange"));
    }, v);
    await vis("hidden");
    await avanza(3 * 60000);
    await vis("visible");
    await avanza(500);
    ok((await page.innerText("#radice")).includes("Adesso riprende."), "rientro con il video in riproduzione: «Adesso riprende» (vero)");
    // Settanta secondi: oltre il minuto (sotto non si dice niente) e DENTRO la
    // tolleranza — è l'unico caso in cui il conteggio corre ancora al rientro e
    // «adesso riprende» sarebbe vero per venti secondi. Con un'assenza più lunga
    // la tolleranza è già scaduta e la guardia non serve: la prima stesura usava
    // tre minuti, e la controprova sulla guardia non mordeva.
    await page.evaluate(() => window.__stato(2));
    await vis("hidden");
    await avanza(70000);
    await vis("visible");
    await avanza(500);
    const dopoPausa = await page.innerText("#radice");
    // ⚠️ Si legge il RESO (#radice), mai `body`: nel body c'è anche il bundle, che
    // contiene ogni testo del prodotto — la prima stesura era verde per questo.
    ok(dopoPausa.includes("Hai passato") && !dopoPausa.includes("Adesso riprende."), "rientro con il video in pausa: l'avviso c'è, ma senza «Adesso riprende»", dopoPausa.slice(0, 400));

    // PRIMA DELL'INIZIO un «incorporamento disattivato» non si segnala (25/10).
    const prima = await apri(new Date(inizio.getTime() - 5 * 60000), []);
    await prima.evaluate(() => window.__errore(150));
    await prima.clock.runFor(1000);
    await new Promise((r) => setTimeout(r, 300));
    const rpcPrima = await prima.evaluate(() => window.__rpc ?? []);
    ok(!rpcPrima.includes("segnala_player_live"), "prima dell'inizio il player che non si vede non diventa un allarme per il moderatore", `rpc=${rpcPrima.join(",")}`);
    const resoPrima = await prima.innerText("#radice");
    ok(resoPrima.includes("La diretta non è ancora cominciata") && !resoPrima.includes("pubblicato in modo che non si possa"), "e allo studente non si dice che il video è pubblicato male", resoPrima.slice(0, 300));
    // Dopo l'inizio lo stesso errore si segnala: la regola del 18/10 resta.
    await prima.clock.runFor(5 * 60000);
    await prima.evaluate(() => window.__errore(150));
    await prima.clock.runFor(1000);
    await new Promise((r) => setTimeout(r, 300));
    ok((await prima.evaluate(() => window.__rpc ?? [])).includes("segnala_player_live"), "dopo l'inizio lo stesso errore si segnala, come sempre");
  } finally {
    await browser.close();
  }
  console.log(`\n${falliti ? "✗" : "✓"} ${fatte - falliti}/${fatte} proprietà (npm run test:pausa)`);
  process.exit(falliti ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
