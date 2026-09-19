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

const { abilitaTypeScript } = require("./banco/ts");
abilitaTypeScript();

const { SLUG_T1, SLUG_T2, missionePerArea } = require("@/lib/test/config");
const { calcolaEvidenzeT3 } = require("@/lib/test/scoring");
const { evidenzeDaRighe } = require("@/lib/test/payload");
const { selezionaCandidate, assemblaT3 } = require("@/lib/test/assembla-t3");
const { getTest } = require("@/lib/test/config");
const { getMissione, stepDellaMissione } = require("@/lib/escape/config");
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

console.log("\n═══ Il percorso del robot: tre test e una missione ═══\n");

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
console.log("\n2) La missione fissata è quella che il prodotto suggerirebbe");

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
  suggerita?.slug === R.MISSIONE_FISSATA,
  suggerita?.slug === R.MISSIONE_FISSATA
    ? `dal profilo esce «${vincitrice}» → «${suggerita.slug}», che è la missione fissata`
    : `dal profilo esce «${vincitrice}» → «${suggerita?.slug ?? "nessuna"}», ma il banco gioca «${R.MISSIONE_FISSATA}»: i tre testi aperti sarebbero risposte a domande di un'altra missione`,
);

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

// ── 4) LA DIPENDENZA: cinque comprati, sette nominati come non letti ─────────
console.log("\n4) I testi parlano di quello che il robot non ha guardato");

const missione = getMissione(R.MISSIONE_FISSATA, (id) => R.PARTITA[id] ?? undefined);
ok(Boolean(missione), `la missione «${R.MISSIONE_FISSATA}» esiste nel registro`);

const stepInfo = stepDellaMissione(missione).find((s) => s.tipo === "seleziona_informazioni");
ok(Boolean(stepInfo), "la missione ha un passo a gettoni");

ok(R.GETTONI.length === stepInfo.budget, `il robot spende ${R.GETTONI.length} gettoni, esattamente il budget del passo (${stepInfo.budget})`);
ok(new Set(R.GETTONI).size === R.GETTONI.length, "nessun gettone speso due volte");

const idDossier = stepInfo.dossier.map((d) => d.id);
const compratiEsistono = R.GETTONI.every((g) => idDossier.includes(g));
ok(compratiEsistono, `i ${R.GETTONI.length} materiali comprati esistono tutti nel dossier di questa missione`);

const nonComprati = idDossier.filter((id) => !R.GETTONI.includes(id));
const nominati = Object.keys(R.NOMINATI_COME_NON_LETTI);

// I DUE VERSI, ed è il punto di tutto il file.
const mancanti = nonComprati.filter((id) => !nominati.includes(id));
ok(
  mancanti.length === 0,
  mancanti.length === 0
    ? `tutti i ${nonComprati.length} materiali non comprati sono nominati nei testi`
    : `non comprati e MAI nominati nei testi: ${mancanti.join(", ")} — il robot li ha saltati senza dirlo`,
);
const fantasma = nominati.filter((id) => !nonComprati.includes(id));
ok(
  fantasma.length === 0,
  fantasma.length === 0
    ? "nessun testo nomina come «non letto» qualcosa che il robot ha comprato"
    : `i testi dicono di NON aver letto ${fantasma.join(", ")}, ma il robot li ha comprati: i testi sono diventati falsi`,
);

// E le frasi devono comparire davvero: un accoppiamento che non si affaccia
// nel testo è una tabella che nessuno aggiorna.
const tuttiITesti = Object.values(R.TESTI).join("\n").toLowerCase();
const frasiAssenti = Object.entries(R.NOMINATI_COME_NON_LETTI).filter(([, frase]) => !tuttiITesti.includes(frase.toLowerCase()));
ok(
  frasiAssenti.length === 0,
  frasiAssenti.length === 0
    ? `le ${nominati.length} frasi che nominano i materiali chiusi compaiono tutte nei testi`
    : `frasi dichiarate ma assenti dai testi: ${frasiAssenti.map(([id, f]) => `${id} («${f}»)`).join(", ")}`,
);

// Il conto che la riflessione fa ad alta voce: «quattro su carte e uno solo su
// persone». È un numero che chi legge può rifare, quindi deve restare vero.
const dipersone = R.GETTONI.filter((g) => R.GETTONI_DI_PERSONE.includes(g)).length;
const suCarte = R.GETTONI.length - dipersone;
ok(dipersone === 1 && suCarte === 4, `il conto della riflessione regge: ${suCarte} gettoni su carte e ${dipersone} su persone`);
ok(R.GETTONI_DI_PERSONE.every((g) => R.GETTONI.includes(g)), "il gettone «di persone» è davvero fra quelli spesi");

// ── 5) La partita copre la missione, passo per passo ─────────────────────────
console.log("\n5) Ogni passo della missione riceve una risposta valida");

// Si ricostruisce come fa il robot: la missione è DINAMICA — il mandato decide
// le consulenze, i materiali comprati decidono le voci di budget — quindi una
// costruzione sola all'inizio proverebbe una versione che nessuno vede.
const risposte = new Map();
const leggi = (id) => risposte.get(id);
let passi = 0;
let copertura = true;
for (let giro = 0; giro < 50; giro++) {
  const m = getMissione(R.MISSIONE_FISSATA, leggi);
  const steps = stepDellaMissione(m);
  const prossimo = steps.find((s) => !risposte.has(s.id));
  if (!prossimo) break;
  const payload = R.rispostaPerStep(prossimo);
  if (!payload) {
    console.error(`      «${prossimo.id}» (${prossimo.tipo}): nessuna risposta, e la regola generica non copre il tipo`);
    copertura = false;
    risposte.set(prossimo.id, {});
    continue;
  }
  risposte.set(prossimo.id, payload);
  passi++;
}
ok(copertura, `tutti i ${passi} passi della missione hanno una risposta`);

const finali = stepDellaMissione(getMissione(R.MISSIONE_FISSATA, leggi));
const perId = new Map(finali.map((s) => [s.id, s]));

// Gli id nominati nelle risposte devono esistere negli step VERI: una voce di
// budget rinominata nel config lascerebbe il robot a distribuire minuti su una
// riga che non c'è, e il totale tornerebbe lo stesso.
function idEsistenti(stepId, ids, presenti, cosa) {
  const step = perId.get(stepId);
  if (!step) return ok(false, `lo step «${stepId}» non esiste più in questa missione`);
  const fuori = ids.filter((i) => !presenti.includes(i));
  return ok(fuori.length === 0, fuori.length === 0 ? `${stepId}: ${cosa} esistono tutti` : `${stepId}: ${cosa} inesistenti → ${fuori.join(", ")}`);
}

const budget = perId.get("s3_budget");
const alloc = R.PARTITA.s3_budget.allocazioni;
idEsistenti("s3_budget", Object.keys(alloc), budget.voci.map((v) => v.id), "le voci allocate");
const somma = Object.values(alloc).reduce((a, b) => a + b, 0);
ok(somma === budget.totale, `s3_budget: i minuti distribuiti fanno ${somma}, e il totale è ${budget.totale}`);
ok(Object.values(alloc).every((v) => v % budget.passo === 0), `s3_budget: ogni voce è un multiplo del passo (${budget.passo})`);

const scarto = perId.get("s3_scarto");
idEsistenti("s3_scarto", R.PARTITA.s3_scarto.scartati, scarto.opzioni.map((o) => o.id), "le opzioni scartate");
ok(R.PARTITA.s3_scarto.scartati.length === scarto.daScartare, `s3_scarto: se ne scartano ${scarto.daScartare}, e il robot ne scarta ${R.PARTITA.s3_scarto.scartati.length}`);
// La trappola dichiarata dev'essere fra le scartate: se un domani la trappola
// cambia opzione, il robot la terrebbe in mano senza che nessuno lo noti.
const trappole = scarto.opzioni.filter((o) => o.trappola || o.trappolaSeScartata);
const tenute = trappole.filter((t) => !t.trappolaSeScartata && !R.PARTITA.s3_scarto.scartati.includes(t.id));
ok(tenute.length === 0, tenute.length === 0 ? "nessuna trappola resta in mano al robot" : `trappole TENUTE: ${tenute.map((t) => t.id).join(", ")}`);

const ruoli = perId.get("s3_ruoli");
idEsistenti("s3_ruoli", Object.keys(R.PARTITA.s3_ruoli.assegnazioni), ruoli.ruoli.map((r) => r.id), "i compiti assegnati");
ok(Object.keys(R.PARTITA.s3_ruoli.assegnazioni).length === ruoli.ruoli.length, `s3_ruoli: assegnati tutti i ${ruoli.ruoli.length} compiti`);
const presi = Object.values(R.PARTITA.s3_ruoli.assegnazioni).filter((v) => v === "io").length;
// Né tutto né niente: prendersi tutto o lasciare tutto è una risposta che non
// distingue autoefficacia da indifferenza, ed è il segnale che quel passo emette.
ok(presi > 0 && presi < ruoli.ruoli.length, `s3_ruoli: il robot ne prende ${presi} su ${ruoli.ruoli.length} — né tutto né niente`);

const priorita = perId.get("s1_priorita");
idEsistenti("s1_priorita", R.PARTITA.s1_priorita.ordine, priorita.elementi.map((e) => e.id), "le priorità ordinate");
ok(R.PARTITA.s1_priorita.ordine.length === priorita.elementi.length, "s1_priorita: l'ordine copre tutte le richieste");

const mandato = perId.get("s1_mandato");
ok(mandato.opzioni.some((o) => o.id === R.PARTITA.s1_mandato.opzioneId), `s1_mandato: «${R.PARTITA.s1_mandato.opzioneId}» è un mandato vero di questa missione`);

const passiDomani = perId.get("s5_passi");
if (passiDomani) {
  idEsistenti("s5_passi", R.PARTITA.s5_passi.passi, passiDomani.passi.map((p) => p.id), "i passi di domani");
  ok(R.PARTITA.s5_passi.passi.length === passiDomani.quanti, `s5_passi: ne servono ${passiDomani.quanti}, il robot ne dà ${R.PARTITA.s5_passi.passi.length}`);
}

// ── 6) I due testi con un minimo di caratteri lo rispettano ──────────────────
console.log("\n6) I testi aperti stanno dentro i vincoli del prodotto");

for (const [stepId, testo] of [["s4_proposta", R.TESTI.proposta], ["s5_riflessione", R.TESTI.riflessione]]) {
  const step = perId.get(stepId);
  if (!step) {
    ok(false, `lo step «${stepId}» non esiste più: il testo scritto per lui è orfano`);
    continue;
  }
  const min = step.minCaratteri ?? 0;
  ok(testo.length >= min, `${stepId}: ${testo.length} caratteri, il minimo è ${min}`);
}

// LA RISPOSTA ALLA MAIL NON CHIEDE CHI È. È la regola dura di quella missione
// (il revisore la valuta bassa se chiede il nome) ed è anche la ragione per
// cui il robot ha comprato M6: un testo che scivola lì renderebbe incoerente
// tutta la partita.
const proposta = R.TESTI.proposta.toLowerCase();
const identificative = ["come ti chiami", "come si chiama", "qual è il tuo nome", "quanti anni hai", "dimmi chi sei", "mi dica chi è"];
const scivolate = identificative.filter((f) => proposta.includes(f));
ok(scivolate.length === 0, scivolate.length === 0 ? "la risposta alla mail non chiede chi è" : `la risposta alla mail chiede: ${scivolate.join(", ")}`);

// ── 7) Controprove ───────────────────────────────────────────────────────────
// Senza, «tutto verde» direbbe solo che le liste lette erano vuote.
console.log("\n7) Controprove: il controllo si accorge davvero");

const nominatiRotti = { ...R.NOMINATI_COME_NON_LETTI };
delete nominatiRotti.M7;
const mancantiRotti = nonComprati.filter((id) => !Object.keys(nominatiRotti).includes(id));
ok(mancantiRotti.length === 1 && mancantiRotti[0] === "M7", "togliendo un materiale dall'elenco dei nominati, il controllo lo nota");

const gettoniRotti = [...R.GETTONI.slice(0, 4), "M7"];
const fantasmaRotto = Object.keys(R.NOMINATI_COME_NON_LETTI).filter((id) => !idDossier.filter((d) => !gettoniRotti.includes(d)).includes(id));
ok(fantasmaRotto.includes("M7"), "comprando un materiale che i testi dicono di non aver letto, il controllo lo nota");

const frasiRotte = Object.entries({ ...R.NOMINATI_COME_NON_LETTI, M7: "una frase che non compare da nessuna parte" }).filter(
  ([, f]) => !tuttiITesti.includes(f.toLowerCase()),
);
ok(frasiRotte.length === 1, "cambiando la frase di un materiale senza cambiare il testo, il controllo lo nota");

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
