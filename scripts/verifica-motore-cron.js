// Il motore del workshop: SE LA MARCATURA NON ATTERRA, LA TAPPA NON AVANZA.
//
// Il cron fa due scritture di fila su `workshop_fasi_stato`: prima marca
// `revisione_esito` sulla riga, poi chiama `avanza_fase_workshop`. L'ordine è
// giusto ed era commentato dal primo giorno — ma fra le due non c'era niente
// che verificasse che la prima fosse atterrata: l'esito dell'update era
// scartato, e l'avanzamento partiva comunque.
//
// Il 13/09 `marketing > quartiere` è finito esattamente nello stato che quel
// commento diceva di voler evitare: `revisionata`, `revisione_esito` null, zero
// tentativi. È il caso peggiore di tutti perché è INDISTINGUIBILE da una
// riuscita — la query che cerca i guasti (`revisione_esito is not null and
// revisione_esito <> 'riuscita'`) non lo vede, e lo studente ha un punteggio
// che nessuno sa più da dove venga.
//
// Perché un controllo LESSICALE e non un test funzionale: la route è un
// handler Next che monta il client Supabase e l'SDK Anthropic, e non gira
// senza rete. Ma la proprietà che conta è una GUARDIA FRA DUE RIGHE, e quella
// si legge — stessa scelta già fatta per l'ordine dei gesti del robot.
//
// Esecuzione: `npm run test:motore`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "app/api/cron/workshop-motore/route.ts");

let falliti = 0;
const ok = (cond, msg) => {
  if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); }
};

// La scrittura che marca l'esito, riconosciuta dalla destrutturazione che la
// apre: se l'errore non viene raccolto, questo non combacia — ed è proprio il
// codice di stamattina.
const RE_MARCATURA =
  /const \{\s*error:\s*(\w+)\s*\}\s*=\s*await supabase\s*\n\s*\.from\("workshop_fasi_stato"\)\s*\n\s*\.update\(\{[^}]*revisione_esito[^}]*\}\)/;

const ANCORA_AVANZA = 'supabase.rpc("avanza_fase_workshop"';

// LA SECONDA PROPRIETÀ, dal guasto del 18/09: una resa deve lasciare scritto
// COSA si è arreso. La resa guarda due esiti (`esitoPeggiore`), la marcatura ne
// scriveva uno — quando falliva il feedback finale, sulla riga finiva
// 'riuscita', l'esito della revisione, e la query dei guasti non poteva vederlo.
//
// Due metà, e servono tutte e due: che `finale_esito` sia scritto, e che il
// valore scritto sia NULL dove il finale non era dovuto. Scriverlo sempre
// varrebbe 'riuscita' su ogni tappa non ultima — la stessa bugia in piccolo.
function marcaAncheIlFinale(sorgente) {
  const m = sorgente.match(/\.update\(\{[^}]*finale_esito:\s*([A-Za-z_$][\w$]*)[^}]*\}\)/);
  if (!m) return { ok: false, perche: "la marcatura non scrive `finale_esito`: una resa del feedback finale resta indistinguibile da una riuscita" };

  const nome = m[1];
  const dichiarazione = new RegExp(`(?:const|let)\\s+${nome}\\b[^;]*\\bfase\\.ultima\\b[^;]*:\\s*null`);
  if (!dichiarazione.test(sorgente)) {
    return {
      ok: false,
      perche: `\`${nome}\` è scritto su ogni tappa: senza il ternario su \`fase.ultima\` vale 'riuscita' anche dove il finale non era dovuto`,
    };
  }
  return { ok: true };
}

// La proprietà, isolata: fra la scrittura e l'azione ci deve stare una guardia
// sull'errore che INTERROMPE. Un `console.error` da solo non basta — dice che
// è successo, non impedisce che succeda il resto.
function guardiaTraLeDue(sorgente) {
  const m = sorgente.match(RE_MARCATURA);
  if (!m) return { ok: false, perche: "l'update che marca `revisione_esito` non raccoglie l'errore" };

  const iMarcatura = m.index + m[0].length;
  const iAvanza = sorgente.indexOf(ANCORA_AVANZA, iMarcatura);
  if (iAvanza === -1) return { ok: false, perche: "non trovo la chiamata ad avanza_fase_workshop dopo la marcatura" };

  const inMezzo = sorgente.slice(iMarcatura, iAvanza);
  const nome = m[1];
  if (!new RegExp(`if\\s*\\(\\s*${nome}\\s*\\)`).test(inMezzo)) {
    return { ok: false, perche: `l'errore \`${nome}\` è raccolto ma non guardato prima di avanzare` };
  }
  if (!/\bcontinue\s*;/.test(inMezzo)) {
    return { ok: false, perche: "la guardia non interrompe: dire che è successo non impedisce che la tappa avanzi" };
  }
  return { ok: true, nome };
}

console.log("\n═══ Il motore: una scrittura muta non fa avanzare niente ═══\n");

// ── controprove sintetiche, PRIMA del file vero ───────────────────────────
// La taratura di un controllo si prova, non si legge: se non diventasse rosso
// sul codice di stamattina non starebbe controllando niente.
const SCRITTURA_MUTA = `
      await supabase
        .from("workshop_fasi_stato")
        .update({ tentativi_revisione: t + 1, revisione_esito: esito })
        .eq("id", riga.id);

      const { error: e } = await supabase.rpc("avanza_fase_workshop", { p_fase_id: f });
`;
const SOLO_LOG = `
      const { error: erroreMarcatura } = await supabase
        .from("workshop_fasi_stato")
        .update({ tentativi_revisione: t + 1, revisione_esito: esito })
        .eq("id", riga.id);
      if (erroreMarcatura) console.error("ops", erroreMarcatura);

      const { error: e } = await supabase.rpc("avanza_fase_workshop", { p_fase_id: f });
`;
const COMPLETA = `
      const { error: erroreMarcatura } = await supabase
        .from("workshop_fasi_stato")
        .update({ tentativi_revisione: t + 1, revisione_esito: esito })
        .eq("id", riga.id);
      if (erroreMarcatura) {
        console.error("ops", erroreMarcatura);
        errori++;
        continue;
      }

      const { error: e } = await supabase.rpc("avanza_fase_workshop", { p_fase_id: f });
`;

ok(guardiaTraLeDue(SCRITTURA_MUTA).ok === false, "diventa rosso sul codice di stamattina: l'update senza `{ error }`");
ok(guardiaTraLeDue(SOLO_LOG).ok === false, "…e anche su una guardia che LOGGA ma non interrompe");
ok(guardiaTraLeDue(COMPLETA).ok === true, "…e verde quando l'errore è raccolto, guardato e interrompe");

// Le tre stesure della marcatura: quella del 18/09 (un esito solo), quella che
// scrive il secondo esito ma sempre, e quella giusta.
const UN_ESITO_SOLO = `
        .update({ tentativi_revisione: t + 1, revisione_esito: esitoRevisioneStato })
`;
const FINALE_SEMPRE = `
      let esitoFinaleStato: EsitoGenerazione = "riuscita";
        .update({ tentativi_revisione: t + 1, revisione_esito: esitoRevisioneStato, finale_esito: esitoFinaleStato })
`;
const FINALE_GIUSTO = `
      const esitoFinaleDaMarcare: EsitoGenerazione | null = fase.ultima ? esitoFinaleStato : null;
        .update({ tentativi_revisione: t + 1, revisione_esito: esitoRevisioneStato, finale_esito: esitoFinaleDaMarcare })
`;

console.log("");
ok(marcaAncheIlFinale(UN_ESITO_SOLO).ok === false, "diventa rosso sulla marcatura del 18/09: un esito scritto dove se ne guardano due");
ok(marcaAncheIlFinale(FINALE_SEMPRE).ok === false, "…e anche su un `finale_esito` scritto su OGNI tappa, non solo dove era dovuto");
ok(marcaAncheIlFinale(FINALE_GIUSTO).ok === true, "…e verde quando il valore è null dove il feedback finale non c'era da generare");

// ── il file vero ──────────────────────────────────────────────────────────
console.log("");
const sorgente = fs.readFileSync(FILE, "utf8");
const esito = guardiaTraLeDue(sorgente);
ok(esito.ok, esito.ok ? "nel cron: se la marcatura non atterra, la tappa non avanza" : `nel cron: ${esito.perche}`);

// L'altra scrittura muta dello stesso blocco: il contatore dei tentativi sulla
// strada del ritentativo. Se non si alza, la tappa ritenta all'infinito senza
// mai arrendersi — qui non c'è niente da interrompere (il `continue` c'è già),
// ma un guasto che non si scrive non lascia un posto dove cercare.
const RE_CONTATORE =
  /const \{\s*error:\s*\w+\s*\}\s*=\s*await supabase\s*\n\s*\.from\("workshop_fasi_stato"\)\s*\n\s*\.update\(\{\s*tentativi_revisione:[^}]*\}\)/;
ok(RE_CONTATORE.test(sorgente), "anche l'aggiornamento del contatore dei tentativi raccoglie il suo errore");

// E che le uniche due scritture su quella tabella siano quelle due: una terza
// aggiunta un domani senza guardia rientrerebbe dalla finestra.
const quante = (sorgente.match(/\.from\("workshop_fasi_stato"\)\s*\n\s*\.update\(/g) ?? []).length;
ok(quante === 2, `le scritture su workshop_fasi_stato nel cron sono due, entrambe guardate (ne trova ${quante})`);

const finale = marcaAncheIlFinale(sorgente);
ok(finale.ok, finale.ok ? "nel cron: la resa scrive anche quale delle due generazioni si è arresa" : `nel cron: ${finale.perche}`);

// E che la query dell'alert dica la stessa cosa della riga: è il testo che una
// persona copia-incolla quando cerca i guasti, e se resta indietro manda a
// guardare un posto solo dei due.
ok(
  /finale_esito\s+is not null and finale_esito\s+&lt;&gt; 'riuscita'/.test(sorgente),
  "la query dei guasti nell'alert cerca anche le rese del feedback finale",
);

// ── nessun guasto resta solo in un console.error ───────────────────────────
// Dal 19/09 il motore scrive i propri guasti in `public.guasti`, e la
// proprietà che tiene quella tabella viva nel tempo è una sola: **ogni
// `console.error` del motore o passa da `segnalaGuasto`, o è dichiarato qui
// sotto come solo diagnostico, con il motivo scritto accanto.**
//
// È la stessa forma della guardia sul filtro dei log (`npm run test:banco`):
// là si confronta il filtro con le righe che il cron scrive davvero, qui si
// confronta la tabella con le righe che il cron scrive davvero. Senza, la
// tabella invecchia come è invecchiato il filtro — un ramo d'errore nuovo, e
// nessuno se ne accorge finché non manca una consegna a qualcuno.
console.log("");

// Ognuna di queste NON è «una cosa che non è successa per qualcuno»: sono
// letture che servono a comporre i NUMERI della mail di osservabilità. Se
// cadono, la mail riporta un conteggio sbagliato — va saputo, ma non è un
// guasto di prodotto e non va nella tabella dei guasti.
//
// L'unica eccezione, e sta nel codice non qui, è l'invio della mail stessa:
// quello SI registra, perché è il guasto che nasconde tutti gli altri.
const SOLO_DIAGNOSTICI = [
  ["Alert — errore lettura profili di prova:", "serve solo a separare i numeri del robot da quelli veri nella mail"],
  ["Alert — eccezione lettura profili di prova:", "idem, per il ramo eccezione"],
  ["Alert revisore — errore lettura revisore_esiti:", "conteggio per la mail, non un artefatto mancante"],
  ["Alert revisore — eccezione lettura revisore_esiti:", "idem, per il ramo eccezione"],
  ["Alert test — errore lettura test_attempt:", "conteggio per la mail"],
  ["Alert test — eccezione conteggio senza esito:", "idem, per il ramo eccezione"],
  ["Alert guardia lingua — errore lettura:", "conteggio per la mail"],
  ["Alert guardia lingua — eccezione lettura:", "idem, per il ramo eccezione"],
];

// Il primo argomento di ogni `console.error`, fino alla prima interpolazione.
const RE_ERRORE = /console\.error\(\s*(?:"([^"]*)"|`([\s\S]*?)(?:\$\{|`))/g;
const scritte = [...sorgente.matchAll(RE_ERRORE)].map((m) => (m[1] ?? m[2]).trim()).filter(Boolean);

// In quale direzione sbaglia l'estrattore quando sbaglia: se ne perde una, il
// test passa e nessuno lo sa — la risposta comoda. Quindi si confronta con
// quante ce ne sono davvero.
const quanteErrore = (sorgente.match(/console\.error\(/g) ?? []).length;
ok(scritte.length === quanteErrore, `l'estrattore vede tutte le righe di errore del cron (${scritte.length} su ${quanteErrore})`);

const dichiarati = new Set(SOLO_DIAGNOSTICI.map(([t]) => t));
const nonDichiarati = scritte.filter((s) => !dichiarati.has(s));
ok(
  nonDichiarati.length === 0,
  nonDichiarati.length === 0
    ? `ogni console.error rimasto nel cron è dichiarato diagnostico (${scritte.length}); gli altri guasti passano da segnalaGuasto`
    : `${nonDichiarati.length} console.error non registrano e non sono dichiarati diagnostici: ${nonDichiarati.slice(0, 3).map((s) => `«${s}»`).join(", ")}`,
);

// Una lista che nessuno pota è una lista che smette di dire qualcosa: una voce
// che non esiste più nel file va tolta, non lasciata a fare volume.
const stantii = SOLO_DIAGNOSTICI.filter(([t]) => !sorgente.includes(t)).map(([t]) => t);
ok(stantii.length === 0, stantii.length === 0 ? "…e la lista non contiene voci scomparse dal codice" : `voci stantie da togliere: ${stantii.join(", ")}`);

// E che i guasti si registrino davvero, invece di essere solo stampati: il
// motore ha un helper per riga (`guasto`) più le chiamate dirette fuori dal
// ciclo, dove una riga non c'è.
ok(/await segnalaGuasto\(/.test(sorgente), "il cron chiama segnalaGuasto");
ok(/const guasto = \(/.test(sorgente) && (sorgente.match(/await guasto\(/g) ?? []).length >= 10, "…e dentro il ciclo passa dall'helper che riempie iscrizione, tappa e di_prova");

// Controprova: il codice di ieri — un console.error nuovo e non dichiarato —
// deve essere rosso. Se non lo fosse, il controllo sopra non starebbe
// guardando niente.
const CODICE_DI_IERI = `console.error("Errore avanzamento tappa (iscrizione x):", e);`;
const scritteIeri = [...CODICE_DI_IERI.matchAll(RE_ERRORE)].map((m) => (m[1] ?? m[2]).trim());
ok(scritteIeri.length === 1 && !dichiarati.has(scritteIeri[0]), "…e diventa rosso su un console.error nuovo che non registra niente");

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Nessuna tappa avanza su una marcatura che non si sa se è atterrata,\n  e nessun guasto noto resta solo in un log che scade.\n");
