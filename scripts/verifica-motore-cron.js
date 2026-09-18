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

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log("✓ Nessuna tappa avanza su una marcatura che non si sa se è atterrata.\n");
