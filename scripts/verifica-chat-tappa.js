// UN TETTO PER TAPPA NON SI APPLICA MAI A UN CONTEGGIO PER ISCRIZIONE.
//
// Il caso vero, del 13/09: `enoteca > giurisprudenza` fermato al pitch con
// «per questa tappa hai già parlato abbastanza», dopo UN messaggio in quella
// tappa e con un minimo di quattro. In tabella c'erano dieci messaggi
// sull'iscrizione — esattamente il tetto per tappa — perché le tre tappe prima
// ne avevano chiesti tre ciascuna: 3+3+3 = 9, e il tetto è 10.
//
// Il difetto stava in due guardie diverse sullo stesso oggetto: al minimo
// bastava la RIGA della tappa aperta, al filtro del conteggio serviva la sua
// DATA. Quando la riga mancava il filtro saltava, il conteggio cambiava unità
// senza dirlo, e il tetto della tappa finiva applicato al totale. Non mordeva
// all'inizio di un workshop e diventava certo alla quarta tappa: una corsa,
// non una costante — ed è per questo che il 30 agosto la stessa caduta fu
// attribuita al ritentativo (che era un difetto vero, ma un altro).
//
// Esecuzione: `npm run test:chat`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require.extensions[".ts"] = function (mod, filename) {
  const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
    fileName: filename,
  });
  return mod._compile(out.outputText, filename);
};

const { getStatoChatTappa, esitoDelProssimoMessaggio } = require("@/lib/workshop/chatTappa");
const { WORKSHOP_ELABORATO } = require("@/lib/workshop/elaborato-config");
const { TETTO_MESSAGGI_CHAT_TAPPA } = require("@/lib/workshop/config");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

// Un client Supabase finto quanto basta: la riga della tappa aperta e un
// conteggio che sa se il filtro sulla data è stato applicato o no. Serve
// proprio quello — la differenza fra le due unità sta lì.
function clienteFinto({ apertaRiga, dallaTappa, inTutto }) {
  return {
    from() {
      const q = {
        _filtrato: false,
        select: () => q,
        eq: () => q,
        gte: () => { q._filtrato = true; return q; },
        maybeSingle: async () => ({ data: apertaRiga }),
        then: (risolvi) => risolvi({ count: q._filtrato ? dallaTappa : inTutto }),
      };
      return q;
    },
  };
}

console.log("\n═══ Il tetto della chat è per tappa ═══\n");

const SLUG = "enoteca-centocelle";
const RUOLO = "giurisprudenza";
const fasi = WORKSHOP_ELABORATO[SLUG]?.[RUOLO]?.fasi ?? [];
const pitch = fasi.find((f) => f.ultima);
ok(fasi.length === 4 && pitch, "il ruolo di prova ha quattro tappe e l'ultima è il pitch");
const minimiPrima = fasi.slice(0, 3).reduce((s, f) => s + f.chatMinima, 0);
ok(
  minimiPrima + 1 >= TETTO_MESSAGGI_CHAT_TAPPA,
  `alla quarta tappa il cumulativo tocca già il tetto (${minimiPrima} + 1 ≥ ${TETTO_MESSAGGI_CHAT_TAPPA}): è la condizione che rendeva il difetto certo`,
);

// IL CASO DI MARIO: quarta tappa, nove messaggi alle spalle, uno mandato qui.
// Deve poterne mandare altri tre.
(async () => {
  const quartaTappa = await getStatoChatTappa(
    clienteFinto({ apertaRiga: { fase_id: pitch.id, aperta_at: "2026-09-13T08:13:54Z" }, dallaTappa: 1, inTutto: 10 }),
    "isc",
    SLUG,
    RUOLO,
  );
  ok(quartaTappa.inviati === 1, "con la tappa aperta il conteggio è quello della TAPPA, non dell'iscrizione");
  ok(quartaTappa.minimo === pitch.chatMinima, "…e il minimo è quello del pitch");
  ok(quartaTappa.chiusa === false, "uno studente alla quarta tappa con nove messaggi alle spalle può ancora parlare");
  ok(esitoDelProssimoMessaggio(quartaTappa).raggiungeTetto === false, "…e il prossimo messaggio non incontra il tetto");

  // IL RIPIEGO, che è dove nasceva il difetto: nessuna riga aperta. Il tetto
  // per tappa non si applica, perché non si sa nemmeno quale tappa sia.
  const senzaTappa = await getStatoChatTappa(
    clienteFinto({ apertaRiga: null, dallaTappa: 0, inTutto: 10 }),
    "isc",
    SLUG,
    RUOLO,
  );
  ok(senzaTappa.faseId === null, "senza riga aperta la tappa è dichiarata sconosciuta, non indovinata");
  ok(senzaTappa.inviati === 10, "…il conteggio resta vero (è il totale), così il contatore a schermo non mente");
  ok(senzaTappa.raggiuntoTetto === false, "…ma il tetto PER TAPPA non si applica a un conteggio per iscrizione");
  ok(senzaTappa.chiusa === false, "…e la porta non si chiude: era il 429 del 13/09");
  ok(esitoDelProssimoMessaggio(senzaTappa).raggiungeTetto === false, "…nemmeno guardando al messaggio successivo");

  // La riga c'è ma senza data: stessa incertezza, stesso trattamento. Era
  // proprio la divergenza fra le due guardie.
  const rigaSenzaData = await getStatoChatTappa(
    clienteFinto({ apertaRiga: { fase_id: pitch.id, aperta_at: null }, dallaTappa: 0, inTutto: 10 }),
    "isc",
    SLUG,
    RUOLO,
  );
  ok(rigaSenzaData.faseId === null && rigaSenzaData.chiusa === false, "una riga senza data conta come tappa sconosciuta, non come tappa nota");

  // Il tetto per tappa, quando la tappa SI SA, funziona ancora: è una rete che
  // non va persa insieme al difetto.
  const dentroLaTappa = await getStatoChatTappa(
    clienteFinto({ apertaRiga: { fase_id: pitch.id, aperta_at: "2026-09-13T08:13:54Z" }, dallaTappa: TETTO_MESSAGGI_CHAT_TAPPA, inTutto: 99 }),
    "isc",
    SLUG,
    RUOLO,
  );
  ok(dentroLaTappa.raggiuntoTetto === true, "dentro una tappa nota il tetto morde ancora: la rete resta");

  // La regola del prossimo messaggio sta in un posto solo — la route la
  // riscriveva a mano, e la seconda copia si era dimenticata del `faseId`.
  const route = fs.readFileSync(path.join(ROOT, "app/api/workshop/cliente-chat/route.ts"), "utf8");
  ok(/esitoDelProssimoMessaggio\(stato\)/.test(route), "la route chiede la regola a chatTappa invece di riscriverla");
  ok(!/inviati \+ 1 >= stato\.tetto/.test(route), "…e non è rimasta una seconda copia del confronto col tetto");

  console.log("\n═══════════════════════════════════════\n");
  if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
  console.log("✓ Il tetto per tappa non si applica mai a un conteggio per iscrizione.\n");
})();
