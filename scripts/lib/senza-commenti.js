// Toglie i commenti da un sorgente, per i controlli LESSICALI.
//
// PERCHÉ ESISTE, e non è un'utilità di comodo. Il 27/09 una verifica che
// pretendeva `cache(` in `getPassoCorrente` era VERDE con la `cache()` tolta:
// trovava la parola nel COMMENTO che spiegava perché ci dovesse stare. Un
// commento che fa passare il controllo al posto del codice è la specie di casa
// vista dall'altro lato — e si chiude in un posto solo, non in ogni file di test.
//
// Il `[^:]` davanti allo slash doppio serve a non decapitare gli URL
// (`https://…`), che nei sorgenti compaiono dentro le stringhe.
//
// Limite dichiarato: non è un parser. Una sequenza `/*` o `//` dentro una
// stringa o una regex viene tolta come se fosse un commento. Per un controllo
// lessicale sbaglia nella direzione giusta — nasconde codice, quindi al più
// rende un controllo ROSSO su codice buono, che si nota subito; non lo rende
// verde su codice rotto, che è il caso da cui questo helper nasce.
function senzaCommenti(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// La gemella per SQL, che nasce dalla stessa ragione il 27/09: un controllo
// pretendeva che `row_count` NON comparisse in una migrazione, ed era rosso
// perché il commento in testa spiegava proprio perché non si usa. Un commento
// che fa fallire un controllo su codice giusto è l'altra faccia dello stesso
// difetto — e un controllo che grida su codice giusto è un controllo che qualcuno
// disattiva.
//
// Stesso limite dichiarato, e stessa direzione: un `--` dentro una stringa viene
// tolto come se fosse un commento, quindi al più si perde del codice e il
// controllo diventa rosso. Mai verde su qualcosa che non c'è.
function senzaCommentiSql(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
}

module.exports = { senzaCommenti, senzaCommentiSql };
