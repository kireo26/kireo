// Un 5xx che non lascia una riga nei log non è mai successo.
//
// PERCHÉ ESISTE. Il 13/09 due ruoli del robot si sono fermati con «la chat ha
// risposto 500», e nei log di Vercel c'erano 447 righe e nessun errore. Non
// era lo strumento a essere cieco: in `app/api/workshop/cliente-chat/route.ts`
// quel `return erroreDiCortesia(..., 500)` era l'unico degli otto punti del
// file a non scrivere niente prima — e buttava via il messaggio della RPC,
// l'unica cosa che diceva perché il database avesse rifiutato.
//
// LA REGOLA, e il confine. Un 4xx è una risposta al chiamante: dice che la
// richiesta era sbagliata, e può tacere. Un 5xx dice che ci siamo rotti NOI, e
// chi legge il log è l'unico che può ripararlo. Quindi: nessun ritorno con
// stato 5xx senza un `console.error` nel ramo che lo produce.
//
// COSA GUARDA. Solo i route handler sotto `app/` — sono gli unici punti che
// scelgono uno stato HTTP. Il ramo è delimitato guardando l'indentazione: si
// risale finché le righe stanno dentro lo stesso blocco, e ci si ferma
// sull'apertura del blocco o su un `return` di un ramo fratello (quello che
// sta prima appartiene a un'altra strada, e il suo log non conta per questa).
//
// Esecuzione: `npm run test:log5xx`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "app");

function routeHandlers(dir, out = []) {
  for (const voce of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, voce.name);
    if (voce.isDirectory()) routeHandlers(p, out);
    else if (voce.name === "route.ts" || voce.name === "route.tsx") out.push(p);
  }
  return out;
}

const indentDi = (riga) => riga.length - riga.trimStart().length;

// Una riga che costruisce una risposta con stato 5xx: `{ status: 503 }` oppure
// un helper chiamato con lo stato come ultimo argomento (`..., 500)`).
const RIGA_5XX = /status\s*:\s*(5\d\d)\b|,\s*(5\d\d)\s*[,)]/;

// Dove comincia lo statement: la riga del 5xx può essere la coda di un
// `return` spezzato su più righe (succede quando il messaggio è lungo).
function inizioStatement(righe, i) {
  for (let j = i; j >= 0 && i - j <= 8; j--) {
    if (/^return\b/.test(righe[j].trim())) return j;
  }
  return i;
}

// Il ramo che produce questo ritorno: dalla riga di apertura del blocco fino
// al `return` stesso.
function ramo(righe, inizio) {
  const d = indentDi(righe[inizio]);
  let j = inizio - 1;
  for (; j >= 0; j--) {
    const riga = righe[j];
    if (!riga.trim()) continue;
    if (indentDi(riga) < d) break; // apertura del blocco: la si include e si smette
    // Qualunque `return` incontrato risalendo chiude la strada: il controllo
    // se n'è già andato da lì, quindi ciò che sta ancora più su appartiene a
    // un altro ramo e il suo log non vale per questo. Senza questa riga un
    // `console.error` dentro un `if` che ritorna 400 coprirebbe il 500 scritto
    // subito dopo — provato sotto, non dedotto.
    if (/^return\b/.test(riga.trim())) {
      j++;
      break;
    }
  }
  return righe.slice(Math.max(0, j), inizio + 1).join("\n");
}

// ── controprova interna ─────────────────────────────────────────────────────
// Un controllo che grida su cose giuste viene disattivato; uno che tace su
// cose sbagliate non serve. Queste due tarature sono quelle su cui il ramo
// poteva sbagliarsi davvero, quindi si provano a ogni giro invece di fidarsi
// della lettura.
function provaRamo(nome, sorgente, deveTrovareIlLog) {
  const righe = sorgente.split("\n");
  const i = righe.findIndex((r) => RIGA_5XX.test(r));
  const trovato = /console\.error/.test(ramo(righe, inizioStatement(righe, i)));
  if (trovato !== deveTrovareIlLog) {
    console.error(`  ✗ taratura del ramo: ${nome}`);
    return 1;
  }
  return 0;
}

const LOG_DI_UN_ALTRO_RAMO = [
  "  if (a) {",
  "    console.error('questo log è di un altro ramo');",
  "    return erroreDiCortesia('...', 400);",
  "  }",
  "  return erroreDiCortesia('...', 500);",
].join("\n");

const LOG_IN_UN_BLOCCO_PRIMA = [
  "  } catch (errore) {",
  "    if (salvataggio) {",
  "      console.error('questo log è dello stesso ramo');",
  "    }",
  "",
  "    return erroreDiCortesia('...', 503);",
].join("\n");

let tarature = 0;
tarature += provaRamo("un log dentro un ramo che ritorna prima non copre il 5xx dopo", LOG_DI_UN_ALTRO_RAMO, false);
tarature += provaRamo("un log in un blocco senza return resta dello stesso ramo", LOG_IN_UN_BLOCCO_PRIMA, true);
if (tarature) {
  console.error("\n✗ Il controllo non sa più distinguere i rami: va ritarato prima di fidarsene.\n");
  process.exit(1);
}

let muti = 0;
let controllati = 0;
const file = routeHandlers(APP).sort();

console.log("\n═══ Nessun 5xx muto ═══\n");

for (const percorso of file) {
  const righe = fs.readFileSync(percorso, "utf8").split("\n");
  const rel = path.relative(ROOT, percorso);

  for (let i = 0; i < righe.length; i++) {
    const m = righe[i].match(RIGA_5XX);
    if (!m) continue;
    const stato = Number(m[1] ?? m[2]);
    if (stato < 500 || stato > 599) continue;

    const inizio = inizioStatement(righe, i);
    if (!/\breturn\b/.test(righe.slice(inizio, i + 1).join(" "))) continue; // non è un ritorno

    controllati++;
    const testo = ramo(righe, inizio);
    if (!/console\.error/.test(testo)) {
      console.error(`  ✗ ${rel}:${i + 1} — ${stato} senza console.error nel ramo`);
      muti++;
    }
  }
}

console.log(`\n  ${controllati} ritorni 5xx controllati in ${file.length} route handler.`);
console.log("\n═══════════════════════\n");

if (muti) {
  console.error(
    `✗ ${muti} ritorni 5xx non scrivono niente nei log.\n` +
      "  Un 5xx dice che ci siamo rotti noi: senza una riga, il guasto non è mai successo.\n" +
      "  Aggiungi un console.error con il messaggio dell'errore vero (non quello di cortesia).\n",
  );
  process.exit(1);
}
if (controllati === 0) {
  console.error("✗ Nessun ritorno 5xx trovato: il controllo sta guardando nel posto sbagliato.\n");
  process.exit(1);
}
console.log("✓ Ogni 5xx lascia una riga nei log.\n");
