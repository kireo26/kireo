#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LO SCARICAMENTO DI UNA GUIDA, NEL BROWSER VERO (29/10).
//
// Il difetto del 29/10 non stava in una funzione: stava nell'ORDINE in cui il
// browser faceva tre cose (il download, l'email, la scrittura della traccia), e
// la scrittura moriva quando il PDF sostituiva la pagina. Nessuna prova che
// legge il sorgente lo avrebbe visto. Qui si montano i due form VERI
// (`GuidaEnteForm`, `GuidaAreaForm`) in Chromium e si guarda che cosa parte
// davvero dalla pagina:
//   - una POST sola, verso la route che registra e poi rimanda al file;
//   - con i soli campi che usiamo (l'email e la privacy, o niente per chi ha
//     fatto l'accesso), e il percorso per tornare;
//   - nessuna richiesta a Supabase dal browser: la traccia non la scrive più lui;
//   - un'email non valida, o la privacy non accettata, non manda niente.
// La route è finta (risponde 303 a un «PDF» che sostituisce la pagina, il caso
// del difetto): la sua metà la prova `scripts/verifica-guida-dal-server.sql`.
const http = require("http");
const path = require("path");
const esbuild = require("esbuild");
const { chromium } = require("playwright");

const RADICE = path.join(__dirname, "..");
const P = path.join(__dirname, "scaricaguida");
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

// Un server HTTP vero e non `page.route`: Playwright non segue un 303 inventato
// su una navigazione (la pagina finisce in chrome-error), e il punto di questa
// prova è proprio la navigazione.
async function giro(browser, codice, props, gesto) {
  const richieste = [];
  const srv = http.createServer((q, r) => {
    const url = new URL(q.url, "http://x");
    if (url.pathname === "/istituzioni/ente-prova") {
      r.setHeader("content-type", "text/html");
      return r.end(`<!doctype html><div id="radice"></div><script>window.__props=${JSON.stringify(props)}</script><script>${codice}</script>`);
    }
    let corpo = "";
    q.on("data", (d) => (corpo += d));
    q.on("end", () => {
      richieste.push({ metodo: q.method, percorso: url.pathname, corpo });
      if (url.pathname.startsWith("/api/scarica-guida/")) {
        r.writeHead(303, { location: "/guida.pdf" });
        return r.end();
      }
      // Il «PDF» sostituisce la pagina: è il caso in cui la scrittura di prima moriva.
      r.setHeader("content-type", "text/html");
      r.end("il pdf");
    });
  });
  await new Promise((fatto) => srv.listen(0, "127.0.0.1", fatto));
  const pagina = await browser.newPage();
  try {
    await pagina.goto(`http://127.0.0.1:${srv.address().port}/istituzioni/ente-prova`);
    await pagina.waitForSelector("button[type=submit]");
    await gesto(pagina);
    await pagina.waitForTimeout(600);
    return { richieste, finale: new URL(pagina.url()).pathname };
  } finally {
    await pagina.close();
    srv.close();
  }
}

const campi = (corpo) => [...new URLSearchParams(corpo).keys()].sort().join(",");

async function main() {
  const codice = await costruisci();
  const browser = await chromium.launch();
  try {
    console.log("\n§1 — la guida di un ente, senza accesso\n");
    {
      const r = await giro(browser, codice, { quale: "ente", emailAccount: null }, async (p) => {
        await p.fill("#guida-email", "studente@esempio.it");
        await p.check("#guida-privacy");
        await p.click("button[type=submit]");
      });
      const post = r.richieste.filter((q) => q.metodo === "POST");
      ok(post.length === 1 && post[0].percorso === "/api/scarica-guida/ente/G1", "una POST sola, verso la route che registra", JSON.stringify(r.richieste));
      ok(campi(post[0]?.corpo ?? "") === "email,privacy,ritorno", "con i soli campi che usiamo: email, privacy e il percorso per tornare", post[0]?.corpo);
      ok(new URLSearchParams(post[0]?.corpo ?? "").get("ritorno") === "/istituzioni/ente-prova", "…e il percorso è quello della pagina");
      ok(!r.richieste.some((q) => /supabase|\/rest\//.test(q.percorso)), "nessuna scrittura dal browser");
      ok(r.finale === "/guida.pdf", "il file arriva dopo la risposta della route", r.finale);
    }

    console.log("\n§2 — senza un'email valida, o senza la privacy, non parte niente\n");
    for (const [nome, gesto] of [
      ["email non valida", async (p) => { await p.fill("#guida-email", "nonunindirizzo"); await p.check("#guida-privacy"); await p.click("button[type=submit]"); }],
      ["privacy non accettata", async (p) => { await p.fill("#guida-email", "studente@esempio.it"); await p.click("button[type=submit]"); }],
    ]) {
      const r = await giro(browser, codice, { quale: "ente", emailAccount: null }, gesto);
      ok(r.richieste.length === 0 && r.finale === "/istituzioni/ente-prova", `${nome}: nessuna richiesta, si resta sulla pagina`, JSON.stringify(r.richieste));
    }

    console.log("\n§3 — chi ha fatto l'accesso: un bottone, nessun campo\n");
    {
      const r = await giro(browser, codice, { quale: "ente", emailAccount: "test11@esempio.it" }, async (p) => {
        ok((await p.locator("input[name=email]").count()) === 0, "nessun campo email per chi ha fatto l'accesso");
        ok((await p.locator("#radice").innerText()).includes("test11@esempio.it"), "…e la pagina dice dove arriva il link");
        await p.click("button[type=submit]");
      });
      const post = r.richieste.filter((q) => q.metodo === "POST");
      ok(post.length === 1 && campi(post[0].corpo) === "manda_link,ritorno", "una POST con il percorso per tornare e la richiesta del link promesso", post[0]?.corpo);
      ok(r.finale === "/guida.pdf", "e il file dopo la route");
    }

    console.log("\n§4 — la Panoramica di un'area, con e senza accesso\n");
    {
      const senza = await giro(browser, codice, { quale: "area", emailAccount: null }, async (p) => {
        await p.fill("#guida-email", "studente@esempio.it");
        await p.check("#guida-privacy");
        await p.click("button[type=submit]");
      });
      const post = senza.richieste.filter((q) => q.metodo === "POST");
      ok(post.length === 1 && post[0].percorso === "/api/scarica-guida/area/informatica-digitale", "senza accesso: una POST verso la route dell'area", JSON.stringify(senza.richieste));
      ok(campi(post[0]?.corpo ?? "") === "email,privacy,ritorno", "…con email, privacy e ritorno (via nome, cognome e classe)", post[0]?.corpo);

      const con = await giro(browser, codice, { quale: "area", emailAccount: "test11@esempio.it" }, async (p) => {
        // La sessione la legge il browser dopo il primo disegno: si aspetta che
        // il campo email sparisca prima di premere.
        await p.waitForFunction(() => !document.querySelector("input[name=email]"));
        await p.click("button[type=submit]");
      });
      const postCon = con.richieste.filter((q) => q.metodo === "POST");
      ok(postCon.length === 1 && campi(postCon[0].corpo) === "manda_link,ritorno", "con accesso: un bottone, la POST con ritorno e richiesta del link", postCon[0]?.corpo);
      ok(!con.richieste.some((q) => /\/rest\//.test(q.percorso)), "…e nessuna scrittura in activity_log dal browser");
    }
  } finally {
    await browser.close();
  }

  console.log("");
  if (falliti > 0) {
    console.error(`✗ ${falliti} su ${fatte} proprietà fallite (npm run test:scaricaguida)`);
    process.exit(1);
  }
  console.log(`✅ ${fatte}/${fatte} proprietà (npm run test:scaricaguida)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
