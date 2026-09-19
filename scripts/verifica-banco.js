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

// ── il buco della build: i due estremi si prendono larghi ─────────────────
// Fra `createdAt` del successore e il suo `ready` passa un minuto o due in cui
// a rispondere è ancora il PRECEDENTE. Prendendo l'inizio del regno da
// `createdAt` e la fine dal `ready` del successore, i regni si sovrappongono
// per la durata della build: una finestra che cade lì dentro consulta tutti e
// due, invece di quello sbagliato al posto di quello giusto.
console.log("");
const nuovo = { uid: "dpl_nuovo", readyState: "READY", createdAt: ora - min(50), ready: ora - min(46) };
const vecchio = { uid: "dpl_vecchio", readyState: "READY", createdAt: ora - min(200), ready: ora - min(196) };
const nelBuco = finestreDeploy([nuovo, vecchio], ora - min(48)).consultare.map((d) => d.uid);
ok(nelBuco.includes("dpl_vecchio"), "una finestra dentro il buco della build consulta il deploy che allora rispondeva");
ok(nelBuco.includes("dpl_nuovo"), "…e anche quello nuovo: nel dubbio uno in più, mai uno in meno");
const dopoIlReady = finestreDeploy([nuovo, vecchio], ora - min(40)).consultare.map((d) => d.uid);
ok(dopoIlReady.length === 1 && dopoIlReady[0] === "dpl_nuovo", "…mentre fuori dal buco non si consulta nessuno di troppo");

// IL LIMITE, provato perché resti dichiarato e non si trasformi in una
// sicurezza che nessuno ha verificato: se il successore non espone `ready`, il
// buco della sua build è invisibile e quei minuti risultano suoi. Non è
// compensabile — il dato per farlo non c'è — ed è raro, perché passano solo i
// READY e un READY ha quasi sempre `ready`.
const senzaReady = finestreDeploy(
  [{ uid: "dpl_nuovo", readyState: "READY", createdAt: ora - min(50) }, vecchio],
  ora - min(48),
).consultare.map((d) => d.uid);
ok(!senzaReady.includes("dpl_vecchio"), "senza `ready` sul successore il buco resta invisibile: limite noto, non sicurezza promessa");

// ── i flag arrivano davvero ────────────────────────────────────────────────
// Il banco stampava «npm run banco log 30 --tutto», e quel comando non mostra
// tutte le righe: npm si mangia le opzioni prima di passarle allo script. Uno
// strumento che indica una porta deve aprirla, quindi il flag si legge da
// tutte e due le parti — dagli argomenti e da dove npm lo mette.
console.log("");
const { flag } = require("./banco/config");
ok(flag("tutto", ["log", "30", "--tutto"]), "il flag scritto dopo «--» arriva dagli argomenti");
ok(!flag("tutto", ["log", "30"]), "…e senza non si accende da solo");
process.env.npm_config_tutto = "true";
ok(flag("tutto", ["log", "30"]), "il flag che npm si è mangiato si rilegge da dove l'ha messo");
delete process.env.npm_config_tutto;
ok(!flag("tutto", ["robot", "palestra"]), "un flag diverso non si accende per sbaglio");

// ── le due conferme non si saltano ─────────────────────────────────────────
// `--vai` è esistito, non è mai arrivato fin qui (npm se lo mangiava) e in
// settimane nessuno l'ha reclamato: era un flag che nessuno usava. Farlo
// funzionare avrebbe aggiunto una scorciatoia mai chiesta all'unico comando
// che spende e all'unico che cancella. Questo controllo serve perché non
// rientri dalla finestra: una conferma dietro un `if` è una conferma che un
// giorno qualcuno spegne.
const fsBanco = require("fs");
const pathBanco = require("path");
for (const [nome, percorso] of [
  ["robot", "scripts/banco/robot/index.js"],
  ["azzera-percorsi", "scripts/banco/azzera-percorsi.js"],
]) {
  const sorgente = fsBanco.readFileSync(pathBanco.join(__dirname, "..", percorso), "utf8");
  ok(!/opzioni\.vai|\.vai\b/.test(sorgente), `${nome}: nessuna scorciatoia che salti la conferma`);
  ok(/await (chiediConferma|conferma)\(/.test(sorgente), `${nome}: la conferma si chiede, e non dietro una condizione`);
}

// ── un 5xx è un guasto, non un cancello ────────────────────────────────────
// Due ruoli fermati da un 500 erano finiti sotto «un gate che morde è un
// risultato»: dare a un guasto la dignità di un risultato è la cosa che
// questo banco esiste per non fare.
const { e5xx, eGuasto } = require("./banco/robot/sessione");
ok(!e5xx(400) && !e5xx(429) && !e5xx(499), "un 4xx resta un cancello: è il prodotto che dice no");
ok(e5xx(500) && e5xx(503), "un 5xx è un guasto nostro: va coi caduti, che si rifanno");
// E non tutti i «no» sono uguali: un 403 su un gate è un risultato, un 401 è
// il banco che ha perso le credenziali a metà passata.
ok(!eGuasto(400) && !eGuasto(403) && !eGuasto(429), "403 e 429 restano cancelli: il prodotto ha detto no a chi era chi diceva di essere");
ok(eGuasto(401), "un 401 no: è il chiamante che non è più chi diceva di essere, e va coi guasti del banco");
ok(eGuasto(500) && eGuasto(503), "…insieme ai 5xx");

// ── la produzione sta servendo questo commit? ─────────────────────────────
// Il banco aveva già i due dati — il commit locale finisce nel rapporto, lo
// stato dei deploy lo sa `banco deploy` — e non li confrontava mai. Tre passate
// del 13/09 hanno misurato il codice in aria e scritto sopra il commit di qui.
console.log("");
const { allineamento, stessoCommit } = require("./banco/allineamento");
const SHA_QUI = "1111111111111111111111111111111111111111";
const SHA_LA = "2222222222222222222222222222222222222222";
const qui = { sha: SHA_QUI, titolo: "il commit di qui", sporco: false };
const dep = (uid, sha, stato, minutiFa) => ({ uid, readyState: stato, createdAt: ora - min(minutiFa), meta: sha ? { githubCommitSha: sha } : {} });
const esitoDi = (deploys, locale = qui, perche = null) => allineamento({ locale, deploys, perche });
const righeDi = (...args) => esitoDi(...args).righe.join("\n");

ok(esitoDi([dep("dpl_ok", SHA_QUI, "READY", 30)]).esito === "allineato", "stesso commit in aria e qui → si parte");

const disallineato = esitoDi([dep("dpl_vecchio", SHA_LA, "READY", 30)]);
ok(disallineato.esito === "disallineato", "in aria c'è un altro commit → non si parte");
ok(/1111111111/.test(disallineato.righe.join("\n")) && /2222222222/.test(disallineato.righe.join("\n")), "…e si vedono tutti e due, non solo il verdetto");

// Il caso che ha fatto cadere due ruoli su cinque: Vercel spegne le vecchie
// funzioni mentre accende le nuove, e una richiesta in volo non trova nessuno.
const inVolo = esitoDi([dep("dpl_nuovo", SHA_QUI, "BUILDING", 1), dep("dpl_serve", SHA_QUI, "READY", 30)]);
ok(inVolo.esito === "in-volo", "un deploy in costruzione ferma la passata, anche se il commit coincide");
ok(/npm run banco deploy/.test(inVolo.righe.join("\n")), "…e dice come aspettarlo, invece di lasciare fermi e basta");

// E non grida su cose giuste: un deploy fallito o annullato dopo quello che
// serve non toglie niente a chi sta servendo. Una guardia che blocca a torto
// è una guardia che qualcuno disattiva.
ok(esitoDi([dep("dpl_fallito", SHA_LA, "ERROR", 1), dep("dpl_serve", SHA_QUI, "READY", 30)]).esito === "allineato", "un deploy ERROR più recente non blocca: a servire è ancora l'altro");
ok(esitoDi([dep("dpl_annullato", SHA_LA, "CANCELED", 1), dep("dpl_serve", SHA_QUI, "READY", 30)]).esito === "allineato", "né uno CANCELED");
ok(esitoDi([dep("dpl_residuo", SHA_LA, "QUEUED", 90), dep("dpl_serve", SHA_QUI, "READY", 30)]).esito === "allineato", "né un residuo in coda più vecchio di chi serve");

// I tre casi in cui non si sa. Nessuno dei tre blocca: sarebbero difetti dello
// strumento, non del prodotto, e su questo comando c'è già una conferma umana.
// Ma si dicono — «non posso verificare» non deve leggersi come un via libera.
ok(esitoDi(null, qui, "il token non risponde").esito === "incerto", "senza lo stato dei deploy non si blocca: si dichiara di non poter verificare");
ok(/il token non risponde/.test(righeDi(null, qui, "il token non risponde")), "…e si dice perché, invece di un ⚠ muto");
ok(esitoDi([dep("dpl_senza_sha", null, "READY", 30)]).esito === "incerto", "un deploy che non porta il commit da cui è nato non è confrontabile");
ok(esitoDi([dep("dpl_ok", SHA_QUI, "READY", 30)], null).esito === "incerto", "se git non risponde qui, non si sa cosa confrontare");
ok(esitoDi([dep("dpl_fallito", SHA_QUI, "ERROR", 5)]).esito === "incerto", "se nessun deploy ha mai servito, non si sa cosa c'è in aria");

// L'albero sporco NON blocca — potrebbe essere un appunto o uno script — ma le
// modifiche non committate in aria non ci sono, quindi la passata non le prova.
const sporco = esitoDi([dep("dpl_ok", SHA_QUI, "READY", 30)], { ...qui, sporco: true });
ok(sporco.esito === "allineato", "un albero sporco non ferma la passata");
ok(/non le prova/.test(sporco.righe.join("\n")), "…ma dice che quelle modifiche non sono sotto prova");

ok(stessoCommit(SHA_QUI, SHA_QUI.slice(0, 7)), "uno sha abbreviato è lo stesso commit: l'API a volte accorcia");
ok(!stessoCommit(SHA_QUI, SHA_LA), "due commit diversi restano diversi");
ok(!stessoCommit(SHA_QUI, "11"), "…e due caratteri non bastano a dichiarare un'uguaglianza");

// IL COLLEGAMENTO, che è il posto in cui una guardia nuova si perde: la
// funzione può essere giusta e non essere chiamata da nessuno. È già successo
// in questo progetto con `registra_guardia_lingua`, che per settimane ha
// contato tutto come produzione perché nessuno le passava il secondo argomento.
const sorgenteRobot = fsBanco.readFileSync(pathBanco.join(__dirname, "banco", "robot", "index.js"), "utf8");
ok(/allineamento\(\{/.test(sorgenteRobot), "il robot chiama davvero la guardia");
ok(/statoProduzione\(\)/.test(sorgenteRobot), "…con lo stato vero della produzione, non con una lista vuota");
// Fra il riconoscimento del blocco e la conferma ci deve essere un `return`:
// stampare un ✗ e proseguire sarebbe la forma peggiore, un avvertimento che non
// avverte. La prima stesura di questo controllo guardava fino ad `apriSessione`
// e passava lo stesso senza il return, perché nel mezzo trovava quello della
// conferma annullata: un controllo tarato largo dà un verde che non vuol dire
// niente, e si scopre solo provando a romperlo.
const daBloccoAConferma = sorgenteRobot.slice(sorgenteRobot.indexOf('=== "in-volo"'), sorgenteRobot.indexOf("await chiediConferma"));
ok(daBloccoAConferma.length > 0 && /\n\s*return;/.test(daBloccoAConferma), "…e quando blocca esce, invece di stampare e proseguire");
ok(sorgenteRobot.indexOf("allineamento({") < sorgenteRobot.indexOf("await chiediConferma"), "…e lo fa PRIMA della conferma: chi conferma deve già saperlo");

// E PRIMA ANCHE DEL PIANO VUOTO. Il 14/09 `banco robot senza-autore` ha detto
// «Nessun ruolo corrisponde» mentre questa cartella era indietro rispetto alla
// produzione, e la guardia — che c'era, e funzionava — è rimasta muta perché
// stava dopo quell'uscita. Un controllo giusto messo dopo il punto in cui
// serviva: la stessa forma del ritentativo sulle scritture e dell'ordine dei
// gesti del robot. «Nessun ruolo corrisponde» è il sintomo in cui un
// disallineamento è la spiegazione più probabile, quindi la guardia parla lì
// per prima.
const iChiesta = sorgenteRobot.indexOf("await verificaAllineamento()");
const iPianoVuoto = sorgenteRobot.indexOf("piano.lavori.length === 0");
// Cercato DOPO l'uscita, non dall'inizio: la frase compare anche nel commento
// che racconta il difetto, e un indice che cade lì dentro produrrebbe una
// finestra vuota — cioè un rosso su un codice giusto.
const iMessaggioFiltro = sorgenteRobot.indexOf("Nessun ruolo corrisponde a", iPianoVuoto);
ok(iChiesta > 0 && iPianoVuoto > 0 && iChiesta < iPianoVuoto, "la guardia si chiede PRIMA dell'uscita per piano vuoto");
const daPianoVuotoAMessaggio = sorgenteRobot.slice(iPianoVuoto, iMessaggioFiltro);
ok(
  iMessaggioFiltro > iPianoVuoto && /stato\.righe/.test(daPianoVuotoAMessaggio),
  "…e parla prima del messaggio del filtro, invece di lasciarlo solo a spiegare un disallineamento",
);

// ── il filtro dei log conosce le righe che il cron scrive davvero ──────────
// Il 18/09 `npm run banco log` ha detto «nessuna passata dal filtro» mentre una
// tappa si era arresa: le quattro voci di INTERESSANTI erano tutte sulla
// generazione AI, e una scrittura che non atterra passava senza essere vista.
//
// È una proprietà FRA DUE FILE — le stringhe le scrive il cron, il filtro vive
// nel banco — quindi si può controllare solo da qui, e senza rete.
console.log("");
const { INTERESSANTI } = require("./banco/vercel");
const sorgenteCron = fsBanco.readFileSync(
  pathBanco.join(__dirname, "..", "app/api/cron/workshop-motore/route.ts"),
  "utf8",
);

// Il primo argomento di ogni `console.error`, fino alla prima interpolazione:
// se il prefisso passa il filtro, la riga intera passa.
const RE_ERRORE = /console\.error\(\s*(?:"([^"]*)"|`([\s\S]*?)(?:\$\{|`))/g;
const scritte = [...sorgenteCron.matchAll(RE_ERRORE)].map((m) => (m[1] ?? m[2]).trim()).filter(Boolean);

// In quale direzione sbaglia questo estrattore quando sbaglia: se ne perde una,
// il test passa e nessuno lo sa — la risposta comoda. Quindi si confronta con
// quante ce ne sono davvero, e se le due cifre divergono è l'estrattore a
// doversi spiegare, non il filtro.
const quanteErrore = (sorgenteCron.match(/console\.error\(/g) ?? []).length;
ok(
  scritte.length === quanteErrore,
  `l'estrattore vede tutte le righe di errore del cron (${scritte.length} su ${quanteErrore})`,
);

const cieche = scritte.filter((s) => !INTERESSANTI.some((p) => p.test(s)));
ok(
  cieche.length === 0,
  cieche.length === 0
    ? `il filtro dei log riconosce tutte e ${scritte.length} le righe di errore del cron`
    : `il filtro non vedrebbe ${cieche.length} righe che il cron scrive: ${cieche.slice(0, 3).map((s) => `«${s}»`).join(", ")}`,
);

// La controprova: col filtro del 18/09 — quattro voci, tutte sulla generazione —
// le righe delle scritture restavano invisibili. Se questa non fosse rossa,
// quella sopra non starebbe controllando niente.
const FILTRO_VECCHIO = [/chiamaJson —/, /Errore generazione/, /forma non valida/i, /Alert osservabilità/];
const MARCATURA = "Errore marcatura revisione_esito (iscrizione ";
ok(
  !FILTRO_VECCHIO.some((p) => p.test(MARCATURA)) && INTERESSANTI.some((p) => p.test(MARCATURA)),
  "…e col filtro di prima quella della marcatura non si vedeva: è la riga del guasto del 18/09",
);

// ── `banco guasti`: due liste che nessuno aggiorna insieme ─────────────────
// L'insieme chiuso delle specie sta nel tipo TypeScript (lib/guasti/registra.ts),
// dove un nome inventato lo ferma il compilatore. Le GLOSSE — cosa vuol dire
// quella specie per chi legge — stanno nel banco, che TypeScript non guarda.
// Sono esattamente due liste in due file diversi: la malattia di casa.
//
// Una specie senza glossa non sparisce dal rapporto (viene stampata lo stesso,
// in fondo), quindi questo non è un controllo che protegge da una cecità: è un
// controllo che protegge da un NOME. Aggiungere una specie vuol dire aver
// deciso che quel guasto si ripara in un modo suo — e se nessuno sa dire cosa
// non è successo per qualcuno, il nome nuovo non aiuta nessuno a capirlo.
console.log("\n── banco guasti: le specie e cosa vogliono dire\n");

const { COSA_VUOL_DIRE, leggiGuasti } = require("./banco/guasti");
const sorgenteSpecie = fsBanco.readFileSync(pathBanco.join(__dirname, "..", "lib", "guasti", "registra.ts"), "utf8");
const blocco = sorgenteSpecie.slice(
  sorgenteSpecie.indexOf("export type SpecieGuasto"),
  sorgenteSpecie.indexOf("export type Guasto"),
);
const specie = [...blocco.matchAll(/\|\s*"([a-z_]+)"/g)].map((m) => m[1]);

// L'estrattore si sorveglia da sé, come quello delle righe di errore: se
// smettesse di vedere le specie, questo controllo passerebbe vuoto e nessuno
// lo saprebbe. Sotto la decina vuol dire che ha smesso di leggere, non che il
// tipo si è svuotato.
ok(specie.length >= 10, `l'estrattore legge le specie dal tipo TypeScript (${specie.length})`);

const senzaGlossa = specie.filter((s) => !COSA_VUOL_DIRE[s]);
ok(
  senzaGlossa.length === 0,
  senzaGlossa.length === 0
    ? `ogni specie di guasto dice cosa NON è successo per qualcuno (${specie.length})`
    : `${senzaGlossa.length} specie senza glossa nel banco: ${senzaGlossa.join(", ")}`,
);

const glosseOrfane = Object.keys(COSA_VUOL_DIRE).filter((s) => !specie.includes(s));
ok(
  glosseOrfane.length === 0,
  glosseOrfane.length === 0
    ? "…e non ne restano di scomparse dal tipo"
    : `glosse per specie che non esistono più: ${glosseOrfane.join(", ")}`,
);

// Controprova sull'estrattore: una specie inventata deve risultare senza
// glossa. Senza questa, «zero mancanti» starebbe dicendo solo che la lista
// letta era vuota.
ok(!COSA_VUOL_DIRE["specie_inventata_per_la_controprova"], "…e una specie nuova risulterebbe senza glossa");

// La proprietà che il comando deve avere sempre: `leggiGuasti` non termina il
// processo e non lancia — restituisce una delle due risposte. Un lettore che
// esce dal processo non si può usare dentro il rapporto del robot, e uno che
// lancia farebbe fallire una passata da quattro dollari per una tabella.
ok(typeof leggiGuasti === "function", "il lettore dei guasti è riusabile fuori dal comando (rapporto del robot)");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Ogni esito ha la sua frase, il fallimento non si nasconde dietro un successo,\n  e «non posso vederle» non si legge come «non ci sono».\n");
