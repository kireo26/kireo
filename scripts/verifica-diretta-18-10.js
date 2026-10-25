#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA DIRETTA DEL 18/10 È FALLITA, e questa guardia tiene ferme le tre cure che
// non dipendono da una sessione vera:
//   §1 un evento IN CORSO è un evento prossimo (l'Agenda lo metteva fra i
//      passati, dove non c'è nessun «Entra»);
//   §2 chi trasmette sa quanti non vedono il video, e la console riprova la
//      sonda finché la diretta è viva;
//   §3 la finestra si sposta dal prodotto, e i testi dicono la cosa vera;
//   §4 il riquadro semplice (script di YouTube non caricato) NON conta come
//      video partito, lo studente lo legge, e ogni volta si conta;
//   §5 «Iscriviti» torna a diretta in corso, come «Iscriviti ed entra».
// Le metà SQL stanno in `scripts/verifica-player-e-finestra.sql`.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");
const { ancora, creaFetta } = require("./lib/ancora");

abilitaTypeScript();
const { eventoNonFinito } = require("@/lib/app/eventi");
const { rigaPlayerRotti } = require("@/lib/eventi/videoDiretta");
const { messaggioSpostaFinestra } = require("@/lib/eventi/spostaFinestra");
const { istanteDaOrarioItaliano, orarioItalianoDaIstante } = require("@/lib/formato");
const P = require("@/lib/live/presenza");
const L = require("@/lib/live");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let fatte = 0;
let falliti = 0;
function ok(cond, testo, dettaglio = "") {
  fatte++;
  console.log(`  ${cond ? "✓" : "✗"} ${testo}${!cond && dettaglio ? ` — ${dettaglio}` : ""}`);
  if (!cond) falliti++;
}
const leggi = (f) => senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));

console.log("\n§1 — un evento in corso è un evento prossimo\n");
{
  // Il caso vero: diretta 17:00 → 17:45 (ora di Roma, 15:00 → 15:45 UTC), Agenda aperta alle 17:07.
  const ev = { data_inizio: "2026-10-18T15:00:00Z", data_fine: "2026-10-18T15:45:00Z" };
  ok(eventoNonFinito(ev, new Date("2026-10-18T15:07:00Z")), "alle 17:07 la diretta delle 17:00 NON è finita (il 18/10 finiva fra i passati)");
  ok(eventoNonFinito(ev, new Date("2026-10-18T14:00:00Z")), "prima dell'inizio è prossima, come prima");
  ok(!eventoNonFinito(ev, new Date("2026-10-18T15:45:00Z")), "alla fine esatta è finita (stesso confine di `statoDiretta`)");
  const senzaFine = { data_inizio: "2026-10-18T15:00:00Z", data_fine: null };
  ok(eventoNonFinito(senzaFine, new Date("2026-10-18T17:59:00Z")), "senza data di fine valgono le tre ore di `fineDiretta`");
  ok(!eventoNonFinito(senzaFine, new Date("2026-10-18T18:00:00Z")), "…e dopo tre ore è finito");

  for (const f of ["lib/app/eventi.ts", "lib/docente/eventi.ts"]) {
    const src = leggi(f);
    ok(!/\.gte\("data_inizio", new Date\(\)\.toISOString\(\)\)/.test(src), `${f}: nessuna lista «prossimi» divisa sull'INIZIO`);
    ok(/!eventoNonFinito\(/.test(src), `${f}: i passati escludono quelli ancora in corso`);
  }
  ok(/eventoNonFinito\(e\)/.test(leggi("app/aree/[slug]/page.tsx")), "anche la pagina di un'area tiene gli eventi in corso");
}

console.log("\n§2 — chi trasmette sa quanti non vedono\n");
{
  ok(rigaPlayerRotti(null) === null, "«non lo so» tace: non diventa uno zero");
  ok(rigaPlayerRotti(0) === null, "zero tace: non serve un riquadro rosso per la notizia buona");
  const r = rigaPlayerRotti(3);
  ok(typeof r === "string" && /: 3\.$/.test(r), "il numero sta in fondo, nella forma «etichetta: numero» (nessun accordo da sbagliare)", String(r));
  const r1 = rigaPlayerRotti(1);
  ok(typeof r1 === "string" && r1.replace(/\d+/g, "#") === r.replace(/\d+/g, "#"), "uno e tre danno la stessa frase con una cifra diversa");

  const console_ = leggi("components/ente/ControlloDirettaEvento.tsx");
  ok(/rpc\("conteggio_player_rotti_live"/.test(console_), "la console legge il conteggio dei player rotti");
  ok(/rigaPlayerRotti\(rotti\)/.test(console_), "…e lo rende con la riga condivisa");
  ok(/role="alert"/.test(console_), "…in un riquadro che un lettore di schermo annuncia");
  ok(/useSondaIncorporamento\(finestraAperta \? youtubeVideoId : null, giroSonda\)/.test(console_), "la console rifà la sonda mentre la finestra della diretta è aperta");
  ok(/setGiroSonda\(\(g\) => g \+ 1\)/.test(console_), "…a giri, non una volta sola");
  // La lettura dei rotti non entra nel giro della freschezza: un suo guasto non
  // deve far dichiarare stantii i presenti.
  ok(!/const andata = [^;]*Rotti/.test(console_), "un guasto della lettura dei rotti non degrada i presenti");

  const pagine = ["app/diretta/[id]/page.tsx", "app/admin/page.tsx", "app/ente/(dashboard)/eventi/page.tsx"];
  for (const f of pagine) ok(/youtubeVideoId=\{/.test(leggi(f)), `${f}: la console riceve il video da riprovare`);
}

console.log("\n§3 — la finestra si sposta dal prodotto\n");
{
  const pagina = leggi("app/diretta/[id]/page.tsx");
  ok(/<SpostaFinestraForm/.test(pagina), "la pagina della diretta ha il form per spostare l'orario");
  ok(/!evento\.diretta_chiusa_il && \(/.test(pagina), "…e non lo mostra a diretta chiusa");
  const form = leggi("components/ente/SpostaFinestraForm.tsx");
  ok(/rpc\("sposta_finestra_evento"/.test(form), "il form passa dalla funzione (non da un update che l'ente non può fare)");
  ok(/istanteDaOrarioItaliano\(inizio\)/.test(form) && /istanteDaOrarioItaliano\(fine\)/.test(form), "gli orari si scrivono in ora italiana");
  ok(/orarioItalianoDaIstante\(dataInizio\)/.test(form), "…e si leggono in ora italiana");
  // L'andata e ritorno: quello che il campo mostra torna all'istante di partenza.
  const iso = "2026-10-18T15:20:00.000Z";
  ok(orarioItalianoDaIstante(iso) === "2026-10-18T17:20", "le 15:20 UTC si mostrano 17:20 (ora di Roma)", orarioItalianoDaIstante(iso));
  ok(istanteDaOrarioItaliano(orarioItalianoDaIstante(iso)) === iso, "andata e ritorno tornano allo stesso istante");
  ok(/non riceve nessun avviso/.test(messaggioSpostaFinestra(null)), "il successo dice quello che NON facciamo: avvisare gli iscritti");
  ok(/già stata chiusa/.test(messaggioSpostaFinestra("diretta_gia_chiusa")), "a diretta chiusa il no dice perché");
  ok(/problema nostro/.test(messaggioSpostaFinestra("qualcosa di inatteso")), "ciò che non riconosciamo è un guasto nostro, non un dato sbagliato");
}

console.log("\n§4 — la presenza comincia quando il video parte (18/10 sera)\n");
{
  ok(!P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: false, finito: false, pausaLunga: false }), "video mai partito: non si conta niente (i venti minuti neri del 18/10)");
  ok(P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: true, finito: false, pausaLunga: false }), "partito una volta: si conta, anche durante pause e caricamenti brevi");
  // 25/10 sera: una pausa oltre la tolleranza non conta (osservato in `npm run test:pausa`).
  ok(!P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: true, finito: false, pausaLunga: true }), "fermo oltre la tolleranza: non conta");
  ok(!P.pausaLunga(1000, 1000 + P.MS_PAUSA_TOLLERATA - 1) && P.pausaLunga(1000, 1000 + P.MS_PAUSA_TOLLERATA), "la tolleranza ha un confine esatto");
  ok(!P.pausaLunga(null, 1e12), "un video che non si è mai fermato non è in pausa");
  ok(P.causaFermo({ avviato: false, videoRotto: false, pausaLunga: true }) === "non_avviato", "mai partito resta «non avviato» anche se fermo");
  ok(P.causaFermo({ avviato: true, videoRotto: true, pausaLunga: true }) === "video_non_visibile", "un video rotto non si sente dire «riprendi la riproduzione»");
  ok(P.causaFermo({ avviato: true, videoRotto: false, pausaLunga: true }) === "in_pausa", "fermo oltre la tolleranza: «in pausa»");
  ok(P.testoContatore(4, 15, false, "in_pausa") === "Presente da 4 minuti. Il video è fermo, quindi la presenza non sta avanzando: riprendi la riproduzione per farla ripartire.", "il testo della pausa è quello di Mario, parola per parola, col numero dei minuti (25/10 pomeriggio)");
  ok(!P.presenzaConta({ inDiretta: true, videoRotto: true, avviato: true, finito: false, pausaLunga: false }), "l'errore ferma tutto, come prima");
  ok(!P.presenzaConta({ inDiretta: false, videoRotto: false, avviato: true, finito: false, pausaLunga: false }), "fuori dalla diretta niente, come prima");

  // La soglia: specchio di ping_attesi_evento × 0,75.
  ok(P.minutiNecessari("2026-10-18T15:00:00Z", "2026-10-18T15:45:00Z") === 34, "45 minuti → 34 per il riconoscimento (0,75 × 45 = 33,75)");
  ok(P.minutiNecessari("2026-10-18T15:00:00Z", "2026-10-18T15:40:00Z") === 30, "40 minuti → 30 esatti (nessun arrotondamento spurio)");
  ok(P.minutiNecessari("2026-10-18T15:00:00Z", null) === null, "senza fine non si calcola");

  ok(P.testoContatore(12, 34, true, "non_avviato") === "Presente da 12 minuti. Per il riconoscimento ne servono 34.", "sotto soglia: il testo di Mario", P.testoContatore(12, 34, true, "non_avviato"));
  ok(P.testoContatore(1, 1, true, "non_avviato").startsWith("Hai raggiunto"), "alla soglia esatta: raggiunta");
  ok(!/garant/i.test(P.testoContatore(40, 34, true, "non_avviato")) && /chiude la diretta/.test(P.testoContatore(40, 34, true, "non_avviato")), "raggiunta NON promette le ore: nomina la condizione che manca");
  ok(P.testoContatore(12, 34, false, "video_non_visibile") === "Il conteggio è fermo a 12 minuti: finché il video non si vede, la presenza non avanza.", "fermo: dice a quanto è fermo");
  ok(/1 minuto\b/.test(P.testoContatore(1, 34, true, "non_avviato")) && !/1 minuti/.test(P.testoContatore(1, 34, false, "non_avviato")), "un minuto al singolare");

  ok(P.testoRientro({ minutiFuori: 0, direttaFinita: false, riprende: true }) === null, "sotto il minuto non si dice niente");
  const dentro = P.testoRientro({ minutiFuori: 6, direttaFinita: false, riprende: true });
  ok(/6 minuti/.test(dentro) && /Adesso riprende\.$/.test(dentro), "diretta ancora in corso: quanti minuti persi, e che riprende", dentro);
  ok(!/riprende/.test(P.testoRientro({ minutiFuori: 6, direttaFinita: false, riprende: false })), "«Adesso riprende» solo se è vero");
  const finita = P.testoRientro({ minutiFuori: 6, direttaFinita: true, riprende: false });
  ok(finita === "Mentre eri fuori la diretta è finita. Gli ultimi 6 minuti non sono stati contati.", "diretta finita nel mentre: il testo di Mario, e nessun rimedio inesistente", finita);

  // ⚠️ Nessuna frase accordata al genere di chi legge (KIREO non lo sa).
  const tutti = [
    P.testoContatore(12, 34, true, "non_avviato"), P.testoContatore(40, 34, true, "non_avviato"), P.testoContatore(12, 34, false, "video_non_visibile"), P.testoContatore(12, 34, false, "non_avviato"),
    dentro, finita, P.testoRientro({ minutiFuori: 1, direttaFinita: false, riprende: true }),
    P.AVVISO_PLAYER, P.AVVISO_PLAYER_TELEFONO,
  ];
  const accordi = tutti.flatMap((t) => trovaAccordi(t));
  ok(accordi.length === 0, "nessun participio accordato col genere di chi legge", accordi.join(", "));
  ok(tutti.length === 9, "la lista dei testi controllati ne ha nove: sotto, il controllo non sta guardando");

  const pannello = leggi("components/live/PannelloLive.tsx");
  ok(/onAvvio=\{segnaAvvio\}/.test(pannello), "il pannello ascolta il primo avvio del video");
  ok(/testoContatore\(contati, necessari, contaLaPresenza, causaFermo\(\{ avviato, videoRotto: !presenzaDaContare\(esitoPlayer\), pausaLunga: inPausaLunga \}\)\)/.test(pannello), "lo studente vede il contatore");
  ok(/visibilitychange/.test(pannello) && /setRientro\(testoRientro/.test(pannello), "al rientro gli si dice cosa ha perso");
  ok(/\{AVVISO_PLAYER\}/.test(pannello) && /sm:hidden">\{AVVISO_PLAYER_TELEFONO\}/.test(pannello), "l'avviso sopra il player, e la riga in più solo sul telefono");
  const player = leggi("components/live/PlayerDiretta.tsx");
  ok(/e\.data === 1\) onAvvioRef\.current/.test(player), "il player dice «partito» sullo stato in riproduzione");
}

console.log("\n§4 — il riquadro semplice non conta come video partito (Mario, 18/10)\n");
{
  const player = leggi("components/live/PlayerDiretta.tsx");
  const pannello = leggi("components/live/PannelloLive.tsx");
  // ⚠️ La regola rovesciata: fino al 18/10 qui stava «nel ripiego si dichiara
  // partito». Il primo errore (ore PCTO certificate a chi non ha visto niente)
  // è irreversibile e silenzioso; il secondo è reversibile, se la persona lo sa.
  ok(!/onAvvioRef\.current\?\.\(\)[^;]*;\s*\}, \[ripiego\]/.test(player) && !/if \(ripiego\) onAvvioRef/.test(player), "nel ripiego il player NON dichiara il video partito");
  ok(/if \(ripiego\) onRipiegoRef\.current/.test(player), "…dice invece al genitore che siamo nel riquadro semplice");
  ok((player.match(/onAvvioRef\.current\?\.\(\)/g) || []).length === 1, "«partito» ha UNA sola strada: lo stato in riproduzione dell'IFrame API");
  ok(/onRipiego=\{segnaRipiego\}/.test(pannello), "il pannello ascolta il ripiego");
  // …e la condizione senza cui la decisione non vale: dirlo, con la cosa da fare.
  ok(P.TESTO_RIPIEGO === "Non riusciamo a sapere se il video è partito, quindi la presenza non avanza. Ricarica la pagina — e se la stai guardando in una finestra in incognito, riaprila in una normale.", "il testo è quello di Mario, parola per parola");
  ok(/\{ripiego && \(/.test(pannello) && /\{TESTO_RIPIEGO\}/.test(pannello), "lo studente nel ripiego legge la frase");
  // RIESAMINATA il 25/10 sera: la condizione ha guadagnato `!videoFinito` in testa;
  // la proprietà (il contatore non compare nel ripiego) non cambia.
  // e il 26/10 `!chiusaDaOrganizzatore` (la diretta chiusa in anticipo).
  ok(/\{!videoFinito && !ripiego && !sessionePersa && !chiusaDaOrganizzatore && !nonLetto && inDiretta && necessari !== null/.test(pannello), "…al posto del contatore, che direbbe «finché il video non si vede» (qui falso: si vede, non sappiamo se è partito)");
  ok(trovaAccordi(P.TESTO_RIPIEGO).length === 0, "il testo non concorda col genere di chi legge");
  // Il ripiego non accende la presenza per nessuna strada: `avviato` resta falso.
  ok(!P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: false, finito: false, pausaLunga: false }), "senza avvio la presenza non conta — ed è l'unica cosa che il ripiego lascia");
  // E la frequenza si impara: una riga per caricamento di pagina, mai di più.
  ok(/fetch\("\/api\/live\/ripiego"/.test(pannello) && /if \(ripiegoContato\.current\) return;/.test(pannello), "ogni ripiego si conta, una volta per pagina");
  // ⚠️ RIESAMINATA il 25/10: la route del ripiego e quella della fine del video
  // condividono ora `registraMisuraLive` — le proprietà su iscrizione e
  // `di_prova` stanno lì, e ogni route deve passarci con la sua specie.
  const route = leggi("app/api/live/ripiego/route.ts");
  const misura = leggi("lib/live/misuraLive.ts");
  ok(/specie: "misura_avvio_video"/.test(route) && /registraMisuraLive\(/.test(route), "…in `guasti`, con una specie sua, passando dalla misura condivisa");
  ok(/from\("iscrizioni_eventi"\)/.test(misura) && /motivo: "non_iscritto"/.test(misura), "…solo per chi è iscritto all'evento: la riga conta studenti davanti a una diretta");
  ok(/diProva: profilo\?\.di_prova === true/.test(misura), "…e separa il robot dagli studenti veri");

  // L'EVENTO DI FINE, REGISTRATO (Mario, 25/10): se il segnale non arriva la
  // presenza degrada al comportamento di prima in silenzio — la riga è l'unica
  // cosa che distingue «si è fermata alla fine» da «non abbiamo mai saputo».
  const fine = leggi("app/api/live/fine-video/route.ts");
  ok(/specie: "misura_fine_video"/.test(fine) && /registraMisuraLive\(/.test(fine), "la fine del video si registra, con una specie sua e la stessa misura condivisa");
  ok(/rispettoAllaFine\(/.test(fine), "…e dice quanto prima o dopo la fine programmata è arrivata");
  ok(/fetch\("\/api\/live\/fine-video"/.test(pannello) && /if \(fineContata\.current\) return;/.test(pannello), "il pannello la registra quando il player dice «finito», una volta per pagina");
  const fineEsatta = new Date("2026-10-25T07:25:00Z");
  ok(P.rispettoAllaFine("2026-10-25T07:25:00Z", fineEsatta) === "alla fine programmata", "alla fine: «alla fine programmata»");
  ok(P.rispettoAllaFine("2026-10-25T07:25:00Z", new Date("2026-10-25T07:13:00Z")) === "12 min prima della fine programmata", "dodici minuti prima", P.rispettoAllaFine("2026-10-25T07:25:00Z", new Date("2026-10-25T07:13:00Z")));
  ok(P.rispettoAllaFine("2026-10-25T07:25:00Z", new Date("2026-10-25T07:28:00Z")) === "3 min dopo la fine programmata", "tre minuti dopo");
  ok(P.rispettoAllaFine(null, fineEsatta) === "l'incontro non ha un orario di fine", "senza fine: lo dice, non inventa un numero");
  // Nota 3: «Adesso riprende» solo se il conteggio riparte davvero — nel
  // ripiego non riparte, e `riprende` nasce da `contaRef`, cioè da `contaLaPresenza`.
  ok(/riprende: !finita && contaRef\.current/.test(pannello), "«Adesso riprende» nasce dal conteggio vero, non da una speranza");
}

console.log("\n§5 — «Iscriviti» torna mentre la diretta è in corso (Mario, 18/10)\n");
{
  const ev = ["2026-10-18T15:00:00Z", "2026-10-18T15:45:00Z"];
  const a = (iso) => new Date(iso);
  ok(L.faseIscrizione(...ev, a("2026-10-18T14:50:00Z")) === "prima", "dieci minuti prima: «prima» (nel pre-roll l'evento non è cominciato)");
  ok(L.faseIscrizione(...ev, a("2026-10-18T15:00:00Z")) === "in_corso", "all'inizio esatto: in corso");
  ok(L.faseIscrizione(...ev, a("2026-10-18T15:03:00Z")) === "in_corso", "alle 17:03: in corso — iscriversi è la porta");
  ok(L.faseIscrizione(...ev, a("2026-10-18T15:45:00Z")) === "finita", "alla fine esatta: finita (stesso confine di `eventoNonFinito`)");
  ok(L.faseIscrizione("2026-10-18T15:00:00Z", null, a("2026-10-18T17:59:00Z")) === "in_corso" && L.faseIscrizione("2026-10-18T15:00:00Z", null, a("2026-10-18T18:00:00Z")) === "finita", "senza fine: tre ore, come `fineDiretta`");
  // La stessa fine di `eventoNonFinito`: due confini diversi sono due Agende diverse.
  for (const t of ["2026-10-18T15:44:59Z", "2026-10-18T15:45:00Z", "2026-10-18T14:00:00Z"]) {
    const coincide = (L.faseIscrizione(...ev, a(t)) !== "finita") === eventoNonFinito({ data_inizio: ev[0], data_fine: ev[1] }, a(t));
    ok(coincide, `«non finita» coincide con \`eventoNonFinito\` alle ${t}`);
  }
  ok(L.ETICHETTA_ISCRIVITI_ED_ENTRA === "Iscriviti ed entra" && L.ETICHETTA_ISCRIVITI === "Iscriviti", "le due etichette di Mario");

  const card = leggi("components/app/CardEvento.tsx");
  // RIESAMINATA il 25/10 pomeriggio: la fase si decide sulla fine EFFETTIVA
  // (`fineEffettiva`, `npm run test:fine`). La proprietà non cambia.
  ok(
    /const fine = fineEffettiva\(evento\.data_inizio, evento\.data_fine, evento\.diretta_chiusa_il\)/.test(card) &&
      /faseIscrizione\(evento\.data_inizio, fine\)/.test(card),
    "la card dello studente decide sulla fase (sulla fine effettiva)",
  );
  ok(/fase === "in_corso" && evento\.tipo === "webinar" && !iscritto \? \(/.test(card), "a diretta in corso, a chi non è iscritto, un bottone — solo per un webinar, dove c'è una diretta in cui entrare");
  const { fettaOppureRosso, dentro } = creaFetta(ok);
  const ramoInCorso = fettaOppureRosso(card, { nome: 'fase === "in_corso"' }, { nome: ") : null;", volte: 2, quale: 0 }, "ramo in corso della card");
  ok(dentro(ramoInCorso, "entraHref={hrefDiretta}"), "…ed è «Iscriviti ed entra»: porta alla diretta in un gesto solo");
  ok(!/fase === "finita" \? \(/.test(card), "a evento finito niente, come prima");
  const bottone = leggi("components/app/IscrivitiEventoButton.tsx");
  ok(/if \(entraHref\) \{\s*router\.push\(entraHref\);\s*return;/.test(bottone), "iscritti, si entra: nessun secondo bottone da cercare");
  let dopo = false;
  try {
    dopo = ancora(bottone, "router.push(entraHref)", { dove: "bottone" }) > ancora(bottone, "setIscritto(true)", { dove: "bottone" });
  } catch (e) {
    console.log(`    ${e.message}`);
  }
  ok(dopo, "…e solo DOPO che l'iscrizione è riuscita (entrare senza iscrizione porterebbe a «non risulti iscritto»)");
  ok(/setErrore\(true\)/.test(bottone), "un'iscrizione che non riesce lo dice, invece di lasciare di nuovo una card muta");
  const docente = leggi("components/docente/CardWebinarDocente.tsx");
  ok(/faseIscrizione\(/.test(docente) && /entraHref=\{hrefDiretta\}/.test(docente) && /fase === "prima"/.test(docente), "lo stesso nell'area docente (dove fino al 18/10 «Iscriviti» compariva anche su un webinar finito)");
}


console.log("\n§6 — il battito respinto e il contatore che scendeva (25/10)\n");
{
  ok(P.testoContatore(0, 34, false, "non_avviato") === "Il conteggio è fermo a 0 minuti: la presenza comincia quando avvii il video.", "non avviato: il testo di Mario, che non dice «finché il video non si vede» a chi lo vede");
  ok(P.testoContatore(0, 34, false, "video_non_visibile") !== P.testoContatore(0, 34, false, "non_avviato"), "le due cause del fermo dicono due cose");
  const pannelloV = leggi("components/live/PannelloLive.tsx");
  ok(!/testoContatore\([^)]*\)/.test(pannelloV.replace(/testoContatore\(contati, necessari, contaLaPresenza, causaFermo\(\{ avviato, videoRotto: !presenzaDaContare\(esitoPlayer\), pausaLunga: inPausaLunga \}\)\)/, "")), "una sola chiamata, con la causa");
  // Gli esiti del battito.
  ok(P.esitoBattito(401, { ok: false }) === "sessione_persa", "401: sessione persa");
  ok(P.esitoBattito(200, { ok: true }) === "ok", "200 ok:true: riuscito");
  ok(P.esitoBattito(200, { ok: false, motivo: "x" }) === "rifiutato", "200 ok:false: rifiutato (prima era indistinguibile da un riuscito)");
  ok(P.esitoBattito(500, null) === "rifiutato" && P.esitoBattito(200, null) === "rifiutato", "un corpo illeggibile non è un riuscito");
  ok(P.esitoBattito(null, null) === "rete", "nessuna risposta: rete");
  // La lettura: non scende, e non scrive zero quando non ha letto.
  const L1 = (o) => P.letturaPresenza({ dato: null, errore: false, precedente: null, battitoRiuscito: false, ...o });
  ok(L1({}).tipo === "valore" && L1({}).minuti === 0, "prima di ogni battito, nessuna riga: zero è vero");
  ok(L1({ battitoRiuscito: true }).tipo === "non_letto", "dopo un battito riuscito, nessuna riga: non letto (è una lettura senza sessione)");
  ok(L1({ precedente: 4 }).tipo === "non_letto", "il 25/10: da 4 a nessuna riga non è «0 minuti»");
  ok(L1({ dato: 2, precedente: 4 }).tipo === "non_letto", "un valore che scende non viene dalla presenza salvata");
  ok(L1({ dato: 4, errore: true, precedente: 3 }).tipo === "non_letto", "un errore non è un valore");
  ok(L1({ dato: 5, precedente: 4 }).minuti === 5, "un valore che sale si scrive");
  ok(/setNonLetto\(l\.tipo === "non_letto"\)/.test(pannelloV) && !/ping_totali \?\? 0/.test(pannelloV), "la pagina passa dalla lettura, e non riempie più il buco con zero");
  // L'hook legge la risposta, e non smette di battere su un fallimento.
  const hook = senzaCommenti(leggi("lib/useHeartbeatDiretta.ts"));
  ok(/esitoBattito\(status, corpo\)/.test(hook) && /setInterval\(ping, 60000\)/.test(hook), "l'hook legge l'esito e il ciclo resta un intervallo indipendente dall'await");
  ok(/const battito = useHeartbeatDiretta\(/.test(pannelloV), "il pannello riceve l'esito");
  ok(/\{sessionePersa && \(/.test(pannelloV) && /TESTO_SESSIONE_PERSA/.test(pannelloV) && /\/accedi\?redirectedFrom=/.test(pannelloV), "la sessione persa si dice, con il link per rifare l'accesso");
  ok(/contaLaPresenza && !sessionePersa && contati === null/.test(pannelloV), "«presenza in rilevamento» non si dice a sessione persa");
  for (const t of [P.TESTO_SESSIONE_PERSA, P.TESTO_BATTITO_RIFIUTATO, P.TESTO_CONTEGGIO_NON_LETTO, P.testoVideoFinito(28, 34), ...Object.values(P.TESTO_RIFIUTO_DOMANDA)]) {
    ok(trovaAccordi(t).length === 0, `nessun accordo di genere: «${t.slice(0, 40)}…»`);
  }
  // La domanda rifiutata: quattro cause (25/10 sera: «non ammessa» erano due).
  const C = (o) => P.causaRifiutoDomanda({ codice: "42501", sessioneViva: true, direttaAperta: true, ...o });
  ok(C({ sessioneViva: false }) === "sessione_persa", "RLS senza sessione: sessione persa");
  ok(C({ direttaAperta: false }) === "fuori_diretta", "RLS con sessione, diretta chiusa: fuori dalla diretta");
  ok(C({}) === "non_iscritto", "RLS con sessione, diretta aperta: manca l'iscrizione");
  ok(C({ codice: "XX000" }) === "guasto", "il resto è nostro");
  ok(C({ codice: "XX000", direttaAperta: false }) === "guasto", "un guasto nostro resta nostro anche a diretta chiusa");
  ok(new Set(Object.values(P.TESTO_RIFIUTO_DOMANDA)).size === 4, "quattro cause, quattro testi");
  ok(P.TESTO_RIFIUTO_DOMANDA.fuori_diretta.includes(`${L.ORE_FINESTRA_CONSEGNA} ore`), "le ore della consegna vengono dalla costante, non da una copia");
  ok(/non tuo/.test(P.TESTO_RIFIUTO_DOMANDA.guasto), "il guasto dice «non tuo»");
  ok(/I minuti già contati restano/.test(P.TESTO_SESSIONE_PERSA) && /I minuti già contati restano/.test(P.TESTO_BATTITO_RIFIUTATO), "sessione persa e battito rifiutato dicono che i minuti restano");
  ok(!/registrat/.test(P.TESTO_CONTEGGIO_NON_LETTO), "il conteggio non letto non promette una registrazione che non sappiamo");
  const box = senzaCommenti(leggi("components/live/BoxDomandeLive.tsx"));
  ok(!/Non è stato possibile inviare la domanda\. Riprova/.test(box) && /causaRifiutoDomanda\(/.test(box), "il rifiuto generico è uscito");
  ok(/direttaAperta: statoDiretta\(dataInizio, dataFine, new Date\(\)\)/.test(box), "se la diretta è aperta lo dice l'orologio del rifiuto");
  // «il testo resta qui» è vero: la bozza si salva prima del rientro e torna.
  ok(/if \(c === "sessione_persa"\) scriviBozza\(eventoId, testo\.trim\(\)\)/.test(box) && /leggiBozza\(eventoId\)/.test(box), "la bozza sopravvive al rientro");
  ok(/scriviBozza\(eventoId, null\)/.test(box), "e si cancella quando la domanda arriva");
  ok(/causa === "sessione_persa"/.test(box) && /\/accedi\?redirectedFrom=/.test(box), "il rifiuto per sessione persa porta il link per rientrare");
  // LA PRESENZA FINISCE QUANDO IL VIDEO FINISCE (25/10 sera).
  ok(P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: true, finito: false, pausaLunga: false }), "partito e non finito: conta");
  ok(!P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: true, finito: true, pausaLunga: false }), "finito: non conta più");
  ok(P.testoVideoFinito(28, 34) === "La diretta è finita. La tua presenza si è fermata a 28 minuti.", "il testo di Mario, parola per parola");
  ok(P.testoVideoFinito(null, 34) === "La diretta è finita.", "senza un numero letto non si dice un numero");
  ok(P.testoVideoFinito(1, 34).includes("1 minuto."), "un minuto al singolare");
  ok(/Le ore vengono riconosciute/.test(P.testoVideoFinito(40, 34)), "a soglia raggiunta resta la condizione che manca");
  const player = senzaCommenti(leggi("components/live/PlayerDiretta.tsx"));
  ok(/e\.data === 0\) onFineRef\.current/.test(player), "il player ascolta lo stato 0");
  ok(/finito: videoFinito/.test(pannelloV) && /onFine=\{segnaFine\}/.test(pannelloV), "il pannello passa la fine alla regola");
  ok(/testoVideoFinito\(nonLetto \? null : contati/.test(pannelloV), "un conteggio non letto non diventa il numero della fine");
  // L'AVVISO DEL RIENTRO SE NE VA (25/10 sera).
  ok(/if \(!rientro \|\| !contaLaPresenza\) return;/.test(pannelloV) && /setTimeout\(\(\) => setRientro\(null\), MS_DURATA_AVVISO_RIENTRO\)/.test(pannelloV), "l'avviso sparisce dopo qualche minuto di conteggio ripreso");
  ok(P.MS_DURATA_AVVISO_RIENTRO >= 60000 && P.MS_DURATA_AVVISO_RIENTRO <= 10 * 60000, "e la durata sta fra uno e dieci minuti");
  const route = leggi("app/api/live/ping/route.ts");
  ok(/battito senza sessione/.test(route) && /battito rifiutato/.test(route), "la route lascia una riga sui rifiuti inattesi");
}

console.log("\n§ il riquadro prima dell'inizio non è un allarme (26/10)");
{
  const pannello = leggi("components/live/PannelloLive.tsx");
  // Il colore è un testo: la cornice rossa resta per il video rotto DOPO
  // l'inizio, e prima dell'inizio prende il tono neutro del «Comincia alle…».
  const fetta = creaFetta(ok).fettaOppureRosso(pannello, { nome: "{videoRotto && (" }, { nome: "riquadroRotto.titolo" }, "il riquadro del video");
  ok(fetta !== null && /primaDellInizio \? "border-white\/5 bg-kireo-card" : "border-red-500\/30 bg-red-500\/5"/.test(fetta), "prima dell'inizio: tono neutro; dopo: rosso");
  ok(/const primaDellInizio = erroreVideoPrimaDellInizio\(dataInizio, ora\.getTime\(\)\)/.test(pannello), "…deciso dalla stessa condizione che sceglie il testo");
  ok(P.erroreVideoPrimaDellInizio("2026-10-25T10:00:00Z", Date.parse("2026-10-25T09:59:00Z")) === true && P.erroreVideoPrimaDellInizio("2026-10-25T10:00:00Z", Date.parse("2026-10-25T10:00:00Z")) === false, "«prima dell'inizio» finisce all'orario di inizio");
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà verificate`);
process.exit(falliti === 0 ? 0 : 1);
