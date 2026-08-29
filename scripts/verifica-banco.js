// Verifica della TABELLA DI DECISIONE del banco (`scripts/banco/motore.js`).
//
// Il banco vale per una cosa sola: dice cosa vuol dire un esito, invece di
// stampare numeri che qualcuno deve tradurre. Quella traduzione, il 30 agosto
// 2026, viveva nella testa di una persona mentre un progetto vero stava a due
// tentativi dalla resa — e la frase che ha evitato di bruciare il feedback
// finale è la stessa che questo test pretende ci sia.
//
// Provato qui e non a mano perché è l'unica parte del banco che si può provare
// senza rete: la chiamata, i log e lo stato del deploy richiedono Vercel e
// Supabase veri.
//
// Esecuzione: `npm run test:banco`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const { interpreta, maxTentativi } = require("./banco/motore");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

const testo = (status, dati, max = 3) => interpreta(status, dati, max).righe.join("\n");

console.log("\n═══ Il banco dice cosa vuol dire, non solo quanto ═══\n");

// ── i cinque casi della tabella ────────────────────────────────────────────
const fallita = testo(200, { processate: 0, saltate: 0, errori: 1, revisoriFalliti: 1 });
ok(/GENERAZIONE È FALLITA/.test(fallita), "errori + revisoriFalliti → la generazione è fallita");
ok(/NON è avanzata/.test(fallita), "…e dice che la tappa non è avanzata");
ok(/tetto è 3 giri/.test(fallita), "…e dice quanti giri restano, letti dal cron e non copiati qui");
ok(/senza feedback finale/.test(fallita), "…e avvisa del caso che non si recupera");
ok(interpreta(200, { errori: 1, revisoriFalliti: 1 }, 3).grave === false, "un revisore fallito non è un'uscita in errore: si può ancora rimediare");

const raffredda = testo(200, { processate: 0, saltate: 2, errori: 0, revisoriFalliti: 0 });
ok(/NIENTE DA FARE ORA/.test(raffredda) && /2 tappe sono/.test(raffredda), "saltate > 0 → raffreddamento, al plurale giusto");
ok(/Non è un errore/.test(raffredda), "…e dice esplicitamente che non è un errore");
ok(/Rilanciare adesso non cambia niente/.test(raffredda), "…e dice di non rilanciare");

const fatto = testo(200, { processate: 1, saltate: 3, errori: 0, revisoriFalliti: 0 });
ok(/FATTO: 1 tappa avanzata/.test(fatto), "processate > 0 → fatto, al singolare giusto");
ok(/Altre 3 tappe stanno ancora raffreddando/.test(fatto), "…e non nasconde le altre in attesa");

ok(/NON AUTORIZZATO \(401\)/.test(testo(401, {})), "401 → segreto sbagliato o deploy di preview");
ok(/deploy di PREVIEW/.test(testo(401, {})), "…e nomina la seconda causa, che è quella che non viene in mente");
ok(interpreta(401, {}, 3).grave === true, "401 esce in errore: non c'è niente da interpretare oltre");

ok(/CHIAVE ANTHROPIC ASSENTE/.test(testo(503, {})), "503 → manca la chiave Anthropic");
ok(/serve un redeploy/.test(testo(503, {})), "…e ricorda che una variabile senza redeploy non è attiva");

// ── i casi che restano ─────────────────────────────────────────────────────
ok(/NESSUNA TAPPA CONSEGNATA/.test(testo(200, { processate: 0, saltate: 0, errori: 0 })), "tutto a zero → non c'era niente da fare");
const soloErrori = testo(200, { processate: 0, saltate: 0, errori: 1, revisoriFalliti: 0 });
ok(/ERRORI SENZA REVISORI FALLITI/.test(soloErrori), "errori senza revisori falliti → il guasto è a valle, non nell'AI");

// ── la precedenza: un fallimento non viene coperto da un successo ──────────
// Un giro può avanzare una tappa e fallirne un'altra. Se prevalesse il «fatto»,
// il fallimento resterebbe invisibile fino alla resa.
const misto = testo(200, { processate: 1, saltate: 0, errori: 1, revisoriFalliti: 1 });
ok(/GENERAZIONE È FALLITA/.test(misto), "con un successo E un fallimento nello stesso giro, prevale il fallimento");

// ── la costante non è duplicata ────────────────────────────────────────────
ok(maxTentativi() !== null, "MAX_TENTATIVI_REVISIONE si legge davvero dal codice del cron");
const senzaMax = testo(200, { errori: 1, revisoriFalliti: 1 }, null);
ok(/GENERAZIONE È FALLITA/.test(senzaMax) && !/tetto è/.test(senzaMax), "se la costante non si trova, il banco tace sul numero invece di inventarlo");

// ── la copertura dei log: «non posso vederle» ≠ «non ci sono» ─────────────
// Il caso vero del 30 agosto 2026, numeri compresi: i guasti erano delle 15:15
// e delle 16:05; alle 17:29 abbiamo ridistribuito per il segreto nuovo; alle
// 17:50 il banco guardava 240 minuti indietro e diceva «nessuna riga», perché
// guardava solo il deploy nato 21 minuti prima. L'assenza riportata come un
// fatto invece che come un limite dello strumento — e su LO strumento con cui
// si verifica tutto il resto.
const { finestreDeploy, raccontaCopertura } = require("./banco/finestre");
const ora = Date.now();
const min = (n) => n * 60_000;

console.log("");
const pronto = (uid, minutiFa) => ({ uid, readyState: "READY", createdAt: ora - min(minutiFa) });
const treDeploy = [pronto("dpl_delle_1729", 21), pronto("dpl_delle_1600", 110), pronto("dpl_delle_1430", 200)];
const c240 = finestreDeploy(treDeploy, ora - min(240));
ok(c240.consultare.length === 3, "una finestra di 240 minuti consulta tutti e tre i deploy, non solo il corrente");
ok(c240.consultare[0].uid === "dpl_delle_1729", "…a partire dal più recente");
ok(Math.round(c240.scoperto / 60000) === 40, "…e sa che 40 minuti restano fuori portata");
ok(/restano SCOPERTI/.test(raccontaCopertura(c240, 240).join("\n")), "…e lo dice, invece di tacere");

const c15 = finestreDeploy(treDeploy, ora - min(15));
ok(c15.consultare.length === 1 && c15.scoperto === 0, "una finestra dentro la vita del deploy corrente non ha scoperti");
ok(!/SCOPERTI/.test(raccontaCopertura(c15, 15).join("\n")), "…e allora non allarma per niente");

ok(finestreDeploy([], ora - min(60)).consultare.length === 0, "senza deploy non si consulta niente");
ok(/non posso vedere niente/.test(raccontaCopertura(finestreDeploy([], ora - min(60)), 60).join("\n")), "…e la frase dice «non posso vedere», non «nessuna riga»");

// Un deploy nato DOPO la fine della finestra non c'entra niente con quelle ore.
const futuro = finestreDeploy([pronto("dpl_dopo", 5), pronto("dpl_prima", 300)], ora - min(200), ora - min(100));
ok(futuro.consultare.some((d) => d.uid === "dpl_prima"), "una finestra nel passato consulta il deploy che allora reggeva il traffico");
ok(!futuro.consultare.some((d) => d.uid === "dpl_dopo"), "…e non quello nato dopo, che di quelle ore non sa niente");

// ── solo chi ha servito ha un regno ───────────────────────────────────────
// `target=production` filtra la destinazione, non l'esito: nella lista di
// Vercel finiscono anche i deploy falliti, annullati e in costruzione. Un
// deploy che non ha mai servito non è inerte — CHIUDEREBBE il regno di quello
// prima di lui, mandando il banco a cercare righe dove non ce ne sono.
console.log("");
const conFalliti = [
  { uid: "dpl_in_corso", readyState: "BUILDING", createdAt: ora - min(1) },
  { uid: "dpl_annullato", readyState: "CANCELED", createdAt: ora - min(2) },
  { uid: "dpl_fallito", readyState: "ERROR", createdAt: ora - min(30) },
  pronto("dpl_che_serve", 90),
  pronto("dpl_di_prima", 300),
];
const f = finestreDeploy(conFalliti, ora - min(120));
ok(!f.consultare.some((d) => d.uid === "dpl_in_corso"), "un deploy in BUILDING non entra: non ha ancora servito niente");
ok(!f.consultare.some((d) => ["dpl_annullato", "dpl_fallito"].includes(d.uid)), "né uno CANCELED o ERROR");
ok(f.scartati === 3, "…e il banco sa quanti ne ha esclusi");
ok(/3 esclusi/.test(raccontaCopertura(f, 120).join("\n")), "…e lo dice, invece di far sparire tre righe in silenzio");

// IL CASO PEGGIORE, che è anche il più probabile: si lancia il banco mentre un
// redeploy costruisce — cioè subito dopo aver corretto qualcosa — e il deploy
// in BUILDING, essendo il più recente, si prenderebbe il regno fino ad adesso.
const corrente = f.consultare[0];
ok(corrente && corrente.uid === "dpl_che_serve", "con un redeploy in costruzione, il presente resta coperto da chi sta davvero servendo");
ok(corrente && corrente.regge[1] === Infinity, "…e il suo regno arriva fino ad adesso, non si chiude su un deploy che non serve");

// Un READY promosso e poi sostituito ha servito: resta dentro.
ok(f.consultare.some((d) => d.uid === "dpl_di_prima"), "un deploy READY sostituito da un altro resta consultabile: ha servito");

// Il regno comincia quando il deploy è PRONTO, non quando è stato creato: fra
// la creazione e la fine della build risponde ancora il precedente.
const conReady = finestreDeploy(
  [
    { uid: "dpl_nuovo", readyState: "READY", createdAt: ora - min(50), ready: ora - min(46) },
    { uid: "dpl_vecchio", readyState: "READY", createdAt: ora - min(200), ready: ora - min(196) },
  ],
  ora - min(48),
);
ok(conReady.consultare.some((d) => d.uid === "dpl_vecchio"), "una finestra che comincia durante una build consulta anche il deploy che allora rispondeva");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Ogni esito ha la sua frase, il fallimento non si nasconde dietro un successo,\n  e «non posso vederle» non si legge come «non ci sono».\n");
