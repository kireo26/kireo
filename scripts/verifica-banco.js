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

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Ogni esito ha la sua frase, e il fallimento non si nasconde dietro un successo.\n");
