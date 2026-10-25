#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:uscita` — tre proprietà del 25/10/2026 che vivono in file
// diversi e nascono dalla stessa diretta.
//   §1 nessun «Esci» revoca le sessioni degli altri dispositivi (scope local)
//   §2 la promessa sulla visibilità delle domande si deriva dal pubblico
//   §3 la barra di /app non precarica le sue voci
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
abilitaTypeScript();
const P = require("@/lib/live/presenza");
const { USCITA_SOLO_QUI } = require("@/lib/supabase/uscita");

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
function sorgenti(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sorgenti(rel));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}

console.log("\n§1 — «Esci» chiude solo qui\n");
ok(USCITA_SOLO_QUI === "local", "la costante vale «local»", String(USCITA_SOLO_QUI));
const chiamate = [];
for (const rel of [...sorgenti("app"), ...sorgenti("components"), ...sorgenti("lib")]) {
  const src = leggi(rel);
  for (const m of src.matchAll(/auth\.signOut\(([^)]*)\)/g)) chiamate.push({ rel, arg: m[1].trim() });
}
// Soglia dichiarata: sotto sette, l'estrattore non sta leggendo (modo 2).
ok(chiamate.length >= 7, "l'estrattore vede i sette «Esci»", `${chiamate.length}`);
const scoperte = chiamate.filter((c) => c.arg !== "{ scope: USCITA_SOLO_QUI }");
ok(scoperte.length === 0, "ogni `signOut` passa `{ scope: USCITA_SOLO_QUI }` (il default è global)", scoperte.map((c) => `${c.rel}(${c.arg || "vuoto"})`).join(", "));

console.log("\n§2 — chi vede le domande si deriva dal pubblico\n");
ok(
  P.VISIBILITA_DOMANDE.studenti === "Le tue domande non sono pubbliche: le vedi tu, le riceve chi ha organizzato la diretta, e le legge KIREO.",
  "studenti: il testo di Mario, parola per parola",
);
ok(
  P.VISIBILITA_DOMANDE.docenti === "Le tue domande non sono pubbliche, ma non sono anonime: chi ha organizzato la diretta vede il tuo nome. Le legge anche KIREO.",
  "docenti: il testo di Mario, parola per parola",
);
ok(/^[^:]*non sono anonime:.*nome/.test(P.VISIBILITA_DOMANDE.docenti), "…con «non sono anonime» davanti, prima di chi vede cosa");
ok(Object.values(P.VISIBILITA_DOMANDE).every((t) => t.includes("KIREO") && !/solo tu/i.test(t)), "tutti e due nominano KIREO, nessuno dice «solo tu»");
const box = leggi("components/live/BoxDomandeLive.tsx");
ok(box.includes("{VISIBILITA_DOMANDE[pubblico]}") && !box.includes("Solo tu vedi"), "il box rende il testo del suo pubblico, non una costante");
const pannello = leggi("components/live/PannelloLive.tsx");
ok(/<BoxDomandeLive[\s\S]*?pubblico=\{pubblico\}/.test(pannello), "il pannello passa il pubblico al box");
for (const rel of ["app/app/eventi/[id]/live/page.tsx", "app/docente/webinar/[id]/live/page.tsx"]) {
  const pg = leggi(rel);
  ok(pg.includes("pubblico={evento.pubblico}"), `${rel}: il pubblico viene dall'evento letto, non scritto a mano dalla pagina`);
}

console.log("\n§3 — la barra non precarica\n");
const shell = leggi("components/app/AppShell.tsx");
const link = [...shell.matchAll(/<Link\s+key=\{item\.href\}[\s\S]*?>|<Link\s+href=\{item\.href\}[\s\S]*?>/g)].map((m) => m[0]);
ok(link.length === 2, "le due barre (desktop e telefono)", `${link.length}`);
ok(link.every((l) => l.includes("prefetch={false}")), "nessuna delle due precarica le voci");
const proxy = leggi("lib/supabase/proxy.ts");
ok(!/next-router-prefetch|purpose|prefetch/i.test(proxy), "il middleware non ha una strada che salta la guardia sui precaricamenti");

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
process.exit(falliti === 0 ? 0 : 1);
