// `npm run banco azzera-percorsi` — riporta il robot a prima della passata.
//
// PERCHÉ ESISTE. Alla fine della prima passata completa tutti e venticinque i
// ruoli erano `completato`, e il robot rifiuta di rigiocare un ruolo che ha
// già finito — regola giusta, che per uno studente vero deve restare. Ma senza
// una strada per tornare a zero **il banco è monouso**: la seconda passata
// sarebbe venticinque righe di «niente da rigiocare», e la prima cosa che si
// vuole fare dopo aver toccato un prompt è rifare la misura e confrontare i
// due numeri. Un banco che misura una volta sola non è un banco, è una
// fotografia.
//
// COSA CANCELLA, per i soli profili marcati `di_prova`:
//
//   · le ISCRIZIONI ai workshop — e con loro, per cascata, elaborati, stato
//     delle tappe, chat col cliente e consegne caricate [verificato leggendo
//     20260807130000 e 20260808100000, non dedotto];
//   · i TENTATIVI DEI TEST — e per cascata le risposte e le prove;
//   · i TENTATIVI DELLE MISSIONI — idem, più diario e portfolio, che restano
//     (attempt_id va a null, non in cascata) e vanno via a mano;
//   · il PROFILO che ne deriva: `area_signal` e `style_signal`.
//
// LE DUE TABELLE DEL PROFILO NON SONO UN DI PIÙ: sono il motivo per cui la
// passata dello studente era monouso in un modo peggiore del solito. Le
// candidate di T3 si leggono da `area_signal`; lasciandole, la seconda passata
// non ripartirebbe da zero ma dal profilo della prima — e non se ne
// accorgerebbe nessuno, perché il risultato sarebbe comunque plausibile.
// Cancellare le prove e lasciare l'aggregato è il caso peggiore dei due: il
// profilo resterebbe a dire una cosa che sotto non ha più niente.
//
// COSA NON TOCCA, di proposito: `activity_log`. Quelle righe appartengono allo
// studente, non a un tentativo, e sul confronto fra due passate non pesano —
// il cron le scrive con un cap giornaliero e un `on conflict do nothing`.
// Allargare la cancellazione a tabelle che non servono alla ripetibilità
// significa solo aumentare quello che un comando distruttivo può sbagliare.
//
// LA GUARDIA È LA STESSA DEL ROBOT: parte solo su profili `di_prova`. Qui però
// conta il doppio, perché questo comando CANCELLA: il robot che scrive su un
// account vero sporca una misura, questo porterebbe via il lavoro di una
// persona.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const readline = require("readline");
const { config } = require("./config");

async function chiedi(c, percorso, opzioni = {}) {
  const risposta = await fetch(`${c.supabaseUrl}/rest/v1/${percorso}`, {
    method: opzioni.method ?? "GET",
    headers: {
      apikey: c.supabaseServiceRoleKey,
      Authorization: `Bearer ${c.supabaseServiceRoleKey}`,
      ...(opzioni.method === "DELETE" ? { Prefer: "return=representation" } : {}),
    },
  });
  if (!risposta.ok) {
    console.error(`\n✗ Supabase ha risposto ${risposta.status}: ${(await risposta.text()).slice(0, 300)}\n`);
    process.exit(1);
  }
  return risposta.json();
}

function conferma(domanda) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(domanda, (a) => { rl.close(); r(a.trim().toLowerCase()); }));
}

const uno = (v) => (Array.isArray(v) ? v[0] : v);

async function azzeraPercorsi() {
  const c = config(["supabaseUrl", "supabaseServiceRoleKey"]);

  const profili = await chiedi(c, "profiles?select=id,nome,cognome&di_prova=is.true");
  if (profili.length === 0) {
    console.log("\nNessun profilo marcato «di_prova»: non c'è niente da azzerare, e non c'è niente che questo comando possa toccare.\n");
    return;
  }

  const ids = profili.map((p) => p.id);
  const dentro = `student_id=in.(${ids.join(",")})`;

  const [iscrizioni, tentativiTest, missioni, segnaliArea, segnaliStile] = await Promise.all([
    chiedi(c, `workshop_iscrizioni?select=id,stato,created_at,student_id,workshop(slug),workshop_ruoli(slug)&${dentro}`),
    chiedi(c, `test_attempt?select=id,student_id,test_slug,stato&${dentro}`),
    chiedi(c, `mission_attempt?select=id,student_id,mission_slug,stato&${dentro}`),
    chiedi(c, `area_signal?select=student_id,area_slug&${dentro}`),
    chiedi(c, `style_signal?select=student_id,asse&${dentro}`),
  ]);

  const totale = iscrizioni.length + tentativiTest.length + missioni.length + segnaliArea.length + segnaliStile.length;
  if (totale === 0) {
    console.log("\nI profili di prova non hanno né iscrizioni, né test, né missioni, né profilo: già a zero.\n");
    return;
  }

  console.log("\n═══════════ COSA STO PER CANCELLARE ═══════════\n");
  for (const p of profili) {
    const sue = iscrizioni.filter((i) => i.student_id === p.id);
    const suoiTest = tentativiTest.filter((t) => t.student_id === p.id);
    const sueMissioni = missioni.filter((m) => m.student_id === p.id);
    const nome = `${p.nome ?? "?"} ${p.cognome ?? ""}`.trim();
    console.log(
      `  ${nome} — ${sue.length} iscrizioni, ${suoiTest.length} test, ${sueMissioni.length} missioni, ` +
        `${segnaliArea.filter((s) => s.student_id === p.id).length} aree + ${segnaliStile.filter((s) => s.student_id === p.id).length} assi nel profilo`,
    );
    for (const i of sue) {
      console.log(`    · ${uno(i.workshop)?.slug ?? "?"} > ${uno(i.workshop_ruoli)?.slug ?? "?"}   [${i.stato}]   dal ${String(i.created_at).slice(0, 10)}`);
    }
    for (const t of suoiTest) console.log(`    · test ${t.test_slug}   [${t.stato}]`);
    for (const m of sueMissioni) console.log(`    · missione ${m.mission_slug}   [${m.stato}]`);
  }
  console.log("");
  console.log(`  ${iscrizioni.length} iscrizioni, e con loro — per cascata — elaborati, stato delle`);
  console.log("  tappe, chat col cliente e consegne caricate.");
  console.log(`  ${tentativiTest.length} tentativi di test e ${missioni.length} missioni, con risposte e prove.`);
  console.log(`  ${segnaliArea.length + segnaliStile.length} righe di profilo (area_signal, style_signal): senza, la passata`);
  console.log("  dopo ripartirebbe dalle aree di questa, e T3 farebbe domande già decise.");
  console.log("  Non torna indietro.");
  console.log("");
  console.log("  Restano fuori: activity_log (righe dello studente, non di un tentativo)");
  console.log("  e il profilo stesso, che serve alla passata dopo.");
  console.log("");

  // LA CONFERMA NON SI SALTA, e non c'è un flag per farlo — vedi il commento
  // gemello in robot/index.js. Questo è l'unico comando del banco che
  // cancella: fra i due l'asimmetria giusta è chiedere sempre.
  const risposta = await conferma("Cancello? (scrivi «cancella») ");
  if (risposta !== "cancella") {
    console.log("Annullato: niente è stato toccato.\n");
    return;
  }

  // L'ORDINE CONTA: prima i tentativi (le loro prove se ne vanno in cascata),
  // poi diario e portfolio che la cascata lascia indietro con attempt_id a
  // null, poi l'aggregato. All'incontrario resterebbe un profilo ricalcolabile
  // da prove che non ci sono più.
  const conteggi = {};
  const cancella = async (etichetta, percorso) => {
    const righe = await chiedi(c, percorso, { method: "DELETE" });
    conteggi[etichetta] = righe.length;
  };

  if (iscrizioni.length) await cancella("iscrizioni", `workshop_iscrizioni?id=in.(${iscrizioni.map((i) => i.id).join(",")})&select=id`);
  if (tentativiTest.length) await cancella("test", `test_attempt?id=in.(${tentativiTest.map((t) => t.id).join(",")})&select=id`);
  if (missioni.length) await cancella("missioni", `mission_attempt?id=in.(${missioni.map((m) => m.id).join(",")})&select=id`);
  await cancella("diario", `journal_entry?${dentro}&select=id`);
  await cancella("portfolio", `portfolio_item?${dentro}&select=id`);
  // Le prove orfane: oggi nessuna fonte ne scrive senza un tentativo, ma una
  // riga rimasta indietro falserebbe il ricalcolo del profilo senza dirlo.
  await cancella("prove", `evidence?${dentro}&select=id`);
  await cancella("aree", `area_signal?${dentro}&select=area_slug`);
  await cancella("assi", `style_signal?${dentro}&select=asse`);

  // Si RILEGGE, non ci si fida della risposta: è la lezione del trigger di
  // `di_prova`, che riportava successo mentre il valore restava com'era.
  const [ri, rt, rm, ra, rs, re] = await Promise.all([
    chiedi(c, `workshop_iscrizioni?select=id&${dentro}`),
    chiedi(c, `test_attempt?select=id&${dentro}`),
    chiedi(c, `mission_attempt?select=id&${dentro}`),
    chiedi(c, `area_signal?select=area_slug&${dentro}`),
    chiedi(c, `style_signal?select=asse&${dentro}`),
    chiedi(c, `evidence?select=id&${dentro}`),
  ]);

  console.log("");
  for (const [etichetta, n] of Object.entries(conteggi)) console.log(`  ✓ ${etichetta}: ${n} cancellate`);
  const rimaste = ri.length + rt.length + rm.length + ra.length + rs.length + re.length;
  if (rimaste > 0) {
    console.error(
      `\n  ⚠  Ne restano ${rimaste} (iscrizioni ${ri.length}, test ${rt.length}, missioni ${rm.length}, ` +
        `aree ${ra.length}, assi ${rs.length}, prove ${re.length}): la cancellazione non è andata fino in fondo.`,
    );
    console.error("     Guarda prima di rilanciare la passata: una passata su un mezzo azzeramento\n     non è confrontabile con niente.\n");
    process.exit(1);
  }
  console.log("\n✓ Niente rimasto: il robot riparte dal percorso intero, e le due passate si possono confrontare.\n");
}

module.exports = { azzeraPercorsi };
