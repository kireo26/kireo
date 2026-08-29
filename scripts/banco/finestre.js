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

// Ogni deploy di produzione "regge" il traffico dalla sua nascita fino alla
// nascita del successivo. `deploys` arriva dal più recente al più vecchio,
// come li restituisce Vercel.
//
// Restituisce:
//   consultare  — i deploy che si sovrappongono alla finestra, dal più recente
//   scoperto    — millisecondi di finestra che NESSUN deploy noto copre
//                 (perché più vecchi del più vecchio deploy in elenco)
//   piuVecchio  — il timestamp da cui parte la copertura possibile
function finestreDeploy(deploys, daMs, aMs = Date.now()) {
  const ordinati = [...deploys]
    .filter((d) => typeof d.createdAt === "number")
    .sort((a, b) => b.createdAt - a.createdAt);

  const consultare = [];
  for (let i = 0; i < ordinati.length; i++) {
    const inizio = ordinati[i].createdAt;
    // Il precedente in elenco è il PIÙ RECENTE fra i più vecchi: quello che ha
    // sostituito questo. Per il primo (il corrente) la fine è «adesso».
    const fine = i === 0 ? Infinity : ordinati[i - 1].createdAt;
    if (fine > daMs && inizio < aMs) consultare.push({ ...ordinati[i], regge: [inizio, fine] });
  }

  const piuVecchio = ordinati.length > 0 ? ordinati[ordinati.length - 1].createdAt : null;
  const scoperto = piuVecchio !== null && piuVecchio > daMs ? piuVecchio - daMs : 0;

  return { consultare, scoperto, piuVecchio };
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
function raccontaCopertura({ consultare, scoperto }, minutiChiesti) {
  const righe = [];
  if (consultare.length === 0) {
    righe.push(`⚠  Nessun deploy di produzione copre gli ultimi ${minutiChiesti} minuti: non posso vedere niente.`);
    return righe;
  }

  const quanti = consultare.length;
  righe.push(`Deploy consultati: ${quanti} (i log di runtime appartengono al singolo deploy, non al progetto).`);
  for (const d of consultare) {
    righe.push(`  · ${d.uid}  nato ${durata(Date.now() - d.createdAt)} fa`);
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
