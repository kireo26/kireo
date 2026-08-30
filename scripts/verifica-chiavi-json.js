// Le chiavi che il prompt CHIEDE e quelle che il validatore PRETENDE.
//
// PERCHÉ ESISTE. Il 2026-08-31 la revisione di tappa è passata da
// `punti_forza` a `cosa_regge`. La rinomina è arrivata in quattro posti — il
// prompt, il tipo, il lettore, il pannello — e non nel quinto: il blocco che
// decide se la risposta del modello si salva o si butta. Risultato: ogni tappa
// di mezza passata a `forma_non_valida`, tre tentativi ciascuna, fiducia 0 su
// lavori giusti. Uno studente vero avrebbe letto quattro pannelli vuoti senza
// che niente gli dicesse che il guasto non era suo.
//
// PERCHÉ NESSUN CONTROLLO L'AVEVA PRESA. Il validatore legge un
// `Record<string, unknown>`, e su un Record **qualunque chiave è legale**: il
// compilatore non ha niente da controllare, ESLint nemmeno, la build passa. Il
// confine JSON è l'unico punto in cui i tipi smettono di guardare, ed è anche
// l'unico che decide se il lavoro di uno studente esiste.
//
// COME FUNZIONA. Estrae dai prompt gli scheletri JSON («Rispondi SOLO con
// JSON: { "chiave": ... }»), estrae dai validatori le chiavi che toccano
// (`parsed.chiave`), accoppia ogni validatore allo scheletro con cui ha più
// chiavi in comune, e pretende una cosa sola:
//
//     ogni chiave che il prompt CHIEDE dev'essere TOCCATA dal validatore.
//
// È la direzione che prende il difetto: il prompt chiede `cosa_regge`, il
// validatore guarda solo `punti_forza`, e la risposta buona finisce nel
// cestino. La direzione opposta — il validatore tocca una chiave che il prompt
// non chiede — è solo una nota: è quello che fa un `parsed.a ?? parsed.b`
// tenuto per retro-compatibilità, ed è legittimo.
//
// L'ACCOPPIAMENTO NON HA UNA TABELLA, di proposito: una tabella è una cosa da
// aggiornare, e questa classe di difetto nasce proprio da due liste che
// nessuno aggiorna insieme. Si accoppia per somiglianza, e un validatore che
// non somiglia a nessuno scheletro è un errore, non un silenzio.
//
// Esecuzione: `npm run test:chiavi`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function tuttiITs(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) out.push(...tuttiITs(p));
    else if (voce.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

// ── gli scheletri chiesti dai prompt ───────────────────────────────────────
// Due forme, tutte e due in uso: lo scheletro su più righe (i prompt dei
// revisori workshop) e quello in linea dentro una frase (i prompt di Escape).
// Ogni scheletro si porta dietro il nome della funzione che lo contiene, che è
// quello che poi si legge nel messaggio d'errore.
function scheletri(testo, rel) {
  const trovati = [];
  const righe = testo.split("\n");

  const nomeFunzione = (indiceRiga) => {
    for (let i = indiceRiga; i >= 0; i--) {
      const m = righe[i].match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)|(?:export\s+)?const\s+([A-Za-z0-9_]+)\s*[:=]/);
      // Un nome di una o due lettere è quasi sempre una variabile di appoggio
      // in mezzo al testo, non la funzione che contiene lo scheletro: un
      // messaggio d'errore che dice «f» non porta nessuno alla riga giusta.
      const prop = righe[i].match(/^\s*([A-Za-z0-9_]+)\s*:\s*\(/);
      const nome = m?.[1] || m?.[2] || prop?.[1];
      if (nome && nome.length > 2) return nome;
    }
    return "?";
  };

  // a) su più righe: blocchi consecutivi di `  "chiave": ...`
  let blocco = null;
  righe.forEach((riga, i) => {
    const m = riga.match(/^\s*"([a-z_]+)"\s*:/);
    if (m) {
      if (!blocco) blocco = { nome: nomeFunzione(i), riga: i + 1, chiavi: [] };
      blocco.chiavi.push(m[1]);
    } else if (blocco) {
      if (blocco.chiavi.length >= 2) trovati.push({ ...blocco, file: rel });
      blocco = null;
    }
  });
  if (blocco && blocco.chiavi.length >= 2) trovati.push({ ...blocco, file: rel });

  // b) in linea: `{"aree":[{"area_slug":"...","curiosity":0.0}]}`
  // SOLO LE CHIAVI DI PRIMO LIVELLO. Uno scheletro come
  // `{"aree":[{"area_slug":"…","interest":0.0}]}` chiede UNA chiave al
  // validatore — `aree` — e le altre le legge dagli elementi dell'array.
  // Confrontarle tutte insieme con quelle toccate su `parsed` produceva un
  // allarme su un validatore che funziona.
  righe.forEach((riga, i) => {
    if (/^\s*"[a-z_]+"\s*:/.test(riga)) return; // già preso da (a)
    const inizio = riga.search(/\{\s*\\?"[a-z_]+\\?"\s*:/);
    if (inizio < 0) return;
    const chiavi = [];
    let profondita = 0;
    for (let k = inizio; k < riga.length; k++) {
      const c = riga[k];
      if (c === "{" || c === "[") profondita++;
      else if (c === "}" || c === "]") profondita--;
      else if (c === '"' && profondita === 1) {
        const resto = riga.slice(k);
        const m = resto.match(/^"([a-z_]+)\\?"\s*:/);
        if (m) chiavi.push(m[1]);
      }
      if (profondita === 0 && k > inizio) break;
    }
    // Stessa ragione della soglia dei validatori: uno scheletro con una
    // chiave sola («{"aree":[…]}») è uno scheletro. Si chiede in cambio che la
    // riga dichiari di stare chiedendo del JSON, o qualunque graffa con dentro
    // due punti diventerebbe un prompt.
    const minimo = /JSON/i.test(riga) ? 1 : 2;
    if (chiavi.length >= minimo) trovati.push({ nome: nomeFunzione(i), riga: i + 1, chiavi: [...new Set(chiavi)], file: rel });
  });

  return trovati;
}

// ── le chiavi che un validatore tocca ──────────────────────────────────────
// L'ancoraggio è il cast del campo `.dati` — cioè della risposta AI, che è
// quello che `EsitoAI` restituisce: `const parsed = esito.dati as {...}` è
// letteralmente il punto in cui il JSON del modello diventa tipato per
// affermazione. Due tentativi scartati prima di arrivarci, e vale la pena
// sapere perché:
//   · ancorare all'`if (` vedeva quattro validatori su sei — quelli di Escape
//     validano con un cast e un ternario, senza `if`. Un controllo che copre
//     due terzi senza dirlo è peggio di nessuno, perché chiude la domanda;
//   · ancorare a QUALUNQUE `as {` ne trovava cinque che non c'entrano niente
//     (i metadata di registrazione: `user_metadata as { nome, cognome… }`).
//     Un controllo che grida su cose giuste è un controllo che qualcuno
//     disattiva.
const FINESTRA_DOPO = 30;

function validatori(testo, rel) {
  const righe = testo.split("\n");
  const trovati = [];
  righe.forEach((riga, i) => {
    const m = riga.match(/(?:const|let)\s+([A-Za-z0-9_]+)\s*=\s*[^;]*\.dati\s+as\s*(\{|Record<)/);
    if (!m) return;
    const nome = m[1];
    const finestra = righe.slice(i, Math.min(righe.length, i + FINESTRA_DOPO)).join("\n");
    const re = new RegExp(`\\b${nome}\\.([a-z_]+)`, "g");
    const chiavi = [...new Set([...finestra.matchAll(re)].map((x) => x[1]))];
    // Anche le chiavi dichiarate NEL CAST: `as { aree?: unknown[] }` dice cosa
    // il validatore si aspetta anche prima di leggerlo.
    const nelCast = [...riga.matchAll(/([a-z_]+)\??\s*:/g)].map((x) => x[1]);
    const tutte = [...new Set([...chiavi, ...nelCast])];
    // NESSUNA SOGLIA sul numero di chiavi: l'ancoraggio `.dati as` è già
    // preciso, e una soglia a due faceva sparire in silenzio il sesto confine
    // del repo — quello della riflessione Escape, che di chiavi ne ha una
    // sola. Un confine non controllato che non si vede è peggio di uno
    // controllato male.
    if (tutte.length >= 1) trovati.push({ file: rel, riga: i + 1, chiavi: tutte, richieste: tutte });
  });
  return trovati;
}

// Chiavi che un prompt chiede DI PROPOSITO senza che nessuno le legga. Ognuna
// con la sua ragione, come le esenzioni di test:prova: un elenco di eccezioni
// senza motivi è un elenco che cresce.
const CHIESTE_E_NON_LETTE = new Map([
  [
    "giudizio_complessivo",
    "Slot per la frase di chiusura che il modello tende a scrivere: se ha un posto DENTRO il JSON non l'appende dopo la graffa, ed è la coppia della riga anti-poscritto di chiamaJson. Registrato in lib/escape/scoring.ts.",
  ],
]);

const comuni = (a, b) => a.filter((x) => b.includes(x)).length;

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };

console.log("\n═══ Le chiavi chieste e le chiavi pretese ═══\n");

const files = [...tuttiITs(path.join(ROOT, "lib")), ...tuttiITs(path.join(ROOT, "app"))];
const tuttiScheletri = [];
const tuttiValidatori = [];
for (const f of files) {
  const testo = fs.readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f);
  tuttiScheletri.push(...scheletri(testo, rel));
  tuttiValidatori.push(...validatori(testo, rel));
}

ok(tuttiScheletri.length > 0, `trovati ${tuttiScheletri.length} scheletri JSON nei prompt`);
ok(tuttiValidatori.length > 0, `trovati ${tuttiValidatori.length} validatori che leggono una risposta`);

for (const v of tuttiValidatori) {
  // Lo scheletro con cui questo validatore ha più chiavi in comune.
  const classifica = tuttiScheletri
    .map((s) => ({ s, punti: comuni(s.chiavi, v.chiavi) }))
    .sort((a, b) => b.punti - a.punti);
  const migliore = classifica[0];

  if (!migliore || migliore.punti === 0) {
    ok(false, `${v.file}:${v.riga} pretende ${v.richieste.join(", ")} e non somiglia a nessuno scheletro di prompt\n      → o il prompt è altrove e questo controllo non lo vede, o quel validatore sta guardando chiavi che nessuno chiede più.`);
    continue;
  }

  const s = migliore.s;
  const mancanti = s.chiavi.filter((k) => !v.chiavi.includes(k) && !CHIESTE_E_NON_LETTE.has(k));
  for (const k of s.chiavi.filter((k) => !v.chiavi.includes(k) && CHIESTE_E_NON_LETTE.has(k))) {
    console.log(`      nota: «${k}» è chiesta e non letta di proposito — ${CHIESTE_E_NON_LETTE.get(k).slice(0, 90)}…`);
  }
  ok(
    mancanti.length === 0,
    `${s.nome} (${s.file}:${s.riga}) → ${v.file}:${v.riga}` +
      (mancanti.length === 0
        ? ": ogni chiave chiesta è guardata"
        : `\n      IL PROMPT CHIEDE «${mancanti.join(", ")}» E IL VALIDATORE NON LA GUARDA.\n      La risposta del modello finirà scartata come forma non valida, e la\n      tappa avanzerà a zero su un lavoro giusto. Il validatore guarda: ${v.chiavi.join(", ")}.`),
  );

  // Nota, non errore: una chiave pretesa che il prompt non chiede più è
  // quasi sempre un `?? parsed.vecchia` tenuto per lo storico.
  const inPiu = v.richieste.filter((k) => !s.chiavi.includes(k));
  if (inPiu.length > 0) console.log(`      nota: guarda anche «${inPiu.join(", ")}», che ${s.nome} non chiede — di solito è retro-compatibilità`);
}

console.log("\n═══════════════════════════════════════════\n");
if (falliti) {
  console.error(`✗ ${falliti} controlli falliti.`);
  console.error("  Una rinomina va inseguita fin dove i tipi smettono di vedere: al confine");
  console.error("  JSON il compilatore non è più una rete, e lì la chiave decide se il");
  console.error("  lavoro di uno studente esiste.\n");
  process.exit(1);
}
console.log("✓ Ogni chiave chiesta da un prompt è guardata da chi valida la risposta.\n");
