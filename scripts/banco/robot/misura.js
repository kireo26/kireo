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
const { LESSICO_VERDETTO } = require("@/lib/lingua/registroStudente");
const { trovaRegistro } = require("@/lib/lingua/registroStudente");
const { stringheInJson } = require("@/lib/lingua/scansione");
const { verificaAtteso } = require("./atteso");

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

// Ogni testo con la sua provenienza, così una cattura si può andare a rileggere
// invece di restare un numero.
function raccogliTesti(esiti) {
  const testi = [];
  for (const e of esiti) {
    for (const t of e.tappe) {
      if (t.revisione) testi.push({ dove: `${e.etichetta} / ${t.faseId} / revisione`, valore: t.revisione });
      if (t.reazione) testi.push({ dove: `${e.etichetta} / ${t.faseId} / reazione del cliente`, valore: t.reazione });
    }
    if (e.feedbackFinale) testi.push({ dove: `${e.etichetta} / feedback finale`, valore: e.feedbackFinale });
  }
  return testi;
}

// In quale delle quattro categorie cade un ruolo giocato. La precedenza è
// quella delle tre liste storiche (doppio > guasto > cancello) più «finito»,
// che prima non era una lista perché non serviva a nessuno — e infatti il buco
// stava lì: un ruolo che non finisce e non entra in nessuna lista sparisce.
function categoriaEsito(e) {
  if (!e.fermato) return "finito";
  if (e.fermato.doppio) return "respinto";
  if (e.fermato.guasto) return "caduto";
  return "fermato";
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
    fermato: conta("fermato"),
    caduto: conta("caduto"),
    respinto: conta("respinto"),
  };
  const somma = Object.values(perCategoria).reduce((a, b) => a + b, 0);

  // Senza il piano non si può dire niente: si dichiara, non si tace. È la
  // stessa regola di «non posso vederle» invece di «non ci sono».
  if (!Array.isArray(attesi)) {
    return { noto: false, perCategoria, esiti: esiti.length, copertiDalleListe: somma };
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
  let tentativiTotali = 0;
  let tappeConTentativiExtra = 0;
  for (const e of esiti) {
    for (const t of e.tappe) {
      if (t.giaFatta) continue;
      const k = t.esitoRevisione ?? "sconosciuto";
      esitiRevisione[k] = (esitiRevisione[k] ?? 0) + 1;
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
  const generi = ["revisione", "reazione del cliente", "feedback finale"];
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
    testi: testi.length,
    accordi,
    registro,
    testiConAccordo,
    testiConRegistro,
    dovePorta,
    dovePortaConContenitore,
    perGenere,
    esitiRevisione,
    avanzateSenzaEsito,
    tentativiTotali,
    tappeConTentativiExtra,
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

function stampaRapporto(m, righe = console.log) {
  const di = (t = "") => righe(t);

  di("\n═══════════ LA MISURA ═══════════\n");

  // L'APPELLO, per primo. Non è una misura sui testi: è la domanda se il
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

module.exports = { misura, stampaRapporto, raccogliTesti, verificaCompletezza, categoriaEsito };
