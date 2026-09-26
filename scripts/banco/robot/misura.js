// La misura sui testi raccolti — il PRODOTTO del robot, non «tutto verde».
//
// Alla fine di una passata ci sono ~125 testi scritti dai revisori: quattro
// revisioni e un feedback finale per ruolo. Su quei testi passano i pattern che
// abbiamo già, e che hanno la risposta giusta nota — l'unico tipo di giudizio
// automatico di cui ci fidiamo.
//
// COSA NON FA, e non è una dimenticanza: non dice se una revisione è BUONA.
// Quello si legge. Un modello che valuta un modello condivide i suoi angoli
// ciechi, e ne abbiamo la prova: due revisori diversi hanno elogiato lo stesso
// paragrafo pericoloso.

/* eslint-disable @typescript-eslint/no-require-imports -- script Node CommonJS di utilità */

const path = require("path");
const fs = require("fs");
const ts = require("typescript");
const Module = require("module");

const ROOT = path.join(__dirname, "..", "..", "..");
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith("@/")) {
    const p = path.join(ROOT, request.slice(2));
    for (const ext of [".ts", ".tsx", ".js"]) if (fs.existsSync(p + ext)) return origResolve.call(this, p + ext, parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
if (!require.extensions[".ts"]) {
  require.extensions[".ts"] = function (mod, filename) {
    const out = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: "commonjs", target: "es2019", esModuleInterop: true },
      fileName: filename,
    });
    return mod._compile(out.outputText, filename);
  };
}

const { trovaAccordi } = require("@/lib/lingua/accordoGenere");
const { LESSICO_VERDETTO, LESSICO_SOLO_AI, PATTERN_TERZA_PERSONA } = require("@/lib/lingua/registroStudente");
const { trovaRegistro } = require("@/lib/lingua/registroStudente");
const { stringheInJson, trovaConPattern } = require("@/lib/lingua/scansione");
const { verificaAtteso } = require("./atteso");
const { riprese, descriviRipresa } = require("../riprese");
const { livelli, descriviLivello } = require("../livelli");

// Una cattura senza la frase intorno non si rilegge: `dove` dice in quale
// campo sta, non cosa c'era scritto. E qui serve più che altrove, perché i
// pattern sono LARGHI di proposito — per il tripwire un falso positivo è una
// voce di whitelist, per la guardia una chiamata in più, ma la misura non ha
// un umano dentro il ciclo: pubblica un numero. Il primo giro vero, il 31
// agosto 2026, ha dato 4 catture e 4 falsi positivi («quel signore ci entra da
// solo», «Tonino da solo», «il defibrillatore parla da solo», «hai capito»
// dentro un complimento): il tasso pubblicato diceva 33% dove il vero era 0.
const CONTORNO = 120;

function conContesto(testo, cattura) {
  const i = String(testo).toLowerCase().indexOf(String(cattura).toLowerCase());
  if (i < 0) return String(cattura);
  const da = Math.max(0, i - CONTORNO);
  const a = Math.min(testo.length, i + cattura.length + CONTORNO);
  return `${da > 0 ? "…" : ""}${testo.slice(da, i)}»${testo.slice(i, i + cattura.length)}«${testo.slice(i + cattura.length, a)}${a < testo.length ? "…" : ""}`;
}

// La classe più affidabile: il participio con ESSERE / il riflessivo in seconda
// persona, che falsi positivi non ne fa. `da sol[oa]` invece resta sempre una
// cattura DA GUARDARE — la sua percentuale di verità la dice una persona.
const CERTA = /\b(?:sei|ti sei|se ti sei|quando sei|non sei)\b/;
const certa = (cattura) => CERTA.test(String(cattura).toLowerCase());

// DUE PROBLEMI, non uno — e li stiamo contando insieme da quando la misura
// esiste. «Hai capito» e «hai riconosciuto» sono una FORMULA: letterale,
// sempre nella stessa posizione, e da oggi tolta in codice quando è seguita da
// «che» (vedi lib/lingua/formulaTesta.ts) — quello che resta qui è il residuo,
// le forme senza «che». «Maturo», «saggio», «studente» sono GIUDIZI veri: una
// dozzina, e toglierli meccanicamente vorrebbe dire riscrivere un contenuto.
// Sommarli dava un numero solo su cui non si poteva decidere niente.
const PATTERN_FORMULA = LESSICO_VERDETTO["stato-d'animo"] ?? [];
const eFormula = (cattura) => PATTERN_FORMULA.some((re) => new RegExp(re.source, "i").test(String(cattura)));

// QUALI VOCI DEL LESSICO HANNO CATTURATO, E QUANTE VOLTE — comprese quelle che
// non hanno catturato mai.
//
// `LESSICO_VERDETTO` è una lista EDITORIALE che «si fa crescere con revisione»,
// e oggi non sappiamo distinguere i due casi in cui una voce non scatta: o è
// inutile, o è la prova che il divieto funziona. Il conto del 26/09 su trenta
// rapporti diceva che le prime due voci coprono il 64% delle catture e che
// buona parte della lista non ne ha mai fatta nessuna — un fatto che a mano non
// rifà nessuno, e che va stampato accanto alla lista quando la lista gira.
//
// SI CONTA PATTERN PER PATTERN, non ri-testando le catture già raccolte: una
// cattura è la porzione di testo che UN pattern ha trovato, e ri-testarla
// contro tutti attribuirebbe la stessa occorrenza a due voci quando i loro
// match si sovrappongono. Contando ogni pattern da sé la somma delle voci è
// esattamente il numero delle catture — e il rapporto la confronta, perché un
// estrattore che perde una riga è verde e non lo sa nessuno.
const FAMIGLIE_LESSICO = [
  ...Object.entries(LESSICO_VERDETTO).map(([famiglia, patterns]) => ({ famiglia, patterns })),
  ...Object.entries(LESSICO_SOLO_AI).map(([famiglia, patterns]) => ({ famiglia, patterns })),
  { famiglia: "terza-persona", patterns: PATTERN_TERZA_PERSONA },
];

function contaLessico(testi) {
  const stringhe = testi.flatMap((t) => stringheInJson(t.valore));
  const voci = [];
  for (const { famiglia, patterns } of FAMIGLIE_LESSICO) {
    for (const re of patterns) {
      const voce = { famiglia, pattern: re.source, catture: 0, esempi: [] };
      for (const s of stringhe) {
        for (const c of trovaConPattern(s, [re])) {
          voce.catture++;
          if (voce.esempi.length < 3 && !voce.esempi.includes(c)) voce.esempi.push(c);
        }
      }
      voci.push(voce);
    }
  }
  return voci;
}

// LE PAROLE-CONTENITORE, in «dove_porta» e solo lì.
//
// Quel campo deve nominare una persona che fa una cosa in un posto: «chi fa
// l'infermiere in un paese di montagna». La prima passata del blocco ha invece
// dato «il settore delle professioni sanitarie e socio-educative» — la voce di
// chi archivia, che non ha mai fatto venire voglia a nessuno di fare un
// mestiere, e dentro la quale un ragazzo non riesce a immaginarsi.
//
// È UNA MISURA, NON UNA GUARDIA, e la differenza è deliberata: la regola nel
// prompt è appena stata riscritta in forma operativa, e questo numero serve a
// dire se ha preso. Un filtro nel codice la renderebbe invisibile — è la
// lezione della formula «hai capito», dove il numero pubblicato è quello PRIMA
// della riscrittura, altrimenti la misura vede zero e racconta che il modello
// ha smesso.
//
// Larga di proposito, come tutti i pattern del banco: «professioni» prende
// anche usi legittimi. Si conta la VOCE, non le occorrenze, e la si stampa con
// il testo accanto — quanto sia vera lo dice una persona.
const CONTENITORI = [
  /\bsettor[ei]\b/i,
  /\bcompart[oi]\b/i,
  /\bambit[oi]\b/i,
  /\bfigur[ae] professional[ei]\b/i,
  /\bprofil[oi] professional[ei]\b/i,
  /\bprofessioni\b/i,
  /\bmondo del(?:la|lo|l')?\b/i,
  /\baziende di servizi\b/i,
  /\bstud[io]o? consulenzial[ei]\b/i,
  /\brealtà aziendal[ei]\b/i,
];

function contenitoriIn(voce) {
  return CONTENITORI.map((re) => String(voce).match(re)?.[0]).filter(Boolean);
}

// IL «FEEDBACK FINALE» NON È UN TESTO SOLO, e finché lo contavamo come tale il
// suo numero non era di nessun prompt. Dentro `feedbackFinale` convivono tre
// provenienze diverse:
//
//   · i campi di `promptFeedbackFinale` (punti_forza, da_migliorare,
//     messaggio_chiusura) — il revisore che giudica il progetto consegnato;
//   · `modo_di_lavorare`, che lo scrive una CHIAMATA SEPARATA, con un altro
//     prompt (`promptModoDiLavorare`), e finisce annidato qui dentro
//     (`route.ts`: `feedbackFinale.modo_di_lavorare = modo`);
//   · `chiusura_cliente`, scritto dallo stesso prompt del finale ma NELLA VOCE
//     DEL CLIENTE, di proposito — lì «hai capito» detto da Gianni è un
//     personaggio in carattere, non un revisore che emette un verdetto.
//
// Tenendole in un testo solo, una cattura in QUALUNQUE delle tre marcava tutto
// l'insieme: un tasso del tipo «quanti testi hanno almeno una cattura» non
// poteva che salire, e non si poteva sapere quale prompt lo alzasse. Il conto
// del 26/09 su trenta rapporti in archivio dava il feedback finale al 100% —
// cioè un numero attribuito a un prompt che ne produce soltanto una parte, e su
// cui si stava per spendere una passata per vedere se una modifica a quel
// prompt lo abbassava.
//
// Le tre diventano quindi tre testi distinti, con tre `dove`. Un rapporto
// scritto prima di oggi non ha i due generi nuovi: `banco confronta` lo
// DICHIARA, invece di leggere la loro assenza come uno zero.
function partiDelFinale(feedbackFinale) {
  const { modo_di_lavorare: modo, chiusura_cliente: chiusura, ...resto } = feedbackFinale;
  const parti = [{ suffisso: "feedback finale", valore: resto }];
  // Assenti quando non ci sono: un testo senza stringhe non può avere catture,
  // e contarlo diluirebbe le percentuali di tutti gli altri.
  if (modo) parti.push({ suffisso: "come hai lavorato", valore: modo });
  if (chiusura) parti.push({ suffisso: "chiusura del cliente", valore: chiusura });
  return parti;
}

// Ogni testo con la sua provenienza, così una cattura si può andare a rileggere
// invece di restare un numero.
function raccogliTesti(esiti) {
  const testi = [];
  for (const e of esiti) {
    for (const t of e.tappe) {
      if (t.revisione) testi.push({ dove: `${e.etichetta} / ${t.faseId} / revisione`, valore: t.revisione });
      if (t.reazione) testi.push({ dove: `${e.etichetta} / ${t.faseId} / reazione del cliente`, valore: t.reazione });
    }
    if (e.feedbackFinale) {
      for (const p of partiDelFinale(e.feedbackFinale)) {
        testi.push({ dove: `${e.etichetta} / ${p.suffisso}`, valore: p.valore });
      }
    }
  }
  return testi;
}

// In quale delle CINQUE categorie cade un ruolo giocato. La precedenza è quella
// delle tre liste storiche (doppio > guasto > cancello) più le due che
// riguardano chi è arrivato in fondo — e tutte e due sono nate da un buco:
// «finito» perché un ruolo che non finisce e non entra in nessuna lista
// sparisce, «senza_finale» perché uno che finisce SENZA la sua pagina di
// chiusura contava come finito.
//
// Il 18/09 `scuola-musica-napoli > spazio` ha chiuso il progetto con
// `feedback_ai` vuoto: il rapporto ha contato «5 finiti» e, più sotto, «feedback
// finale 4 testi». Tutte e due vere, e nessuna delle due diceva che a uno
// studente mancava la pagina che legge alla fine — perché i due numeri non si
// parlano. Un'assenza non è una statistica.
//
// Una lettura FALLITA cade qui dentro e non fra i finiti: non sappiamo che ci
// sia, quindi non lo si dà per buono. La riga sotto dice quale dei due è.
function categoriaEsito(e) {
  if (e.fermato) {
    if (e.fermato.doppio) return "respinto";
    if (e.fermato.guasto) return "caduto";
    return "fermato";
  }
  return e.feedbackFinale && !e.letturaFinaleFallita ? "finito" : "senza_finale";
}

// Perché manca, detto con quello che sappiamo e non con quello che supponiamo:
// `finale_esito` sull'ultima tappa è la resa scritta dal cron (dal 18/09), e
// quando non c'è nemmeno quella lo si dice invece di inventare una causa.
function perchePagina(e) {
  if (e.letturaFinaleFallita) return `non ho potuto leggerla: ${e.letturaFinaleFallita}`;
  const ultima = [...(e.tappe ?? [])].reverse().find((t) => t.esitoFinale);
  if (ultima) return `il feedback finale si è arreso (${ultima.esitoFinale}) dopo i tentativi del cron`;
  if (!e.chiuso) return "il progetto non risulta chiuso: l'ultima tappa non è arrivata in fondo";
  return "il progetto è chiuso ma `feedback_ai` è vuoto, e la riga della tappa non dice perché";
}

// OGNI RUOLO DEL PIANO DEVE COMPARIRE IN UN ESITO — uno dei quattro, per tutti.
//
// Perché un confronto di CONTEGGI e non una riga in più nel log: il 13/09 il
// robot ha lasciato un ruolo attivo per un tentativo che non poteva riuscire,
// e quella transizione non compariva da nessuna parte perché formalmente non
// era successo niente. Quella strada è chiusa; **la prossima arriverà da
// un'altra parte**, e un conteggio la prende senza sapere da dove viene.
//
// Due domande distinte, e servono tutte e due:
//   · il piano diceva cinque e gli esiti sono quattro? (chi manca all'appello)
//   · le quattro liste coprono tutti gli esiti? (un quinto stato aggiunto un
//     domani e non messo in nessuna lista sparirebbe esattamente così)
function verificaCompletezza(esiti, attesi) {
  const categorie = esiti.map(categoriaEsito);
  const conta = (c) => categorie.filter((x) => x === c).length;
  const perCategoria = {
    finito: conta("finito"),
    senza_finale: conta("senza_finale"),
    fermato: conta("fermato"),
    caduto: conta("caduto"),
    respinto: conta("respinto"),
  };
  const somma = Object.values(perCategoria).reduce((a, b) => a + b, 0);
  // Fuori dal ramo del piano di proposito: una pagina finale mancante è un
  // fatto sul ruolo giocato, non sull'appello — si sa anche quando il piano non
  // è arrivato fin qui.
  const senzaFinale = esiti
    .filter((e) => categoriaEsito(e) === "senza_finale")
    .map((e) => ({ etichetta: e.etichetta, perche: perchePagina(e) }));

  // Senza il piano non si può dire niente: si dichiara, non si tace. È la
  // stessa regola di «non posso vederle» invece di «non ci sono».
  if (!Array.isArray(attesi)) {
    return { noto: false, perCategoria, esiti: esiti.length, copertiDalleListe: somma, senzaFinale };
  }

  const conteggia = (elenco) => {
    const m = new Map();
    for (const x of elenco) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  // Si contano le etichette invece di cercarle: due trappole sullo stesso
  // ruolo hanno la stessa etichetta, e una verifica di sola presenza le
  // vedrebbe come una.
  const voluti = conteggia(attesi);
  const avuti = conteggia(esiti.map((e) => e.etichetta));

  const mancanti = [];
  for (const [etichetta, n] of voluti) {
    const m = avuti.get(etichetta) ?? 0;
    if (m < n) mancanti.push({ etichetta, attesi: n, conEsito: m });
  }
  const inPiu = [];
  for (const [etichetta, m] of avuti) {
    const n = voluti.get(etichetta) ?? 0;
    if (m > n) inPiu.push({ etichetta, attesi: n, conEsito: m });
  }

  return {
    noto: true,
    attesi: attesi.length,
    esiti: esiti.length,
    perCategoria,
    copertiDalleListe: somma,
    mancanti,
    inPiu,
    senzaFinale,
    completa: mancanti.length === 0 && inPiu.length === 0 && somma === esiti.length,
  };
}

function misura(esiti, attesi = null) {
  const testi = raccogliTesti(esiti);

  const accordi = [];
  const registro = [];
  for (const t of testi) {
    // Si scende alle singole stringhe invece di passare l'oggetto intero, così
    // la frase intorno alla cattura è quella vera e non un JSON appiattito.
    for (const s of stringheInJson(t.valore)) {
      for (const c of trovaAccordi(s)) accordi.push({ dove: t.dove, cattura: c, contesto: conContesto(s, c), certa: certa(c) });
      for (const c of trovaRegistro(s)) registro.push({ dove: t.dove, cattura: c, contesto: conContesto(s, c), formula: eFormula(c) });
    }
  }

  // Gli esiti dei revisori, contati per come li marca il motore.
  //
  // E UNA LISTA A PARTE per il caso che non dovrebbe esistere: una tappa che è
  // AVANZATA (la revisione c'è, quindi il motore è arrivato in fondo) ma senza
  // un esito registrato. Il 13/09 `marketing > quartiere` è finito così, e nel
  // rapporto compariva come `sconosciuto 1 (5.0%)` in fondo a una riga di
  // percentuali — dove si legge come rumore. È il nome di uno stato che non
  // dovrebbe esistere, e merita una riga sua: se non altro perché è così che
  // l'abbiamo trovato.
  //
  // Il discrimine è la revisione, non un campo nuovo: una tappa mai revisionata
  // ha `revisione` null ed è già nella lista dei fermati con il suo perché;
  // questa ce l'ha. Ricavarlo dai dati già raccolti vuol dire anche che i
  // rapporti salvati prima di oggi si rileggono senza perdere il caso.
  const esitiRevisione = {};
  const avanzateSenzaEsito = [];
  // I punteggi di TAPPA di questa passata. Le tappe `giaFatta` restano fuori
  // apposta: la loro revisione l'ha scritta un'altra passata, con un altro
  // prompt, e mescolarle è il modo di rendere illeggibile un confronto.
  const punteggiTappa = [];
  let tentativiTotali = 0;
  let tappeConTentativiExtra = 0;
  for (const e of esiti) {
    for (const t of e.tappe) {
      if (t.giaFatta) continue;
      const k = t.esitoRevisione ?? "sconosciuto";
      esitiRevisione[k] = (esitiRevisione[k] ?? 0) + 1;
      const p = Number(t.revisione?.punteggio_fiducia);
      if (Number.isFinite(p)) punteggiTappa.push(p);
      tentativiTotali += t.tentativi || 0;
      if ((t.tentativi || 0) > 1) tappeConTentativiExtra++;
      if (!t.esitoRevisione && t.revisione) {
        avanzateSenzaEsito.push({
          etichetta: e.etichetta,
          iscrizioneId: e.iscrizioneId ?? null,
          faseId: t.faseId,
          tentativi: t.tentativi || 0,
        });
      }
    }
  }

  // La distribuzione dei punteggi di tappa. La forbice sui TOTALI (sotto) dice
  // se due ruoli diversi finiscono lontani; questa dice se la scala viene usata
  // per intero — che è la stessa domanda un piano più in basso, e con dieci
  // volte i dati.
  const punteggi = distribuzionePunteggi(punteggiTappa);

  // La fiducia per ruolo: un ruolo che dà sempre il minimo o sempre il massimo
  // ha un problema di rubrica, non di studente.
  const fiducia = esiti
    .filter((e) => e.fiduciaFinale !== null && e.fiduciaFinale !== undefined)
    .map((e) => ({ etichetta: e.etichetta, valore: e.fiduciaFinale }))
    .sort((a, b) => a.valore - b.valore);

  // Due liste, non una: «fermato da un cancello» si studia, «caduto per un
  // guasto» si rifà. Nella prima passata stavano insieme sotto «un gate che
  // morde è un risultato», e due `fetch failed` risultavano risultati.
  const tuttiFermati = esiti.filter((e) => e.fermato).map((e) => ({ etichetta: e.etichetta, ...e.fermato }));
  // TRE liste, non due: «fermato da un cancello» si studia, «caduto per un
  // guasto» si rifà, «respinto per una richiesta doppia» si corregge QUI, nel
  // banco. La terza è nata il 2026-08-31, quando un ritentativo sulle
  // scritture ha fatto arrivare un quinto messaggio al cliente e il 429 che ne
  // è seguito è finito fra i cancelli — dove sembrava un verdetto del
  // prodotto. Un fermato prodotto dal robot non è un cancello che morde.
  const respinti = tuttiFermati.filter((f) => f.doppio);
  const fermati = tuttiFermati.filter((f) => !f.guasto && !f.doppio);
  const caduti = tuttiFermati.filter((f) => f.guasto && !f.doppio);

  // Le trappole: confronto letterale sul testo della revisione, mai un modello
  // che giudica un modello.
  const trappole = esiti
    .filter((e) => e.atteso)
    .map((e) => ({ etichetta: e.etichetta, nome: e.nome ?? null, ...verificaAtteso(e.atteso, e) }));

  // Per GENERE DI TESTO, non solo in totale: la prima passata ha mostrato che
  // il feedback finale è cinque volte più esposto delle revisioni e che la
  // reazione del cliente non sbaglia mai. Quel numero dice DOVE si lavora — un
  // prompt invece di quattro — e a mano non lo rifà nessuno.
  //
  // CINQUE e non tre dal 26/09: quello che si chiamava «feedback finale» era la
  // somma di due chiamate più un passaggio scritto nella voce del cliente (vedi
  // `partiDelFinale`). L'ordine è quello in cui uno studente li legge.
  const generi = [
    "revisione",
    "reazione del cliente",
    "feedback finale",
    "come hai lavorato",
    "chiusura del cliente",
  ];
  const genereDi = (dove) => generi.find((g) => String(dove).endsWith(g)) ?? "altro";
  const perGenere = {};
  for (const g of generi) perGenere[g] = { testi: 0, accordi: 0, certe: 0, registro: 0 };
  for (const t of testi) {
    const g = genereDi(t.dove);
    if (perGenere[g]) perGenere[g].testi++;
  }
  for (const a of accordi) {
    const g = genereDi(a.dove);
    if (perGenere[g]) { perGenere[g].accordi++; if (a.certa) perGenere[g].certe++; }
  }
  for (const r of registro) {
    const g = genereDi(r.dove);
    if (perGenere[g]) perGenere[g].registro++;
  }

  // Quanti TESTI hanno almeno una cattura, non quante catture: è il numero che
  // dice quante volte la guardia ha chiesto una seconda risposta E la seconda
  // era ancora sporca. Ogni riga qui è una chiamata a pagamento spesa per
  // niente, e sul registro la prima passata ne ha contate tante.
  const testiConAccordo = new Set(accordi.map((a) => a.dove)).size;
  const testiConRegistro = new Set(registro.map((r) => r.dove)).size;

  // «dove porta»: quante voci sono state scritte, e quante nominano una
  // categoria invece di una persona. Si guardano le voci del blocco, non tutte
  // le stringhe del feedback finale: altrove «settore» può essere legittimo,
  // qui è precisamente la cosa che non va.
  const dovePorta = [];
  for (const e of esiti) {
    for (const voce of e.feedbackFinale?.modo_di_lavorare?.dove_porta ?? []) {
      const trovate = contenitoriIn(voce);
      dovePorta.push({ dove: `${e.etichetta} / dove porta`, voce: String(voce), contenitori: trovate });
    }
  }
  const dovePortaConContenitore = dovePorta.filter((v) => v.contenitori.length > 0);

  return {
    completezza: verificaCompletezza(esiti, attesi),
    // CON CHE COSA È STATA GIOCATA. Dal 20/09 lo stesso ruolo si può giocare
    // con due corpi di risposte di qualità nota diversa, e i numeri che ne
    // escono non sono confrontabili. Si ricava dagli esiti e non dal piano, che
    // qui non arriva sempre: un rapporto vecchio non ha il campo e lo dice.
    livelli: livelli(esiti),
    // Quali tappe NON sono state giocate da zero. Non è un difetto — riprendere
    // invece di rifare è la cosa giusta — ma qualifica tutto il resto del
    // rapporto, e soprattutto qualsiasi confronto con un'altra passata.
    riprese: riprese(esiti),
    testi: testi.length,
    accordi,
    registro,
    // Quali voci del lessico hanno catturato e quante volte, zeri compresi.
    lessico: contaLessico(testi),
    testiConAccordo,
    testiConRegistro,
    dovePorta,
    dovePortaConContenitore,
    perGenere,
    esitiRevisione,
    avanzateSenzaEsito,
    tentativiTotali,
    tappeConTentativiExtra,
    punteggi,
    fiducia,
    fermati,
    caduti,
    respinti,
    trappole,
  };
}

function percentuale(parte, tutto) {
  return tutto === 0 ? "—" : `${((parte / tutto) * 100).toFixed(1)}%`;
}

// ── LA SCALA DEL PUNTEGGIO DI TAPPA, e il metro per leggerla ─────────────────
// LA LINEA DI BASE, misurata sull'archivio PRIMA che il prompt del revisore
// avesse una rubrica (fino al 20/09 il campo `punteggio_fiducia` era descritto
// solo come «intero da 0 a 25, quanto ha convinto il cliente»): 486 punteggi di
// tappa su 119 ruoli chiusi, mai sotto 8, mai sopra 22, e l'84% dentro QUATTRO
// valori — 16, 17, 18, 19.
const BANDA_BASE = [16, 19];
const BASE = { punteggi: 486, ruoli: 119, min: 8, max: 22, quotaDentro: 84 };

// IL METRO, scritto PRIMA della passata che deve leggerlo (Mario, 20/09): la
// rubrica ha funzionato se i punteggi usano almeno otto valori distinti E
// almeno il 20% cade fuori dai quattro valori della linea di base. Sta qui e
// non in testa a chi legge perché un criterio deciso dopo aver visto i numeri
// non è un criterio: è una lettura.
const METRO = { distinti: 8, fuoriBanda: 20 };

// Sotto un workshop intero la distribuzione non dice niente — il metro è stato
// scritto per una passata da 5 ruoli, cioè 20 tappe.
const MIN_TAPPE_DISTRIBUZIONE = 20;

// Pura: `npm run test:banco` la prova senza rete.
function distribuzionePunteggi(valori) {
  if (valori.length === 0) return null;
  const conteggio = new Map();
  for (const v of valori) conteggio.set(v, (conteggio.get(v) ?? 0) + 1);
  const per = [...conteggio.entries()].sort((a, b) => a[0] - b[0]).map(([valore, n]) => ({ valore, n }));
  const dentroBanda = valori.filter((v) => v >= BANDA_BASE[0] && v <= BANDA_BASE[1]).length;
  return {
    totale: valori.length,
    distinti: conteggio.size,
    min: per[0].valore,
    max: per[per.length - 1].valore,
    per,
    dentroBanda,
    fuoriBanda: valori.length - dentroBanda,
  };
}

function stampaRapporto(m, righe = console.log) {
  const di = (t = "") => righe(t);

  di("\n═══════════ LA MISURA ═══════════\n");

  // CON CHE COSA È STATA GIOCATA, prima di tutto il resto — perfino prima
  // dell'appello. Non è una misura: è la dichiarazione dell'INGRESSO, e senza
  // di lei ogni numero qui sotto è un numero senza unità. Due rapporti
  // accostati fra un mese leggerebbero come un cambiamento del prodotto una
  // differenza che è solo di consegne.
  const liv = m.livelli;
  if (liv) {
    if (liv.misto) {
      di(`LIVELLO DELLE CONSEGNE: MISTO — ${liv.distinti.join(", ")}`);
      di("  Questa passata ha mescolato consegne di qualità diversa, e i suoi numeri");
      di("  non descrivono niente: una distribuzione costruita su due ingressi diversi");
      di("  non è la distribuzione di nessuno dei due. Il robot dovrebbe rifiutarsi di");
      di("  partire su un piano così — se questo rapporto esiste, la guardia non ha");
      di("  funzionato e va guardata prima dei numeri.\n");
    } else if (!liv.noto) {
      di("LIVELLO DELLE CONSEGNE: non lo so");
      di("  Questi esiti sono stati scritti prima che il banco registrasse il livello.");
      di("  Non vuol dire «base»: vuol dire che non si può dire, e che un confronto con");
      di("  una passata dichiarata va letto sapendolo.\n");
    } else {
      di(`LIVELLO DELLE CONSEGNE: ${liv.unico}`);
      di(`  ${descriviLivello(liv.unico)}`);
      di("");
    }
  }

  // L'APPELLO, subito dopo. Non è una misura sui testi: è la domanda se il
  // rapporto che segue parla di tutti o solo di quelli che si sono fatti
  // vedere. Se il piano diceva cinque e gli esiti sono quattro, il quinto è
  // sparito senza lasciare traccia in nessuna delle tre liste — e quello è il
  // modo in cui un difetto resta invisibile per settimane.
  const c = m.completezza;
  if (c) {
    const q = c.perCategoria;
    // «1 fermati» si legge come una svista, e una svista in una riga di
    // riepilogo fa dubitare del riepilogo.
    const n = (quanti, uno, molti) => `${quanti} ${quanti === 1 ? uno : molti}`;
    const dettaglio = [
      n(q.finito, "finito", "finiti"),
      // Mai «0 senza pagina finale»: una riga che dice zero ogni volta smette
      // di essere letta, e questa serve proprio le volte in cui non è zero.
      ...(q.senza_finale > 0 ? [`${q.senza_finale} senza pagina finale`] : []),
      n(q.fermato, "fermato", "fermati"),
      n(q.caduto, "caduto", "caduti"),
      n(q.respinto, "respinto", "respinti"),
    ].join(", ");
    if (!c.noto) {
      di("APPELLO — non verificabile");
      di(`  ${c.esiti} ruoli giocati (${dettaglio}), ma il piano non è arrivato fin qui.`);
      di("  Non vuol dire «tutti presenti»: vuol dire che non si è potuto controllare.");
      di("");
    } else if (c.completa) {
      di(`APPELLO: ${c.attesi} ruoli nel piano, ${c.attesi} con un esito — ${dettaglio}`);
      di("");
    } else {
      di(`APPELLO INCOMPLETO — ${c.attesi} ruoli nel piano, ${c.esiti} con un esito`);
      di(`  (${dettaglio})\n`);
      for (const x of c.mancanti) {
        di(`  · ${x.etichetta} — nessun esito${x.attesi > 1 ? ` (${x.conEsito} su ${x.attesi})` : ""}`);
      }
      for (const x of c.inPiu) {
        di(`  · ${x.etichetta} — ${x.conEsito} esiti dove il piano ne prevedeva ${x.attesi}`);
      }
      if (c.copertiDalleListe !== c.esiti) {
        di(`  · ${c.esiti - c.copertiDalleListe} esiti non cadono in nessuna delle quattro categorie`);
        di("    (è il caso che si vedrebbe se qualcuno aggiungesse un quinto stato");
        di("     senza metterlo in una lista: sparirebbe esattamente così)");
      }
      di("");
      di("  Un ruolo che non compare in nessuna lista non è «andato bene»: è un buco.");
      di("  Il robot può essersi fermato prima di riportare — e in quel caso può aver");
      di("  già cambiato qualcosa: guarda `npm run banco iscrizioni` prima di rilanciare.");
      di("");
    }

    // FUORI dal ramo dell'appello incompleto, e non è un dettaglio di stampa:
    // un ruolo senza pagina finale ha comunque il suo esito, quindi l'appello è
    // COMPLETO e questo blocco non comparirebbe mai. È esattamente il modo in
    // cui il 18/09 «5 finiti» e «feedback finale 4 testi» sono convissuti nello
    // stesso rapporto senza che nessuno dei due dicesse la cosa.
    if (c.senzaFinale && c.senzaFinale.length > 0) {
      const quanti = c.senzaFinale.length;
      di(`SENZA PAGINA FINALE — ${quanti === 1 ? "1 ruolo" : `${quanti} ruoli`}`);
      for (const x of c.senzaFinale) di(`  · ${x.etichetta} — ${x.perche}`);
      di("");
      di("  Non è un buco del rapporto: è la pagina che lo studente apre alla fine del");
      di("  progetto, e non c'è. Il percorso è arrivato in fondo lo stesso, quindi non");
      di("  lo dice nessun altro numero — i testi contati più sotto sono quelli che");
      di("  esistono, non quelli che dovevano esserci.");
      di("");
    }
  }

  // QUESTA PASSATA È PULITA? Sta qui in alto perché qualifica tutto quello che
  // segue: i punteggi, i testi contati, la lingua. Una passata ripresa non è
  // identica a una pulita — e il banco esiste per confrontarle.
  const rip = m.riprese;
  if (rip && rip.tappe.length > 0) {
    di(`RIPRESE DA UNA PASSATA PRECEDENTE: ${rip.tappe.length === 1 ? "1 tappa" : `${rip.tappe.length} tappe`} su ${rip.ruoli === 1 ? "1 ruolo" : `${rip.ruoli} ruoli`}`);
    di("  Non è un guasto: il robot ha fatto la cosa giusta, ha ripreso invece di");
    di("  rifare. Ma questa passata NON è pulita, e se entra in un confronto senza");
    di("  che si sappia, la differenza si legge come un cambiamento del prodotto.\n");
    for (const t of rip.tappe) di(`  · ${t.etichetta} — tappa «${t.faseId}»: ${descriviRipresa(t)}`);
    di("");
  } else if (rip && !rip.noto && rip.tappeViste > 0) {
    // «Non ho guardato» non è «non ce n'erano»: un rapporto scritto prima che
    // il banco registrasse le riprese non ha il campo, e tacere qui direbbe
    // che la passata era pulita.
    di("RIPRESE: non lo so");
    di("  Questi esiti sono stati scritti prima che il banco registrasse le riprese.");
    di("  Non vuol dire che la passata fosse pulita: vuol dire che non si può dire.\n");
  }

  if (m.trappole && m.trappole.length > 0) {
    di("TRAPPOLE");
    const ETICHETTA = {
      colta: "✓ COLTA",
      non_colta: "✗ NON COLTA",
      rossa_come_previsto: "✗ rossa, come previsto",
      diventata_verde: "★ È DIVENTATA VERDE",
      nessun_verdetto: "— nessun verdetto",
    };
    for (const t of m.trappole) {
      const stato = t.stato ?? "nessun_verdetto";
      di(`  ${ETICHETTA[stato] ?? stato}  ${t.nome ?? t.etichetta}  (${t.dove ?? "?"}${Number.isFinite(t.punteggio) ? `, ${t.punteggio} punti` : ""})`);
      if (t.motivo) di(`      ${t.motivo}`);
      if (stato === "rossa_come_previsto") di(`      attesa rossa: ${t.rossoAtteso}`);
      for (const c of t.controlli ?? []) di(`      ${c.ok ? "✓" : "✗"} ${c.ok ? c.descrizione : c.spiegazione}`);
    }
    di("");

    // Una trappola ROSSA DI PROPOSITO che diventa verde è la notizia del
    // rapporto, e va detta senza esultare: il controllo è lessicale, quindi
    // parziale, e un modello che dice la stessa cosa con altre parole lo passa.
    const nuoveVerdi = m.trappole.filter((t) => t.stato === "diventata_verde");
    if (nuoveVerdi.length > 0) {
      for (const t of nuoveVerdi) {
        di(`  ★ «${t.nome ?? t.etichetta}» era attesa ROSSA e adesso passa.`);
        di(`      ci si aspettava: ${t.rossoAtteso}`);
      }
      di("  O la proprietà è arrivata, o il controllo ha smesso di guardare dove");
      di("  guardava — è lessicale, quindi parziale. Le due cose si distinguono");
      di("  solo LEGGENDO il testo. Prima di togliere l'attesa rossa dal file,");
      di("  leggilo.");
      di("");
    }

    di("  Confronto letterale sul testo, mai un modello che giudica un altro");
    di("  modello. Una trappola NON colta è il risultato più utile che questo");
    di("  banco possa dare: vuol dire che il revisore ha lasciato passare");
    di("  esattamente la cosa che gli avevamo chiesto di non lasciar passare.");
    di("  «Rossa come previsto» è un'altra cosa: chiede una proprietà che il");
    di("  prodotto non ha ancora, e sta qui apposta per renderla visibile prima");
    di("  che si costruisca la cosa che dovrebbe averla. Una trappola che sta");
    di("  fuori dalla suite perché fallisce è una trappola che nessuno rimette.");
    di("");
  }

  // Lo stato che non dovrebbe esistere. Sta qui in alto e non in fondo alla
  // riga delle percentuali dei revisori, dove il 13/09 si è letto come rumore:
  // `sconosciuto 1 (5.0%)`, in mezzo a numeri che raccontano quanto bene sono
  // andati i revisori. Non è un revisore andato male — è una tappa che è
  // avanzata senza che nessuno abbia registrato com'è andata.
  if (m.avanzateSenzaEsito && m.avanzateSenzaEsito.length > 0) {
    di(`UNA TAPPA È AVANZATA SENZA UN ESITO REGISTRATO: ${m.avanzateSenzaEsito.length}`);
    di("  La tappa risulta «revisionata» — la revisione c'è, quindi il motore è");
    di("  arrivato in fondo — ma `revisione_esito` è null. È il caso peggiore di");
    di("  tutti, perché è INDISTINGUIBILE da una riuscita: la query che cerca i");
    di("  guasti (`revisione_esito is not null and revisione_esito <> 'riuscita'`)");
    di("  non la vede, e lo studente ha un punteggio che nessuno sa da dove venga.\n");
    for (const a of m.avanzateSenzaEsito) {
      di(`  · ${a.etichetta} — tappa «${a.faseId}», iscrizione ${a.iscrizioneId ?? "(non riportata)"}`);
      di(`      ${a.tentativi} tentativi registrati`);
    }
    di("");
    di("  Da guardare per prima cosa: `npm run banco -- log 240`, e la marcatura");
    di("  di `revisione_esito` nel cron (che se non atterra deve fermare la tappa,");
    di("  non lasciarla avanzare muta).");
    di("");
  }

  if (m.respinti && m.respinti.length > 0) {
    di(`RESPINTI PER UNA RICHIESTA DOPPIA: ${m.respinti.length}`);
    di("  Non sono cancelli e non sono guasti del prodotto: è il banco che ha");
    di("  bussato due volte, e il prodotto ha risposto giustamente di no. Il");
    di("  difetto sta qui dentro, non là fuori.\n");
    for (const r of m.respinti) di(`  · ${r.etichetta} — a «${r.dove}»: ${r.perche}`);
    di("");
  }

  if (m.caduti && m.caduti.length > 0) {
    di(`CADUTI PER UN GUASTO: ${m.caduti.length}`);
    di("  Non sono risultati: sono ruoli persi. La rete, un timeout, un'eccezione,");
    di("  o un 5xx — che è il prodotto che si rompe, non il prodotto che dice no.");
    di("  Il robot riprova già una volta da solo su un errore di rete, quindi se");
    di("  sono qui hanno fallito due volte. Vanno RIFATTI, non studiati.");
    di("  Su un 5xx guarda PRIMA i log: `npm run banco -- log 30`.\n");
    for (const c of m.caduti) di(`  · ${c.etichetta} — ${c.perche}`);
    di("");
  }

  if (m.fermati.length > 0) {
    di(`FERMATI DA UN CANCELLO: ${m.fermati.length}`);
    di("  Un gate che morde è un risultato, non un ostacolo. Questi vanno letti per primi.\n");
    for (const f of m.fermati) {
      di(`  · ${f.etichetta} — a «${f.dove}»`);
      di(`      ${f.perche}`);
      if (f.gate) di(`      (è un gate del prodotto che ha rifiutato la consegna: guardalo prima di cambiare il file)`);
    }
    di("");
  }

  di(`TESTI RACCOLTI: ${m.testi}`);
  di("  Revisioni di tappa, reazioni del cliente e feedback finali. Sono i testi che");
  di("  uno studente avrebbe letto: su questi passano i pattern, non su un campione.\n");

  const certe = m.accordi.filter((a) => a.certa).length;
  di(`LINGUA INVARIANTE — ${m.accordi.length} catture da leggere su ${m.testi} testi`);
  if (m.accordi.length === 0) {
    di("  Nessuna. I pattern non hanno trovato niente da guardare.");
  } else {
    di("  NON sono ancora un tasso di esposizione: i pattern sono larghi apposta e");
    di("  una parte di queste sarà legittima («il defibrillatore parla da solo» non");
    di("  è rivolto a chi legge). Quante lo siano davvero lo dice chi le legge.");
    di(`  Di queste, ${certe} sono della classe che falsi positivi non ne fa (il`);
    di("  participio con «essere» in seconda persona): quelle contano comunque.");
    di("");
    for (const a of m.accordi.slice(0, 12)) di(`  · ${a.dove}${a.certa ? "   [certa]" : ""}\n      ${a.contesto}`);
    if (m.accordi.length > 12) di(`  … e altre ${m.accordi.length - 12}, tutte nel rapporto su file.`);
  }
  di("");

  di("DOVE SI CONCENTRANO (per genere di testo)");
  di("  Serve a sapere quale prompt toccare: non tutti sbagliano allo stesso modo.");
  for (const [g, v] of Object.entries(m.perGenere)) {
    if (v.testi === 0) continue;
    di(`  ${g.padEnd(22)} ${String(v.testi).padStart(3)} testi   lingua ${v.accordi} (${v.certe} certe, ${percentuale(v.certe, v.testi)})   registro ${v.registro}`);
  }
  if (m.perGenere["come hai lavorato"] || m.perGenere["chiusura del cliente"]) {
    di("  Le ultime tre righe erano UNA fino al 26/09, e il loro numero non era di");
    di("  nessun prompt: «come hai lavorato» lo scrive una chiamata a sé, «chiusura");
    di("  del cliente» è scritta nella voce del cliente apposta. Una cattura in una");
    di("  qualunque delle tre marcava tutte e tre.");
  }
  di("");

  const formule = m.registro.filter((r) => r.formula).length;
  const giudizi = m.registro.length - formule;
  di(`REGISTRO — ${m.registro.length} catture da leggere: ${formule} formula, ${giudizi} giudizi`);
  if (m.registro.length === 0) di("  Nessuna parola-verdetto e nessuna terza persona.");
  else {
    di("  Sono DUE problemi. La FORMULA («hai capito», «hai riconosciuto») è tolta in");
    di("  codice quando la segue «che»: quello che resta qui è il residuo, le forme");
    di("  che non si riscrivono senza rompere la frase. I GIUDIZI («maturo»,");
    di("  «saggio», lo studente in terza persona) sono un'altra specie, e sono");
    di("  ancora un problema di prompt.");
    di("  Stessa avvertenza di sempre: «hai capito» dentro un complimento va letto.");
    di("");
    for (const r of m.registro.slice(0, 12)) di(`  · ${r.dove}\n      ${r.contesto}`);
    if (m.registro.length > 12) di(`  … e altre ${m.registro.length - 12}, tutte nel rapporto su file.`);
  }
  di("");

  // LA LISTA ACCANTO ALLE SUE CATTURE. Non conclude niente, e non deve: una
  // voce a zero o è inutile o è la prova che il divieto funziona, e i due casi
  // da qui non si distinguono. Dirlo è il punto — un elenco editoriale che
  // cresce senza che nessuno sappia quali voci lavorano cresce alla cieca.
  if (m.lessico) {
    const attive = m.lessico.filter((v) => v.catture > 0).sort((a, b) => b.catture - a.catture);
    const mute = m.lessico.filter((v) => v.catture === 0);
    const somma = m.lessico.reduce((a, v) => a + v.catture, 0);
    di(`IL LESSICO, VOCE PER VOCE — ${attive.length} voci su ${m.lessico.length} hanno catturato`);
    for (const v of attive) {
      di(`  ${String(v.catture).padStart(4)}  ${v.famiglia.padEnd(22)} /${v.pattern}/${v.esempi.length ? `   «${v.esempi.join("», «")}»` : ""}`);
    }
    if (mute.length > 0) {
      di("");
      di(`  Mai scattate in questa passata (${mute.length}):`);
      // Per famiglia, che è l'unità con cui la lista è scritta e con cui si
      // deciderà se una voce va tolta.
      const perFamiglia = {};
      for (const v of mute) (perFamiglia[v.famiglia] ??= []).push(`/${v.pattern}/`);
      for (const [f, ps] of Object.entries(perFamiglia)) di(`    ${f.padEnd(22)} ${ps.join("  ")}`);
    }
    // Il riscontro incrociato: la somma delle voci DEVE essere il numero delle
    // catture. Se divergono è l'estrattore a doversi spiegare, non i numeri —
    // un conteggio che non torna con quello accanto è l'unico modo di
    // accorgersi che uno dei due ha smesso di guardare.
    if (somma !== m.registro.length) {
      di("");
      di(`  ⚠  La somma delle voci (${somma}) non torna col numero delle catture (${m.registro.length}).`);
      di("     Non è un dato sul modello: è questo conto che ha un difetto. Da guardare");
      di("     prima di leggere qualunque riga qui sopra.");
    }
    di("");
  }

  // «Dove porta» ha una riga sua perché è l'unico campo del prodotto in cui una
  // parola-contenitore è di per sé il difetto: altrove «settore» può starci.
  if (m.dovePorta && m.dovePorta.length > 0) {
    const sporche = m.dovePortaConContenitore ?? [];
    di(`DOVE PORTA — ${sporche.length} voci su ${m.dovePorta.length} nominano una categoria invece di una persona`);
    if (sporche.length === 0) {
      di("  Nessuna parola-contenitore. Da leggere lo stesso: la regola chiede una");
      di("  persona che fa una cosa IN UN POSTO, e il posto un pattern non lo vede.");
    } else {
      di("  La regola chiede una persona che fa una cosa in un posto — «chi fa");
      di("  l'infermiere in un paese di montagna» — non il nome che quei lavori hanno");
      di("  in un elenco. Larga di proposito: «professioni» prende anche usi buoni.");
      di("");
      for (const v of sporche.slice(0, 8)) di(`  · ${v.dove}   [${v.contenitori.join(", ")}]\n      ${v.voce}`);
      if (sporche.length > 8) di(`  … e altre ${sporche.length - 8}, tutte nel rapporto su file.`);
    }
    di("");
  }

  di("QUANTO CI È COSTATO");
  di(`  Testi con almeno una cattura — lingua: ${m.testiConAccordo}, registro: ${m.testiConRegistro} (su ${m.testi}).`);
  di("  Ognuno di questi è una SECONDA chiamata che la guardia ha chiesto e che");
  di("  non è servita: il testo è arrivato allo studente comunque sporco. Se il");
  di("  numero del registro è alto, la regola nel prompt non sta prendendo —");
  di("  chiederla meglio costa una chiamata a testo e non la risolve.");
  di("");

  di("REVISORI:");
  const totRev = Object.values(m.esitiRevisione).reduce((a, b) => a + b, 0);
  for (const [k, v] of Object.entries(m.esitiRevisione).sort((a, b) => b[1] - a[1])) {
    di(`  ${String(k).padEnd(18)} ${v}  (${percentuale(v, totRev)})`);
  }
  if (m.esitiRevisione.sconosciuto) {
    di("  «sconosciuto» NON è un giudizio del revisore: è una tappa senza esito");
    di("  registrato — o mai revisionata (sta fra i fermati, col suo perché), o");
    di("  avanzata lo stesso (sta in cima al rapporto, con la riga sua).");
  }
  di(`  Tappe che hanno avuto bisogno di più di un giro: ${m.tappeConTentativiExtra}`);
  if (m.tappeConTentativiExtra > 0) {
    di("  Ogni giro in più è un giorno di attesa in produzione. Il motivo sta nei log:");
    di("      npm run banco log 240");
  }
  di("");

  // LA DISTRIBUZIONE DEI PUNTEGGI DI TAPPA. Non conclude: stampa i due numeri
  // del metro accanto alla linea di base e lascia la lettura a chi legge — un
  // titolo che concludesse al posto suo sarebbe la stessa cosa contro cui la
  // riga «catture da leggere» è stata scritta.
  if (m.punteggi) {
    const d = m.punteggi;
    const quotaFuori = (d.fuoriBanda / d.totale) * 100;
    di("PUNTEGGIO DI TAPPA — quanta scala viene usata:");
    for (const { valore, n } of d.per) di(`  ${String(valore).padStart(3)}  ${"█".repeat(Math.min(n, 40))} ${n}`);
    di(`  ${d.totale} punteggi, ${d.distinti} valori distinti, da ${d.min} a ${d.max}.`);
    di(`  Fuori dai quattro valori ${BANDA_BASE[0]}-${BANDA_BASE[1]}: ${d.fuoriBanda} (${quotaFuori.toFixed(1)}%).`);
    if (d.totale < MIN_TAPPE_DISTRIBUZIONE) {
      di(`  (${d.totale} tappe sono poche per leggere una distribuzione: il metro qui sotto`);
      di("   è stato scritto per un workshop intero. Non vuol dire che vada bene,");
      di("   vuol dire che non si vede.)");
    } else {
      di(`  Linea di base, PRIMA che il punteggio avesse una rubrica: ${BASE.punteggi} punteggi su`);
      di(`  ${BASE.ruoli} ruoli, mai sotto ${BASE.min} e mai sopra ${BASE.max}, ${BASE.quotaDentro}% dentro ${BANDA_BASE[0]}-${BANDA_BASE[1]}.`);
      di(`  Il metro scritto prima: almeno ${METRO.distinti} valori distinti E almeno ${METRO.fuoriBanda}% fuori dalla banda.`);
      const q1 = d.distinti >= METRO.distinti ? "sì" : "no";
      const q2 = quotaFuori >= METRO.fuoriBanda ? "sì" : "no";
      di(`  Qui: valori distinti ${d.distinti} → ${q1};  fuori dalla banda ${quotaFuori.toFixed(1)}% → ${q2}.`);
      if (q1 === "no" && q2 === "no") {
        di("  Se la distribuzione resta com'era, la rubrica non era la causa — e la strada");
        di("  successiva non è scrivere ancore migliori: è che il modello non distingue su");
        di("  questa scala, e allora il numero va tolto o sostituito con qualcosa di verificabile.");
      }
    }
    di("");
  }

  if (m.fiducia.length > 0) {
    di("FIDUCIA PER RUOLO (dal più basso):");
    for (const f of m.fiducia) di(`  ${String(f.valore).padStart(3)}/100  ${f.etichetta}`);
    const min = m.fiducia[0].valore;
    const max = m.fiducia[m.fiducia.length - 1].valore;

    // L'AVVISO PARLA DELLA RUBRICA, quindi ha bisogno di abbastanza ruoli per
    // poterlo dire. Su una passata da un ruolo solo scattava lo stesso —
    // «76—76» non è una forbice stretta, è un valore unico — e su due non
    // significa niente: lo scarto noto fra due passate sullo stesso identico
    // lavoro è 2,5-3,1 punti per ruolo, quindi con due numeri qualunque
    // distanza sta dentro il rumore. Stessa specie di ogni altro controllo che
    // conclude su quello che non può vedere.
    const MIN_RUOLI_FORBICE = 3;
    if (m.fiducia.length === 1) {
      di("  Un ruolo solo: non c'è nessuna forbice da leggere.");
    } else {
      di(`  Estremi: ${min} — ${max}.`);
      if (max - min < 10) {
        if (m.fiducia.length >= MIN_RUOLI_FORBICE) {
          di("  ⚠  Una forbice così stretta su ruoli diversi non è un merito: vuol dire che");
          di("     il punteggio non sta distinguendo niente. Va guardata la rubrica.");
        } else {
          di(`  (${m.fiducia.length} ruoli sono pochi per dire se la rubrica distingue: serve`);
          di("   una passata più larga. Non vuol dire che vada bene, vuol dire che non si vede.)");
        }
      }
    }
  }

  di("\n═════════════════════════════════\n");
  di("Cosa NON c'è qui, apposta: se una revisione sia BUONA. Quello si legge.");
  di("Un modello che valuta un modello condivide i suoi angoli ciechi — e ne");
  di("abbiamo la prova: due revisori diversi hanno elogiato lo stesso paragrafo");
  di("pericoloso, quello del protocollo senza defibrillatore.\n");
}

module.exports = {
  misura,
  stampaRapporto,
  raccogliTesti,
  partiDelFinale,
  contaLessico,
  verificaCompletezza,
  categoriaEsito,
  distribuzionePunteggi,
};
