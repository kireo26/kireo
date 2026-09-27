// Le risposte del robot ai tre test e alla missione, verificate senza rete.
//
// PERCHÉ ESISTE, e non è «per coprire un file nuovo». Le risposte del robot
// hanno una proprietà che non si vede leggendole: **i tre testi aperti parlano
// di quello che il robot NON ha guardato**. Spende cinque gettoni e ne lascia
// chiusi sette, e i testi li nominano uno per uno. Se un domani qualcuno
// «migliora» il robot facendogli comprare tutto, quei testi restano lì a dire
// «non ho letto il registro degli accessi» mentre il registro è stato letto —
// e nessuno se ne accorge, perché le due cose stanno a cento righe di distanza
// e nessuna delle due è sbagliata da sola.
//
// È una dipendenza vera fra CONTENUTO e COMPORTAMENTO, e l'unico modo di
// tenerla è controllarla in tutti e due i versi: ogni materiale nominato come
// non letto non dev'essere fra i comprati, e ogni non comprato dev'essere
// nominato. Aggiungerne uno ai gettoni fa diventare rosso questo file con il
// nome del materiale e la frase che quel testo continua a dire.
//
// E LA MISSIONE SI RIDERIVA, non si crede. `MISSIONE_FISSATA` è una stringa
// scritta a mano: qui si rifà il percorso intero — T1 → area_signal → le
// candidate di T3 → il torneo → `missionePerArea` — e si pretende che ne esca
// la stessa. Il giorno in cui il registro delle missioni cambia, i tre testi
// diventano risposte a domande diverse: questo controllo lo dice prima che
// qualcuno spenda una passata per scoprirlo.
//
// E LE RISPOSTE SI ATTRAVERSANO COME LE ATTRAVERSA LA ROUTE. Fino al 19/09
// questo file passava allo scoring la mappa delle risposte GIÀ SVOLTA —
// `new Map(Object.entries(T1_RISPOSTE))` — cioè la forma che la route produce
// DOPO aver letto il payload: provava il pezzo dopo quello rotto, e infatti
// era verde mentre in produzione T1 non registrava niente. Ora le risposte
// passano da `evidenzeDaRighe` (lib/test/payload.ts), la stessa lettura della
// route, nella stessa forma in cui il robot le salva: `{item_id, payload}`.
// Una copia riscritta qui sarebbe una copia che diverge.
//
// Nessun DB e nessuna AI: lo scoring dei test è deterministico e la missione
// si costruisce dal config. Gira in mezzo secondo.
//
// Esecuzione: `npm run test:percorso`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript } = require("./banco/ts");
abilitaTypeScript();

const { SLUG_T1, SLUG_T2, missionePerArea } = require("@/lib/test/config");
const { calcolaEvidenzeT3 } = require("@/lib/test/scoring");
const { evidenzeDaRighe } = require("@/lib/test/payload");
const { selezionaCandidate, assemblaT3 } = require("@/lib/test/assembla-t3");
const { getTest } = require("@/lib/test/config");
const { getMissione, stepDellaMissione, valutaPiano } = require("@/lib/escape/config");
const R = require("./banco/robot/risposte-percorso");

let falliti = 0;
const ok = (cond, msg) => {
  if (!cond) {
    console.error("  ✗ " + msg);
    falliti++;
  } else {
    console.log("  ✓ " + msg);
  }
};

console.log("\n═══ Il percorso del robot: tre test e le missioni ═══\n");

// ── 1) T1 e T2: le risposte scritte esistono davvero ─────────────────────────
console.log("1) Le risposte scritte corrispondono a item e opzioni veri");

const t1 = getTest(SLUG_T1);
const t2 = getTest(SLUG_T2);
ok(Boolean(t1 && t2), "i due test esistono nel config");

let t1Sane = true;
for (const [itemId, payload] of Object.entries(R.T1_RISPOSTE)) {
  const item = t1.items.find((i) => i.id === itemId);
  // LA FORMA PRIMA DEL CONTENUTO: un `{opzioneId}`, non l'id nudo. È il
  // difetto del 19/09, e un id valido dentro una forma sbagliata resta
  // invisibile a tutto il resto del file.
  const opzId = payload?.opzioneId;
  if (typeof opzId !== "string") {
    console.error(`      item «${itemId}»: la risposta non è un payload {opzioneId} (${JSON.stringify(payload)})`);
    t1Sane = false;
    continue;
  }
  if (!item || !item.opzioni.some((o) => o.id === opzId)) {
    console.error(`      item «${itemId}» / opzione «${opzId}» non esiste`);
    t1Sane = false;
  }
}
ok(t1Sane, `T1: ${Object.keys(R.T1_RISPOSTE).length} risposte, tutte su item e opzioni esistenti`);
ok(Object.keys(R.T1_RISPOSTE).length === t1.items.length, `T1: risposto a tutti i ${t1.items.length} item (nessuno lasciato indietro)`);

let t2Sane = true;
for (const item of t2.items) {
  const p = R.T2_RISPOSTE[item.id];
  if (!p) {
    console.error(`      item «${item.id}» senza risposta`);
    t2Sane = false;
    continue;
  }
  if (item.tipo === "scelta" && !item.opzioni.some((o) => o.id === p.opzioneId)) {
    console.error(`      T2 «${item.id}»: opzione «${p.opzioneId}» inesistente`);
    t2Sane = false;
  }
  if (item.tipo === "ordina" && item.elementi.length !== (p.ordine ?? []).length) {
    console.error(`      T2 «${item.id}»: l'ordine non copre tutti gli elementi`);
    t2Sane = false;
  }
}
ok(t2Sane, `T2: ${t2.items.length} item, tutti risposti con opzioni esistenti`);

// IL ROBOT NON RISPONDE MAI AGLI ESTREMI: un profilo fatto di minimi e massimi
// non somiglia a nessuno, e rende invisibili gli errori di arrotondamento
// della normalizzazione per-asse.
const likert = t2.items.filter((i) => i.tipo === "likert").map((i) => R.T2_RISPOSTE[i.id]?.valore);
ok(likert.length > 0 && likert.every((v) => v > 1 && v < 5), `le Likert stanno lontane dagli estremi (${likert.join(", ")})`);

// ── 2) La derivazione: la missione si rifà, non si crede ─────────────────────
console.log("\n2) La missione derivata è quella che il prodotto suggerirebbe");

// DALLE RIGHE, come le legge la route: `{item_id, payload}` esattamente nella
// forma in cui il robot le salva su `test_response`.
const righeDa = (risposte) => Object.entries(risposte).map(([item_id, payload]) => ({ item_id, payload }));
const ev1 = evidenzeDaRighe(SLUG_T1, "attempt-di-prova", righeDa(R.T1_RISPOSTE));
ok(ev1.length > 0, `le risposte di T1, lette come le legge la route, producono ${ev1.length} prove (zero = profilo vuoto, e T3 non parte)`);
// `area_signal.interest_score` è round(100 × media pesata). Con la sola fonte
// T1 c'è una prova per area, quindi la media coincide col valore.
const segnali = ev1.map((e) => ({ area_slug: e.area_slug, interest_score: Math.round(100 * e.valore) }));
const candidate = selezionaCandidate(segnali);
const ev2 = evidenzeDaRighe(SLUG_T2, "attempt-di-prova", righeDa(R.T2_RISPOSTE));
ok(ev2.length > 0, `e quelle di T2 ne producono ${ev2.length}`);
const assiOrdinati = [...ev2].sort((a, b) => b.valore - a.valore);
const asseDominante = assiOrdinati[0]?.asse ?? null;
const congelate = { candidate, asseDominante };

ok(candidate.length >= 3, `T3 ha ${candidate.length} aree candidate (sopra il minimo di 3: niente fallback)`);

function classificaCon(attemptId) {
  const items = assemblaT3(congelate, attemptId);
  const risposte = new Map(items.map((it) => [it.id, { opzioneId: R.scegliT3(it) }]));
  return calcolaEvidenzeT3(congelate, attemptId, risposte).classifica;
}

const classifica = classificaCon("att-riferimento");
const vincitrice = classifica[0]?.area_slug;

// COSA DECIDE DAVVERO LA MISSIONE, e va saputo prima di fidarsi del controllo
// qui sotto: non la classifica che esce da T1, ma la REGOLA di T3. Finché
// l'area portante entra fra le cinque candidate, la preferenza del robot le fa
// vincere tutti gli incontri e quindi il torneo — anche partendo quarta.
//
// Misurato, non dedotto: togliendo TRE dei cinque item di T1 che nominano
// `salute` la missione non cambia (l'area scende a 5 punti e a quarta
// candidata, e vince lo stesso); serve toglierli tutti e cinque, cioè farla
// uscire del tutto dalle candidate, perché il controllo diventi rosso.
//
// Non è un difetto — la regola preferisce salute perché è il profilo del
// robot, ed è coerente. Ma è una sensibilità che questo file NON ha: chi legge
// «la missione si riderivà» non deve credere che copra ogni cambiamento di T1.
const primaInPreferenza = R.PREFERENZA_AREE.find((a) => candidate.includes(a));
ok(
  vincitrice === primaInPreferenza,
  `a vincere T3 è la prima della preferenza del robot fra le candidate (${primaInPreferenza}): è la regola a decidere, non la classifica di T1`,
);
const suggerita = vincitrice ? missionePerArea(vincitrice) : null;
ok(
  suggerita?.slug === R.MISSIONE_DERIVATA,
  suggerita?.slug === R.MISSIONE_DERIVATA
    ? `dal profilo esce «${vincitrice}» → «${suggerita.slug}», che è la missione derivata`
    : `dal profilo esce «${vincitrice}» → «${suggerita?.slug ?? "nessuna"}», ma il banco gioca «${R.MISSIONE_DERIVATA}» come derivata: i suoi tre testi aperti sarebbero risposte a domande di un'altra missione`,
);

// LA DERIVATA È UNA SOLA, e le altre NON devono essere suggerite da nessuno: se
// un domani il suggerimento cadesse su una di quelle, il confronto di
// `studente.js` direbbe «coincidono» su una missione che il robot gioca per
// un'altra ragione, e la distinzione fra le due categorie si perderebbe.
const derivate = R.MISSIONI_GIOCATE.filter((m) => m.derivata === true);
ok(derivate.length === 1, `una sola missione è marcata come derivata (${derivate.map((m) => m.slug).join(", ") || "nessuna"})`);
ok(derivate[0]?.slug === R.MISSIONE_DERIVATA, "…ed è quella che `MISSIONE_DERIVATA` nomina");
const deliberate = R.MISSIONI_GIOCATE.filter((m) => m.derivata !== true);
const suggeriteMaDeliberate = deliberate.filter((m) => m.slug === suggerita?.slug);
ok(
  suggeriteMaDeliberate.length === 0,
  suggeriteMaDeliberate.length === 0
    ? `le missioni giocate di proposito (${deliberate.length}) non sono quella suggerita: restano una scelta dichiarata`
    : `«${suggeriteMaDeliberate[0].slug}» è giocata «di proposito» ma è anche quella che il prodotto suggerisce: una delle due etichette è sbagliata`,
);
// Ognuna deve dire per quale RAMO esiste: una missione in più senza una ragione
// scritta è una passata che costa tre chiamate e non si sa cosa compra.
const senzaRamo = R.MISSIONI_GIOCATE.filter((m) => !m.ramo || !m.perche);
ok(senzaRamo.length === 0, senzaRamo.length === 0 ? "ogni missione giocata dice perché e quale ramo copre" : `senza «ramo»/«perche»: ${senzaRamo.map((m) => m.slug).join(", ")}`);

// ── 3) Determinismo e non-degenerazione ──────────────────────────────────────
console.log("\n3) Due passate danno lo stesso profilo, e il profilo non è degenere");

// La sequenza mostrata dipende dal seme (l'attemptId); la CLASSIFICA no,
// perché lo scoring mappa per id. Se un giorno dipendesse, due passate non
// sarebbero più confrontabili — ed è l'unica cosa su cui si regge il banco.
const semi = ["att-A", "att-B", "zzz-999"];
const firme = semi.map((s) => classificaCon(s).map((c) => `${c.area_slug}:${c.vittorie}/${c.incontri}`).join("|"));
ok(new Set(firme).size === 1, `la classifica di T3 non dipende dal seme del tentativo (${semi.length} semi provati)`);

const areeConPunti = segnali.filter((s) => s.interest_score > 0);
ok(areeConPunti.length >= 4, `T1 apre ${areeConPunti.length} aree: il profilo non è tutto su una sola`);
const seconda = [...segnali].sort((a, b) => b.interest_score - a.interest_score)[1];
ok(seconda && seconda.interest_score > 0, `la seconda area ha segnale vero (${seconda?.area_slug} ${seconda?.interest_score})`);
ok(assiOrdinati.length >= 2 && assiOrdinati[1].valore > 0, `il secondo asse non è a zero (${assiOrdinati[1]?.asse} ${assiOrdinati[1]?.valore})`);
// Se l'area portante prendesse tutto, T3 sarebbe una formalità e non
// proverebbe il codice che decide fra aree vicine — che è il motivo per cui
// esiste.
const vinti = classifica[0]?.vittorie ?? 0;
const totVinti = classifica.reduce((s, c) => s + c.vittorie, 0);
ok(totVinti > vinti, `nel torneo di T3 vince anche qualcun altro (${vinti} su ${totVinti} incontri vinti dalla prima)`);

// ── 4-6) Ogni missione, una per una ──────────────────────────────────────────
//
// TUTTO QUELLO CHE SEGUE GIRA PER OGNI MISSIONE GIOCATA, e non è un ciclo messo
// per eleganza: gli id degli step sono canonici e COLLIDONO — `s3_budget` esiste
// in tutte e due, e nelle due vuole un payload di forma diversa. Un controllo
// scritto per una sola missione resterebbe verde sull'altra senza guardarla.
//
// I NUMERI DI CIASCUNA SI ESEGUONO, NON SI LEGGONO. Per il cantiere questo è il
// punto: 240.000 € e 83 giorni con dipendenze fra i lavori sono un vincolo
// aritmetico vero, e una partita scritta male là non «suona» male — non entra.
const raccolta = [];
for (const def of R.MISSIONI_GIOCATE) {
  console.log(`\n4) «${def.slug}» — i testi parlano di quello che il robot non ha guardato`);

  const missione = getMissione(def.slug, (id) => def.partita[id] ?? undefined);
  ok(Boolean(missione), `la missione «${def.slug}» esiste nel registro`);
  if (!missione) continue;

  const stepInfo = stepDellaMissione(missione).find((s) => s.tipo === "seleziona_informazioni");
  ok(Boolean(stepInfo), "ha un passo a gettoni");
  if (!stepInfo) continue;

  ok(def.gettoni.length === stepInfo.budget, `spende ${def.gettoni.length} gettoni, esattamente il budget del passo (${stepInfo.budget})`);
  ok(new Set(def.gettoni).size === def.gettoni.length, "nessun gettone speso due volte");

  const idDossier = stepInfo.dossier.map((d) => d.id);
  ok(def.gettoni.every((g) => idDossier.includes(g)), `i ${def.gettoni.length} materiali comprati esistono tutti nel dossier di questa missione`);

  const nonComprati = idDossier.filter((id) => !def.gettoni.includes(id));
  const nominati = Object.keys(def.nominatiComeNonLetti);
  const tuttiITesti = Object.values(def.testi).join("\n").toLowerCase();

  // IL VERSO CHE VALE SEMPRE: nessuna frase nomina come non letto qualcosa che è
  // stato comprato. È quello che tiene i testi dal diventare falsi.
  const fantasma = nominati.filter((id) => !nonComprati.includes(id));
  ok(
    fantasma.length === 0,
    fantasma.length === 0
      ? "nessun testo nomina come «non letto» qualcosa che il robot ha comprato"
      : `i testi dicono di NON aver letto ${fantasma.join(", ")}, ma il robot li ha comprati: i testi sono diventati falsi`,
  );

  // IL VERSO OPPOSTO vale solo dove il testo li ELENCA. Dove ne nomina uno di
  // proposito, pretenderlo spingerebbe verso un elenco — una scrittura peggiore —
  // e al suo posto si pretende il NUMERO che il testo dichiara.
  if (def.chiusi === "enumerati") {
    const mancanti = nonComprati.filter((id) => !nominati.includes(id));
    ok(
      mancanti.length === 0,
      mancanti.length === 0
        ? `tutti i ${nonComprati.length} materiali non comprati sono nominati nei testi (elenco completo)`
        : `non comprati e MAI nominati nei testi: ${mancanti.join(", ")} — il robot li ha saltati senza dirlo`,
    );
  } else {
    ok(def.chiusi === "unoSolo", `dichiara come tratta i chiusi («${def.chiusi}»)`);
    ok(nominati.length > 0, "…e ne nomina almeno uno: un testo che non ammette niente non ammette niente");
    // IL NUMERO CHE CHI LEGGE PUÒ RIFARE. Se i gettoni diventano sei, «i cinque
    // documenti» è una frase falsa dentro il materiale con cui misuriamo.
    const PAROLE = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"];
    const atteso = PAROLE[def.gettoni.length];
    ok(def.numeroDichiarato === atteso, `il numero dichiarato nel testo («${def.numeroDichiarato}») è quello dei gettoni spesi (${def.gettoni.length} → «${atteso}»)`);
    ok(tuttiITesti.includes(def.numeroDichiarato), `…e la parola «${def.numeroDichiarato}» compare davvero nei testi`);
  }

  // Le frasi devono comparire davvero: un accoppiamento che non si affaccia nel
  // testo è una tabella che nessuno aggiorna.
  const frasiAssenti = Object.entries(def.nominatiComeNonLetti).filter(([, frase]) => !tuttiITesti.includes(frase.toLowerCase()));
  ok(
    frasiAssenti.length === 0,
    frasiAssenti.length === 0
      ? `le ${nominati.length} frasi che nominano i materiali chiusi compaiono tutte nei testi`
      : `frasi dichiarate ma assenti dai testi: ${frasiAssenti.map(([id, f]) => `${id} («${f}»)`).join(", ")}`,
  );

  // Il conto che la riflessione fa ad alta voce, dove lo fa: «quattro su carte e
  // uno solo su persone». Dove non lo fa, il campo è null e non si inventa.
  if (def.gettoniDiPersone) {
    const dipersone = def.gettoni.filter((g) => def.gettoniDiPersone.includes(g)).length;
    const suCarte = def.gettoni.length - dipersone;
    ok(dipersone === 1 && suCarte === 4, `il conto della riflessione regge: ${suCarte} gettoni su carte e ${dipersone} su persone`);
    ok(def.gettoniDiPersone.every((g) => def.gettoni.includes(g)), "il gettone «di persone» è davvero fra quelli spesi");
  }

  // ── 5) la partita copre la missione, passo per passo ───────────────────────
  console.log(`\n5) «${def.slug}» — ogni passo riceve una risposta valida`);

  // Si ricostruisce come fa il robot: la missione è DINAMICA — il mandato decide
  // le consulenze, i materiali comprati decidono le voci di budget e i lavori
  // del piano — quindi una costruzione sola all'inizio proverebbe una versione
  // che nessuno studente vede.
  const risposte = new Map();
  const leggi = (id) => risposte.get(id);
  let passi = 0;
  let copertura = true;
  for (let giro = 0; giro < 50; giro++) {
    const m = getMissione(def.slug, leggi);
    const steps = stepDellaMissione(m);
    const prossimo = steps.find((s) => !risposte.has(s.id));
    if (!prossimo) break;
    const payload = R.rispostaPerStep(def.slug, prossimo);
    if (!payload) {
      console.error(`      «${prossimo.id}» (${prossimo.tipo}): nessuna risposta, e la regola generica non copre il tipo`);
      copertura = false;
      risposte.set(prossimo.id, {});
      continue;
    }
    risposte.set(prossimo.id, payload);
    passi++;
  }
  ok(copertura, `tutti i ${passi} passi hanno una risposta`);

  const finali = stepDellaMissione(getMissione(def.slug, leggi));
  const perId = new Map(finali.map((s) => [s.id, s]));
  raccolta.push({ def, idDossier, nonComprati, tuttiITesti, perId });

  // Gli id nominati nelle risposte devono esistere negli step VERI: una voce di
  // budget rinominata nel config lascerebbe il robot a distribuire minuti su una
  // riga che non c'è, e il totale tornerebbe lo stesso.
  const idEsistenti = (stepId, ids, presenti, cosa) => {
    const step = perId.get(stepId);
    if (!step) return ok(false, `lo step «${stepId}» non esiste più in questa missione`);
    const fuori = ids.filter((i) => !presenti.includes(i));
    return ok(fuori.length === 0, fuori.length === 0 ? `${stepId}: ${cosa} esistono tutti` : `${stepId}: ${cosa} inesistenti → ${fuori.join(", ")}`);
  };

  // LO STEP 3.1 SI CONTROLLA PER TIPO, non per missione: `alloca_budget` e
  // `pianifica_lavori` hanno lo stesso id canonico e due payload diversi.
  const budget = perId.get("s3_budget");
  const risposta31 = def.partita.s3_budget;
  if (budget?.tipo === "alloca_budget") {
    const alloc = risposta31.allocazioni;
    idEsistenti("s3_budget", Object.keys(alloc), budget.voci.map((v) => v.id), "le voci allocate");
    const somma = Object.values(alloc).reduce((a, b) => a + b, 0);
    ok(somma === budget.totale, `s3_budget: distribuiti ${somma} ${budget.unita ?? ""}, e il totale è ${budget.totale}`);
    ok(Object.values(alloc).every((v) => v % budget.passo === 0), `s3_budget: ogni voce è un multiplo del passo (${budget.passo})`);
  } else if (budget?.tipo === "pianifica_lavori") {
    // I CONTI ESEGUITI CONTRO IL MOTORE. È il controllo per cui questa sezione
    // esiste: qui una partita sbagliata non suona male, non entra.
    const sel = risposta31.selezionati;
    idEsistenti("s3_budget", sel, budget.lavori.map((l) => l.id), "i lavori scelti");
    const v = valutaPiano(budget, sel);
    ok(
      v.soldi <= budget.budgetSoldi,
      `s3_budget: ${v.soldi} ${budget.unitaSoldi} su ${budget.budgetSoldi} — il piano ${v.soldi <= budget.budgetSoldi ? "sta dentro i soldi" : "SFORA i soldi, e una partita che sfora non entra"}`,
    );
    ok(
      v.giorni <= budget.budgetGiorni,
      `s3_budget: ${v.giorni} giorni su ${budget.budgetGiorni} — il piano ${v.giorni <= budget.budgetGiorni ? "sta dentro i giorni" : "SFORA i giorni, e una partita che sfora non entra"}`,
    );
    ok(
      v.dipendenzeMancanti.length === 0,
      v.dipendenzeMancanti.length === 0
        ? "s3_budget: nessuna dipendenza violata fra i lavori"
        : `s3_budget: dipendenze violate → ${v.dipendenzeMancanti.map((d) => `${d.lavoro} richiede ${d.mancanti.join("+")}`).join("; ")}`,
    );
    // I lavori ESSENZIALI al collaudo: senza, il piano entra nei tetti e la
    // palestra non riapre — il caso peggiore della missione, e non lo segnala
    // nessun tetto.
    const essenziali = budget.lavori.filter((l) => l.essenziale).map((l) => l.id);
    const fuoriEssenziali = essenziali.filter((id) => !sel.includes(id));
    ok(
      fuoriEssenziali.length === 0,
      fuoriEssenziali.length === 0
        ? `s3_budget: tutti i ${essenziali.length} lavori essenziali al collaudo sono dentro`
        : `s3_budget: essenziali FUORI dal piano → ${fuoriEssenziali.join(", ")}: il piano entra nei tetti e la palestra non riapre`,
    );
    // Il margine, dichiarato: serve a chi legge per sapere quanto è stretta.
    console.log(`      margine: ${budget.budgetSoldi - v.soldi} ${budget.unitaSoldi} e ${budget.budgetGiorni - v.giorni} giorni`);
  } else {
    ok(false, `s3_budget: tipo «${budget?.tipo ?? "assente"}» che questo controllo non sa verificare`);
  }

  const scarto = perId.get("s3_scarto");
  idEsistenti("s3_scarto", def.partita.s3_scarto.scartati, scarto.opzioni.map((o) => o.id), "le opzioni scartate");
  ok(def.partita.s3_scarto.scartati.length === scarto.daScartare, `s3_scarto: se ne scartano ${scarto.daScartare}, e il robot ne scarta ${def.partita.s3_scarto.scartati.length}`);
  // LE TRAPPOLE, NEI DUE VERSI: una `trappola` scatta a TENERLA, una
  // `trappolaSeScartata` a SCARTARLA. Se un domani la trappola cambia opzione, il
  // robot ci cascherebbe senza che nessuno lo noti.
  const trappole = scarto.opzioni.filter((o) => o.trappola || o.trappolaSeScartata);
  const tenute = trappole.filter((t) => !t.trappolaSeScartata && !def.partita.s3_scarto.scartati.includes(t.id));
  ok(tenute.length === 0, tenute.length === 0 ? "nessuna trappola resta in mano al robot" : `trappole TENUTE: ${tenute.map((t) => t.id).join(", ")}`);
  const scartateAMale = trappole.filter((t) => t.trappolaSeScartata && def.partita.s3_scarto.scartati.includes(t.id));
  ok(
    scartateAMale.length === 0,
    scartateAMale.length === 0
      ? "nessuna trappola-a-scartarla è fra quelle scartate"
      : `trappole SCARTATE, e lì la trappola è proprio scartarle: ${scartateAMale.map((t) => t.id).join(", ")}`,
  );

  const ruoli = perId.get("s3_ruoli") ?? perId.get("s4_ruoli");
  if (ruoli) {
    const assegnate = def.partita[ruoli.id].assegnazioni;
    idEsistenti(ruoli.id, Object.keys(assegnate), ruoli.ruoli.map((r) => r.id), "i compiti assegnati");
    ok(Object.keys(assegnate).length === ruoli.ruoli.length, `${ruoli.id}: assegnati tutti i ${ruoli.ruoli.length} compiti`);
    const presi = Object.values(assegnate).filter((v) => v === "io").length;
    // Né tutto né niente: prendersi tutto o lasciare tutto è una risposta che non
    // distingue autoefficacia da indifferenza, ed è il segnale che quel passo emette.
    ok(presi > 0 && presi < ruoli.ruoli.length, `${ruoli.id}: il robot ne prende ${presi} su ${ruoli.ruoli.length} — né tutto né niente`);
  }

  const priorita = perId.get("s1_priorita");
  idEsistenti("s1_priorita", def.partita.s1_priorita.ordine, priorita.elementi.map((e) => e.id), "le priorità ordinate");
  ok(def.partita.s1_priorita.ordine.length === priorita.elementi.length, "s1_priorita: l'ordine copre tutte le richieste");

  const mandato = perId.get("s1_mandato");
  ok(mandato.opzioni.some((o) => o.id === def.partita.s1_mandato.opzioneId), `s1_mandato: «${def.partita.s1_mandato.opzioneId}» è un mandato vero di questa missione`);

  const passiDomani = perId.get("s5_passi");
  if (passiDomani) {
    idEsistenti("s5_passi", def.partita.s5_passi.passi, passiDomani.passi.map((p) => p.id), "i passi di domani");
    ok(def.partita.s5_passi.passi.length === passiDomani.quanti, `s5_passi: ne servono ${passiDomani.quanti}, il robot ne dà ${def.partita.s5_passi.passi.length}`);
  }

  // ── 6) i testi con un minimo di caratteri lo rispettano ────────────────────
  console.log(`\n6) «${def.slug}» — i testi aperti stanno dentro i vincoli del prodotto`);

  for (const [stepId, testo] of [["s4_proposta", def.testi.proposta], ["s5_riflessione", def.testi.riflessione]]) {
    const step = perId.get(stepId);
    if (!step) {
      ok(false, `lo step «${stepId}» non esiste più: il testo scritto per lui è orfano`);
      continue;
    }
    const min = step.minCaratteri ?? 0;
    ok(testo.length >= min, `${stepId}: ${testo.length} caratteri, il minimo è ${min}`);
  }
}

// LA RISPOSTA ALLA MAIL NON CHIEDE CHI È. È la regola dura della missione
// derivata (il revisore la valuta bassa se chiede il nome) ed è anche la ragione
// per cui il robot ha comprato M6: un testo che scivola lì renderebbe incoerente
// tutta la partita. Vale su QUELLA missione, non su tutte — sul cantiere non c'è
// nessun anonimo da proteggere, e un controllo applicato dove non serve è un
// controllo che un giorno grida su una cosa giusta.
const derivataRaccolta = raccolta.find((r) => r.def.derivata === true);
const proposta = (derivataRaccolta?.def.testi.proposta ?? "").toLowerCase();
const identificative = ["come ti chiami", "come si chiama", "qual è il tuo nome", "quanti anni hai", "dimmi chi sei", "mi dica chi è"];
const scivolate = identificative.filter((f) => proposta.includes(f));
ok(scivolate.length === 0, scivolate.length === 0 ? "la risposta alla mail non chiede chi è" : `la risposta alla mail chiede: ${scivolate.join(", ")}`);

// ── 6bis) Il banco stampa il profilo come lo mostra la HOME ──────────────────
// La proprietà è una sola, e il 20/09 è costata due letture sbagliate in due
// giorni: **un'area sotto la barra non sta in fondo alla classifica, sta
// fuori.** Il banco ordinava le righe di `area_signal` per punteggio, quindi
// mostrava `scienze-educazione` (una sola attività, per il prodotto è
// «sfiorata») sopra `salute` (confermata, due attività) — e da lì «il profilo
// ribalta l'area su cui lo studente ha lavorato di più», vero dello strumento
// e falso del prodotto.
console.log("\n6bis) Il profilo stampato è quello della home, non una classifica di comodo");

const giocaT = require("./banco/robot/giocaTest");
const righeStampate = [];
giocaT.stampaProfilo(
  {
    lettura: "ok",
    righeArea: 2,
    affinita: {
      haAttivita: true,
      // Il caso vero rovesciato apposta: la sfiorata avrebbe il punteggio più
      // alto, quindi un ordinamento per punteggio la metterebbe in cima.
      eleggibili: [{ slug: "salute-professioni-sanitarie", nome: "Salute", interest: 67, status: "confermata" }],
      sfiorate: [{ nome: "Scienze dell'Educazione", motivazione: "hai messo il minore per primo" }],
    },
    assi: [],
  },
  (r) => righeStampate.push(r),
);
const stampa = righeStampate.join("\n");
const iClassifica = stampa.indexOf("in classifica");
const iSfiorate = stampa.indexOf("aree sfiorate");
const iSalute = stampa.indexOf("salute-professioni-sanitarie");
const iEducazione = stampa.indexOf("Scienze dell'Educazione");
ok(iClassifica !== -1 && iSfiorate !== -1, "le due liste sono separate e nominate");
ok(iSalute > iClassifica && iSalute < iSfiorate, "l'area eleggibile sta nella classifica");
ok(iEducazione > iSfiorate, "la sfiorata sta DOPO, nel suo blocco: non è una riga della classifica");
ok(!/Scienze dell'Educazione\s+\d/.test(stampa), "e non porta un punteggio: il prodotto non gliene mostra uno");
ok(/≥2 attività distinte/.test(stampa), "la barra è dichiarata sotto le due liste");
ok(/hai messo il minore per primo/.test(stampa), "la sfiorata porta la sua prova più forte, come in home");

// «Non ho potuto leggere» non è «è vuoto»: `caricaAffinitaHome` degrada a un
// profilo vuoto anche quando la query fallisce, e per un banco quella è la
// risposta comoda.
const righeCieche = [];
giocaT.stampaProfilo({ lettura: "fallita", righeArea: 7, affinita: { haAttivita: false, eleggibili: [], sfiorate: [] }, assi: [] }, (r) => righeCieche.push(r));
ok(/NON HO POTUTO LEGGERLO/.test(righeCieche.join("\n")), "una lettura fallita si dichiara, invece di stampare un profilo vuoto");
ok(/7 righe/.test(righeCieche.join("\n")), "…dicendo quante righe ci sono davvero in area_signal");

const righeVuote = [];
giocaT.stampaProfilo({ lettura: "ok", righeArea: 0, affinita: { haAttivita: false, eleggibili: [], sfiorate: [] }, assi: [] }, (r) => righeVuote.push(r));
ok(/è vuoto \(ho guardato\)/.test(righeVuote.join("\n")), "…e un profilo davvero vuoto lo dice per quello che è");

// I DUE LETTORI, controllati sul sorgente: le funzioni async contro Supabase
// non girano senza rete, ma «chi chiede a chi» si legge.
const srcGioca = fs.readFileSync(path.join(__dirname, "banco/robot/giocaTest.js"), "utf8");
const srcStudente = fs.readFileSync(path.join(__dirname, "banco/studente.js"), "utf8");
ok(srcGioca.includes("caricaAffinitaHome(supabase"), "il banco CHIEDE il profilo a caricaAffinitaHome invece di riordinarlo");
ok(!/order\("interest_score"/.test(srcGioca), "…e non ordina più area_signal per punteggio per conto suo");
ok(
  /confrontaMissione\(esitiTest[\s\S]{0,80}?vincitrice\)/.test(srcStudente),
  "il confronto sulla missione riceve il vincitore del TORNEO, non la prima riga di area_signal",
);
ok(!/confrontaMissione\(profilo\.aree/.test(srcStudente), "…e la vecchia forma non rientra");

// ── 6ter) Le cifre che il testo CITA sono quelle che il motore calcola ────────
// LA REGOLA CHE QUESTO BLOCCO TIENE: «un numero che il lettore può rifare» non
// deve poter essere smentito dal motore. Nella prima stesura della proposta del
// cantiere una clausola diceva «e quei sei giorni servivano», e i sei giorni non
// c'erano: `valutaPiano` dà gli stessi giorni col parquet e col PVC. Un difetto
// del genere non si vede rileggendo — la frase suona bene — e a trovarlo è stato
// un conto eseguito.
//
// Quindi le cifre non si confrontano con una copia: si costruisce la FRASE dal
// valore che il motore restituisce e si cerca quella nel testo. Se un domani un
// costo o una durata cambiano nel config, il controllo cerca una frase che nel
// testo non c'è più e lo dice, invece di restare verde su una prosa diventata
// falsa.
//
// IL LIMITE, dichiarato: questo vede una cifra SPARITA o CAMBIATA, non una
// aggiunta. Una clausola nuova con un numero inventato non la prende nessuno
// qui — quella si legge.
console.log("\n6ter) Le cifre citate nella proposta sono quelle del motore");
{
  const conPiano = raccolta.find((r) => r.perId.get("s3_budget")?.tipo === "pianifica_lavori");
  if (!conPiano) {
    console.log("   (nessuna missione con un piano di lavori: niente da confrontare)");
  } else {
    const step = conPiano.perId.get("s3_budget");
    const sel = conPiano.def.partita.s3_budget.selezionati;
    const testo = conPiano.def.testi.proposta;

    // Un vocabolario di NUMERALI, non una copia delle risposte: se il motore
    // dicesse 75 invece di 74 la voce non c'è e il controllo lo dichiara, invece
    // di cercare una parola sbagliata.
    const PAROLE = {
      6: "sei", 9: "nove", 12: "dodici", 14: "quattordici",
      74: "settantaquattro", 80: "ottanta", 83: "ottantatré",
    };
    const p = (n) => PAROLE[n] ?? `«${n}» (numerale non in vocabolario)`;
    // Il separatore delle migliaia a mano: `toLocaleString("it-IT")` non lo mette
    // sui numeri di quattro cifre (7000 → «7000»), e il testo scrive «7.000 €».
    const eur = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    const lavoro = (id) => step.lavori.find((l) => l.id === id);

    const piano = valutaPiano(step, sel);
    const conParquet = valutaPiano(step, sel.map((x) => (x === "pvc" ? "parquet" : x)));
    const conFondo = valutaPiano(step, [...sel, "fondo_imprevisti"]);
    const senzaSquadra = valutaPiano(step, sel.filter((x) => x !== "seconda_squadra"));

    const frasi = [
      ["i giorni dei due pavimenti", `il parquet ne prende ${p(lavoro("parquet").giorni)} e il PVC ${p(lavoro("pvc").giorni)}`],
      ["i giorni degli spogliatoi", `che ne prendono ${p(lavoro("accessibilita").giorni)}`],
      ["i due costi a confronto", `${eur(lavoro("parquet").costo)} € contro i ${eur(lavoro("pvc").costo)}`],
      ["lo sforo col parquet", `arrivava a ${eur(conParquet.soldi)} € su ${eur(step.budgetSoldi)}`],
      ["il costo della seconda squadra", `${eur(lavoro("seconda_squadra").costo)} € per la seconda squadra`],
      ["il fondo a cui si rinuncia", `fondo imprevisti da ${eur(lavoro("fondo_imprevisti").costo)}`],
      ["lo sforo col fondo", `arrivava a ${eur(conFondo.soldi)} su ${eur(step.budgetSoldi)} disponibili`],
      ["i giorni guadagnati", `da ${p(senzaSquadra.giorni)} giorni a ${p(piano.giorni)}`],
      ["il margine", `sugli ${p(step.budgetGiorni)} che avevamo: ${p(step.budgetGiorni - piano.giorni)} di margine`],
      ["le economie non spese", `Restano ${eur(step.budgetSoldi - piano.soldi)} € non spesi`],
      ["gli spogliatoi, costo e durata", `${eur(lavoro("accessibilita").costo)} € e ${p(lavoro("accessibilita").giorni)} giorni`],
    ];
    for (const [cosa, frase] of frasi) {
      ok(testo.includes(frase), testo.includes(frase) ? `${cosa}: il testo dice «${frase}»` : `${cosa}: il motore dice «${frase}» e il testo non lo dice`);
    }
    // La minaccia dichiarata: il ritardo del quadro (12 giorni, testo del vincolo
    // del mandato) è più grande del margine. È la cosa che la clausola riscritta
    // AMMETTE, e se un domani il margine crescesse l'ammissione diventerebbe falsa.
    ok(
      step.budgetGiorni - piano.giorni < 12,
      step.budgetGiorni - piano.giorni < 12
        ? `il margine (${step.budgetGiorni - piano.giorni} giorni) NON copre i dodici del quadro difettoso: il testo ha ragione ad ammetterlo`
        : `il margine (${step.budgetGiorni - piano.giorni} giorni) copre i dodici del quadro: la clausola che ammette di essere stata fortunata non regge più`,
    );
  }
}

// ── 7) Controprove ───────────────────────────────────────────────────────────
// Senza, «tutto verde» direbbe solo che le liste lette erano vuote.
console.log("\n7) Controprove: il controllo si accorge davvero");

// Le tre di sempre, sulla missione che ELENCA i chiusi (là il verso «ogni non
// comprato è nominato» c'è, e si può rompere).
const enumerata = raccolta.find((r) => r.def.chiusi === "enumerati");
ok(Boolean(enumerata), "c'è almeno una missione che elenca i chiusi: è quella su cui le controprove hanno senso");
if (enumerata) {
  const { def, nonComprati, idDossier, tuttiITesti } = enumerata;
  const unoDeiNominati = Object.keys(def.nominatiComeNonLetti)[0];
  const nominatiRotti = { ...def.nominatiComeNonLetti };
  delete nominatiRotti[unoDeiNominati];
  const mancantiRotti = nonComprati.filter((id) => !Object.keys(nominatiRotti).includes(id));
  ok(mancantiRotti.length === 1 && mancantiRotti[0] === unoDeiNominati, `togliendo «${unoDeiNominati}» dall'elenco dei nominati, il controllo lo nota`);

  const gettoniRotti = [...def.gettoni.slice(0, def.gettoni.length - 1), unoDeiNominati];
  const fantasmaRotto = Object.keys(def.nominatiComeNonLetti).filter((id) => !idDossier.filter((d) => !gettoniRotti.includes(d)).includes(id));
  ok(fantasmaRotto.includes(unoDeiNominati), "comprando un materiale che i testi dicono di non aver letto, il controllo lo nota");

  const frasiRotte = Object.entries({ ...def.nominatiComeNonLetti, [unoDeiNominati]: "una frase che non compare da nessuna parte" }).filter(
    ([, f]) => !tuttiITesti.includes(f.toLowerCase()),
  );
  ok(frasiRotte.length === 1, "cambiando la frase di un materiale senza cambiare il testo, il controllo lo nota");
}

// LA CONTROPROVA DEL NUMERO DICHIARATO, sulla missione che ne nomina uno solo:
// è la proprietà che sostituisce il verso perduto, quindi va rotta per sapere
// che c'è.
const unoSolo = raccolta.find((r) => r.def.chiusi === "unoSolo");
ok(Boolean(unoSolo), "c'è almeno una missione che nomina un chiuso solo: è quella col numero dichiarato");
if (unoSolo) {
  const PAROLE = ["zero", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove", "dieci"];
  const giusto = PAROLE[unoSolo.def.gettoni.length];
  const unoInPiu = PAROLE[unoSolo.def.gettoni.length + 1];
  ok(
    unoSolo.def.numeroDichiarato === giusto && giusto !== unoInPiu,
    unoSolo.def.numeroDichiarato === giusto
      ? `comprando un gettone in più il testo direbbe ancora «${giusto}» mentre i gettoni sarebbero «${unoInPiu}»: il controllo lo noterebbe`
      : `il testo dichiara «${unoSolo.def.numeroDichiarato}» e i gettoni sono «${giusto}»: è già disallineato adesso`,
  );
  ok(!unoSolo.tuttiITesti.includes("una parola che nei testi non c'è"), "e la parola dichiarata si cerca DAVVERO nei testi, non si dà per buona");
}

// IL PIANO CHE NON ENTRA. Il controllo dei conti è verde: rompiamolo, o «sta
// dentro i tetti» direbbe solo che `valutaPiano` ha restituito due numeri.
const conPiano = raccolta.find((r) => r.perId.get("s3_budget")?.tipo === "pianifica_lavori");
ok(Boolean(conPiano), "c'è una missione con un piano di lavori: è il ramo che non era mai girato");
if (conPiano) {
  const step = conPiano.perId.get("s3_budget");
  const sel = conPiano.def.partita.s3_budget.selezionati;

  // (a) il parquet al posto del PVC: sfora sui SOLDI e non sui giorni — è il
  //     conto che una lettura a mano sbaglia, ed è il motivo per cui il testo
  //     della proposta parla di euro.
  const conParquet = valutaPiano(step, sel.map((x) => (x === "pvc" ? "parquet" : x)));
  const conPvc = valutaPiano(step, sel);
  ok(
    conParquet.soldi > step.budgetSoldi,
    conParquet.soldi > step.budgetSoldi
      ? `col parquet il piano sfora i soldi (${conParquet.soldi} > ${step.budgetSoldi})`
      : `col parquet il piano NON sfora (${conParquet.soldi} ≤ ${step.budgetSoldi}): la ragione scritta nel testo della proposta non regge più`,
  );
  ok(
    conParquet.giorni === conPvc.giorni,
    conParquet.giorni === conPvc.giorni
      ? `…e NON costa un giorno in più (${conParquet.giorni} con l'uno e con l'altro): i due sono entrambi parallelizzabili`
      : `…e costa ${conParquet.giorni - conPvc.giorni} giorni in più (${conPvc.giorni} → ${conParquet.giorni}): allora la ragione dei GIORNI torna valida, e il testo va riletto`,
  );

  // (b) il fondo imprevisti: con lui si sfora. È la ragione per cui il robot non
  //     lo prende, e va eseguita invece di crederla.
  const conFondo = valutaPiano(step, [...sel, "fondo_imprevisti"]);
  ok(
    conFondo.soldi > step.budgetSoldi,
    conFondo.soldi > step.budgetSoldi
      ? `col fondo imprevisti il piano sforerebbe (${conFondo.soldi} > ${step.budgetSoldi})`
      : `col fondo imprevisti il piano ci starebbe (${conFondo.soldi} ≤ ${step.budgetSoldi}): non prenderlo non è più una scelta costretta`,
  );

  // (c) togliendo un lavoro che ne abilita un altro, le dipendenze si rompono.
  const senzaCopertura = valutaPiano(step, sel.filter((x) => x !== "copertura"));
  ok(senzaCopertura.dipendenzeMancanti.length > 0, "togliendo un lavoro che un altro richiede, il controllo delle dipendenze lo nota");

  // (d) la voce che esiste SOLO per un materiale comprato: è la dipendenza più
  //     dura della partita, perché se M10 uscisse dai gettoni il piano
  //     nominerebbe un lavoro che non c'è.
  const gated = step.lavori.filter((l) => l.gate);
  ok(gated.length > 0, `il piano ha ${gated.length} voce/i che esistono solo per un materiale comprato (${gated.map((l) => `${l.id}←${l.gate}`).join(", ")})`);
  const gateScelti = gated.filter((l) => sel.includes(l.id));
  ok(gateScelti.length > 0, "…e il robot ne usa almeno una: quel ramo del config viene davvero esercitato");
}

// IL SLUG PASSATO A `rispostaPerStep`. Gli step id collidono fra missioni: una
// chiamata senza slug, o con quello sbagliato, darebbe una risposta PLAUSIBILE
// alla missione sbagliata. Controllo lessicale perché `giocaMissione` è async
// contro Supabase e non gira qui — ma «chi passa cosa» si legge.
const srcGiocaM = fs.readFileSync(path.join(__dirname, "banco/robot/giocaMissione.js"), "utf8");
ok(/rispostaPerStep\(missionSlug, prossimo\)/.test(srcGiocaM), "giocaMissione passa il slug a rispostaPerStep, non si affida a un default");
ok(!/missionSlug = /.test(srcGiocaM), "…e `missionSlug` non ha un default: chi gioca nomina la missione, sempre");
ok(R.rispostaPerStep("una-missione-che-non-esiste", { id: "s1_mandato", tipo: "scelta_singola", opzioni: [{ id: "x" }] }) === null, "con uno slug sconosciuto rispostaPerStep torna null, invece di rispondere a caso");

// GLI ID CHE UNO STEP OFFRIVA. Senza, una risposta che dipende da cosa era in
// offerta non si rilegge: nel rapporto resterebbe «ha scelto materiali» senza
// dire fra cosa. E il dossier e i lavori cambiano davvero con la partita.
const giocaM = require("./banco/robot/giocaMissione");
ok(/offerte: offertePerStep\(prossimo\)/.test(srcGiocaM), "giocaMissione registra, per ogni passo, gli id che quel passo offriva");
for (const r of raccolta) {
  const info = r.perId.get("s2_informazioni");
  const off = giocaM.offertePerStep(info);
  ok(Array.isArray(off) && off.length === info.dossier.length, `«${r.def.slug}»: le offerte del passo a gettoni sono i ${info.dossier.length} id del dossier`);
}
const ruoliOff = giocaM.offertePerStep({ tipo: "assegna_ruoli", ruoli: [{ id: "a" }, { id: "b" }] });
ok(ruoliOff?.join(",") === "a,b", "…e per lo step dei ruoli sono i compiti offerti: è la domanda che Mario ha posto per prima");
ok(giocaM.offertePerStep({ tipo: "ordina_priorita", elementi: [{ id: "a" }] }) === null, "per gli step a opzioni fisse non si registra niente: quelle liste stanno nel config");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(
    `✗ ${falliti} controlli falliti.\n` +
      "  I tre testi aperti del robot parlano di quello che NON ha guardato: se cambiano\n" +
      "  i gettoni, o cambia la missione, quei testi diventano affermazioni false dette\n" +
      "  da uno studente finto dentro il materiale che usiamo per misurare il prodotto.\n",
  );
  process.exit(1);
}
console.log("✓ Il robot gioca un percorso coerente, e i suoi testi dicono il vero.\n");
