// La sonda dell'incorporamento e la chiave di trasmissione: le proprietà che
// si possono provare senza rete e senza browser.
//
// PERCHÉ ESISTE. Il 4/10 una classe ha aperto la pagina di una diretta e al
// posto del video ha letto «La riproduzione su altri siti web è stata
// disattivata dal proprietario del video». Il prodotto aveva registrato
// «verificato» perché l'ente aveva spuntato una casella — una cosa scritta da
// un terzo, trattata come un fatto nostro. Da oggi quella cosa si misura, e
// dove la misura risponde la casella non c'è più.
//
// LE TRE PROPRIETÀ CHE QUESTO FILE TIENE FERME, e sono decisioni, non
// dettagli:
//   1. una DICHIARAZIONE e una MISURA non stanno mai insieme a schermo — la
//      prima volta che divergessero nessuno saprebbe a quale credere;
//   2. `non_controllato` non è `attivo` e non è `rotto`: è «non ho guardato»,
//      e non apre niente né ferma niente;
//   3. se il video non si riproduce, LA PRESENZA NON SI CONTA. Quei ping
//      diventano ore PCTO: meglio un evento senza presenze di un registro di
//      presenze finte.
//
// Quello che questo file NON può provare — e nessuno ancora lo ha visto — è
// che la sonda RISPONDA davvero su un video YouTube reale, in particolare su
// una diretta programmata non ancora iniziata. Serve un browser e la rete
// verso YouTube. È la ragione per cui la casella non è stata rimossa in
// assoluto ma solo dove la misura c'è.
//
// Esecuzione: `npm run test:sonda`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti, senzaCommentiSql } = require("./lib/senza-commenti");

abilitaTypeScript();

const {
  esitoDaCodiceErrore,
  sondaBlocca,
  serveDichiarazioneIncorporamento,
  presenzaDaContare,
  testoSonda,
  TESTO_DIRETTA_ROTTA,
  MS_ATTESA_SONDA,
} = require("@/lib/sondaYoutube");
const { statoChiaveTrasmissione, testoChiaveTrasmissione } = require("@/lib/eventi/chiaveTrasmissione");
const { ETICHETTA_TIPO, LINK_TIPO } = require("@/lib/notifiche/etichette");

let falliti = 0;
function ok(cond, testo) {
  console.log(`  ${cond ? "✓" : "✗"} ${testo}`);
  if (!cond) falliti++;
}

const leggi = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
// Le ancore di FRASE su una copia con gli spazi normalizzati: un a-capo del
// formattatore non è un cambio di contenuto (lezione del 28/09).
const frasiDi = (src) => src.replace(/\s+/g, " ");

// =====================================================================
console.log("\n§1 — la mappa dei codici di errore");
// =====================================================================

ok(esitoDaCodiceErrore(101) === "incorporamento_disattivato", "101 → incorporamento disattivato");
ok(esitoDaCodiceErrore(150) === "incorporamento_disattivato", "150 → incorporamento disattivato (è 101 travestito)");
ok(esitoDaCodiceErrore(100) === "non_disponibile", "100 (rimosso o privato) → non disponibile");
ok(esitoDaCodiceErrore(2) === "non_disponibile", "2 (id non valido) → non disponibile");
ok(esitoDaCodiceErrore(5) === "non_disponibile", "5 (non riproducibile) → non disponibile");
// UN CODICE IGNOTO È UNA RISPOSTA, NON UN SILENZIO: il player ha parlato e ha
// detto no. Metterlo fra i «non ho guardato» vorrebbe dire dichiarare di non
// aver guardato una cosa che abbiamo guardato.
ok(esitoDaCodiceErrore(999) === "non_disponibile", "un codice che non riconosciamo resta una risposta, non un silenzio");
ok(esitoDaCodiceErrore(999) !== "non_controllato", "…e in particolare non diventa «non ho guardato»");

// =====================================================================
console.log("\n§2 — cosa blocca, cosa no, e cosa chiede la dichiarazione");
// =====================================================================

ok(sondaBlocca("incorporamento_disattivato"), "l'incorporamento disattivato blocca");
ok(sondaBlocca("non_disponibile"), "un video che non si riproduce blocca");
ok(!sondaBlocca("attivo"), "un video che si riproduce non blocca");
// `non_controllato` NON blocca: rifiutare un link buono perché la nostra
// sonda non si è caricata sarebbe un no dato per un difetto nostro.
ok(!sondaBlocca("non_controllato"), "«non ho guardato» non blocca: sarebbe un no dato per un difetto nostro");

// LA PROPRIETÀ 1, e il suo contrario: la dichiarazione esiste SOLO dove la
// misura manca. Se un giorno comparissero insieme, la prima volta che
// divergono nessuno saprebbe a quale credere.
ok(serveDichiarazioneIncorporamento(null), "sonda mai partita → serve la dichiarazione");
ok(serveDichiarazioneIncorporamento("non_controllato"), "sonda muta → serve la dichiarazione");
ok(!serveDichiarazioneIncorporamento("attivo"), "sonda che ha risposto «attivo» → NESSUNA dichiarazione da chiedere");
ok(!serveDichiarazioneIncorporamento("incorporamento_disattivato"), "sonda bloccante → nessuna dichiarazione (il form rifiuta)");
ok(!serveDichiarazioneIncorporamento("non_disponibile"), "video non disponibile → nessuna dichiarazione (il form rifiuta)");

// =====================================================================
console.log("\n§3 — la presenza non si conta se il video non si vede");
// =====================================================================

ok(presenzaDaContare(null) === true, "nessun errore dal player → la presenza conta");
ok(presenzaDaContare("attivo") === true, "il video si riproduce → la presenza conta");
ok(presenzaDaContare("incorporamento_disattivato") === false, "incorporamento disattivato → NON si conta");
ok(presenzaDaContare("non_disponibile") === false, "video non disponibile → NON si conta");
// Dove non sappiamo si continua a contare: l'alternativa sarebbe togliere una
// presenza vera per un dubbio nostro.
ok(presenzaDaContare("non_controllato") === true, "«non ho guardato» → si continua a contare");

// La regola del conteggio è la stessa di quella del blocco, e non per caso:
// se il video non si vede, non si vede né per l'ente né per lo studente.
const ESITI = ["attivo", "incorporamento_disattivato", "non_disponibile", "non_controllato"];
ok(
  ESITI.every((e) => presenzaDaContare(e) === !sondaBlocca(e)),
  "contare la presenza è l'esatto contrario di bloccare, su tutti e quattro gli esiti",
);

// =====================================================================
console.log("\n§4 — i testi: quattro esiti, quattro referti distinti");
// =====================================================================

const testi = ESITI.map((e) => testoSonda(e));
ok(
  testi.every((t) => t && t.titolo && t.dettaglio && t.tono),
  "ogni esito ha un referto completo",
);
ok(new Set(testi.map((t) => t.titolo)).size === 4, "quattro titoli distinti: due esiti con la stessa frase non si distinguono");
// La frase di Mario, parola per parola: dice la conseguenza invece della
// regola, che è la forma che in questo progetto funziona.
ok(
  testoSonda("incorporamento_disattivato").dettaglio.includes("un riquadro nero al posto di te"),
  "«un riquadro nero al posto di te» resta la frase di Mario, parola per parola",
);
// Il referto del silenzio non deve rassicurare: la risposta comoda è quella
// che nessuno torna a ricontrollare.
ok(
  /non lo sappiamo/i.test(testoSonda("non_controllato").dettaglio),
  "il referto del silenzio dice che non lo sappiamo, non che va bene",
);
ok(testoSonda("non_controllato").tono !== "ok", "…e non ha il tono di una buona notizia");
ok(MS_ATTESA_SONDA >= 5000, "l'attesa è larga: scadere presto produrrebbe un «non ho guardato» che era un «non ho aspettato»");

// Il testo che legge lo studente non dà la colpa a lui e non chiude la pagina.
const frasiRotta = `${TESTO_DIRETTA_ROTTA.titolo} ${TESTO_DIRETTA_ROTTA.dettaglio}`;
ok(/non è colpa tua/i.test(frasiRotta), "allo studente si dice che non è colpa sua");
ok(/domande/i.test(frasiRotta), "…e che quello che può fare lo può fare comunque");
// ⚠️ Nessun accordo col genere di chi legge: KIREO non lo sa e non lo chiede.
ok(
  !/\b(sei|eri|ti sei)\s+\w+(ato|ata|uto|uta|ito|ita)\b/i.test(frasiRotta),
  "nessun participio accordato col genere di chi legge",
);

// =====================================================================
console.log("\n§5 — la sonda è montata dove il link viene incollato");
// =====================================================================

const form = senzaCommenti(leggi("components/ente/CreaEventoForm.tsx"));
ok(/useSondaIncorporamento\(/.test(form), "il form dell'ente monta la sonda");
ok(
  /hostingDiretta === "proprio" \? idYoutube : null/.test(form),
  "…e la fa girare solo sul ramo in cui il video lo fornisce l'ente",
);
// LA SPUNTA ESCE DALL'ELENCO FISSO: se tornasse lì dentro starebbe a schermo
// accanto alla misura, che è la cosa che non deve succedere.
ok(
  !/VOCI_CHECKLIST[\s\S]{0,400}incorporamento_attivo/.test(form),
  "la voce dell'incorporamento NON è nell'elenco fisso della checklist",
);
ok(/serveDichiarazioneIncorporamento\(esitoSonda\)/.test(form), "…compare solo quando la sonda non ha potuto rispondere");
ok(/vociChecklist\.map/.test(form) && !/VOCI_CHECKLIST\.map/.test(form), "il render usa l'elenco calcolato, non quello fisso");
ok(/vociChecklist\.some/.test(form), "…e la validazione chiede solo le voci davvero mostrate");
ok(/sondaBlocca\(esitoSonda\)/.test(form) && /next\.youtubeLink =/.test(form), "un esito bloccante rifiuta, e il no arriva sul campo del link");
// Si registra solo quello che è stato DAVVERO dichiarato.
ok(/for \(const voce of vociChecklist\) checklistDaSalvare/.test(form), "nel jsonb finisce solo quello che era a schermo");
ok(/incorporamento_sonda: usaChecklist \? esitoSonda : null/.test(form), "…e l'esito della misura si salva accanto");

const admin = senzaCommenti(leggi("components/admin/GestisciVideoDirettaForm.tsx"));
ok(/useSondaIncorporamento\(idDigitato\)/.test(admin), "anche il campo dell'admin prova il video (lì la dichiarazione non esisteva proprio)");
ok(/incorporamento_sonda: esitoSonda/.test(admin), "…e registra l'esito, anche quando l'admin impone comunque");
ok(/salva\(true\)/.test(admin), "l'admin può imporre comunque: è l'ultima risorsa, e una sonda che sbaglia non deve bloccarla");
ok(/bloccata &&/.test(admin), "…ma solo dopo un esito bloccante, come gesto esplicito");

// =====================================================================
console.log("\n§6 — il player della diretta e l'heartbeat");
// =====================================================================

const pannello = senzaCommenti(leggi("components/live/PannelloLive.tsx"));
ok(/<PlayerDiretta/.test(pannello), "la pagina della diretta usa il player dell'IFrame API");
ok(!/<iframe/.test(pannello), "…e non più un iframe grezzo, che non diceva niente");
ok(
  /useHeartbeatDiretta\(eventoId, stato === "in_corso" && contaLaPresenza\)/.test(pannello),
  "l'heartbeat si ferma quando il video non si vede",
);
ok(/presenzaDaContare\(esitoPlayer\)/.test(pannello), "…e la regola la decide `presenzaDaContare`, non una condizione riscritta qui");
ok(/contaLaPresenza \?/.test(pannello), "la riga «presenza in rilevamento» non dichiara un rilevamento che abbiamo fermato");
ok(/TESTO_DIRETTA_ROTTA/.test(pannello), "al posto del video compare il nostro testo, non il riquadro nero di YouTube");
ok(/BoxDomandeLive/.test(pannello), "la pagina resta aperta: le domande funzionano comunque");

const player = senzaCommenti(leggi("components/live/PlayerDiretta.tsx"));
ok(/esitoDaCodiceErrore\(e\.data\)/.test(player), "il player traduce il codice di errore con la mappa condivisa");
ok(/ripiego/.test(player) && /<iframe/.test(player), "se l'API non si carica si torna all'iframe: nessuno resta senza video");
ok(/document\.createElement\("div"\)/.test(player), "l'API sostituisce un figlio usa e getta, non il nodo che React possiede");

// =====================================================================
console.log("\n§7 — i tre momenti della chiave di trasmissione");
// =====================================================================

const DOMANI = { dataInizio: "2026-12-01T14:00:00Z", dataFine: "2026-12-01T15:00:00Z" };
const IERI = { dataInizio: "2026-01-01T14:00:00Z", dataFine: "2026-01-01T15:00:00Z" };

ok(statoChiaveTrasmissione({ haChiave: true, ...DOMANI }) === "pronta", "la chiave c'è → pronta");
ok(statoChiaveTrasmissione({ haChiave: false, ...DOMANI }) === "non_preparata", "non c'è e la diretta non è passata → non ancora preparata");
// IL QUARTO MOMENTO, quello che nessuno chiede: la diretta è passata e la
// chiave non è mai arrivata. Senza questo ramo l'ente leggerebbe per sempre
// «non è ancora stata preparata» su un evento che non si può più trasmettere
// — la stessa frase per un'attesa e per una cosa che non succederà mai.
ok(statoChiaveTrasmissione({ haChiave: false, ...IERI }) === "mai_arrivata", "non c'è e la diretta è passata → non è mai arrivata");
ok(statoChiaveTrasmissione({ haChiave: true, ...IERI }) === "pronta", "una chiave arrivata resta «pronta» anche dopo la diretta");
// Senza data_fine la finestra la calcola `fineDiretta` (tre ore), la stessa
// usata da tutto il resto: non una seconda copia della durata.
ok(
  statoChiaveTrasmissione({ haChiave: false, dataInizio: "2026-01-01T14:00:00Z", dataFine: null }) === "mai_arrivata",
  "senza data di fine si usa la durata di default condivisa, non una copia",
);

const tPronta = testoChiaveTrasmissione("pronta", "2026-10-04T09:00:00Z");
const tAttesa = testoChiaveTrasmissione("non_preparata", null);
const tMai = testoChiaveTrasmissione("mai_arrivata", null);
ok(new Set([tPronta.titolo, tAttesa.titolo, tMai.titolo]).size === 3, "tre momenti, tre frasi distinte");
// UNA CHIAVE VECCHIA CHE RESTA A SCHERMO È PEGGIO DI NESSUNA CHIAVE: il testo
// dice che quella mostrata è l'unica valida.
ok(/unica valida/.test(tPronta.dettaglio), "la chiave pronta dice di essere l'unica valida");
ok(/2026/.test(tPronta.dettaglio), "…e dice quando è stata preparata, così una rotazione si vede");
ok(/non è ancora stata preparata/i.test(tAttesa.titolo), "il buco si dice: «non è ancora stata preparata», non «la riceverai»");
ok(/non devi chiederla/i.test(tAttesa.dettaglio), "…e che arriva da sola, senza che l'ente la chieda");
ok(/non è colpa tua/i.test(tMai.titolo), "se non è arrivata, lo ammettiamo");
ok(tMai.tono === "errore", "…e non lo si racconta come un'attesa");

// =====================================================================
console.log("\n§8 — dove la chiave si legge e dove si scrive");
// =====================================================================

const pagEnte = senzaCommenti(leggi("app/ente/(dashboard)/eventi/page.tsx"));
const frasiEnte = frasiDi(pagEnte);
ok(/<ChiaveTrasmissione/.test(pagEnte), "il pannello dell'ente mostra lo stato della chiave");
ok(/statoChiaveTrasmissione\(/.test(pagEnte), "…chiedendolo alla funzione, invece di ricalcolare la regola");
// LA PROMESSA CHE NON AVEVA NIENTE DIETRO: se torna, torna anche il difetto.
ok(
  !/riceverai la chiave di trasmissione/i.test(frasiEnte),
  "la promessa «riceverai la chiave» non è più l'unica cosa che l'ente legge",
);
ok(/console\.error\("\[ente\/eventi\] chiavi_trasmissione:/.test(pagEnte), "una lettura fallita si logga: muta direbbe «non preparata» su una chiave che c'è");

const pagAdmin = senzaCommenti(leggi("app/admin/page.tsx"));
ok(/<GestisciChiaveTrasmissioneForm/.test(pagAdmin), "l'admin la scrive accanto al video");
ok(/hosting_diretta === "kireo"/.test(pagAdmin), "…solo sugli eventi che trasmette KIREO");
ok(/console\.error\("\[admin\] chiavi_trasmissione:/.test(pagAdmin), "anche qui una lettura fallita si logga");

const formChiave = senzaCommenti(leggi("components/admin/GestisciChiaveTrasmissioneForm.tsx"));
ok(/imposta_chiave_trasmissione/.test(formChiave), "la scrittura passa dalla funzione, che avvisa nella stessa transazione");
// Il valore già impostato non si ri-legge in quel campo: ricaricarlo a
// schermo a ogni apertura della coda admin lo esporrebbe senza che nessuno
// l'abbia chiesto.
// L'ADMIN VEDE CHE C'È E DA QUANDO, NON IL VALORE: ricaricare un segreto a
// schermo a ogni apertura della coda lo esporrebbe senza che nessuno l'abbia
// chiesto. La proprietà è una sola — la `select` della coda admin non chiede
// la colonna `chiave` — e si scrive come una sola: un OR di due negazioni
// può essere vero per il motivo sbagliato.
const selectChiaviAdmin = pagAdmin.match(/from\("chiavi_trasmissione"\)[\s\S]{0,120}?\.select\("([^"]*)"\)/);
ok(selectChiaviAdmin !== null, "la coda admin legge la tabella delle chiavi");
ok(selectChiaviAdmin !== null && !/\bchiave\b/.test(selectChiaviAdmin[1]), `…senza chiedere il valore (${selectChiaviAdmin?.[1] ?? "?"})`);
ok(selectChiaviAdmin !== null && /aggiornata_il/.test(selectChiaviAdmin[1]), "…ma sapendo da quando c'è");

const chiaveTsx = senzaCommenti(leggi("components/ente/ChiaveTrasmissione.tsx"));
ok(/visibile \? chiave : "/.test(chiaveTsx), "all'ente la chiave è nascosta di default: chi va in diretta a volte condivide lo schermo");
ok(/navigator\.clipboard/.test(chiaveTsx), "…con un modo di copiarla senza mostrarla");
ok(/setVisibile\(true\)/.test(chiaveTsx), "e se la clipboard non c'è resta la strada di leggerla: un fallimento non toglie l'unica via");

// =====================================================================
console.log("\n§9 — la migrazione, e il buco che chiude");
// =====================================================================

const sqlSonda = senzaCommentiSql(leggi("supabase/migrations/20261004100000_sonda_incorporamento.sql"));
// ⚠️ UN CHECK PASSA QUANDO VALE NULL. Settima volta che la specie è la stessa,
// prima volta dentro un CHECK invece che dentro un `if`.
ok(/coalesce\(/.test(sqlSonda), "il vincolo è avvolto in un coalesce: un CHECK che vale NULL ACCETTA la riga");
ok(/false\s*\n?\s*\)\s*\n?\s*\);/.test(sqlSonda), "…con `false` come ripiego, non `true`");
ok(/or incorporamento_sonda = 'attivo'/.test(sqlSonda), "la misura basta da sola");
ok(/checklist_diretta \? 'incorporamento_attivo'/.test(sqlSonda), "…e la dichiarazione pure, dove la misura manca");
ok(/incorporamento_sonda text/.test(sqlSonda), "la colonna esiste");
ok(!/check \(incorporamento_sonda in \(/.test(sqlSonda), "nessun CHECK sul dominio: rifiuterebbe un evento invece di un valore");

const sqlChiave = senzaCommentiSql(leggi("supabase/migrations/20261004120000_chiave_trasmissione.sql"));
ok(/is distinct from 'admin'/.test(sqlChiave), "la guardia admin è NULL-safe");
ok(/revoke all on function public\.imposta_chiave_trasmissione\(uuid, text\) from public, anon/.test(sqlChiave), "il permesso è revocato a public e ad anon, nominandoli");
ok(!/for insert|for update|for delete/.test(sqlChiave), "nessuna policy di scrittura: la chiave non si scrive da fuori la funzione");
// LA NOTIFICA PORTA IL FATTO, NON IL SEGRETO.
ok(
  /insert into public\.notifiche_studenti \(student_id, tipo, riferimento_id\)/.test(sqlChiave) && !/p_chiave[\s\S]{0,200}notifiche_studenti/.test(sqlChiave),
  "la notifica porta il fatto e non la chiave",
);
ok(/chiave_trasmissione_cambiata/.test(sqlChiave) && /chiave_trasmissione_pronta/.test(sqlChiave), "due tipi: una rotazione muta farebbe riprovare con la chiave vecchia");
ok(/hosting_non_kireo/.test(sqlChiave), "una chiave del canale KIREO su un evento dell'ente non vuol dire niente");

const sqlEnum = leggi("supabase/migrations/20261004110000_notifica_tipo_chiave.sql");
ok(/alter type public\.notifica_tipo add value/.test(sqlEnum) && !/create table|create function/.test(sqlEnum), "i due valori enum stanno in una migrazione isolata, come vuole Postgres");

// =====================================================================
console.log("\n§10 — la campanella: due liste che nessuno aggiornava insieme");
// =====================================================================

// Fino al 4/10 l'enum aveva sei valori e la campanella quattro etichette: un
// referente scuola che riceveva la risposta a una proposta leggeva il NOME
// GREZZO del valore enum, e il link cadeva su `/app`, cioè l'area studente.
// Vivo da fine luglio.
const migrazioni = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => leggi(path.join("supabase/migrations", f)))
  .join("\n");
const valoriEnum = new Set();
const creazione = migrazioni.match(/create type public\.notifica_tipo as enum \(([^)]*)\)/);
if (creazione) for (const m of creazione[1].matchAll(/'([^']+)'/g)) valoriEnum.add(m[1]);
for (const m of migrazioni.matchAll(/alter type public\.notifica_tipo add value '([^']+)'/g)) valoriEnum.add(m[1]);

ok(valoriEnum.size >= 8, `l'estrattore vede i valori dell'enum (${valoriEnum.size})`);
const senzaEtichetta = [...valoriEnum].filter((v) => !ETICHETTA_TIPO[v]);
ok(senzaEtichetta.length === 0, `ogni tipo ha un'etichetta — altrimenti si legge il nome grezzo (${senzaEtichetta.join(", ") || "nessuno"})`);
const senzaLink = [...valoriEnum].filter((v) => !LINK_TIPO[v]);
ok(senzaLink.length === 0, `ogni tipo ha un link — altrimenti cade su un ripiego, magari nell'area sbagliata (${senzaLink.join(", ") || "nessuno"})`);
const etichetteOrfane = Object.keys(ETICHETTA_TIPO).filter((k) => !valoriEnum.has(k));
ok(etichetteOrfane.length === 0, `nessuna etichetta per un tipo che non esiste (${etichetteOrfane.join(", ") || "nessuna"})`);
// Ogni tipo appartiene a UN ruolo, e il link deve portare nella sua area.
ok(LINK_TIPO.proposta_incontro_risposta.startsWith("/scuola"), "la risposta a una proposta porta nell'area scuola, non in quella studente");
ok(LINK_TIPO.proposta_incontro_ricevuta.startsWith("/ente"), "una proposta ricevuta porta nell'area ente");
ok(LINK_TIPO.chiave_trasmissione_pronta.startsWith("/ente"), "la chiave pronta porta dove la chiave si legge");
ok(new Set(Object.values(ETICHETTA_TIPO)).size === Object.keys(ETICHETTA_TIPO).length, "nessuna etichetta ripetuta: due notifiche con la stessa frase non si distinguono");

// LA CAMPANELLA ERA MONTATA IN DUE SHELL SU TRE. Una riga scritta in un canale
// che nessuno apre non è una notifica, è un dato — e dalla chiave di
// trasmissione quel canale è l'unica strada verso l'ente.
// DUE MONTAGGI, non uno: la sidebar su desktop e l'header su mobile, come
// fanno AppShell e ScuolaShell. Perderne uno è perdere la campanella per
// metà di chi guarda — e una sola asserzione di presenza non lo vedrebbe,
// perché l'altra resterebbe a far passare il controllo.
const enteShell = senzaCommenti(leggi("components/ente/EnteShell.tsx"));
const montaggi = (enteShell.match(/<NotificheBell/g) ?? []).length;
ok(montaggi === 2, `la campanella è montata nell'area ente in tutti e due i posti, sidebar e header mobile (${montaggi})`);
ok(/allineamento="sinistra"/.test(enteShell), "…e nella sidebar da 240px il pannello si apre verso l'interno, altrimenti finisce fuori dalla finestra");
ok(/userId/.test(senzaCommenti(leggi("app/ente/(dashboard)/layout.tsx"))), "il layout le passa l'utente");

// =====================================================================
console.log(`\n${falliti === 0 ? "Tutto verde." : `${falliti} asserzioni rosse.`}`);
process.exit(falliti === 0 ? 0 : 1);
