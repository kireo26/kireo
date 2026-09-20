// Con che cosa è stata giocata una passata: il LIVELLO delle consegne.
//
// PERCHÉ ESISTE. Dal 2026-09-20 lo stesso ruolo si può giocare con due corpi di
// risposte diversi — una consegna scritta bene (`base`) e una scritta debole —
// e i numeri che ne escono non sono confrontabili fra loro. Se un rapporto non
// dicesse quale dei due ha giocato, fra un mese due rapporti accostati
// leggerebbero come un cambiamento del prodotto una differenza che è solo di
// ingresso.
//
// Sta in un file suo, e non dentro `misura.js`, per la stessa ragione di
// `riprese.js`: quel modulo tira dentro il transpilatore TypeScript per leggere
// il prodotto, e `confronta` — che legge due file e basta — non deve
// dipenderne.
//
// Puro: `npm run test:banco` lo prova senza rete.

// I tre livelli, con la domanda a cui ognuno risponde. Non sono tre gradi della
// stessa scala: sono tre domande diverse, e il robot li tratta diversamente.
const LIVELLI = {
  base: "consegne scritte bene — la domanda è «funziona per tutti e venticinque?»",
  trappola: "una consegna con dentro un difetto noto — la domanda è «il revisore lo vede?»",
  debole: "una consegna di qualità volutamente bassa — la domanda è «il punteggio distingue?»",
};

const NOTI = Object.keys(LIVELLI);

// Dato un elenco di cose che portano un `livello` (i lavori di un piano, o gli
// esiti di un rapporto), dice con quali si ha a che fare.
//
// `noto: false` quando anche UNA sola voce non lo dichiara: un rapporto scritto
// prima che i livelli esistessero non ha il campo, e l'assenza del campo non è
// «era una base». Fallisce verso «non lo so», mai verso la risposta comoda —
// stessa regola di `riprese`.
function livelli(elenco) {
  const voci = Array.isArray(elenco) ? elenco : [];
  const dichiarati = voci.map((v) => v?.livello).filter((l) => typeof l === "string" && l.length > 0);
  const noto = voci.length > 0 && dichiarati.length === voci.length;
  const distinti = [...new Set(dichiarati)].sort();
  return {
    noto,
    voci: voci.length,
    distinti,
    unico: distinti.length === 1 ? distinti[0] : null,
    misto: distinti.length > 1,
    // I livelli che nessuno ha mai definito: un file con `livello: "medio"`
    // scritto domani non deve passare per buono solo perché è una stringa.
    sconosciuti: distinti.filter((l) => !NOTI.includes(l)),
  };
}

function descriviLivello(livello) {
  return LIVELLI[livello] ?? "livello non riconosciuto";
}

module.exports = { LIVELLI, NOTI, livelli, descriviLivello };
