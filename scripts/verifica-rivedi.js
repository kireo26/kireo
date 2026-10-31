// Rivedere una diretta (Mario, 31/10): il bottone c'è solo se la sonda del
// server ha visto la registrazione partire; rivedere non dà presenza né ore, e
// lo schermo lo dice; la pagina dell'area elenca solo quello che si riapre.
// Gli attesi sono scritti a mano.
//
// Esecuzione: `npm run test:rivedi`.
/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");
const { senzaCommenti } = require("./lib/senza-commenti");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = require.extensions[".tsx"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const R = require("@/lib/eventi/registrazione");
const S = require("@/lib/eventi/sondaRegistrazione");
const { trovaAccordi } = require("@/lib/lingua/accordoGenere");

let fatte = 0;
let falliti = 0;
function ok(cond, msg, dettaglio) {
  fatte++;
  if (cond) console.log(`  ✓ ${msg}`);
  else { falliti++; console.log(`  ✗ ${msg}${dettaglio ? ` [${dettaglio}]` : ""}`); }
}
const leggi = (f) => senzaCommenti(fs.readFileSync(path.join(ROOT, f), "utf8"));
const a = (t) => new Date(t);

(async () => {
  console.log("§1 quando un evento si riapre");
  const ev = (x = {}) => ({ tipo: "webinar", data_inizio: "2026-10-05T15:00:00Z", data_fine: "2026-10-05T16:00:00Z", diretta_chiusa_il: null, youtube_video_id: "5doxLWDlAJU", registrazione_esito: "disponibile", ...x });
  ok(R.registrazioneRivedibile(ev(), a("2026-10-31T10:00:00Z")) === true, "un webinar finito, con la registrazione vista dalla sonda, si riapre");
  ok(R.registrazioneRivedibile(ev({ registrazione_esito: null }), a("2026-10-31T10:00:00Z")) === false, "con l'id ma senza sonda no: un indirizzo non è una registrazione");
  for (const e of ["non_incorporabile", "non_trovata", "non_controllato"]) {
    ok(R.registrazioneRivedibile(ev({ registrazione_esito: e }), a("2026-10-31T10:00:00Z")) === false, `con l'esito «${e}» no`);
  }
  ok(R.registrazioneRivedibile(ev({ youtube_video_id: null }), a("2026-10-31T10:00:00Z")) === false, "senza video no");
  ok(R.registrazioneRivedibile(ev({ tipo: "altro" }), a("2026-10-31T10:00:00Z")) === false, "un incontro in presenza no");
  ok(R.registrazioneRivedibile(ev(), a("2026-10-05T15:30:00Z")) === false, "a diretta in corso no");
  ok(R.registrazioneRivedibile(ev({ diretta_chiusa_il: "2026-10-05T15:20:00Z" }), a("2026-10-05T15:30:00Z")) === true, "una diretta chiusa prima è finita prima (la fine effettiva)");
  ok(R.doveSiRivede(ev(), a("2026-10-31T10:00:00Z")) === "kireo", "disponibile: si rivede dentro KIREO");
  ok(R.doveSiRivede(ev({ registrazione_esito: "non_incorporabile" }), a("2026-10-31T10:00:00Z")) === "youtube", "incorporamento spento: si rivede su YouTube (il video c'è, manca il permesso di mostrarlo qui)");
  for (const e of [null, "non_trovata", "non_controllato"]) {
    ok(R.doveSiRivede(ev({ registrazione_esito: e }), a("2026-10-31T10:00:00Z")) === null, `con «${e}» nessun bottone`);
  }
  ok(R.doveSiRivede(ev({ registrazione_esito: "non_incorporabile" }), a("2026-10-05T15:30:00Z")) === null, "nemmeno YouTube prima della fine");
  ok(R.urlYoutube("nyeZXqVZcWA") === "https://www.youtube.com/watch?v=nyeZXqVZcWA", "il link esterno è la pagina del video su youtube.com");
  ok(R.TESTI_RIVEDI.bottoneYoutube === "Guarda la registrazione su YouTube", "il bottone esterno è quello di Mario");
  ok(R.TESTI_RIVEDI.nonConta === "Rivedere la registrazione non conta come partecipazione.", "la riga accanto al bottone è quella di Mario, parola per parola");

  console.log("§2 la sonda");
  ok(S.esitoDaRispostaOembed(200) === "disponibile" && S.esitoDaRispostaOembed(401) === "non_incorporabile"
    && S.esitoDaRispostaOembed(403) === "non_trovata" && S.esitoDaRispostaOembed(404) === "non_trovata"
    && S.esitoDaRispostaOembed(500) === "non_controllato" && S.esitoDaRispostaOembed(429) === "non_controllato",
    "200 disponibile, 401 non incorporabile, 403/404 non trovata, il resto non controllato");
  ok(S.urlOembed("5doxLWDlAJU") === "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3D5doxLWDlAJU&format=json", "chiede l'oEmbed di youtube.com per quell'id");
  ok(S.daSondare(ev(), a("2026-10-05T17:59:00Z")) === false && S.daSondare(ev(), a("2026-10-05T18:00:00Z")) === true, "si chiede a diretta finita da due ore, non prima");

  // Un client finto: legge i candidati, registra gli update.
  function finto({ righe, erroreLettura = null, righeScritte = [{ id: "x" }] }) {
    const update = [];
    const from = () => {
      const q = { filtri: [], aggiornamento: null };
      const catena = new Proxy({}, {
        get(_, nome) {
          if (nome === "then") {
            const r = q.aggiornamento ? { data: righeScritte, error: null } : { data: erroreLettura ? null : righe, error: erroreLettura };
            return (ok2) => Promise.resolve(r).then(ok2);
          }
          return (...args) => {
            if (nome === "update") { q.aggiornamento = args[0]; update.push(q); }
            q.filtri.push([nome, ...args]);
            return catena;
          };
        },
      });
      return catena;
    };
    return { from, update };
  }
  const adesso = a("2026-10-31T04:17:00Z");
  {
    const c = finto({ righe: [ev({ id: "e1" }), ev({ id: "e2", data_inizio: "2026-10-31T02:00:00Z", data_fine: "2026-10-31T03:00:00Z" })] });
    const visti = [];
    const g = await S.giroSondaRegistrazioni(c, async (url) => { visti.push(url); return { status: 200 }; }, adesso);
    ok(g.sondati.length === 1 && g.sondati[0].id === "e1" && g.sondati[0].esito === "disponibile", "sonda solo la diretta finita da più di due ore, e scrive l'esito");
    ok(visti.length === 1, "una richiesta per evento sondato, nessuna per quello appena finito");
    const u = c.update[0];
    ok(u && u.aggiornamento.registrazione_esito === "disponibile" && u.aggiornamento.registrazione_sondata_il === adesso.toISOString()
      && u.filtri.some((f) => f[0] === "select"), "l'update scrive esito e ora, e conta le righe toccate");
  }
  {
    const c = finto({ righe: [ev({ id: "e1" })] });
    const g = await S.giroSondaRegistrazioni(c, async () => { throw new Error("rete"); }, adesso);
    ok(g.sondati[0]?.esito === "non_controllato", "una richiesta che non torna è «non controllato» (si riprova al giro dopo), mai «disponibile»");
  }
  {
    const g = await S.giroSondaRegistrazioni(finto({ righe: null, erroreLettura: { message: "giù" } }), async () => ({ status: 200 }), adesso);
    ok(g.letti === null && g.guasti[0]?.passo === "lettura", "una lettura fallita è un guasto, non «niente da sondare»");
  }
  {
    const g = await S.giroSondaRegistrazioni(finto({ righe: [ev({ id: "e1" })], righeScritte: [] }), async () => ({ status: 200 }), adesso);
    ok(g.sondati.length === 0 && g.guasti[0]?.passo === "scrittura", "un update che non tocca righe è un guasto, non un esito scritto");
  }
  {
    // Una richiesta per video: tre eventi, due con lo stesso video.
    const tre = finto({ righe: [ev({ id: "e1" }), ev({ id: "e2" }), ev({ id: "e3", youtube_video_id: "nyeZXqVZcWA" })] });
    const viste = [];
    const g = await S.giroSondaRegistrazioni(tre, async (url) => { viste.push(url); return { status: url.includes("nyeZXqVZcWA") ? 401 : 200 }; }, adesso);
    ok(viste.length === 2 && g.richieste === 2, "una richiesta a YouTube per video distinto, non una per evento", `${viste.length} richieste`);
    ok(g.sondati.length === 3 && tre.update.length === 3, "e una scrittura per ogni evento, ognuna contata");
    ok(g.sondati.find((x) => x.id === "e2")?.esito === "disponibile" && g.sondati.find((x) => x.id === "e3")?.esito === "non_incorporabile",
      "l'esito del video vale per ogni evento che lo usa");
  }
  const src = leggi("lib/eventi/sondaRegistrazione.ts");
  ok(/\.or\("registrazione_esito\.is\.null,registrazione_esito\.eq\.non_controllato"\)/.test(src), "si sonda una volta: solo gli eventi mai sondati o non controllati");
  ok(/\.limit\(SONDE_PER_GIRO \* 5\)/.test(src) && /\.slice\(0, SONDE_PER_GIRO\)/.test(src), "un tetto di sonde per giro");

  console.log("§3 rivedere non è esserci");
  for (const f of ["app/eventi/[id]/rivedi/page.tsx", "components/eventi/PlayerRegistrazione.tsx"]) {
    const s = leggi(f);
    ok(!/useHeartbeatDiretta|\/api\/live|ping_presenza|presenze_live|iscrizioni_eventi/.test(s), `${f}: nessun battito, nessuna presenza, nessuna iscrizione`);
  }
  const pagina = leggi("app/eventi/[id]/rivedi/page.tsx");
  ok(/const dove = doveSiRivede\(evento\)/.test(pagina) && /dove === "kireo" && evento\.youtube_video_id \? \(/.test(pagina)
    && /dove === "youtube" && evento\.youtube_video_id \? \(/.test(pagina) && /TESTI_RIVEDI\.nonDisponibile/.test(pagina),
    "la pagina: il player se si incorpora, YouTube se no, e lo dice se non c'è");
  ok(/\{TESTI_RIVEDI\.nonConta\}[\s\S]*?<PlayerRegistrazione/.test(pagina), "sopra il video, che non conta come partecipazione");
  const proxy = fs.readFileSync(path.join(ROOT, "lib/supabase/proxy.ts"), "utf8");
  ok(!/"\/eventi"/.test(proxy), "la pagina è aperta anche a chi non ha fatto l'accesso (non sta fra le aree protette)");
  const card = leggi("components/app/CardEvento.tsx");
  ok(/const dove = doveSiRivede\(evento\);/.test(card) && /\{dove === "kireo" && \([\s\S]*?hrefRivedi\(evento\.id\)[\s\S]*?TESTI_RIVEDI\.nonConta/.test(card),
    "la card: «Rivedi» solo se si incorpora, e la riga accanto");
  {
    const ramoYt = (card.match(/\{dove === "youtube" && evento\.youtube_video_id && \([\s\S]*?\n {10}\)\}/) ?? [""])[0];
    ok(/href=\{urlYoutube\(evento\.youtube_video_id\)\}/.test(ramoYt) && /target="_blank"/.test(ramoYt) && /rel="noopener noreferrer"/.test(ramoYt),
      "con l'incorporamento spento, un link a YouTube in una scheda nuova", ramoYt.slice(0, 80));
    ok(/TESTI_CONTENUTI\.fuoriDaKireo/.test(ramoYt) && /TESTI_RIVEDI\.nonConta/.test(ramoYt), "con «Si apre fuori da KIREO» e la stessa riga: la regola non cambia con il posto");
  }
  ok(!/dove === "(kireo|youtube)" && iscritto/.test(card) && !/iscritto && dove/.test(card), "i bottoni sono per tutti, iscritti o no");

  console.log("§4 la pagina dell'area elenca solo quello che si riapre");
  const area = leggi("app/aree/[slug]/page.tsx");
  ok(/tuttiEventi\s*\.filter\(\(e\) => doveSiRivede\(e\) !== null\)/.test(area), "i già trasmessi sono quelli che si rivedono, dentro KIREO o su YouTube");
  ok(/\.slice\(0, RIVEDIBILI_AREA_MASSIMO\)/.test(area) && /b\.data_inizio\.localeCompare\(a\.data_inizio\)/.test(area), "i più recenti, con un tetto");
  ok(/rivedibili\.length > 0 && \(/.test(area), "senza registrazioni la sezione non c'è");
  ok(/rivedibili\.map\([\s\S]*?mostraOre=\{false\}/.test(area), "senza le ore: rivedere non le dà");


  console.log("§6 la sonda si ripara dove si rompe");
  {
    // Un client finto per un evento solo: legge la riga, registra gli update.
    const unoFinto = (riga, { errore = null, scritte = [{ id: "e1" }] } = {}) => {
      const update = [];
      const from = () => {
        const q = { aggiornamento: null };
        const catena = new Proxy({}, {
          get(_, nome) {
            if (nome === "then") {
              const r = q.aggiornamento ? { data: scritte, error: null } : { data: errore ? null : riga, error: errore };
              return (k) => Promise.resolve(r).then(k);
            }
            return (...args) => { if (nome === "update") { q.aggiornamento = args[0]; update.push(args[0]); } return catena; };
          },
        });
        return catena;
      };
      return { from, update };
    };
    const adesso = a("2026-10-31T18:00:00Z");
    const riga = (x = {}) => ({ id: "e1", tipo: "webinar", stato: "approvato", youtube_video_id: "5doxLWDlAJU", registrazione_esito: "disponibile", registrazione_sondata_il: "2026-10-31T04:17:00Z", ...x });
    const chiamate = [];
    const chiedi = (status) => async (url) => { chiamate.push(url); return { status }; };

    let c = unoFinto(riga());
    let r = await S.risondaUnEvento(c, chiedi(404), "e1", adesso);
    ok(r.stato === "scritto" && r.esito === "non_trovata" && c.update[0]?.registrazione_esito === "non_trovata", "un video sparito: la risonda lo scrive, e il bottone si spegne per tutti");
    c = unoFinto(riga());
    r = await S.risondaUnEvento(c, chiedi(200), "e1", adesso);
    ok(r.stato === "scritto" && r.esito === "disponibile", "se il video c'è (il problema era del browser), resta disponibile");
    c = unoFinto(riga());
    r = await S.risondaUnEvento(c, async () => { throw new Error("rete"); }, "e1", adesso);
    ok(r.stato === "non_controllato" && c.update.length === 0, "un nostro guasto di rete non spegne il bottone di tutti: non si scrive niente");
    chiamate.length = 0;
    c = unoFinto(riga({ registrazione_sondata_il: "2026-10-31T17:55:00Z" }));
    r = await S.risondaUnEvento(c, chiedi(404), "e1", adesso);
    ok(r.stato === "non_serve" && chiamate.length === 0 && c.update.length === 0, "non più spesso di una volta ogni 10 minuti per evento: nessuna richiesta a YouTube");
    c = unoFinto(riga({ registrazione_esito: "non_trovata" }));
    r = await S.risondaUnEvento(c, chiedi(200), "e1", adesso);
    ok(r.stato === "non_serve" && c.update.length === 0, "si risonda solo un bottone acceso: un evento già spento non si riaccende da una pagina");
    c = unoFinto(null, { errore: { message: "giù" } });
    ok((await S.risondaUnEvento(c, chiedi(200), "e1", adesso)).stato === "guasto", "una lettura fallita è un guasto");
    ok((await S.risondaUnEvento(unoFinto(riga(), { scritte: [] }), chiedi(404), "e1", adesso)).stato === "guasto", "un update che non tocca righe è un guasto");
    ok(S.MINUTI_TRA_RISONDE === 10, "la pausa fra due risonde è di 10 minuti");
  }
  const route = leggi("app/api/eventi/[id]/risonda/route.ts");
  ok(!/request\.(json|text|formData)\(/.test(route) && /_request/.test(route), "la route non legge il corpo: il browser chiede, non dichiara");
  ok(/risondaUnEvento\(supabase, \(url, init\) => fetch\(url, init\), id, new Date\(\)\)/.test(route), "decide il server, con la sonda vera");
  const player = leggi("components/eventi/PlayerRegistrazione.tsx");
  ok(/onErrore=\{quandoNonParte\}/.test(player) && /fetch\(`\/api\/eventi\/\$\{eventoId\}\/risonda`, \{ method: "POST", keepalive: true \}\)/.test(player), "quando il video non parte, la pagina chiede di ricontrollare");
  ok(!/body:/.test(player) && /if \(chiesto\.current\) return;/.test(player), "senza corpo, e una volta per caricamento");
  ok(/eventoId=\{evento\.id\}/.test(leggi("app/eventi/[id]/rivedi/page.tsx")), "la pagina passa l'evento al player");

  console.log("§7 la frase di settembre");
  ok(R.testoNessunEventoInProgramma(true) === "Non ci sono eventi in programma in quest'area. Qui sotto trovi quelli già trasmessi."
    && R.testoNessunEventoInProgramma(false) === "Non ci sono ancora eventi in quest'area.", "i due testi di Mario, parola per parola, secondo cosa c'è nella pagina");
  const mesi = /gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|\d/i;
  ok(!mesi.test(R.testoNessunEventoInProgramma(true)) && !mesi.test(R.testoNessunEventoInProgramma(false)), "niente date promesse, mai");
  const pagArea = leggi("app/aree/[slug]/page.tsx");
  ok(/testoNessunEventoInProgramma\(rivedibili\.length > 0\)/.test(pagArea) && !/settembre/i.test(pagArea), "la pagina dell'area usa la frase vera, e «settembre» non c'è più");

  console.log("§8 il cron e la lingua");
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  ok(vercel.crons.some((c) => c.path === "/api/cron/registrazioni"), "il cron della sonda è in vercel.json");
  for (const t of [...Object.values(R.TESTI_RIVEDI), R.testoNessunEventoInProgramma(true), R.testoNessunEventoInProgramma(false)]) {
    if (typeof t === "string") ok(trovaAccordi(t).length === 0, "nessun accordo di genere", t);
  }

  console.log(`\n${falliti === 0 ? "✓" : "✗"} ${fatte - falliti}/${fatte} proprietà`);
  process.exit(falliti === 0 ? 0 : 1);
})();
