#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// `npm run test:rifiuto` — lo studente rifiutato riceve il motivo (01/11,
// passo 3 della scuola; la metà del database la prova
// scripts/verifica-rifiuto-verifica.sql).
//   §1 i motivi del codice sono quelli del database, e nessun altro
//   §2 i testi: attesi scritti a mano, invarianti nel genere
//   §3 chi rifiuta sceglie un motivo da un elenco, mai un testo libero
//   §4 lo studente legge il motivo nel profilo, e la notifica porta lì
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora } = require("./lib/ancora");

abilitaTypeScript();
const R = require("@/lib/scuola/rifiutoVerifica");
const { linkNotifica, ETICHETTA_TIPO } = require("@/lib/notifiche/etichette");
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

console.log("\n§1 — i motivi sono quelli del database\n");
{
  const dir = path.join(ROOT, "supabase", "migrations");
  let valori = null;
  for (const f of fs.readdirSync(dir).sort()) {
    const m = fs.readFileSync(path.join(dir, f), "utf8").match(/create type public\.motivo_rifiuto_verifica as enum\s*\(([^)]*)\)/i);
    if (m) valori = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  ok(valori !== null && valori.length >= 2, `il tipo nel database ha ${valori ? valori.length : 0} motivi (pavimento 2)`);
  ok(
    valori !== null && JSON.stringify([...valori].sort()) === JSON.stringify([...R.MOTIVI_RIFIUTO].sort()),
    "MOTIVI_RIFIUTO è lo stesso elenco del tipo motivo_rifiuto_verifica",
    `codice ${JSON.stringify(R.MOTIVI_RIFIUTO)}, database ${JSON.stringify(valori)}`,
  );
  ok(R.MOTIVI_RIFIUTO.every((m) => typeof R.TESTO_MOTIVO[m] === "string" && R.TESTO_MOTIVO[m].length > 0), "ogni motivo ha il suo testo");
  ok(R.eMotivoRifiuto("scuola_sbagliata") && !R.eMotivoRifiuto("altro") && !R.eMotivoRifiuto(null), "eMotivoRifiuto riconosce solo i motivi dell'elenco");
}

console.log("\n§2 — i testi\n");
{
  // Le frasi dei due motivi sono di Mario: attesi scritti a mano.
  ok(R.TESTO_MOTIVO.non_risulta_studente === "Non risulta fra i nostri studenti", "il primo motivo con le parole di Mario");
  ok(R.TESTO_MOTIVO.scuola_sbagliata === "Hai scelto la scuola sbagliata", "il secondo motivo con le parole di Mario");
  ok(
    R.rigaRifiuto("Liceo Galilei", "1 novembre 2026", "scuola_sbagliata") ===
      "Il 1 novembre 2026 «Liceo Galilei» non ha confermato: «Hai scelto la scuola sbagliata».",
    "la riga del profilo: prima il giorno, poi la scuola copiata e il motivo",
  );
  // Anche le righe COMPOSTE, per ogni motivo: la guardia sulle parole vietate
  // al primo giro guardava solo le costanti, e «ha risposto» sta nella riga.
  const tutti = [
    ...Object.values(R.TESTO_MOTIVO),
    ...Object.values(R.TESTI_RIFIUTO),
    ETICHETTA_TIPO.verifica_rifiutata,
    ...R.MOTIVI_RIFIUTO.map((m) => R.rigaRifiuto("Liceo Galilei", "1 novembre 2026", m)),
  ];
  const accordi = tutti.flatMap((t) => trovaAccordi(t));
  ok(accordi.length === 0, `nessun testo accorda col genere di chi legge (${tutti.length} testi)`, accordi.join(", "));
  ok(!/come su[oa] student/i.test(tutti.join(" ")), "nessun «come suo studente»");
  ok(!/ha risposto|avevi indicato/i.test(tutti.join(" ")), "nessuno scambio inventato e nessuna scelta messa al passato", "«ha risposto» suggerisce uno scambio che non c'è stato; «avevi indicato» tratta la scelta come un errore");
}

console.log("\n§3 — chi rifiuta sceglie da un elenco\n");
{
  const rel = "components/scuola/GestioneStudentiDichiarati.tsx";
  const src = leggi(rel);
  ok(/p_motivo:\s*motivo/.test(src), "la chiamata a verifica_studente manda il motivo");
  ok(!/agisciSu\([^)]*"rifiutato"\s*\)/.test(src), "nessun bottone rifiuta senza passare dal motivo", "un rifiuto senza motivo lo respinge il database: qui non deve nemmeno partire");
  ok((src.match(/setRifiutoPer\(/g) || []).length >= 3, "i due bottoni «Rifiuta» aprono la scelta del motivo");
  ok(/MOTIVI_RIFIUTO\.map/.test(src), "la scelta elenca MOTIVI_RIFIUTO");
  ok(!/<textarea|type="text"/.test(src), "nessun campo di testo libero nella schermata della verifica");
  ok(src.includes("TESTI_RIFIUTO.domanda"), "chi rifiuta legge che il motivo arriva allo studente");
}

console.log("\n§4 — lo studente legge il motivo\n");
{
  const pagina = leggi("app/app/profilo/page.tsx");
  ok(/select\("rifiuto_motivo, rifiuto_scuola_nome, rifiuto_il"\)/.test(pagina), "il profilo legge le tre colonne del rifiuto");
  ok(/eMotivoRifiuto\(r\.rifiuto_motivo\)/.test(pagina), "e accetta solo un motivo dell'elenco");
  const form = leggi("components/app/ProfiloForm.tsx");
  const blocco = ancora(form, "{rifiuto && stato !== \"ok\" && (", "il blocco del rifiuto");
  ok(blocco >= 0, "il profilo mostra il rifiuto, e lo nasconde appena la scuola nuova è salvata");
  ok(/rigaRifiuto\(rifiuto\.scuola,/.test(form) && form.includes("TESTI_RIFIUTO.cosaFare"), "con la riga e la cosa da fare");
  ok((form.match(/id="scuola"/g) || []).length === 2, "tutte e due le forme della sezione hanno l'àncora #scuola");
  ok(linkNotifica("verifica_rifiutata", "x") === "/app/profilo#scuola", "la notifica porta alla sezione della scuola");
  const esporta = leggi("lib/app/esportaDati.ts");
  ok(/rifiuto_motivo, rifiuto_scuola_nome, rifiuto_il/.test(esporta), "«Scarica i miei dati» ha il motivo del rifiuto");
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà${falliti ? `, ${falliti} rotte` : ""}`);
process.exit(falliti === 0 ? 0 : 1);
