// Quali deploy coprono una finestra di tempo — la parte di `banco log` che si
// può provare senza rete, e che il 30 agosto mancava del tutto.
//
// IL DIFETTO CHE QUESTO FILE ESISTE PER CHIUDERE. Su Vercel i log di runtime
// appartengono al singolo deploy. `banco log` guardava solo il deploy corrente,
// quindi dopo un redeploy le righe del guasto che si era appena riparato
// diventavano invisibili — e il banco diceva «nessuna riga di errore», che è
// l'assenza riportata come un fatto invece che come un limite dello strumento.
// È successo alla lettera: alzati i tetti dei token, ridistribuito, e con quel
// gesto perso l'accesso alle righe che documentavano il guasto.
//
// La sequenza normale è: qualcosa si rompe → si corregge → si ridistribuisce.
// Uno strumento cieco proprio dopo il terzo passo è cieco quando serve.

// SOLO CHI HA SERVITO HA UN REGNO. `target=production` nell'API di Vercel
// filtra la destinazione, non l'esito: nella lista finiscono anche i deploy
// ERROR, CANCELED, BUILDING e QUEUED, che non hanno mai servito una richiesta.
// Non sono inerti nel calcolo — un deploy che non ha mai servito CHIUDEREBBE
// il regno di quello prima di lui, e il banco andrebbe a cercare quelle righe
// dentro un deploy che non ne ha, trovandone zero: lo stesso difetto che
// questo file esiste per chiudere, rientrato da un'altra porta.
//
// Il caso peggiore è anche il più probabile: un deploy in BUILDING è il più
// recente, quindi si prenderebbe il regno fino ad adesso — e lanciare il banco
// mentre un redeploy costruisce lo renderebbe cieco sul PRESENTE, che è
// esattamente il momento in cui uno lo lancia.
//
// Un deploy READY promosso e poi sostituito resta invece dentro: ha servito,
// ed è il caso normale.
const HA_SERVITO = (d) => (d.readyState ?? d.state) === "READY";

// Il regno comincia quando il deploy ha cominciato a SERVIRE, non quando è
// stato creato: fra `createdAt` e la fine della build passa un minuto o due in
// cui a rispondere è ancora il precedente. Vercel espone `ready` quando ce
// l'ha; senza, si ripiega su `createdAt` (l'errore è di un paio di minuti, e
// in eccesso: si consulta un deploy in più, mai uno in meno).
const inizioRegno = (d) => d.ready ?? d.createdAt;

// Ogni deploy di produzione che ha servito "regge" il traffico da quando è
// pronto fino a quando è pronto il successivo. `deploys` è la lista grezza
// dell'API, in qualunque ordine e con qualunque stato.
//
// Restituisce:
//   consultare  — i deploy che si sovrappongono alla finestra, dal più recente
//   scoperto    — millisecondi di finestra che NESSUN deploy noto copre
//                 (perché più vecchi del più vecchio deploy in elenco)
//   scartati    — quanti sono stati esclusi perché non hanno mai servito
//   piuVecchio  — il timestamp da cui parte la copertura possibile
function finestreDeploy(deploys, daMs, aMs = Date.now()) {
  const validi = deploys.filter((d) => typeof (d.ready ?? d.createdAt) === "number");
  const ordinati = validi.filter(HA_SERVITO).sort((a, b) => inizioRegno(b) - inizioRegno(a));
  const scartati = validi.length - ordinati.length;

  const consultare = [];
  for (let i = 0; i < ordinati.length; i++) {
    const inizio = inizioRegno(ordinati[i]);
    // Il precedente in elenco è il PIÙ RECENTE fra i più vecchi: quello che ha
    // sostituito questo. Per il primo (il corrente) la fine è «adesso».
    const fine = i === 0 ? Infinity : inizioRegno(ordinati[i - 1]);
    if (fine > daMs && inizio < aMs) consultare.push({ ...ordinati[i], regge: [inizio, fine] });
  }

  const piuVecchio = ordinati.length > 0 ? inizioRegno(ordinati[ordinati.length - 1]) : null;
  const scoperto = piuVecchio !== null && piuVecchio > daMs ? piuVecchio - daMs : 0;

  return { consultare, scoperto, scartati, piuVecchio };
}

// «21 minuti», «3 ore», «2 giorni»: un numero di millisecondi non si legge.
function durata(ms) {
  const minuti = Math.round(ms / 60000);
  if (minuti < 60) return `${minuti} ${minuti === 1 ? "minuto" : "minuti"}`;
  const ore = Math.round(minuti / 60);
  if (ore < 48) return `${ore} ${ore === 1 ? "ora" : "ore"}`;
  return `${Math.round(ore / 24)} giorni`;
}

// La frase che il banco stampa PRIMA delle righe, e che è il vero deliverable:
// dice cosa ha potuto guardare e cosa no. Senza questa, «nessuna riga» e «non
// posso vederle» si leggono uguali.
function raccontaCopertura({ consultare, scoperto, scartati = 0 }, minutiChiesti) {
  const righe = [];
  const nota = scartati > 0 ? ` (${scartati} esclusi: non sono mai arrivati a servire)` : "";

  if (consultare.length === 0) {
    righe.push(`⚠  Nessun deploy di produzione copre gli ultimi ${minutiChiesti} minuti: non posso vedere niente.${nota}`);
    return righe;
  }

  righe.push(`Deploy consultati: ${consultare.length}${nota} — i log di runtime appartengono al singolo deploy, non al progetto.`);
  for (const d of consultare) {
    righe.push(`  · ${d.uid}  pronto ${durata(Date.now() - inizioRegno(d))} fa`);
  }

  if (scoperto > 0) {
    righe.push("");
    righe.push(`⚠  ${durata(scoperto)} della finestra richiesta restano SCOPERTI: sono più vecchi del`);
    righe.push(`   deploy più remoto che riesco a elencare. Quelle righe non è che non ci siano —`);
    righe.push(`   è che da qui non si vedono.`);
  }
  return righe;
}

module.exports = { finestreDeploy, raccontaCopertura, durata };
