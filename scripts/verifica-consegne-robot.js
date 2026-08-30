// Verifica dei file di consegne del robot (scripts/banco/consegne/*.json).
//
// Il robot non esiste ancora: questo controlla che il materiale con cui girerà
// sia buono PRIMA, invece di scoprirlo a metà di una passata da duecento
// chiamate a pagamento.
//
// LA COSA CHE CONTA: non verifica il formato contro il documento del formato —
// verifica le consegne contro il MOTORE VERO. Gli id delle sezioni, i minimi,
// le colonne e soprattutto `sezioniIncomplete` sono quelli importati da
// `lib/workshop/elaboratoValore.ts`, cioè lo stesso identico gate che il robot
// troverà quando proverà a consegnare. Un controllo scritto a parte
// direbbe che va tutto bene fino al giorno in cui il gate cambia.
//
// Esecuzione: `npm run test:consegne`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
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

const { WORKSHOP_ELABORATO } = require("@/lib/workshop/elaborato-config");
const { sezioniIncomplete } = require("@/lib/workshop/elaboratoValore");

const DIR = path.join(ROOT, "scripts", "banco", "consegne");

let falliti = 0;
const ok = (cond, msg) => { if (!cond) { console.error("  ✗ " + msg); falliti++; } else { console.log("  ✓ " + msg); } };
const nota = (msg) => console.log("  · " + msg);

// La forma che ogni tipo di sezione si aspetta. È la stessa di ValoreSezione,
// e se un giorno divergesse il controllo su `sezioniIncomplete` più sotto se ne
// accorgerebbe comunque — questo serve a dire QUALE campo è sbagliato invece di
// dire solo che la tappa non si consegna.
function formaGiusta(sezione, valore) {
  switch (sezione.tipo) {
    case "testo":
    case "testo_lungo":
      return typeof valore === "string" ? null : "doveva essere una stringa";
    case "tabella": {
      if (!Array.isArray(valore)) return "doveva essere un array di righe";
      const colonne = (sezione.colonne ?? []).length;
      const storta = valore.findIndex((r) => !Array.isArray(r) || r.length !== colonne);
      return storta === -1 ? null : `la riga ${storta + 1} ha ${valore[storta]?.length ?? "?"} celle invece di ${colonne}`;
    }
    case "checklist": {
      if (!valore || typeof valore !== "object" || Array.isArray(valore)) return "doveva essere { voci, nota }";
      // Le chiavi di `voci` sono le VOCI ESATTE del config: una voce con una
      // parola diversa non fa fallire niente, si salva e semplicemente a
      // schermo non risulta spuntata. Un errore che non si vede è peggio di
      // uno che si vede.
      const ammesse = sezione.voci ?? [];
      const inventata = Object.keys(valore.voci ?? {}).find((v) => !ammesse.includes(v));
      return inventata ? `la voce «${inventata}» non esiste nella checklist del config` : null;
    }
    case "scelta": {
      if (!valore || typeof valore !== "object" || !("opzione" in valore)) return "doveva essere { opzione, motivazione }";
      // Stessa cosa: `sezioneRaggiungeMinimo` guarda solo che `opzione` non sia
      // vuota, quindi un'opzione scritta a modo suo passerebbe il gate e
      // arriverebbe al revisore come una scelta che il progetto non offre.
      const opzioni = sezione.opzioni ?? [];
      if (opzioni.length > 0 && !opzioni.includes(valore.opzione)) {
        return `l'opzione «${valore.opzione}» non è fra quelle del config (${opzioni.join(" / ")})`;
      }
      return null;
    }
    case "immagine":
      return typeof valore === "string" ? null : "doveva essere un percorso Storage (o essere omessa)";
    default:
      return `tipo di sezione sconosciuto: ${sezione.tipo}`;
  }
}

function validaFile(rel) {
  console.log(`\n─── ${rel}`);
  let dati;
  try {
    dati = JSON.parse(fs.readFileSync(path.join(DIR, rel), "utf8"));
  } catch (errore) {
    ok(false, `JSON non valido: ${errore.message}`);
    return;
  }

  const ruoliDelWorkshop = WORKSHOP_ELABORATO[dati.workshop];
  ok(Boolean(ruoliDelWorkshop), `il workshop «${dati.workshop}» esiste nel motore`);
  if (!ruoliDelWorkshop) return;

  for (const [ruoloSlug, ruolo] of Object.entries(dati.ruoli ?? {})) {
    const def = ruoliDelWorkshop[ruoloSlug];
    if (!def) { ok(false, `${ruoloSlug}: ruolo inesistente in questo workshop`); continue; }

    const livello = ruolo.livello;
    if (livello !== "base" && livello !== "trappola") { ok(false, `${ruoloSlug}: livello «${livello}» — dev'essere "base" o "trappola"`); continue; }

    // Tutte le tappe, altrimenti il robot non arriva in fondo e il feedback
    // finale — quello che ci interessa di più — non si genera mai.
    const attese = def.fasi.map((f) => f.id);
    const date = Object.keys(ruolo.tappe ?? {});
    const mancanti = attese.filter((t) => !date.includes(t));
    const inventate = date.filter((t) => !attese.includes(t));
    ok(mancanti.length === 0, `${ruoloSlug}: tutte e ${attese.length} le tappe${mancanti.length ? ` — mancano ${mancanti.join(", ")}` : ""}`);
    ok(inventate.length === 0, `${ruoloSlug}: nessuna tappa inventata${inventate.length ? ` — ${inventate.join(", ")} non esistono` : ""}`);

    for (const fase of def.fasi) {
      const tappa = ruolo.tappe?.[fase.id];
      if (!tappa) continue;
      const dove = `${ruoloSlug}/${fase.id}`;

      // sezioni: id validi e forma giusta
      const idValidi = fase.sezioni.map((s) => s.id);
      const sconosciute = Object.keys(tappa.sezioni ?? {}).filter((id) => !idValidi.includes(id));
      ok(sconosciute.length === 0, `${dove}: nessuna sezione sconosciuta${sconosciute.length ? ` — ${sconosciute.join(", ")}` : ""}`);

      let formeOk = true;
      for (const sezione of fase.sezioni) {
        const valore = tappa.sezioni?.[sezione.id];
        if (valore === undefined) continue; // omessa di proposito: lo dirà sezioniIncomplete
        const problema = formaGiusta(sezione, valore);
        if (problema) { ok(false, `${dove}/${sezione.id}: ${problema}`); formeOk = false; }
      }
      if (formeOk) ok(true, `${dove}: forme dei valori coerenti coi tipi del config`);

      // IL CONTROLLO CHE VALE: il gate vero, la stessa funzione che girerà
      // quando il robot proverà a consegnare.
      const incomplete = sezioniIncomplete(fase, tappa.sezioni ?? {});
      if (livello === "base") {
        ok(incomplete.length === 0, `${dove}: la tappa si consegna${incomplete.length ? ` — sotto il minimo: ${incomplete.join(", ")}` : ""}`);
      } else if (incomplete.length > 0) {
        // Su una trappola una sezione lasciata sotto il minimo è LEGITTIMA e
        // può essere il punto della prova — ma il robot si fermerà lì, quindi
        // deve essere una scelta e non una svista.
        nota(`${dove}: sotto il minimo su ${incomplete.join(", ")} — su una trappola può essere voluto, ma il robot si fermerà qui e lo riporterà`);
      }

      // chat: mai meno del minimo, e se di più costa
      const quanti = (tappa.chat ?? []).length;
      ok(quanti >= fase.chatMinima, `${dove}: ${quanti} messaggi di chat (minimo ${fase.chatMinima})`);
      if (quanti > fase.chatMinima) nota(`${dove}: ${quanti - fase.chatMinima} messaggi oltre il minimo — il robot non li manderà, ogni messaggio è una chiamata`);
      const vuoti = (tappa.chat ?? []).filter((m) => typeof m !== "string" || m.trim() === "").length;
      ok(vuoti === 0, `${dove}: nessun messaggio vuoto`);
    }

    if (livello === "trappola") {
      const a = ruolo.atteso ?? {};
      ok(Boolean(ruolo.nome), `${ruoloSlug}: la trappola ha un nome`);
      ok(Boolean(a.tappa) && attese.includes(a.tappa), `${ruoloSlug}: «atteso.tappa» punta a una tappa che esiste`);
    }
  }
}

console.log("\n═══ Le consegne del robot, contro il motore vero ═══");

if (!fs.existsSync(DIR)) {
  console.log("\nNessuna cartella scripts/banco/consegne: niente da controllare.\n");
  process.exit(0);
}
// Anche le trappole, che stanno in una sottocartella: un `readdirSync` piatto
// le salterebbe in silenzio, e un file di consegne non controllato è
// esattamente quello che questo script esiste per impedire.
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".json"));
const dirTrappole = path.join(DIR, "trappole");
if (fs.existsSync(dirTrappole)) {
  for (const f of fs.readdirSync(dirTrappole)) if (f.endsWith(".json")) files.push(path.join("trappole", f));
}
if (files.length === 0) {
  console.log("\nNessun file di consegne ancora scritto.\n");
  process.exit(0);
}
for (const f of files) validaFile(f);

console.log("\n═══════════════════════════════════════════\n");
if (falliti) { console.error(`✗ ${falliti} controlli falliti.\n`); process.exit(1); }
console.log(`✓ ${files.length} file di consegne: il robot può girarli senza fermarsi su un dato sbagliato.\n`);
