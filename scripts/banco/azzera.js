// `npm run banco azzera-tentativi <iscrizione> <fase>` — l'UNICO comando del
// banco che scrive.
//
// Sta in un file suo, ha un nome che dice cosa fa, e prima di scrivere mostra
// la riga che sta per cambiare e chiede conferma. Tutto il resto del banco è
// sola lettura, e quella proprietà vale finché resta vera senza doverla
// verificare: se un domani serve un secondo comando che scrive, va qui accanto,
// non dentro `percorso.js`.
//
// A cosa serve: una tappa che ha bruciato tentativi per un guasto poi
// riparato (il tetto dei token alzato, una chiave rimessa) resta più vicina
// alla resa di quanto meriti. Rimettere il contatore a zero le ridà i giri
// interi. NON tocca lo stato della tappa, la revisione, la fiducia: solo il
// contatore e l'esito, che senza il contatore resterebbe a raccontare un
// guasto che non c'è più.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const readline = require("readline");
const { config } = require("./config");

function chiediConferma(domanda) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((risolvi) => rl.question(domanda, (r) => { rl.close(); risolvi(r.trim().toLowerCase()); }));
}

async function azzeraTentativi(iscrizioneId, faseId) {
  if (!iscrizioneId || !faseId) {
    console.error("\nUso: npm run banco azzera-tentativi <id-iscrizione> <id-fase>");
    console.error("Li trovi con: npm run banco percorso\n");
    process.exit(1);
  }
  const c = config(["supabaseUrl", "supabaseServiceRoleKey"]);
  const intestazioni = {
    apikey: c.supabaseServiceRoleKey,
    Authorization: `Bearer ${c.supabaseServiceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
  const filtro = `iscrizione_id=eq.${encodeURIComponent(iscrizioneId)}&fase_id=eq.${encodeURIComponent(faseId)}`;

  const risposta = await fetch(`${c.supabaseUrl}/rest/v1/workshop_fasi_stato?${filtro}&select=*`, { headers: intestazioni });
  const righe = await risposta.json();
  if (!Array.isArray(righe) || righe.length === 0) {
    console.error(`\n✗ Nessuna riga per iscrizione ${iscrizioneId}, fase ${faseId}.\n  Controlla con: npm run banco percorso\n`);
    process.exit(1);
  }

  const r = righe[0];
  console.log("\nSTO PER MODIFICARE QUESTA RIGA:");
  console.log(`  fase        ${r.fase_id}`);
  console.log(`  stato       ${r.stato}   (NON cambia)`);
  console.log(`  tentativi   ${r.tentativi_revisione}  →  0`);
  console.log(`  esito       ${r.revisione_esito ?? "null"}  →  null`);
  console.log("\nLa revisione già salvata, la fiducia e lo stato della tappa restano come sono.");

  const risposta1 = await chiediConferma("\nProcedo? (scrivi «si») ");
  if (risposta1 !== "si" && risposta1 !== "sì") {
    console.log("Annullato, niente è stato scritto.\n");
    return;
  }

  const patch = await fetch(`${c.supabaseUrl}/rest/v1/workshop_fasi_stato?${filtro}`, {
    method: "PATCH",
    headers: intestazioni,
    body: JSON.stringify({ tentativi_revisione: 0, revisione_esito: null }),
  });
  if (!patch.ok) {
    console.error(`\n✗ Scrittura fallita (${patch.status}): ${(await patch.text()).slice(0, 300)}\n`);
    process.exit(1);
  }
  console.log("\n✓ Fatto. La tappa ha di nuovo tutti i tentativi.");
  console.log("  Se il guasto che li aveva bruciati non è stato riparato, li brucerà di nuovo:");
  console.log("  guarda prima npm run banco log.\n");
}

module.exports = { azzeraTentativi };
