// `npm run banco robot [filtro]` — il secondo pezzo del banco.
//
// Gioca i workshop come uno studente, dall'iscrizione al feedback finale, e
// alla fine misura i testi che i revisori hanno scritto.
//
// TRE COSE CHE VALGONO PIÙ DEL CODICE, e stanno qui perché chi lo apre le
// legga prima di modificarlo:
//
// 1. DALLA PORTA. Sessione vera, le stesse route, gli stessi gate. Se un gate
//    blocca il robot, il robot SI FERMA E LO RIPORTA: non riempie una sezione
//    per passare, non inventa un messaggio, non aggira un cooldown. La
//    scoperta migliore del 30 agosto è venuta da un gate che ha morso.
// 2. NON PARTE SU UN ACCOUNT VERO. Il flag `profiles.di_prova` si controlla
//    prima di scrivere qualunque cosa (vedi sessione.js): le righe scritte da
//    un account non marcato non si distinguono più, mai.
// 3. DICE QUANTO SPENDE PRIMA DI PARTIRE. Oltre cinquecento chiamate a giro
//    non sono una cosa che parte per sbaglio.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");
// Leggere il TypeScript del prodotto (le fasi dei workshop) sta in un file
// suo: lo usa anche `banco studente`, e due copie di un registratore di
// estensioni divergono come qualunque altra coppia.
const { abilitaTypeScript, ROOT } = require("../ts");
abilitaTypeScript();

const { WORKSHOP_ELABORATO } = require("@/lib/workshop/elaborato-config");
const { apriSessione } = require("./sessione");
const { giocaRuolo } = require("./gioca");
const { misura, stampaRapporto } = require("./misura");
const { allineamento } = require("../allineamento");
const { statoProduzione } = require("../vercel");
const { leggiGuasti, perSpecie } = require("../guasti");

const DIR_CONSEGNE = path.join(ROOT, "scripts", "banco", "consegne");
// Le trappole stanno in una cartella loro: un ruolo per file, così ognuna si
// lancia da sola. Vanno lette esplicitamente — un `readdirSync` piatto sulla
// cartella padre non le vedrebbe, e il file finirebbe ignorato in silenzio
// (il modo peggiore di fallire: «nessun ruolo corrisponde» invece di un
// errore).
const DIR_TRAPPOLE = path.join(DIR_CONSEGNE, "trappole");

function fileConsegne() {
  const elenco = [];
  for (const dir of [DIR_CONSEGNE, DIR_TRAPPOLE]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (f.endsWith(".json")) elenco.push(path.join(dir, f));
  }
  return elenco;
}

// I due predicati del cancello, chiesti a chi li definisce (migrazione
// 20260920100000). Restituisce true/false, oppure null quando non si è potuto
// leggere — e chi chiama tratta null come «parti lo stesso».
async function cancelloApertoPerIWorkshop(sessione) {
  try {
    const [esperienza, gia] = await Promise.all([
      sessione.supabase.rpc("ha_esperienza_percorso"),
      sessione.supabase.rpc("e_gia_entrato_in_un_workshop"),
    ]);
    if (esperienza.error || gia.error) {
      console.error("  ⚠  non ho potuto leggere il cancello dei workshop:", (esperienza.error ?? gia.error).message);
      return null;
    }
    return esperienza.data === true || gia.data === true;
  } catch (errore) {
    console.error("  ⚠  non ho potuto leggere il cancello dei workshop:", errore?.message ?? errore);
    return null;
  }
}

// Il piano della passata: quali ruoli, e quanto costa. Puro, così il conto si
// può provare senza toccare la rete (vedi npm run test:robot).
// UNA TRAPPOLA NON ENTRA NELLA PASSATA COMPLETA, e non è una questione di
// conti. Gira sullo stesso ruolo di una `base` con una consegna diversa:
// nella stessa passata sarebbero due iscrizioni sullo stesso workshop per lo
// stesso account, e la seconda troverebbe la prima già completata. Le trappole
// si lanciano per nome, una alla volta — `npm run banco robot defibrillatore`
// — che è anche il modo in cui si vuole rileggerle.
function costruisciPiano(filtro) {
  const lavori = [];
  for (const f of fileConsegne()) {
    const dati = JSON.parse(fs.readFileSync(f, "utf8"));
    const definizioni = WORKSHOP_ELABORATO[dati.workshop];
    if (!definizioni) continue;
    for (const [ruoloSlug, consegne] of Object.entries(dati.ruoli ?? {})) {
      const def = definizioni[ruoloSlug];
      if (!def) continue;
      // Una trappola ha un nome suo, e il filtro deve poterla prendere per
      // quello: «npm run banco robot defibrillatore».
      const etichetta = `${dati.workshop} > ${ruoloSlug}`;
      // Una trappola si prende SOLO per il suo nome o per il suo file, mai per
      // il workshop o il ruolo: chi scrive «palestra» vuole i cinque ruoli
      // base, e trovarsi dentro anche una trappola sarebbe una sorpresa a
      // pagamento. `defibrillatore` la prende, `palestra` no.
      const trappola = consegne.livello === "trappola";
      const cercabile = (trappola ? `${consegne.nome ?? ""} ${path.basename(f, ".json")}` : etichetta).toLowerCase();
      if (!filtro && trappola) continue;
      if (filtro && !cercabile.includes(String(filtro).toLowerCase())) continue;
      // 2 chiamate per tappa (revisione + reazione) + la chat minima, e un
      // feedback finale sull'ultima.
      const chiamate = def.fasi.reduce((somma, fase) => somma + 2 + fase.chatMinima + (fase.ultima ? 1 : 0), 0);
      lavori.push({
        workshopSlug: dati.workshop,
        ruoloSlug,
        etichetta,
        consegne,
        fasi: def.fasi,
        chiamate,
        livello: consegne.livello,
        trappola,
        nome: consegne.nome ?? null,
        atteso: consegne.atteso ?? null,
      });
    }
  }
  return {
    lavori,
    chiamate: lavori.reduce((s, l) => s + l.chiamate, 0),
    tappe: lavori.reduce((s, l) => s + l.fasi.length, 0),
  };
}

// Il commit su cui la passata ha girato. Se git non risponde (una copia senza
// storia, un albero sporco) si dice, invece di scrivere qualcosa di plausibile.
function commitCorrente() {
  try {
    const sha = execSync("git rev-parse HEAD", { encoding: "utf8", cwd: ROOT }).trim();
    const titolo = execSync("git log -1 --pretty=%s", { encoding: "utf8", cwd: ROOT }).trim();
    const sporco = execSync("git status --porcelain", { encoding: "utf8", cwd: ROOT }).trim().length > 0;
    return { sha, titolo, sporco };
  } catch {
    return null;
  }
}

// Il verdetto della guardia, chiesto una volta sola. Porta con sé il commit
// locale perché è lo stesso valore che finisce nel rapporto: due letture di
// `git rev-parse` a distanza di un'ora sono due valori che possono divergere,
// e il rapporto deve nominare quello che la guardia ha controllato.
async function verificaAllineamento() {
  const locale = commitCorrente();
  const { deploys, perche } = await statoProduzione();
  return { ...allineamento({ locale, deploys, perche }), locale };
}

function chiediConferma(domanda) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((r) => rl.question(domanda, (a) => { rl.close(); r(a.trim().toLowerCase()); }));
}

async function robot(filtro) {
  const piano = costruisciPiano(filtro);

  // LA GUARDIA SI CHIEDE PRIMA DEL PIANO, e si stampa in due posti diversi.
  // Il 14/09 `banco robot senza-autore` ha risposto «Nessun ruolo corrisponde»
  // mentre questa cartella era indietro rispetto alla produzione: il file della
  // trappola esisteva, ma non in quel commit. La guardia c'era già e non ha
  // parlato, perché stava DOPO l'uscita per piano vuoto — un controllo giusto,
  // messo dopo il punto in cui serviva, che è la forma ricorrente dei difetti
  // di questi giorni.
  //
  // «Nessun ruolo corrisponde» è precisamente il sintomo in cui un
  // disallineamento è la spiegazione più probabile, quindi lì la guardia parla
  // per prima. E parla anche quando è tutto allineato: dire «sei allineato»
  // chiude l'ipotesi, e chi legge sa che il nome è sbagliato davvero.
  const stato = await verificaAllineamento();

  if (piano.lavori.length === 0) {
    console.log("");
    for (const riga of stato.righe) console.log("  " + riga);
    console.log(filtro ? `\nNessun ruolo corrisponde a «${filtro}».` : "\nNessun file di consegne in scripts/banco/consegne.");
    // La riga che unisce i due fatti, perché separati non dicono niente: è
    // esattamente la deduzione che il 14/09 ha dovuto fare una persona.
    if (filtro && (stato.esito === "disallineato" || stato.esito === "in-volo")) {
      console.log(`Con questa cartella non allineata, un nome che non si trova di solito è un file`);
      console.log(`che in questo commit non c'è ancora. Allinea e riprova prima di cercarlo altrove.`);
    }
    console.log("");
    return;
  }

  console.log(`\n═══════════ LA PASSATA ═══════════\n`);
  console.log(`  ${piano.lavori.length} ruoli, ${piano.tappe} tappe`);
  console.log(`  ~${piano.chiamate} chiamate AI a pagamento`);
  console.log(`  (2 per tappa — revisione e reazione del cliente — più la chat minima,`);
  console.log(`   più un feedback finale per ruolo)\n`);
  for (const l of piano.lavori) console.log(`  · ${l.etichetta}${l.livello === "trappola" ? `   [trappola: ${l.nome ?? "senza nome"}]` : ""}`);
  console.log("\n  Il robot gioca come uno studente vero: se un gate lo blocca si ferma");
  console.log("  e lo riporta, invece di aggirarlo.\n");

  // LA GUARDIA DI ALLINEAMENTO, prima della conferma e prima di qualunque
  // spesa (chiesta sopra, vedi il commento lì). Il robot gioca contro il SITO,
  // ma il rapporto porta il commit di QUESTA cartella: se i due non
  // coincidono, la passata attribuisce i suoi numeri a un codice che non ha
  // mai eseguito. Tre passate della giornata del 13/09 sono finite così, e in
  // due casi il sintomo è stato un 500 che non era del prodotto ma della
  // funzione spenta mentre ne saliva un'altra.
  for (const riga of stato.righe) console.log("  " + riga);
  console.log("");
  if (stato.esito === "in-volo" || stato.esito === "disallineato") {
    // Nessun flag per passare oltre, per lo stesso motivo per cui non c'è per
    // la conferma: una scorciatoia su una guardia che costa quattro dollari a
    // ignorarla è una scorciatoia che qualcuno prende di fretta.
    console.log("  Non parto: sarebbe una passata che misura un codice e ne nomina un altro.\n");
    return;
  }

  // LA CONFERMA NON SI SALTA, e non c'è un flag per farlo. Ce n'era uno,
  // `--vai`, che per via di npm non è mai arrivato fin qui: in settimane
  // nessuno l'ha reclamato, quindi nessuno lo usava. Questo comando è l'unico
  // del banco che spende — farlo funzionare adesso sarebbe stato aggiungere
  // una scorciatoia che nessuno aveva chiesto proprio al comando che costa.
  const risposta = await chiediConferma("Procedo? (scrivi «si») ");
  if (risposta !== "si" && risposta !== "sì") {
    console.log("Annullato: nessuna chiamata fatta.\n");
    return;
  }

  const sessione = await apriSessione();
  console.log(`\n✓ sessione aperta come ${sessione.profilo.nome ?? sessione.utente.email} (profilo di prova)\n`);

  // IL CANCELLO SI GUARDA PRIMA DI SPENDERE, e il robot NON PARTE se è chiuso.
  //
  // Dal 2026-09-20 i workshop si aprono dopo un'esperienza. Senza questa
  // guardia, una passata lanciata subito dopo `azzera-percorsi` produrrebbe
  // venticinque «fermato da un cancello» — e quella è la lista che leggiamo
  // per PRIMA, proprio perché lì un blocco è prezioso. Riempirla di blocchi
  // che non dicono niente sul prodotto, ma solo che il banco non si è
  // preparato, è il modo di renderla inutile: è già successo il 13/09 con i
  // `fetch failed`, e ci è costata una diagnosi.
  //
  // Sta QUI e non prima della conferma perché serve una sessione per sapere di
  // chi si parla — e a questo punto non è stato speso niente: la conferma non
  // costa, le chiamate cominciano nel ciclo qui sotto.
  //
  // DEGRADA VERSO IL PARTIRE, come il lato prodotto: se le due letture non
  // riescono (RPC non ancora migrata, rete), la passata parte e sarà semmai il
  // prodotto a fermarla. Fermare una passata per un difetto dello strumento è
  // la cosa che la guardia dell'allineamento ha già imparato a non fare.
  const cancello = await cancelloApertoPerIWorkshop(sessione);
  if (cancello === false) {
    console.log("Il robot non ha ancora i requisiti per iscriversi ai workshop.");
    console.log("Dal 2026-09-20 un workshop si apre dopo una missione completata");
    console.log("(o un workshop già consegnato), e questo profilo non ne ha.\n");
    console.log("  Lancia prima:  npm run banco studente\n");
    console.log("Nessuna chiamata fatta.\n");
    return;
  }

  // L'istante da cui leggere i guasti, alla fine. Si prende QUI e non dopo:
  // un guasto che capita al primo ruolo deve entrare nella finestra come
  // quello che capita all'ultimo. Un secondo indietro per non perdere una riga
  // scritta nello stesso istante in cui la sessione si apre.
  const inizioPassata = new Date(Date.now() - 1000).toISOString();

  const esiti = [];
  for (const lavoro of piano.lavori) {
    console.log(`── ${lavoro.etichetta}`);
    try {
      const esito = await giocaRuolo({
        sessione,
        workshopSlug: lavoro.workshopSlug,
        ruoloSlug: lavoro.ruoloSlug,
        consegne: lavoro.consegne,
        fasi: lavoro.fasi,
        // Una trappola è per definizione un secondo giro sullo stesso ruolo:
        // il rifiuto «già completato», che protegge la misura dal contare due
        // volte gli stessi testi, qui non si applica.
        rigioca: Boolean(lavoro.trappola),
        registra: (t) => console.log(t),
      });
      if (esito.fermato) console.log(`  ✗ fermato a «${esito.fermato.dove}»: ${esito.fermato.perche}`);
      esiti.push({ ...esito, nome: lavoro.nome, atteso: lavoro.atteso });
    } catch (errore) {
      console.log(`  ✗ eccezione: ${errore.message}`);
      // Un'eccezione NON è un cancello: è un guasto. Marcarla come tale è
      // quello che tiene le due liste separate nel rapporto — mettere un
      // `fetch failed` accanto a «la consegna è stata rifiutata» darebbe a un
      // guasto la dignità di un risultato, che è la cosa che questo banco
      // esiste per non fare.
      esiti.push({
        etichetta: lavoro.etichetta,
        nome: lavoro.nome,
        atteso: lavoro.atteso,
        tappe: [],
        fermato: { dove: "?", perche: errore.message, guasto: true },
      });
    }
  }

  // Il piano passa alla misura perché possa fare l'APPELLO: ogni ruolo che
  // doveva essere giocato deve comparire in un esito. Senza questo argomento
  // la misura non può sapere chi manca — e dichiara di non poterlo dire invece
  // di tacere. `npm run test:robot` verifica che questa riga lo passi davvero:
  // un parametro nuovo con un default è esattamente il posto in cui un
  // collegamento mancante si nasconde.
  const m = misura(esiti, piano.lavori.map((l) => l.etichetta));
  stampaRapporto(m);

  // I GUASTI DELLA PASSATA, letti dalla tabella nostra e non dai log del
  // fornitore. Qui il robot legge l'altra metà di quello che è successo: la
  // misura sa cosa ha OTTENUTO, questa riga sa cosa il motore sa di NON aver
  // fatto — e i due insiemi non coincidono, perché un guasto può capitare su
  // una tappa che il robot ha comunque visto avanzare al giro dopo.
  //
  // Dice sempre quale delle due risposte sta dando: «zero guasti» e «non ho
  // guardato» sono cose diverse, e un silenzio che non dichiara quale dei due
  // sia è la risposta comoda.
  const visti = await leggiGuasti({ daIso: inizioPassata });
  console.log("── guasti registrati durante la passata");
  if (!visti.visto) {
    console.log(`   ⚠  NON HO GUARDATO: ${visti.perche}`);
    console.log("      Non vuol dire zero: vuol dire che non sono riuscito a leggere.");
  } else if (visti.righe.length === 0) {
    console.log("   ✓ zero. Ho guardato, e il motore non ha registrato niente.");
    console.log("      (resta fuori la classe che non lascia righe: il codice che non parte)");
  } else {
    for (const g of perSpecie(visti.righe)) {
      console.log(`   · ${g.specie}: ${g.produzione + g.prova}`);
    }
    console.log("      Per esteso, con motivo e dettaglio:  npm run banco guasti");
  }
  console.log("");

  // Il rapporto grezzo su file: i testi si rileggono, e il numero senza il
  // testo accanto non serve a niente.
  const percorso = path.join(ROOT, `banco-robot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")}.json`);
  fs.writeFileSync(
    percorso,
    JSON.stringify(
      {
        // Senza questo, fra due mesi si guardano due rapporti e nessuno si
        // ricorda cosa c'era in mezzo — e allora le misure non si confrontano,
        // si accostano. `npm run banco confronta` lo usa per elencare i commit
        // fra una passata e l'altra.
        commit: stato.locale,
        quando: new Date().toISOString(),
        piano: { ruoli: piano.lavori.length, chiamate: piano.chiamate },
        esiti,
        misura: m,
        // Nel file finisce la RISPOSTA INTERA, non solo le righe: chi rilegge
        // questo rapporto fra due mesi deve poter distinguere una passata
        // senza guasti da una in cui non si è potuto guardare. `guasti: []`
        // da solo direbbe la prima anche quando era la seconda.
        guasti: visti.visto ? { visto: true, righe: visti.righe } : { visto: false, perche: visti.perche },
      },
      null,
      2,
    ),
  );
  console.log(`Rapporto completo, con tutti i testi: ${path.basename(percorso)}`);
  console.log("(ignorato da git — è materiale da leggere, non da versionare)\n");
}

module.exports = { robot, costruisciPiano };
