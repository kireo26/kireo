// Le risposte del robot ai tre test e alla missione. Scritte, non casuali.
//
// PERCHÉ FISSE. Se il robot rispondesse a caso, il suo profilo cambierebbe a
// ogni passata; con il profilo cambia l'area vincente di T3, e con quella la
// missione suggerita. Due passate non sarebbero più confrontabili — e la
// confrontabilità è l'unica cosa su cui si regge tutto il banco.
//
// E NON DEGENERI, che è la parte meno ovvia. La tentazione è dare al robot un
// profilo tutto su un'area sola e uno stile solo: è più semplice da scrivere e
// NON PROVEREBBE MAI la parte del prodotto che decide fra aree vicine. T3
// esiste per mettere le aree una contro l'altra; un robot con una sola area
// rende T3 una formalità e nasconde proprio il codice che dovrebbe esercitare.
// Quindi il robot è uno studente con una direzione chiara e due interessi
// laterali veri: salute portante, comunicazione e agrifood di lato, analitico
// primo con relazionale vicino.
//
// ─────────────────────────────────────────────────────────────────────────
// LA DIPENDENZA CHE NON SI VEDE, E CHE VA LETTA PRIMA DI TOCCARE QUALUNQUE
// COSA QUI DENTRO:
//
//   il robot spende CINQUE gettoni e ne lascia chiusi SETTE, apposta —
//   e i tre testi aperti PARLANO DI QUELLO CHE NON HA GUARDATO.
//
// Non è pigrizia ed è la parte più importante della partita: un robot che
// compra tutto quello che conta non somiglia a nessuno studente e non lascia
// niente da ammettere. Se un domani qualcuno «migliora» il robot facendogli
// comprare tutto, i tre testi diventano FALSI — restano lì a dire «non ho
// letto il registro degli accessi» mentre il registro è stato letto, e nessuno
// se ne accorge leggendo il codice, perché le due cose stanno a cento righe di
// distanza.
//
// Per questo la dipendenza non è solo scritta: è CONTROLLATA. Più sotto,
// `NOMINATI_COME_NON_LETTI` accoppia ogni materiale lasciato chiuso alla frase
// con cui il testo lo nomina, e `npm run test:percorso` pretende che le due
// liste dicano la stessa cosa — in tutti e due i versi. Comprarne uno in più
// fa diventare rosso il test con il nome del materiale e la frase che quel
// testo continua a dire.
// ─────────────────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════ T1 «Da dove parti»
//
// Cinque volte salute, due comunicazione, due agrifood, e i DUE ITEM NEGATIVI
// spesi su aree che nel profilo non contano (economia, meccanica) — così il
// «no» non sporca il profilo. Quelle due righe sono le uniche dove scegliere
// a caso farebbe danno: se un giorno il robot dovesse avere un'area portante
// diversa, vanno riguardate per prime.
//
// LA FORMA È UN PAYLOAD, non l'id dell'opzione. Il 19/09 queste quattordici
// righe erano stringhe nude (`i1: "i1d"`): il robot le ha salvate così, la
// route legge `payload.opzioneId`, e non ne ha vista nessuna — zero prove,
// profilo vuoto, e T3 fermo due test più tardi. Il controllo era verde perché
// passava le risposte allo scoring GIÀ SVOLTE, cioè saltava esattamente il
// pezzo rotto; oggi le attraversa con `evidenzeDaRighe`, la stessa lettura
// della route.
const T1_RISPOSTE = {
  i1: { opzioneId: "i1d" }, // agrifood-ambiente — l'orto verticale
  i2: { opzioneId: "i2a" }, // salute — la molecola
  i3: { opzioneId: "i3d" }, // scienze-ricerca — il dato che non torna
  i4: { opzioneId: "i4a" }, // NEGATIVO su economia-management
  i5: { opzioneId: "i5b" }, // salute — chi assiste in riabilitazione
  i6: { opzioneId: "i6b" }, // forzata → comunicazione-media (scienze-ricerca prende −1)
  i7: { opzioneId: "i7c" }, // comunicazione-media
  i8: { opzioneId: "i8b" }, // salute
  i9: { opzioneId: "i9b" }, // agrifood-ambiente
  i10: { opzioneId: "i10b" }, // lingue-relazioni-internazionali
  i11: { opzioneId: "i11c" }, // NEGATIVO su meccanica-meccatronica
  i12: { opzioneId: "i12b" }, // forzata → salute (edilizia prende −1)
  i13: { opzioneId: "i13c" }, // informatica-digitale
  i14: { opzioneId: "i14c" }, // salute
};

// ══════════════════════════════════════════════════════ T2 «Come ti muovi»
//
// IL ROBOT NON RISPONDE MAI AGLI ESTREMI (le due Likert sono 4 e 2 su 5, non 5
// e 1): un profilo fatto di minimi e massimi non somiglia a nessuno, e rende
// invisibili gli errori di arrotondamento della normalizzazione per-asse.
const T2_RISPOSTE = {
  t2_1: { opzioneId: "t2_1a" },
  t2_2: { opzioneId: "t2_2a" },
  t2_3: { opzioneId: "t2_3b" },
  t2_4: { opzioneId: "t2_4b" },
  t2_5: { opzioneId: "t2_5a" },
  t2_6: { opzioneId: "t2_6a" },
  t2_7: { opzioneId: "t2_7b" },
  t2_8: { opzioneId: "t2_8b" },
  t2_9: { opzioneId: "t2_9a" },
  t2_10: { opzioneId: "t2_10a" },
  t2_11: { opzioneId: "t2_11a" },
  t2_12: { opzioneId: "t2_12a" },
  t2_13: { ordine: ["t2_13a", "t2_13b", "t2_13d", "t2_13c"] },
  t2_14: { allocazioni: { t2_14a: 4, t2_14b: 3, t2_14d: 2, t2_14c: 1 } },
  t2_15: { valore: 4 }, // analitico, alto ma non massimo
  t2_16: { valore: 2 }, // operativo, basso ma non minimo
};

// ══════════════════════════════════════════════════════ T3 «Più a fondo»
//
// QUI NON SI POSSONO SCRIVERE LE RISPOSTE, e non è una scelta: T3 è assemblato
// a runtime sulle aree già emerse (`lib/test/assembla-t3.ts`), gli item hanno
// id come `t3_c_<x>_<y>`, e una lista fissa non esiste e non esisterà.
// Quindi si scrive una REGOLA, ed è deterministica.
const PREFERENZA_AREE = [
  "salute-professioni-sanitarie",
  "comunicazione-media",
  "agrifood-ambiente",
  "scienze-ricerca",
  "lingue-relazioni-internazionali",
  "informatica-digitale",
];
const PREFERENZA_ASSI = ["analitico", "relazionale", "operativo", "creativo"];

// La regola 3 (nessuna delle due in lista → la PRIMA, sempre) non è un
// ripiego: è la garanzia che due passate identiche diano lo stesso T3 anche
// quando il prodotto cambia le aree candidate.
function scegliT3(item) {
  const [a, b] = item.opzioni;
  const lista = item.kind === "coppia" ? PREFERENZA_AREE : PREFERENZA_ASSI;
  const chiave = (o) => (item.kind === "coppia" ? o.area : o.asse);
  const rango = (o) => {
    const i = lista.indexOf(chiave(o));
    return i === -1 ? Number.POSITIVE_INFINITY : i;
  };
  return rango(a) <= rango(b) ? a.id : b.id;
}

// ══════════════════════════════════════════════════════ La missione
//
// FISSATA QUI, e confrontata con quella che il prodotto suggerirebbe. Se il
// banco si limitasse a seguire il suggerimento, il giorno in cui il registro
// delle missioni cambia il robot giocherebbe un'altra missione e nessuno se ne
// accorgerebbe — e questi testi, che sono risposte a QUESTE domande,
// diventerebbero parole a caso. Se divergono, il banco lo dice e va avanti: è
// un'informazione sul prodotto, non un guasto del robot.
//
// Deriva (rifatta eseguendo lo scoring, non leggendo una tabella): T1 porta
// salute a 15 punti su 9 di riferimento → 1.0, quindi area_signal 100 contro
// 67/67/33/33/22; T3 la fa vincere 3 incontri su 3; `missionePerArea` sceglie
// dove l'area è più centrale, e `sportello-insieme` è l'unica che la mette
// all'indice 0.
//
// MA NON È T1 A DECIDERE, e leggendo le due righe qui sopra verrebbe da
// crederlo: il punteggio di T1 serve solo a far entrare salute fra le cinque
// candidate di T3 — dopo, a vincere gli incontri è la PREFERENZA del robot,
// anche partendo quarta. Misurato in `scripts/verifica-percorso-robot.js` §2,
// dove sta il ragionamento per esteso: togliendo tre dei cinque item di T1 che
// nominano salute la missione non cambia; serve toglierli tutti e cinque.
const MISSIONE_FISSATA = "sportello-insieme";

// I cinque gettoni, nell'ordine in cui hanno senso. Ognuno ha una ragione che
// si può leggere; comprarne uno diverso è legittimo, ma allora vanno riscritti
// i testi (vedi NOMINATI_COME_NON_LETTI, e il test che lo pretende).
const GETTONI = [
  "M5", // protocollo minori — è il mandato scelto, e dice che il termine scade oggi
  "M4", // regolamento affitti — cambia la mossa su Kaur: basta protocollare entro le 12
  "M9", // cosa dice davvero la lettera Colella — un'ora di ascolto diventa tre minuti di informazione
  "M6", // riservatezza dei contatti anonimi — è quello che disinnesca la trappola dello scarto
  "M11", // disponibilità reali degli operatori — senza, l'assegnazione è alla cieca
];

// L'UNICO DEI CINQUE CHE RIGUARDA PERSONE E NON CARTE. Serve al testo della
// riflessione, che dice «quattro su carte e uno solo su persone»: è un conto
// che chi legge può rifare, quindi deve restare vero. Il test lo verifica.
const GETTONI_DI_PERSONE = ["M11"];

// I SETTE LASCIATI CHIUSI, ognuno con la frase che lo nomina nei testi. È la
// forma controllabile della dipendenza dichiarata in testa al file: la chiave
// dice COSA non è stato comprato, il valore dice DOVE il robot lo ammette.
//
// Nota per chi ci tornerà: le ultime due sono le consulenze del mandato, che
// stanno nello stesso dossier dei materiali e si comprano con gli stessi
// gettoni. La prima stesura della spec ne contava cinque e si leggeva come un
// elenco completo — il conto vero è sette.
const NOMINATI_COME_NON_LETTI = {
  M7: "il registro degli accessi",
  M8: "la nota sulla mediazione",
  M10: "la scheda dell'alunno",
  M12: "le indicazioni della coordinatrice",
  M13: "il precedente della mail di aprile",
  P_sociale: "l'assistente sociale",
  P_referente_scuola: "la referente della scuola",
};

// ── I TRE TESTI APERTI ────────────────────────────────────────────────────
//
// SONO VOCE, E VANNO RILETTI DA MARIO. La sostanza è sua (concreti, con un
// numero dentro, con un punto in cui si ammette quello che non si sa); la
// stesura è mia, perché la prima versione rispondeva a domande che questa
// missione non fa:
//
//   · `s4_proposta` NON è «la proposta»: è LA RISPOSTA ALLA MAIL ANONIMA.
//     Il revisore ha una regola dura scritta nel prompt — premia le risposte
//     brevi, non invadenti, con un contatto raggiungibile; NON premia quelle
//     lunghe o piene di domande. Un piano della mattina di trecento parole
//     rispondeva a un'altra domanda e sarebbe stato punito per la lunghezza.
//   · `s5_riflessione` chiede due cose precise: chi avete lasciato aspettare
//     più di quanto vi sembrasse giusto, e un momento in cui avreste voluto
//     chiedere aiuto e non l'avete fatto.
//   · e c'era un'ammissione FALSA, che il gioco smentisce: «non ho guardato se
//     il servizio sociale è aperto questo pomeriggio» — ma quello è il vincolo
//     del mandato `minori`, e arriva nell'intro della Stanza 3 prima del
//     budget, senza dipendere da nessun materiale. La cosa che il robot sa per
//     certo, dichiarata come quella che non sa. Al suo posto c'è
//     un'ammissione vera, che è già di Mario: il registro degli accessi.
const TESTI = {
  // s2_non_approfondire — facoltativo, nessun minimo.
  nonApprofondire: [
    "Ho lasciato chiusi il registro degli accessi, la nota sulla mediazione, la scheda dell'alunno, le indicazioni della coordinatrice e il precedente della mail di aprile, e non ho sentito né l'assistente sociale né la referente della scuola.",
    "La nota sulla mediazione e il precedente li ho saltati perché credevo di sapere già la risposta — non far tradurre a un minore, non chiedere il nome a chi scrive anonimo — e in effetti l'ho fatta giusta lo stesso. La scheda dell'alunno l'ho saltata per una ragione diversa e più solida: non è lo sportello a doverla leggere, quella segnalazione la trasmetto e basta.",
    "Quello che ho saltato senza una ragione è il registro degli accessi. Costava un gettone e riguardava l'unica delle cinque persone che non era in sala a farsi vedere.",
  ].join("\n\n"),

  // s4_proposta — la risposta alla mail delle 7:40. Minimo 150 caratteri.
  // Breve, senza domande identificative, con un appiglio raggiungibile.
  // Nessun indirizzo e nessun orario inventati: la mail stessa è il canale, e
  // M3 dice che lo sportello registra ogni contatto — promettere l'anonimato
  // allo sportello sarebbe una cosa che contraddice un materiale letto.
  proposta: [
    "Buongiorno,",
    "ho letto quello che ha scritto. La risposta è sì: si può. Non le chiederò chi è, e per scrivermi non serve che me lo dica.",
    "Questa casella la leggiamo noi dello sportello: può rispondere qui quando vuole — fra un'ora o fra un mese, anche solo per dire che c'è ancora. Se un giorno preferisse parlare di persona, può passare e chiedere di chi le ha risposto a questa mail.",
    "Non deve decidere niente adesso.",
  ].join("\n"),

  // s5_riflessione — minimo 120 caratteri. Risponde a tutte e due le domande.
  riflessione: [
    "Il sig. Muratori. Quarto su cinque, venti minuti alla fine: ha aspettato più di tutti e chiedeva meno di tutti — quattro telefonate e nessuno che gli avesse mai detto niente. E l'ho richiamato senza sapere perché la sua pratica è ferma, perché il registro degli accessi è una delle cose che non ho aperto: si è sentito dire che qualcuno lo aveva sentito, che non è niente, ma non è quello per cui chiamava.",
    "Il momento in cui avrei dovuto chiedere aiuto è stato alle 9:15, davanti ai cinque gettoni. Ne ho spesi quattro su carte — un regolamento, un protocollo, una lettera, una nota — e uno solo su persone. Sofia aveva detto che quella mail le aveva fatto una strana impressione e che non sapeva dire perché: potevo chiederle cosa intendeva, e invece ho aperto un altro documento. Non costava un gettone, e non l'ho fatto.",
  ].join("\n\n"),
};

// ── La partita strutturata ────────────────────────────────────────────────
//
// Una voce per step, per id. Quelli non nominati qui cadono nella regola
// generica (`rispostaGenerica`): prima opzione in ordine di comparsa, sempre,
// mai a caso.
const PARTITA = {
  // Gratis: non leggerli sarebbe una scelta senza nessun contenuto. Si
  // prendono dallo step invece di elencarli, così un materiale aggiunto
  // domani viene letto e non ignorato in silenzio.
  s1_materiali: (step) => ({ letti: step.materiali.map((m) => m.id) }),

  // Il minore per primo: è la scelta dentro il profilo, ed è quella che i
  // materiali premiano — la segnalazione della scuola ha un termine di 48 ore
  // che scade oggi, ed è l'unica scadenza che non si vede guardando le
  // persone in sala.
  s1_priorita: { ordine: ["alunno", "kaur", "colella", "muratori", "mail"] },
  s1_mandato: { opzioneId: "minori" },

  s2_informazioni: { selezionati: GETTONI },
  s2_non_approfondire: { testo: TESTI.nonApprofondire },

  // 210 minuti-operatore, a passi di 10. `protocolla_kaur` e `spiega_colella`
  // esistono solo perché M4 e M9 sono stati letti; `data_per_ciascuno` non
  // compare affatto, perché M12 non è stato comprato — ed è coerente, si sente
  // nella riflessione.
  s3_budget: {
    allocazioni: {
      trasmetti_segnalazione: 30,
      protocolla_kaur: 20,
      compila_kaur: 30,
      ascolto_colella: 30,
      spiega_colella: 20,
      richiama_muratori: 20,
      rispondi_mail: 30,
      registra_contatti: 30,
    },
  },

  // La prima è la trappola dichiarata; la seconda mette un ragazzino di 14
  // anni a tradurre cose della sua famiglia — e il robot la scarta anche senza
  // aver letto M8, perché si riconosce da sola.
  s3_scarto: { scartati: ["chiedi_identita", "traduce_figlio"] },

  // IO/ALTRI, non le persone: per questa missione il passo è `assegna_ruoli`
  // (te ne occupi tu o lo lascia a qualcun altro), e l'assegnazione nominale a
  // Nadia/Paolo/Sofia è `assegna_persone`, che esiste solo nella Missione 10.
  // Le due ragioni per cui il robot lascia ad altri sono tutte e due ancorate
  // a materiali che ha letto davvero: serve l'arabo (M11), e la segnalazione
  // non la gestisce lo sportello (M5).
  s3_ruoli: {
    assegnazioni: {
      colella: "io",
      kaur: "altri",
      muratori: "io",
      segnalazione: "altri",
      mail: "io",
    },
  },

  // Cinque etichette, non una scala 1-5: 70 è «Abbastanza solida». Mai agli
  // estremi, per la stessa ragione delle Likert di T2.
  s4_previsione: { fiducia: 70 },

  s4_proposta: { testo: TESTI.proposta },
  s5_riflessione: { testo: TESTI.riflessione },

  // DERIVATI DALLA PARTITA, non dalla regola generica — e va detto perché è
  // una scelta. La regola generica (prime tre in ordine di comparsa) darebbe
  // «richiamare Colella, verificare Kaur, chiudere Muratori»: tre cose
  // ragionevoli che però contraddicono la mattina che il robot ha appena
  // giocato. Questi tre seguono invece da quello che ha fatto — il minore
  // messo per primo e il servizio sociale chiuso il giovedì pomeriggio
  // (`sociale_alunno`), il registro non letto che è l'ammissione dei suoi due
  // testi (`segnala_ferme`), la mail a cui ha appena risposto
  // (`canale_mail`).
  //
  // ONESTÀ SU COME SONO STATI SCELTI: derivati dalla partita, poi confrontati
  // con gli ideali della rubrica — due su tre coincidono. Il robot non può
  // leggere lo scoring (è server-only apposta, anti-gaming), ma chi scrive le
  // sue risposte sì, e quella asimmetria va dichiarata invece di lasciarla
  // sembrare fortuna.
  s5_passi: { passi: ["sociale_alunno", "segnala_ferme", "canale_mail"] },
};

// La regola generica per ogni passo strutturato non nominato sopra: prima
// opzione in ordine di comparsa, sempre. Se un giorno la missione guadagna uno
// step di un tipo che qui non c'è, questa funzione torna null e il robot SI
// FERMA dicendolo, invece di inventare una risposta plausibile.
function rispostaGenerica(step) {
  switch (step.tipo) {
    case "esplora_libero":
      return { letti: (step.materiali ?? []).map((m) => m.id) };
    case "scelta_singola":
      return { opzioneId: step.opzioni[0].id };
    case "ordina_priorita":
      return { ordine: step.elementi.map((e) => e.id) };
    case "seleziona_informazioni":
      return { selezionati: (step.dossier ?? []).slice(0, step.budget ?? 0).map((d) => d.id) };
    case "alloca_budget": {
      // Tutto sulla prima voce, arrotondato al passo: è arbitrario, ma è
      // deterministico e non finge di essere una scelta ragionata.
      const prima = step.voci[0];
      return { allocazioni: prima ? { [prima.id]: step.totale } : {} };
    }
    case "pianifica_lavori":
      return { selezionati: (step.lavori ?? []).slice(0, 1).map((l) => l.id) };
    case "scarta_opzione":
      return { scartati: step.opzioni.slice(0, step.daScartare).map((o) => o.id) };
    case "assegna_ruoli":
      return { assegnazioni: Object.fromEntries(step.ruoli.map((r) => [r.id, "io"])) };
    case "assegna_persone":
      return { assegnazioni: Object.fromEntries(step.compiti.map((c) => [c.id, "io"])) };
    case "previsione_poi_esito":
      return { fiducia: 70 };
    case "pianifica_passi":
      return { passi: step.passi.slice(0, step.quanti).map((p) => p.id) };
    default:
      return null; // decisione_scritta e riflessione: un testo non si inventa
  }
}

// La risposta per uno step della missione, o null se non si sa rispondere.
function rispostaPerStep(step) {
  const scritta = PARTITA[step.id];
  if (typeof scritta === "function") return scritta(step);
  if (scritta) return scritta;
  return rispostaGenerica(step);
}

module.exports = {
  T1_RISPOSTE,
  T2_RISPOSTE,
  PREFERENZA_AREE,
  PREFERENZA_ASSI,
  scegliT3,
  MISSIONE_FISSATA,
  GETTONI,
  GETTONI_DI_PERSONE,
  NOMINATI_COME_NON_LETTI,
  TESTI,
  PARTITA,
  rispostaGenerica,
  rispostaPerStep,
};
