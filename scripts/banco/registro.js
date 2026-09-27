// Il registro ricontato sui rapporti in archivio, con UNA metrica sola.
//
// Perché esiste: il 26/09 la prova su `cosa_regge` è stata letta accostando
// due numeri che non erano la stessa cosa — «83% e 117%» del 31/08 sono
// CATTURE su testi (possono passare il 100%), il «98/98» di settembre è
// TESTI CON ALMENO UNA CATTURA. Due metriche diverse messe in fila raccontano
// una storia che nessuna delle due sostiene, ed è esattamente il modo in cui
// si è già sbagliato una volta.
//
// Qui si riconta da zero, dagli stessi campi, per tutti i rapporti che si
// passano: le due metriche affiancate, per genere, e l'EPOCA di ognuno letta
// dal suo commit invece che dalla data del file.
//
// COSA NON PUÒ FARE, e lo dice: i rapporti scritti prima del 26/09 non hanno i
// cinque generi (il «feedback finale» era un testo solo che ne conteneva tre —
// vedi `partiDelFinale` in robot/misura.js), quindi per quel genere il numero
// NON è confrontabile con una passata di oggi. Fra due rapporti VECCHI lo è,
// perché sommavano nello stesso modo — ed è quella la domanda su `cosa_regge`.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..", "..");

// I due confini che separano le epoche, con il loro perché.
//
// Sono COMMIT, non date: la data di un file dice quando è stato scritto sul
// disco, il commit dice con quale codice ha girato. Un rapporto ricopiato, o
// scaricato da un'altra macchina, ha la data sbagliata e il commit giusto.
// I CONFINI SONO TRE E NON DUE, e il terzo è stato trovato il 27/09 andando a
// cercare QUALE commit avesse introdotto `cosa_regge` invece di fidarsi di uno
// sha scritto a mano.
//
//   0f6f975  10:11  il rename entra nel prompt — ma il guardiano cerca ancora
//                   `punti_forza`, quindi OGNI revisione fallisce
//                   (`forma_non_valida`, fiducia 0)
//   be847bf  13:24  la rinomina arriva al guardiano: dal qui il campo funziona
//
// In mezzo ci sono tre ore e tredici minuti in cui **non è stata prodotta
// nessuna revisione valida**. Un rapporto di quella finestra, datato «col
// rename», porterebbe un numero del registro vicino a zero — e quello zero si
// leggerebbe come «il registro è crollato» mentre vuol dire «le revisioni non
// sono mai avvenute». È esattamente la specie di errore per cui questo comando
// esiste: un'assenza letta come un valore basso.
const CONFINI = [
  {
    chiave: "cosa_regge",
    sha: "0f6f975",
    quando: "2026-08-30",
    cosa: "il prompt della revisione di tappa chiede `cosa_regge` invece di `punti_forza`",
  },
  {
    chiave: "rename_riparato",
    sha: "be847bf",
    quando: "2026-08-30",
    cosa: "la rinomina arriva anche al guardiano: da qui le revisioni tornano valide",
  },
  {
    chiave: "rubrica",
    sha: "f85d161",
    quando: "2026-09-20",
    cosa: "il prompt della revisione porta la rubrica della fiducia (cinque fasce, tre tetti)",
  },
];

// Un commit CONTIENE un confine se quel confine è un suo antenato.
//
// Restituisce null quando non si può sapere: il commit del rapporto non è in
// questa copia del repository (una passata girata su un ramo mai spinto, o una
// storia riscritta). Un'epoca indovinata è peggio di un'epoca mancante, perché
// finisce in una tabella e nessuno torna a controllarla.
function contiene(shaRapporto, shaConfine) {
  if (!shaRapporto) return null;
  try {
    execSync(`git merge-base --is-ancestor ${shaConfine} ${shaRapporto}`, { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch (errore) {
    // `--is-ancestor` esce 1 quando non lo è (risposta) e 128 quando uno dei
    // due commit non esiste (non risposta). Le due cose non si confondono.
    return errore.status === 1 ? false : null;
  }
}

function esiste(sha) {
  if (!sha) return false;
  try {
    execSync(`git cat-file -e ${sha}^{commit}`, { cwd: ROOT, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// I TRE «NON LO SO» SONO TRE, E VANNO DETTI PER NOME. Fino al 27/09 questa
// funzione ne conosceva uno solo, e `stampa` ne stampava due sulla stessa riga
// che si contraddicevano: «il rapporto non porta il commit» seguito da «il
// commit non è in questa copia del repository». Se il rapporto non lo porta,
// non c'è niente da cercare — una delle due frasi descriveva un altro caso.
//
// Tre «non lo so» distinti erano la parte migliore di questo strumento; due che
// si contraddicono nella stessa riga sono peggio di uno solo.
function epoca(shaRapporto) {
  const dentro = {};
  for (const c of CONFINI) dentro[c.chiave] = contiene(shaRapporto, c.sha);
  const noto = Object.values(dentro).every((v) => v !== null);
  if (noto) return { dentro, noto, perche: null };

  // I confini persi vengono PRIMA: se manca un confine, nessuna datazione è
  // possibile per nessun rapporto, e dare la colpa al commit del rapporto
  // manderebbe a cercare nel posto sbagliato.
  const confiniPersi = CONFINI.filter((c) => !esiste(c.sha));
  if (confiniPersi.length > 0) {
    return {
      dentro,
      noto,
      perche: `${confiniPersi.length === 1 ? "il confine" : "i confini"} ${confiniPersi
        .map((c) => `«${c.chiave}» (${c.sha})`)
        .join(" e ")} non ${confiniPersi.length === 1 ? "è" : "sono"} in questa copia del repository: senza di ${confiniPersi.length === 1 ? "lui" : "loro"} nessun rapporto si può datare`,
    };
  }
  if (!shaRapporto) return { dentro, noto, perche: "il rapporto non porta il commit: non c'è niente da cercare" };
  return { dentro, noto, perche: `il commit ${String(shaRapporto).slice(0, 7)} non è in questa copia del repository (ramo mai spinto, o storia riscritta)` };
}

// I generi storici: gli unici tre che esistono in TUTTI i rapporti, quindi gli
// unici su cui due epoche si confrontano. Dal 26/09 i rapporti ne hanno cinque.
const GENERI_STORICI = ["revisione", "reazione del cliente", "feedback finale"];

// Le due metriche, ricontate dai campi grezzi e non copiate da nessun totale
// già scritto nel rapporto: un totale scritto allora è stato calcolato con il
// codice di allora.
function riconta(misura) {
  const perGenere = misura?.perGenere ?? {};
  const registro = Array.isArray(misura?.registro) ? misura.registro : null;
  const generi = Object.keys(perGenere);

  // Senza l'elenco delle catture si può dare solo la metrica delle catture,
  // non quella dei testi: si dichiara invece di stimarla.
  const righe = [];
  for (const g of generi) {
    const testi = perGenere[g]?.testi ?? 0;
    if (testi === 0) continue;
    const dellGenere = registro ? registro.filter((r) => String(r.dove).endsWith(g)) : null;
    righe.push({
      genere: g,
      testi,
      catture: perGenere[g]?.registro ?? 0,
      // `dove` è l'etichetta del testo: distinti = testi con almeno una cattura.
      testiConCattura: dellGenere ? new Set(dellGenere.map((r) => r.dove)).size : null,
    });
  }
  return { righe, haElencoCatture: registro !== null, generi };
}

function leggi(percorso) {
  const assoluto = path.isAbsolute(percorso) ? percorso : path.join(ROOT, percorso);
  if (!fs.existsSync(assoluto)) return { percorso, errore: "il file non esiste" };
  let dati;
  try {
    dati = JSON.parse(fs.readFileSync(assoluto, "utf8"));
  } catch (e) {
    return { percorso, errore: `non è un JSON leggibile (${e.message})` };
  }
  const sha = dati?.commit?.sha ?? null;
  return {
    percorso: path.basename(assoluto),
    quando: dati?.quando ?? null,
    sha,
    titolo: dati?.commit?.titolo ?? null,
    sporco: dati?.commit?.sporco ?? null,
    epoca: epoca(sha),
    conto: riconta(dati?.misura),
  };
}

const pc = (parte, tutto) => (tutto === 0 ? "—" : `${((parte / tutto) * 100).toFixed(0)}%`);

function stampa(letti, di = console.log) {
  di("");
  di("IL REGISTRO RICONTATO — due metriche affiancate, la stessa per tutti");
  di("");
  di("  Le due colonne NON sono la stessa cosa, e accostarle è l'errore che questo");
  di("  comando esiste per non ripetere:");
  di("    · catture/testi  può passare il 100% (un testo con tre catture ne vale tre)");
  di("    · testi sporchi  è la quota di testi con ALMENO una cattura, quindi al più 100%");
  di("");

  const buoni = letti.filter((l) => !l.errore);
  for (const l of letti.filter((x) => x.errore)) di(`  ✗ ${l.percorso}: ${l.errore}`);
  if (buoni.length === 0) {
    di("");
    di("  Nessun rapporto leggibile. I rapporti del robot NON sono versionati");
    di("  (`banco-robot-*.json` sta in .gitignore): vanno passati per nome dalla");
    di("  cartella in cui sono stati scritti.");
    di("");
    return;
  }

  for (const l of buoni) {
    di(`── ${l.percorso}${l.quando ? `   (${l.quando.slice(0, 10)})` : ""}`);
    // Il commit: si dice cosa c'è, non la conseguenza — la conseguenza la dice
    // la riga dell'epoca, e una sola volta.
    di(l.sha ? `   commit ${l.sha.slice(0, 7)}${l.titolo ? `  «${l.titolo}»` : ""}${l.sporco ? "   [albero sporco]" : ""}` : "   commit: il rapporto non lo porta");

    // L'epoca, dal commit e non dalla data. Quando non si sa, si dice QUALE dei
    // tre motivi è: sono tre casi diversi e si riparano in tre modi diversi.
    if (l.epoca.noto) {
      const e = l.epoca.dentro;
      const nomi = CONFINI.filter((c) => e[c.chiave]).map((c) => c.chiave);
      di(`   epoca: ${nomi.length === 0 ? "prima di tutti i confini" : `con ${nomi.join(" + ")}`}`);
    } else {
      di(`   epoca: NON HO GUARDATO — ${l.epoca.perche}`);
      di("          Non la indovino.");
    }

    di("");
    di("   genere                 testi   catture  catture/testi   testi sporchi");
    for (const r of l.conto.righe) {
      const sporchi = r.testiConCattura === null ? "     n/d" : `${String(r.testiConCattura).padStart(3)} ${pc(r.testiConCattura, r.testi).padStart(4)}`;
      di(`   ${r.genere.padEnd(22)}${String(r.testi).padStart(4)}   ${String(r.catture).padStart(6)}   ${pc(r.catture, r.testi).padStart(10)}   ${sporchi}`);
    }
    if (!l.conto.haElencoCatture) {
      di("   («testi sporchi» non si può ricontare: questo rapporto non porta l'elenco");
      di("    delle catture, solo i totali. Si dichiara invece di stimarla.)");
    }
    di("");
  }

  // Il confronto fra epoche, e i limiti di quello che dice.
  const conGeneriNuovi = buoni.filter((l) => l.conto.generi.includes("come hai lavorato"));
  if (conGeneriNuovi.length > 0 && conGeneriNuovi.length < buoni.length) {
    di("  ⚠  I rapporti passati non dividono i generi allo stesso modo: quelli di prima");
    di("     del 26/09 tengono in «feedback finale» anche il blocco «come hai lavorato»");
    di("     e la chiusura del cliente. Per QUEL genere le righe non si confrontano fra le");
    di("     due forme; fra due rapporti vecchi sì, perché sommavano nello stesso modo.");
    di("");
  }

  const epocheNote = buoni.filter((l) => l.epoca.noto);
  const senza = epocheNote.filter((l) => !l.epoca.dentro.cosa_regge);
  // LA FINESTRA ROTTA NON È UN'EPOCA: è un secchio da scartare. Un rapporto che
  // ha il rename nel prompt ma non nel guardiano non contiene nessuna revisione
  // valida, quindi il suo numero del registro non misura il registro.
  const finestraRotta = epocheNote.filter((l) => l.epoca.dentro.cosa_regge && !l.epoca.dentro.rename_riparato);
  const conRename = epocheNote.filter((l) => l.epoca.dentro.rename_riparato && !l.epoca.dentro.rubrica);
  const conRubrica = epocheNote.filter((l) => l.epoca.dentro.rubrica);

  // LE TRE EPOCHE SI CONTANO TUTTE E TRE, non solo l'intermedia.
  //
  // Il 27/09 questo blocco stampava «l'epoca intermedia c'è: il calo è
  // attribuibile al solo campo» con ZERO rapporti nell'epoca «senza il rename»:
  // verificava l'esistenza del separatore e non delle due cose che deve
  // separare. Un separatore fra due cose di cui una non c'è non separa niente —
  // ed è nato nel ramo scritto apposta per dichiarare il confondente: la
  // cautela era sulla causa sbagliata.
  const EPOCHE = [
    { nome: "senza il rename", righe: senza, spiega: "il «prima» con cui confrontare" },
    { nome: "col rename, senza rubrica", righe: conRename, spiega: "l'epoca che separa le due cause" },
    { nome: "con la rubrica", righe: conRubrica, spiega: "il «dopo»" },
  ];
  const quanti = (n) => `${n} ${n === 1 ? "rapporto" : "rapporti"}`;
  di("  LA PROVA SU `cosa_regge`, e il suo confondente");
  for (const e of EPOCHE) di(`    ${(e.nome + ":").padEnd(27)}${String(e.righe.length).padStart(3)} ${e.righe.length === 1 ? "rapporto" : "rapporti"}${e.righe.length === 0 ? "   ← MANCA" : ""}`);
  if (epocheNote.length < buoni.length) di(`    (${buoni.length - epocheNote.length === 1 ? "1 rapporto non datato" : quanti(buoni.length - epocheNote.length) + " non datati"}: non entrano in nessuna delle tre)`);
  if (finestraRotta.length > 0) {
    di("");
    di(`    ⚠  ${quanti(finestraRotta.length)} ${finestraRotta.length === 1 ? "cade" : "cadono"} nelle tre ore del 30/08 fra ${CONFINI[0].sha} e ${CONFINI[1].sha},`);
    di("       quando il rename era nel prompt e non nel guardiano: lì OGNI revisione");
    di("       falliva, quindi il numero del registro non misura il registro — misura");
    di("       quante revisioni non sono avvenute. Fuori da ogni epoca, non contato:");
    for (const l of finestraRotta) di(`         · ${l.percorso}`);
  }
  di("");

  const vuote = EPOCHE.filter((e) => e.righe.length === 0);
  if (vuote.length === EPOCHE.length) {
    di("    NON HO GUARDATO: nessuno dei rapporti passati è datato, quindi le tre epoche");
    di("    sono tutte a zero. Non vuol dire che la prova sia irrisolvibile — vuol dire");
    di("    che con questi file non si legge.");
  } else if (vuote.length > 0) {
    di(`    LA PROVA NON SI PUÒ LEGGERE: ${vuote.length === 1 ? "manca l'epoca" : "mancano le epoche"}`);
    for (const e of vuote) di(`      · «${e.nome}» — ${e.spiega}`);
    if (senza.length === 0) {
      di("");
      di("    Quando è il «prima» a mancare, la prova non è CONFONDIBILE: è NON RISPONDIBILE.");
      di(`    Il rename è del ${CONFINI[0].quando}: se ogni rapporto in archivio gli è successivo,`);
      di("    non esiste un «prima» da confrontare, e nessun numero letto qui dice qualcosa");
      di("    sul campo. Non è un difetto dei rapporti: è che la domanda è nata dopo di loro.");
    }
  } else {
    di("    Le tre epoche ci sono tutte: il calo della revisione fra «senza» e «col rename,");
    di("    senza rubrica» è attribuibile al solo campo. Quello fra intermedia e «con la");
    di("    rubrica» alla sola rubrica.");
    di("");
    di("    E il metro scritto il 20/09 vale ancora: se cala solo il prompt cambiato è il");
    di("    campo; se calano entrambi o nessuno, l'ipotesi era sbagliata. Il feedback");
    di("    finale non è stato toccato in nessuno dei due confini — è il controllo.");
  }
  di("");
}

async function comando(argomenti) {
  const file = argomenti.filter((a) => !a.startsWith("-"));
  if (file.length === 0) {
    console.log("");
    console.log("Uso: npm run banco registro <rapporto.json> [altri...]");
    console.log("");
    console.log("Riconta il registro sui rapporti del robot già in archivio, con UNA");
    console.log("metrica sola, per genere, e data ogni rapporto dal suo commit.");
    console.log("");
    console.log("I rapporti non sono versionati (`banco-robot-*.json` è in .gitignore):");
    console.log("stanno nella cartella da cui è partita la passata che li ha scritti.");
    console.log("");
    return;
  }
  stampa(file.map(leggi));
}

module.exports = { comando, leggi, riconta, epoca, contiene, stampa, CONFINI, GENERI_STORICI };
