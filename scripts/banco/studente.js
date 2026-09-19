// `npm run banco studente` — la passata dall'inizio alla fine.
//
// Il robot fa i tre test attitudinali e poi la missione che quei test gli
// suggeriscono. È il pezzo che mancava: fino a oggi il banco sapeva giocare i
// workshop, cioè l'ULTIMO gradino del percorso, e non aveva mai attraversato i
// primi. Da qui in poi copre tutto quello che fa uno studente.
//
// SERVE AI CANCELLI, e serve da solo. Ai cancelli perché senza questo un robot
// che arriva a un workshop verrebbe fermato al primo gate («prima i test») e
// il blocco non direbbe niente sul prodotto, solo sul robot. Da solo perché la
// passata intera non l'avevamo mai fatta, e le cose che si rompono in mezzo a
// un percorso non si vedono guardando i pezzi separati.
//
// QUANTO COSTA: i tre test ZERO (scoring deterministico, nessuna AI), la
// missione TRE chiamate — e solo sui passi aperti. Due o tre centesimi. Il
// costo di questo comando è il tempo di chi legge il rapporto, non i soldi.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");
const { abilitaTypeScript, ROOT } = require("./ts");

abilitaTypeScript();

const testConfig = require("@/lib/test/config");
const testAssembla = require("@/lib/test/assembla-t3");
const escapeConfig = require("@/lib/escape/config");

const { apriSessione } = require("./robot/sessione");
const giocaT = require("./robot/giocaTest");
const giocaM = require("./robot/giocaMissione");
const { MISSIONE_FISSATA, GETTONI } = require("./robot/risposte-percorso");
const { allineamento } = require("./allineamento");
const { statoProduzione } = require("./vercel");
const { leggiGuasti, perSpecie } = require("./guasti");

giocaT.collega({ config: testConfig, assembla: testAssembla });
giocaM.collega({ escape: escapeConfig, config: testConfig });

function commitCorrente() {
  try {
    return {
      sha: execSync("git rev-parse HEAD", { encoding: "utf8", cwd: ROOT }).trim(),
      titolo: execSync("git log -1 --pretty=%s", { encoding: "utf8", cwd: ROOT }).trim(),
      sporco: execSync("git status --porcelain", { encoding: "utf8", cwd: ROOT }).trim().length > 0,
    };
  } catch {
    return null;
  }
}

function chiediConferma(domanda) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(domanda, (a) => { rl.close(); r(a.trim().toLowerCase()); }));
}

async function studente() {
  // LA GUARDIA DI ALLINEAMENTO, come per `robot` e per la stessa ragione: il
  // robot gioca contro il SITO, ma il rapporto porta il commit di questa
  // cartella. Se i due non coincidono, la passata attribuisce i suoi numeri a
  // un codice che non ha mai eseguito.
  const locale = commitCorrente();
  const { deploys, perche } = await statoProduzione();
  const stato = { ...allineamento({ locale, deploys, perche }), locale };

  console.log(`\n═══════════ LA PASSATA DELLO STUDENTE ═══════════\n`);
  console.log(`  I tre test attitudinali, poi la missione che ne esce.`);
  console.log(`  ~3 chiamate AI a pagamento (i test non ne fanno nessuna).`);
  console.log(`  Missione fissata nel banco: ${MISSIONE_FISSATA}`);
  console.log(`  — il banco la confronta con quella che il prodotto suggerisce,`);
  console.log(`    e se divergono lo dice invece di seguire il suggerimento.\n`);

  for (const riga of stato.righe) console.log("  " + riga);
  console.log("");
  if (stato.esito === "in-volo" || stato.esito === "disallineato") {
    console.log("  Non parto: sarebbe una passata che misura un codice e ne nomina un altro.\n");
    return;
  }

  // Scrive eccome: tentativi, risposte, prove nel profilo. La conferma non si
  // salta e non c'è un flag per farlo, come per `robot` e `azzera-percorsi`.
  const risposta = await chiediConferma("Procedo? (scrivi «si») ");
  if (risposta !== "si" && risposta !== "sì") {
    console.log("Annullato: nessuna scrittura fatta.\n");
    return;
  }

  const sessione = await apriSessione();
  console.log(`\n✓ sessione aperta come ${sessione.profilo.nome ?? sessione.utente.email} (profilo di prova)\n`);
  const inizioPassata = new Date(Date.now() - 1000).toISOString();

  // ── i tre test ───────────────────────────────────────────────────────────
  const { esiti: esitiTest, profilo } = await giocaT.giocaTest({ sessione, registra: (t) => console.log(t) });
  const fermatoTest = esitiTest.find((e) => e.fermato);
  if (fermatoTest) {
    console.log(`\n  ✗ fermato su ${fermatoTest.slug} a «${fermatoTest.fermato.dove}»: ${fermatoTest.fermato.perche}\n`);
    return;
  }

  console.log("\n── il profilo che ne esce");
  for (const a of profilo.aree.slice(0, 6)) console.log(`   ${a.area.padEnd(34)} ${String(a.punteggio).padStart(3)}  ${a.status}`);
  console.log("   —");
  for (const s of profilo.assi) console.log(`   ${s.asse.padEnd(34)} ${String(s.punteggio).padStart(3)}`);

  // ── il confronto sulla missione ──────────────────────────────────────────
  const confronto = giocaM.confrontaMissione(profilo.aree[0]?.area);
  console.log("\n── la missione");
  console.log(`   area vincente: ${confronto.areaVincente ?? "nessuna"}`);
  console.log(`   il prodotto suggerisce: ${confronto.suggerita ?? "nessuna"}`);
  console.log(`   il banco gioca:         ${confronto.fissata}`);
  if (!confronto.coincidono) {
    // NON si interrompe: è un'informazione sul prodotto, non un guasto del
    // robot. Ma si dice forte, perché i testi aperti sono risposte a domande
    // precise e su un'altra missione sarebbero parole a caso.
    console.log(`   ⚠  NON COINCIDONO. Il banco gioca comunque quella fissata, perché è`);
    console.log(`      quella per cui i testi aperti sono scritti — ma vuol dire che il`);
    console.log(`      registro delle missioni o il profilo del robot è cambiato, e i tre`);
    console.log(`      testi vanno riletti prima di fidarsi di questa passata.`);
  } else {
    console.log(`   ✓ coincidono`);
  }

  // ── la missione ──────────────────────────────────────────────────────────
  console.log(`\n── ${confronto.fissata}`);
  const esitoMissione = await giocaM.giocaMissione({ sessione, registra: (t) => console.log(t) });
  if (esitoMissione.fermato) {
    console.log(`  ✗ fermato a «${esitoMissione.fermato.dove}»: ${esitoMissione.fermato.perche}`);
  } else {
    console.log(`  stato: ${esitoMissione.stato ?? "?"} · revisore: ${esitoMissione.revisoreEsito ?? "nessun esito scritto"}`);
    const conArea = (esitoMissione.prove ?? []).filter((p) => p.area_slug);
    console.log(`  prove scritte: ${esitoMissione.prove?.length ?? 0} (${conArea.length} con un'area)`);
  }

  // Il profilo DOPO la missione: è il punto dell'intera passata — far vedere
  // che i due ritratti (test e missione) finiscono davvero nello stesso posto.
  const dopo = await giocaT.leggiProfilo(sessione);
  console.log("\n── il profilo dopo la missione");
  for (const a of dopo.aree.slice(0, 6)) console.log(`   ${a.area.padEnd(34)} ${String(a.punteggio).padStart(3)}  ${a.status}`);

  // ── i guasti della finestra ──────────────────────────────────────────────
  const visti = await leggiGuasti({ daIso: inizioPassata });
  console.log("\n── guasti registrati durante la passata");
  if (!visti.visto) {
    console.log(`   ⚠  NON HO GUARDATO: ${visti.perche}`);
    console.log("      Non vuol dire zero: vuol dire che non sono riuscito a leggere.");
  } else if (visti.righe.length === 0) {
    console.log("   ✓ zero. Ho guardato, e il motore non ha registrato niente.");
  } else {
    for (const g of perSpecie(visti.righe)) console.log(`   · ${g.specie}: ${g.produzione + g.prova}`);
    console.log("      Per esteso:  npm run banco guasti");
  }

  const percorso = path.join(ROOT, `banco-studente-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`);
  fs.writeFileSync(
    percorso,
    JSON.stringify(
      {
        commit: stato.locale,
        quando: new Date().toISOString(),
        gettoni: GETTONI,
        test: esitiTest,
        profiloDopoITest: profilo,
        confrontoMissione: confronto,
        missione: esitoMissione,
        profiloFinale: dopo,
        guasti: visti.visto ? { visto: true, righe: visti.righe } : { visto: false, perche: visti.perche },
      },
      null,
      2,
    ),
  );
  console.log(`\nRapporto completo: ${path.basename(percorso)}`);
  console.log("(ignorato da git — è materiale da leggere, non da versionare)\n");
}

module.exports = { studente };
