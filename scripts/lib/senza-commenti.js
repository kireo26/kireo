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

module.exports = { senzaCommenti };
