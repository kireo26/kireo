#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `node scripts/misura-intestazione.js [porta]` — l'intestazione pubblica,
// misurata sulla costruzione di produzione (28/10/2026).
//
// Serve il giorno in cui cambiano le voci del menu, o il bottone di destra: la
// soglia fra il menu del telefono e quello del computer (`--breakpoint-menu` in
// app/globals.css) è una MISURA, e una voce in più la sposta. Non si stima
// leggendo il CSS: la larghezza la decidono i caratteri veri.
//
// Come si lancia (fuori dalla produzione, niente si collega a Supabase):
//   NEXT_PUBLIC_SUPABASE_URL=http://supabase.test NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=finta npx next build
//   npx next start -p 4800      (in un altro terminale)
//   node scripts/misura-intestazione.js 4800
// La sessione «collegata» è un cookie finto: il client Supabase la legge dal
// cookie senza chiamate di rete. ⚠️ Dopo, si ricostruisce con le variabili vere
// prima di qualunque altra cosa: questa costruzione punta a un indirizzo che
// non esiste.
//
// Come si legge: per ogni larghezza, quale menu si vede, quanto scorre la
// pagina di lato (deve essere 0), e col menu del computer i due margini (dal
// logo a «Home», da «Contatti» al blocco di destra) e quante voci vanno su due
// righe (deve essere 0). Al 28/10: menu del telefono fino a 1151px, del
// computer da 1152; margini 54px da non collegati, 36 da collegati.
const { chromium } = require("playwright");
const PORTA = process.argv[2] || "4800";
const sessione = { access_token: "x.eyJleHAiOjQxMDI0NDQ4MDB9.x", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, refresh_token: "r",
  user: { id: "u1", aud: "authenticated", role: "authenticated", email: "mario@x.it", user_metadata: { nome: "Mario", cognome: "Izzo" }, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" } };
(async () => {
  const b = await chromium.launch();
  for (const collegato of [true, false]) for (const w of [390, 768, 1024, 1151, 1152, 1280, 1440]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } });
    if (collegato) await ctx.addCookies([{ name: "sb-supabase-auth-token", value: "base64-" + Buffer.from(JSON.stringify(sessione)).toString("base64url"), url: `http://localhost:${PORTA}` }]);
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PORTA}/contatti`, { waitUntil: "networkidle" });
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const vis = (el) => el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
      const nav = document.querySelector('header nav[aria-label="Navigazione principale"]');
      const hamb = document.querySelector('header button[aria-controls="mobile-nav"]');
      let tocca = null;
      if (vis(nav)) {
        const rg = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
        const logo = rg(document.querySelector("header > div > a"));
        const voci = [...nav.querySelectorAll(":scope > a, :scope > div > button")];
        const destra = [...document.querySelectorAll("header > div > div")].find(vis);
        const d = destra.querySelector("a, button").getBoundingClientRect();
        tocca = { logoHome: Math.round(rg(voci[0]).left - logo.right), contattiDestra: Math.round(d.left - rg(voci[voci.length - 1]).right), dueRighe: voci.filter((v) => v.getBoundingClientRect().height > 30).length };
      }
      return { menu: vis(nav) ? "computer" : vis(hamb) ? "telefono" : "nessuno", scorre: document.documentElement.scrollWidth - innerWidth, tocca };
    });
    console.log(`${collegato ? "collegato    " : "non collegato"} ${String(w).padStart(4)}px  menu ${r.menu.padEnd(8)} scorre ${r.scorre}px` + (r.tocca ? `  logo→Home ${r.tocca.logoHome}px · Contatti→destra ${r.tocca.contattiDestra}px · voci su due righe ${r.tocca.dueRighe}` : ""));
    await ctx.close();
  }
  await b.close();
})();
