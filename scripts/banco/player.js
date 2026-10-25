// `npm run banco player [videoId]` — il banco del player, da dieci minuti.
//
// PERCHÉ ESISTE (25/10). Il blocco 3 è stato ordinato attorno a una frase —
// «a fine video YouTube mostra una griglia di suggeriti davanti a un ragazzo»
// — che nessuno ha mai visto. L'unica osservazione che abbiamo va nell'altro
// verso: alle 10:30 del 25/10, a diretta finita, dentro il player di KIREO è
// comparso «riprendi» con la barra rossa, non una griglia. Il sospetto è che
// la diretta e la REGISTRAZIONE si comportino diversamente, e la registrazione
// è il caso della libreria. Dentro KIREO non si può guardare: a diretta chiusa
// la pagina dello studente toglie il player, e un posto dove si riguarda un
// video non esiste ancora.
//
// COSA FA: impacchetta con esbuild il componente VERO (PlayerDiretta, non i
// suoi parametri copiati) e lo serve su http://localhost. Non su file://:
// senza un'origine YouTube rifiuta l'incorporamento (errore 153), e si
// misurerebbe un errore invece di una schermata finale.
//
// ⚠️ LIMITE, dichiarato: la pagina gira su localhost e non su kireo.it.
// L'origine entra nel referer che YouTube vede; non sappiamo che cambi le
// schermate finali, e non lo diamo per scontato.
//
// Sola lettura: non tocca nessun database e non spende niente.
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */
const http = require("http");
const path = require("path");
const esbuild = require("esbuild");

const RADICE = path.join(__dirname, "..", "..");
const VIDEO_PREDEFINITO = "xHyJSZIkYAw"; // la registrazione della diretta del 25/10 mattina
const PORTA = Number(process.env.PORTA_BANCO_PLAYER || 4777);

async function costruisci() {
  const r = await esbuild.build({
    entryPoints: [path.join(__dirname, "player", "ingresso.tsx")],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
    plugins: [
      {
        name: "alias",
        setup(b) {
          b.onResolve({ filter: /^@\// }, async (a) => b.resolve("./" + a.path.slice(2), { resolveDir: RADICE, kind: a.kind }));
        },
      },
    ],
  });
  return r.outputFiles[0].text;
}

async function player(videoId) {
  const id = videoId || VIDEO_PREDEFINITO;
  const codice = await costruisci();
  const html = `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Banco del player</title></head><body style="margin:0;background:#2C2C2A"><div id="radice"></div><script>${codice}</script></body></html>`;
  const server = http.createServer((req, res) => {
    if (!req.url.startsWith("/?") && req.url !== "/") {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(html);
  });
  server.listen(PORTA, () => {
    const url = `http://localhost:${PORTA}/?v=${encodeURIComponent(id)}`;
    console.log(`
BANCO DEL PLAYER — il componente vero (PlayerDiretta), servito qui:

  ${url}

Altri video: npm run banco player <videoId>   (si cambia anche ?v= nell'indirizzo)

DA FOTOGRAFARE, tutte e tre, con l'ora del registro sotto il player visibile:
  1. gli ULTIMI VENTI SECONDI: le schermate finali di YouTube arrivano prima
     della fine, non dopo;
  2. la FINE (il registro deve dire «fine del video (stato 0)»);
  3. se compare una griglia: dove portano quei video — stesso canale che ha
     pubblicato o no (rel=0 dal 2018 li restringe al canale, non li toglie).

Se il registro dice RIPIEGO, la misura è del riquadro semplice e non del
player del prodotto: va detto accanto alla foto.

Ctrl+C per fermare.`);
  });
}

module.exports = { player };
