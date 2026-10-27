#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// I DUE RIQUADRI DELLA PAGINA DELLA DIRETTA SEGUONO IL SERVER — osservato, non
// letto (Mario, giro del 27/10).
//
// Il difetto non stava in una frase: le frasi erano giuste una per una. Stava nel
// PASSAGGIO fra due stati — un riquadro aperto mentre l'altro cambiava le ore —
// e una prova lessicale lì direbbe verde. Quindi questo file monta i due form
// VERI (`CorreggiOreForm`, `SpostaFinestraForm`) in Chromium, come li vede
// l'admin, con un server finto che tiene lo stato dell'evento e un
// `router.refresh()` che rilegge le props, e fa i gesti.
//
// Tre pretese, per tutti e due i riquadri (Mario):
//   1. dopo un'azione dell'altro riquadro l'anteprima si chiede di nuovo;
//   2. la frase vecchia non è MAI a schermo insieme ai valori nuovi (anche
//      mentre la nuova si sta leggendo);
//   3. finché l'anteprima è vecchia o si sta rileggendo, il bottone che conferma
//      non si preme.
// Più la regola del campo (non toccato → segue il server; toccato → resta) e il
// caso delle due persone, dove nessun refresh arriva: lì il form manda lo stato
// che ha mostrato, e su `stato_cambiato` dice di rileggere invece di un guasto.
// Il rifiuto vero lo prova il database: `scripts/verifica-spostamento-stato-visto.sql`.
const path = require("path");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const RADICE = path.join(__dirname, "..");
const P = path.join(__dirname, "riquadri");
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

// Dicembre: ora italiana = UTC+1. 10:35 → 11:35 italiane, il caso del giro.
const INIZIO = "2026-12-01T09:35:00.000Z";
const FINE = "2026-12-01T10:35:00.000Z";

async function main() {
  const codice = await costruisci();
  const browser = await chromium.launch();
  const apri = async (server) => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.log("  (errore nella pagina)", e.message));
    await page.route("**/*", async (route) => {
      if (route.request().url() === "http://kireo.test/") {
        return route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><meta charset="utf-8"><div id="radice"></div><script>window.__server=${JSON.stringify(server)};</script><script>${codice.replace(/<\/script/g, "<\\/script")}</script>`,
        });
      }
      return route.abort();
    });
    await page.goto("http://kireo.test/");
    await page.waitForSelector("#correzione");
    return page;
  };
  const assesta = () => new Promise((r) => setTimeout(r, 150));
  // Si legge il RESO di ciascun riquadro, mai `body` (nel body c'è il bundle,
  // con ogni testo del prodotto: la lezione di `test:pausa`).
  const testo = (page, id) => page.innerText(`#${id}`);
  const bottone = (page, id, nome) => page.locator(`#${id} button`, { hasText: nome });
  const chiamate = (page, nome) => page.evaluate((n) => window.__chiamate.filter((c) => c.nome === n), nome);
  try {
    console.log("\n§0 — il nome del comando dice cosa si sposta\n");
    {
      const page = await apri({ inizio: INIZIO, fine: FINE, ore: 1, fissate: null, chiusa: null });
      const incontro = await testo(page, "spostamento-incontro");
      ok(incontro.includes("Sposta l'orario dell'incontro") && !/diretta/i.test(incontro), "su un incontro in presenza il comando dice «dell'incontro», e non nomina nessuna diretta", incontro);
      ok((await testo(page, "spostamento")).includes("Sposta l'orario della diretta"), "su una diretta dice «della diretta»");
      await page.close();
    }

    console.log("\n§1 — il riquadro della correzione, quando l'orario si sposta (il difetto del giro)\n");
    {
      const page = await apri({ inizio: INIZIO, fine: FINE, ore: 2, fissate: "2026-11-30T09:00:00Z", chiusa: null });
      await bottone(page, "correzione", "Correggi le ore PCTO").click();
      await assesta();
      const prima = await testo(page, "correzione");
      ok(prima.includes("resta 1,00"), "premessa: con 2 ore su un incontro di un'ora la frase è la (i), «resta 1,00»", prima);
      ok((await page.inputValue("#correzione input")) === "2", "premessa: il campo propone le ore del server (2)");

      await bottone(page, "spostamento", "Sposta l'orario della diretta").click();
      await page.fill('#spostamento input[type="datetime-local"] >> nth=1', "2026-12-01T13:35");
      await assesta();
      const anteSposta = await testo(page, "spostamento");
      ok(anteSposta.includes("Le ore erano state fissate a mano (2,00): verranno sostituite dal calcolo sulla nuova durata (3,00)."), "premessa: lo spostamento avvisa che cancella la correzione", anteSposta);

      // Il refresh dopo lo spostamento arriva, ma la nuova anteprima NO, finché
      // il banco non la rilascia: è il momento che il giro ha fotografato.
      const richiestePrima = (await chiamate(page, "anteprima_correzione_ore")).length;
      await page.evaluate(() => { window.__trattieni = true; });
      await bottone(page, "spostamento", "Salva il nuovo orario").click();
      await assesta();
      const durante = await testo(page, "correzione");
      ok(durante.includes("Ore PCTO: 3,00."), "premessa: dopo lo spostamento la riga di stato dice 3,00", durante);
      ok((await chiamate(page, "anteprima_correzione_ore")).length > richiestePrima, "1. l'anteprima della correzione si chiede di nuovo dopo l'azione dell'altro riquadro");
      ok(!durante.includes("resta 1,00") && !durante.includes("1,00"), "2. mentre si rilegge, la frase vecchia non sta accanto ai numeri nuovi", durante);
      ok(durante.includes("Calcolo il massimo riconoscibile"), "…e si dice che si sta calcolando", durante);
      ok(await bottone(page, "correzione", "Salva le ore").isDisabled(), "3. e «Salva le ore» non si preme finché l'anteprima di questo stato non c'è");
      ok((await page.inputValue("#correzione input")) === "3", "il campo non toccato era una proposta nostra: segue il server (3)", await page.inputValue("#correzione input"));
      await page.evaluate(() => { window.__trattieni = false; window.__rilascia(); });
      await assesta();
      const dopo = await testo(page, "correzione");
      ok(dopo.includes("Con l'orario previsto (3 ore), le ore riconosciute non potranno superare 3,00."), "dopo la rilettura la frase è quella del ricaricamento: «Con l'orario previsto (3 ore)… 3,00»", dopo);
      ok(!(await bottone(page, "correzione", "Salva le ore").isDisabled()), "e il bottone torna premibile");
      await page.close();
    }

    console.log("\n§2 — un valore toccato è una scelta di chi scrive: resta\n");
    {
      const page = await apri({ inizio: INIZIO, fine: FINE, ore: 1, fissate: null, chiusa: null });
      await bottone(page, "correzione", "Correggi le ore PCTO").click();
      await page.fill("#correzione input", "5");
      await bottone(page, "spostamento", "Sposta l'orario della diretta").click();
      await page.fill('#spostamento input[type="datetime-local"] >> nth=1', "2026-12-01T13:35");
      await assesta();
      await bottone(page, "spostamento", "Salva il nuovo orario").click();
      await assesta();
      ok((await page.inputValue("#correzione input")) === "5", "il 5 scritto dall'admin resta dopo lo spostamento", await page.inputValue("#correzione input"));
      const t = await testo(page, "correzione");
      ok(t.includes("resta 3,00") && !t.includes("resta 1,00"), "e la frase si ricalcola su quel 5 con il massimo nuovo (3,00)", t);
      await page.close();
    }

    console.log("\n§3 — il gemello: lo spostamento aperto mentre l'admin corregge\n");
    {
      const page = await apri({ inizio: INIZIO, fine: FINE, ore: 1, fissate: null, chiusa: null });
      await bottone(page, "spostamento", "Sposta l'orario della diretta").click();
      await page.fill('#spostamento input[type="datetime-local"] >> nth=1', "2026-12-01T13:35");
      await assesta();
      ok((await testo(page, "spostamento")).includes("da 1,00 a 3,00"), "premessa: «da 1,00 a 3,00»");
      const richiestePrima = (await chiamate(page, "anteprima_spostamento_finestra")).length;
      await bottone(page, "correzione", "Correggi le ore PCTO").click();
      await assesta();
      await page.fill("#correzione input", "5");
      await page.evaluate(() => { window.__trattieni = true; });
      await bottone(page, "correzione", "Salva le ore").click();
      await assesta();
      const durante = await testo(page, "spostamento");
      ok((await chiamate(page, "anteprima_spostamento_finestra")).length > richiestePrima, "1. dopo la correzione l'anteprima dello spostamento si chiede di nuovo");
      ok(!durante.includes("da 1,00 a 3,00"), "2. la frase vecchia («da 1,00…») non resta accanto alle ore corrette", durante);
      ok(await bottone(page, "spostamento", "Salva il nuovo orario").isDisabled(), "3. e il bottone che sposta non si preme mentre l'anteprima si rilegge");
      ok((await page.inputValue('#spostamento input[type="datetime-local"] >> nth=1')) === "2026-12-01T13:35", "la fine scritta dall'ente resta (era una sua scelta)");
      await page.evaluate(() => { window.__trattieni = false; window.__rilascia(); });
      await assesta();
      const dopo = await testo(page, "spostamento");
      ok(dopo.includes("Le ore erano state fissate a mano (5,00): verranno sostituite dal calcolo sulla nuova durata (3,00)."), "e torna l'avviso che conta: lo spostamento cancella la correzione", dopo);
      await page.close();
    }

    console.log("\n§4 — due persone, due computer: nessun refresh arriva\n");
    {
      const page = await apri({ inizio: INIZIO, fine: FINE, ore: 1, fissate: null, chiusa: null });
      await bottone(page, "spostamento", "Sposta l'orario della diretta").click();
      await page.fill('#spostamento input[type="datetime-local"] >> nth=1', "2026-12-01T13:35");
      await assesta();
      // L'admin corregge da un altro computer: il server cambia, la pagina no.
      await page.evaluate(() => { window.__server.ore = 5; window.__server.fissate = "2026-12-01T09:00:00Z"; });
      ok((await testo(page, "spostamento")).includes("da 1,00 a 3,00"), "premessa: questa pagina non può saperlo, e dice ancora «da 1,00 a 3,00»");
      await bottone(page, "spostamento", "Salva il nuovo orario").click();
      await assesta();
      const [ultima] = (await chiamate(page, "sposta_finestra_evento")).slice(-1);
      ok(ultima && Number(ultima.args.p_ore_viste) === 1 && ultima.args.p_fissate_viste === false && ultima.args.p_aveva_fine_vista === true, "lo spostamento manda lo stato che ha MOSTRATO (1,00, non corretto, con fine)", JSON.stringify(ultima?.args));
      ok((await page.evaluate(() => window.__server.ore)) === 5, "la correzione dell'admin non è stata cancellata");
      const t = await testo(page, "spostamento");
      ok(t.includes("sono cambiate mentre guardavi") && !t.includes("problema nostro"), "il rifiuto dice di rileggere, non che c'è stato un guasto", t);
      ok(t.includes("Le ore erano state fissate a mano (5,00)"), "e l'anteprima riletta mostra l'avviso vero", t);
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${falliti ? "✗" : "✓"} ${fatte - falliti}/${fatte} proprietà (npm run test:riquadri)`);
  process.exit(falliti ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
