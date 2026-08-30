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
// COSA CANCELLA: le iscrizioni ai workshop dei profili marcati `di_prova`. Le
// foreign key fanno il resto — elaborati, stato delle tappe, chat col cliente,
// consegne caricate hanno tutte `on delete cascade` sull'iscrizione [verificato
// leggendo 20260807130000 e 20260808100000, non dedotto].
//
// COSA NON TOCCA, di proposito: `activity_log`. Quelle righe appartengono allo
// studente, non all'iscrizione, e sul confronto fra due passate non pesano —
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

async function azzeraPercorsi(opzioni = {}) {
  const c = config(["supabaseUrl", "supabaseServiceRoleKey"]);

  const profili = await chiedi(c, "profiles?select=id,nome,cognome&di_prova=is.true");
  if (profili.length === 0) {
    console.log("\nNessun profilo marcato «di_prova»: non c'è niente da azzerare, e non c'è niente che questo comando possa toccare.\n");
    return;
  }

  const ids = profili.map((p) => p.id);
  const iscrizioni = await chiedi(
    c,
    `workshop_iscrizioni?select=id,stato,created_at,student_id,workshop(slug),workshop_ruoli(slug)&student_id=in.(${ids.join(",")})`,
  );

  if (iscrizioni.length === 0) {
    console.log("\nI profili di prova non hanno nessuna iscrizione ai workshop: già a zero.\n");
    return;
  }

  console.log("\n═══════════ COSA STO PER CANCELLARE ═══════════\n");
  for (const p of profili) {
    const sue = iscrizioni.filter((i) => i.student_id === p.id);
    console.log(`  ${`${p.nome ?? "?"} ${p.cognome ?? ""}`.trim()} — ${sue.length} iscrizioni`);
    for (const i of sue) {
      console.log(`    · ${uno(i.workshop)?.slug ?? "?"} > ${uno(i.workshop_ruoli)?.slug ?? "?"}   [${i.stato}]   dal ${String(i.created_at).slice(0, 10)}`);
    }
  }
  console.log("");
  console.log(`  ${iscrizioni.length} iscrizioni, e con loro — per cascata — elaborati, stato delle`);
  console.log("  tappe, chat col cliente e consegne caricate. Non torna indietro.");
  console.log("");
  console.log("  Restano fuori: activity_log (righe dello studente, non dell'iscrizione)");
  console.log("  e il profilo stesso, che serve alla passata dopo.");
  console.log("");

  if (!opzioni.vai) {
    const risposta = await conferma("Cancello? (scrivi «cancella») ");
    if (risposta !== "cancella") {
      console.log("Annullato: niente è stato toccato.\n");
      return;
    }
  }

  const cancellate = await chiedi(c, `workshop_iscrizioni?id=in.(${iscrizioni.map((i) => i.id).join(",")})&select=id`, { method: "DELETE" });

  // Si RILEGGE, non ci si fida della risposta: è la lezione del trigger di
  // `di_prova`, che riportava successo mentre il valore restava com'era.
  const rimaste = await chiedi(c, `workshop_iscrizioni?select=id&student_id=in.(${ids.join(",")})`);
  console.log(`\n✓ ${cancellate.length} iscrizioni cancellate, ${rimaste.length} rimaste.`);
  if (rimaste.length > 0) {
    console.error("  ⚠  Ne restano: la cancellazione non è andata fino in fondo, guarda prima di rilanciare la passata.\n");
    process.exit(1);
  }
  console.log("  Il robot riparte da zero, e le due passate si possono confrontare.\n");
}

module.exports = { azzeraPercorsi };
