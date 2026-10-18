#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
// LA DIRETTA DEL 18/10 È FALLITA, e questa guardia tiene ferme le tre cure che
// non dipendono da una sessione vera:
//   §1 un evento IN CORSO è un evento prossimo (l'Agenda lo metteva fra i
//      passati, dove non c'è nessun «Entra»);
//   §2 chi trasmette sa quanti non vedono il video, e la console riprova la
//      sonda finché la diretta è viva;
//   §3 la finestra si sposta dal prodotto, e i testi dicono la cosa vera.
// Le metà SQL stanno in `scripts/verifica-player-e-finestra.sql`.
const fs = require("fs");
const path = require("path");
const { abilitaTypeScript, ROOT } = require("./banco/ts");
const { senzaCommenti } = require("./lib/senza-commenti");

abilitaTypeScript();
const { eventoNonFinito } = require("@/lib/app/eventi");
const { rigaPlayerRotti } = require("@/lib/eventi/videoDiretta");
const { messaggioSpostaFinestra } = require("@/lib/eventi/spostaFinestra");
const { istanteDaOrarioItaliano, orarioItalianoDaIstante } = require("@/lib/formato");
const P = require("@/lib/live/presenza");
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
  ok(!P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: false }), "video mai partito: non si conta niente (i venti minuti neri del 18/10)");
  ok(P.presenzaConta({ inDiretta: true, videoRotto: false, avviato: true }), "partito una volta: si conta, anche durante pause e caricamenti");
  ok(!P.presenzaConta({ inDiretta: true, videoRotto: true, avviato: true }), "l'errore ferma tutto, come prima");
  ok(!P.presenzaConta({ inDiretta: false, videoRotto: false, avviato: true }), "fuori dalla diretta niente, come prima");

  // La soglia: specchio di ping_attesi_evento × 0,75.
  ok(P.minutiNecessari("2026-10-18T15:00:00Z", "2026-10-18T15:45:00Z") === 34, "45 minuti → 34 per il riconoscimento (0,75 × 45 = 33,75)");
  ok(P.minutiNecessari("2026-10-18T15:00:00Z", "2026-10-18T15:40:00Z") === 30, "40 minuti → 30 esatti (nessun arrotondamento spurio)");
  ok(P.minutiNecessari("2026-10-18T15:00:00Z", null) === null, "senza fine non si calcola");

  ok(P.testoContatore(12, 34, true) === "Presente da 12 minuti. Per il riconoscimento ne servono 34.", "sotto soglia: il testo di Mario", P.testoContatore(12, 34, true));
  ok(P.testoContatore(1, 1, true).startsWith("Hai raggiunto"), "alla soglia esatta: raggiunta");
  ok(!/garant/i.test(P.testoContatore(40, 34, true)) && /chiude la diretta/.test(P.testoContatore(40, 34, true)), "raggiunta NON promette le ore: nomina la condizione che manca");
  ok(P.testoContatore(12, 34, false) === "Il conteggio è fermo a 12 minuti: finché il video non si vede, la presenza non avanza.", "fermo: dice a quanto è fermo");
  ok(/1 minuto\b/.test(P.testoContatore(1, 34, true)) && !/1 minuti/.test(P.testoContatore(1, 34, false)), "un minuto al singolare");

  ok(P.testoRientro({ minutiFuori: 0, direttaFinita: false, riprende: true }) === null, "sotto il minuto non si dice niente");
  const dentro = P.testoRientro({ minutiFuori: 6, direttaFinita: false, riprende: true });
  ok(/6 minuti/.test(dentro) && /Adesso riprende\.$/.test(dentro), "diretta ancora in corso: quanti minuti persi, e che riprende", dentro);
  ok(!/riprende/.test(P.testoRientro({ minutiFuori: 6, direttaFinita: false, riprende: false })), "«Adesso riprende» solo se è vero");
  const finita = P.testoRientro({ minutiFuori: 6, direttaFinita: true, riprende: false });
  ok(finita === "Mentre eri fuori la diretta è finita. Gli ultimi 6 minuti non sono stati contati.", "diretta finita nel mentre: il testo di Mario, e nessun rimedio inesistente", finita);

  // ⚠️ Nessuna frase accordata al genere di chi legge (KIREO non lo sa).
  const tutti = [
    P.testoContatore(12, 34, true), P.testoContatore(40, 34, true), P.testoContatore(12, 34, false),
    dentro, finita, P.testoRientro({ minutiFuori: 1, direttaFinita: false, riprende: true }),
    P.AVVISO_PLAYER, P.AVVISO_PLAYER_TELEFONO,
  ];
  const accordi = tutti.flatMap((t) => trovaAccordi(t));
  ok(accordi.length === 0, "nessun participio accordato col genere di chi legge", accordi.join(", "));
  ok(tutti.length === 8, "la lista dei testi controllati ne ha otto: sotto, il controllo non sta guardando");

  const pannello = leggi("components/live/PannelloLive.tsx");
  ok(/onAvvio=\{segnaAvvio\}/.test(pannello), "il pannello ascolta il primo avvio del video");
  ok(/testoContatore\(contati, necessari, contaLaPresenza\)/.test(pannello), "lo studente vede il contatore");
  ok(/visibilitychange/.test(pannello) && /setRientro\(testoRientro/.test(pannello), "al rientro gli si dice cosa ha perso");
  ok(/\{AVVISO_PLAYER\}/.test(pannello) && /sm:hidden">\{AVVISO_PLAYER_TELEFONO\}/.test(pannello), "l'avviso sopra il player, e la riga in più solo sul telefono");
  const player = leggi("components/live/PlayerDiretta.tsx");
  ok(/e\.data === 1\) onAvvioRef\.current/.test(player), "il player dice «partito» sullo stato in riproduzione");
  ok(/if \(ripiego\) onAvvioRef\.current/.test(player), "nel ripiego (nessuna misura) si dichiara partito: dove non sappiamo, conta");
}

console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà verificate`);
process.exit(falliti === 0 ? 0 : 1);
