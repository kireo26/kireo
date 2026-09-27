// Le risposte del robot ai tre test e alle missioni. Scritte, non casuali.
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
//   in ogni missione il robot spende TUTTI i gettoni che ha e ne lascia
//   chiusi degli altri, apposta — e i testi aperti PARLANO DI QUELLO CHE
//   NON HA GUARDATO.
//
// Non è pigrizia ed è la parte più importante della partita: un robot che
// compra tutto quello che conta non somiglia a nessuno studente e non lascia
// niente da ammettere. Se un domani qualcuno «migliora» il robot facendogli
// comprare tutto, i testi diventano FALSI — restano lì a dire «non ho letto il
// registro degli accessi» mentre il registro è stato letto, e nessuno se ne
// accorge leggendo il codice, perché le due cose stanno a cento righe di
// distanza.
//
// Per questo la dipendenza non è solo scritta: è CONTROLLATA. In ogni missione
// `nominatiComeNonLetti` accoppia i materiali lasciati chiusi alla frase con
// cui il testo li nomina, e `npm run test:percorso` pretende che le due liste
// dicano la stessa cosa. Comprarne uno in più fa diventare rosso il test con il
// nome del materiale e la frase che quel testo continua a dire.
//
// I DUE VERSI NON VALGONO SEMPRE ENTRAMBI, ed è una differenza di SCRITTURA e
// non di rigore. Il verso «nessuna frase nomina come non letto qualcosa che è
// stato comprato» vale sempre: è quello che tiene i testi dal diventare falsi.
// Il verso opposto — «ogni materiale non comprato è nominato» — vale solo dove
// il testo li ELENCA tutti (`chiusi: "enumerati"`). Dove il testo ne nomina uno
// di proposito (`chiusi: "unoSolo"`) pretenderlo spingerebbe verso un elenco,
// che è una scrittura peggiore; al suo posto si pretende che il NUMERO
// dichiarato nel testo («i cinque documenti») sia quello vero — un numero che
// chi legge può rifare, quindi che deve restare giusto.
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

// ══════════════════════════════════════════ La missione 05 «sportello-insieme»
//
// FISSATA QUI, e confrontata con quella che il prodotto suggerirebbe. Se il
// banco si limitasse a seguire il suggerimento, il giorno in cui il registro
// delle missioni cambia il robot giocherebbe un'altra missione e nessuno se ne
// accorgerebbe — e questi testi, che sono risposte a QUESTE domande,
// diventerebbero parole a caso. Se divergono, il banco lo dice e va avanti: è
// un'informazione sul prodotto, non un guasto del robot.
//
// QUESTA È LA MISSIONE *DERIVATA*: l'unica delle due che il percorso del robot
// produce da sé, e quindi l'unica su cui il confronto col suggerimento ha senso.
// La seconda (il cantiere, più sotto) il robot la gioca di proposito, perché
// copre un ramo di codice che il suggerimento non raggiungerebbe mai.
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
const MISSIONE_DERIVATA = "sportello-insieme";

// I cinque gettoni, nell'ordine in cui hanno senso. Ognuno ha una ragione che
// si può leggere; comprarne uno diverso è legittimo, ma allora vanno riscritti
// i testi (vedi `nominatiComeNonLetti`, e il test che lo pretende).
const GETTONI_SPORTELLO = [
  "M5", // protocollo minori — è il mandato scelto, e dice che il termine scade oggi
  "M4", // regolamento affitti — cambia la mossa su Kaur: basta protocollare entro le 12
  "M9", // cosa dice davvero la lettera Colella — un'ora di ascolto diventa tre minuti di informazione
  "M6", // riservatezza dei contatti anonimi — è quello che disinnesca la trappola dello scarto
  "M11", // disponibilità reali degli operatori — senza, l'assegnazione è alla cieca
];

// L'UNICO DEI CINQUE CHE RIGUARDA PERSONE E NON CARTE. Serve al testo della
// riflessione, che dice «quattro su carte e uno solo su persone»: è un conto
// che chi legge può rifare, quindi deve restare vero. Il test lo verifica.
const GETTONI_DI_PERSONE_SPORTELLO = ["M11"];

// I SETTE LASCIATI CHIUSI, ognuno con la frase che lo nomina nei testi. È la
// forma controllabile della dipendenza dichiarata in testa al file: la chiave
// dice COSA non è stato comprato, il valore dice DOVE il robot lo ammette.
//
// Nota per chi ci tornerà: le ultime due sono le consulenze del mandato, che
// stanno nello stesso dossier dei materiali e si comprano con gli stessi
// gettoni. La prima stesura della spec ne contava cinque e si leggeva come un
// elenco completo — il conto vero è sette.
const NOMINATI_SPORTELLO = {
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
const TESTI_SPORTELLO = {
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
const PARTITA_SPORTELLO = {
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

  s2_informazioni: { selezionati: GETTONI_SPORTELLO },
  s2_non_approfondire: { testo: TESTI_SPORTELLO.nonApprofondire },

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

  s4_proposta: { testo: TESTI_SPORTELLO.proposta },
  s5_riflessione: { testo: TESTI_SPORTELLO.riflessione },

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

// ══════════════════════════════════════════ La missione 04 «cantiere-scuola»
//
// PERCHÉ IL ROBOT LA GIOCA, dato che il prodotto non gliela suggerirebbe mai:
// è l'unica delle due con un `pianifica_lavori` — un tetto di SOLDI **e** uno
// di GIORNI, più le dipendenze fra i lavori — e quel ramo non era mai girato,
// né con l'AI né col database. Lo sportello ha un `alloca_budget`, che è una
// grandezza sola.
//
// E il suggerimento non ci arriverebbe: il cantiere è suggerito solo per
// `edilizia-architettura` [verificato eseguendo `missionePerArea` su tutte e sei
// le sue aree candidate], e l'area vincente del robot è la salute, che fra le
// candidate del cantiere non c'è. Quindi qui NON si confronta niente col
// suggerimento: è una scelta dichiarata, non una divergenza da segnalare.
//
// ─────────────────────────────────────────────────────────────────────────────
// I CONTI DI QUESTA MISSIONE TORNANO O LA PARTITA NON ENTRA, e sono stati
// eseguiti contro `valutaPiano`, non calcolati a mano. Quello che il motore dice
// del piano qui sotto (233.000 € / 74 giorni su 240.000 e 83):
//
//   soldi   233.000 = 34+62+71+21+27+18 mila                        ✓ entra
//   giorni  74 = (copertura 15 + elettrico 25 + controsoffitto 20) + 14
//
// I 74 giorni sono la parte che una lettura a mano sbaglia, e vale la pena
// sapere perché: nel motore **il PVC è `parallelizzabile` esattamente come
// l'accessibilità**, quindi con la seconda squadra i due contano per il MASSIMO
// dei due (14, l'accessibilità) e non «PVC in fila, accessibilità in parallelo».
// Il racconto del cronoprogramma distingue spogliatoi e palestra; `valutaPiano`
// non distingue: prende il massimo di tutti i parallelizzabili selezionati.
//
// DUE CONSEGUENZE, ed erano tutte e due il contrario di quello che si crederebbe:
//
//   · i 12 giorni del quadro difettoso (il vincolo del mandato `elettrico`) NON
//     entrano nel motore: `budgetGiorni` è la costante 83, e il vincolo vive
//     solo come testo nell'intro della Stanza 3. Quindi il piano entra anche
//     SENZA la seconda squadra (80 ≤ 83): comprarla è una scelta che paga 6
//     giorni di margine con 18.000 €, non la condizione per starci dentro;
//   · il parquet al posto del PVC non costa nemmeno un giorno (i giorni restano
//     74, perché l'accessibilità domina comunque): fa sforare sui SOLDI —
//     251.000 contro 240.000. È il motivo per cui il testo della proposta,
//     qui sotto, dice i soldi e non i giorni.
// ─────────────────────────────────────────────────────────────────────────────
const GETTONI_CANTIERE = [
  "M4", // relazione sull'impianto elettrico — è il mandato scelto, e apre la dipendenza controsoffitto ← elettrico
  "M13", // tempi di consegna dei pannelli — non leggerlo fa scattare la sorpresa dell'intro di Stanza 3
  "M5", // perizia sulla copertura — apre la dipendenza controsoffitto ← copertura, e l'avviso sullo scarto
  "M10", // cronoprogramma della ditta — è l'unico che APRE la voce «seconda squadra» (gate M10)
  "M9", // dossier accessibilità — trasforma la trappola dichiarata in una scelta consapevole
];

// LE SETTE COSE LASCIATE CHIUSE, con la frase che le nomina. Sono sette e non
// cinque perché il dossier della Stanza 2 ha DODICI voci: i dieci materiali a
// gettone più le due consulenze del mandato, che stanno nello stesso dossier e
// si comprano con gli stessi gettoni [verificato: `dossier.length === 12`].
//
// Il testo ne nomina UNA di proposito — lo storico delle manutenzioni, l'unico
// che dice *perché* la palestra è chiusa — quindi `chiusi: "unoSolo"`: si
// pretende il verso che tiene il testo dal diventare falso, e al suo posto il
// numero dichiarato («i cinque documenti»). Vedi il blocco in testa al file.
const NOMINATI_CANTIERE = {
  M12: "lo storico delle manutenzioni",
};

const TESTI_CANTIERE = {
  // s2_non_approfondire — facoltativo, nessun minimo.
  nonApprofondire: [
    "Non ho chiesto lo storico delle manutenzioni. Ho pensato: è passato, e io ho ottantatré giorni davanti.",
    "Scrivendolo mi accorgo che non è vero. Il verbale dice che il controsoffitto è caduto di notte, e in assemblea il custode dice di aver segnalato l'acqua tre volte. Tre volte vuol dire che da qualche parte quelle segnalazioni sono scritte, e vuol dire anche che qualcuno le ha lette. Sapere com'è andata l'ultima volta non mi serviva per scegliere i lavori — mi serviva per capire perché siamo qui.",
    "Ho comprato i cinque documenti che mi dicevano cosa fare, e ho lasciato l'unico che mi diceva perché.",
  ].join("\n\n"),

  // s4_proposta — il resoconto al dirigente e al Comune. Minimo 250 caratteri.
  //
  // DUE CLAUSOLE SONO STATE RISCRITTE DA MARIO dopo che i conti sono stati
  // eseguiti, e la proprietà da tenere non è che i numeri siano giusti: è che il
  // testo **ritratta la propria giustificazione**. La prima stesura diceva «e
  // quei sei giorni servivano» (falso: `valutaPiano` dà 74 giorni col parquet e
  // col PVC, perché sono entrambi parallelizzabili e l'accessibilità domina
  // comunque — il parquet sfora sui SOLDI, 251.000 su 240.000); la seconda
  // spiegava la seconda squadra come una scelta fra due opzioni, e non era una
  // scelta, perché col fondo imprevisti il piano arrivava comunque a 248.000.
  // Ora il testo lo dice, e dichiara che i nove giorni di margine NON coprivano
  // i dodici del quadro difettoso: un piano che ammette di essere stato
  // fortunato vale più di uno che spiega perché era giusto.
  //
  // Ogni cifra qui dentro è rifacibile da chi legge, quindi è sorvegliata:
  // `npm run test:percorso` le confronta con `valutaPiano` invece di fidarsi
  // della prosa (vedi CIFRE_PROPOSTA_CANTIERE in fondo al blocco).
  proposta: [
    "Al 20 agosto sono fatti l'impianto elettrico, la copertura dell'angolo nord, il controsoffitto nuovo e l'adeguamento degli spogliatoi. Il pavimento in PVC si posa in questi giorni: è l'ultimo, perché fino a ieri passavano ancora i ponteggi.",
    "Cosa non abbiamo fatto, e chi ci rimette. Niente parquet omologato: 39.000 € contro i 21.000 del PVC. E non è una questione di giorni — il parquet ne prende dodici e il PVC sei, ma tutti e due corrono in parallelo con gli spogliatoi, che ne prendono quattordici: sul calendario non cambiava niente. È che con il parquet il piano arrivava a 251.000 € su 240.000. Non ci stava, e basta. Il PVC dura meno: fra qualche anno qualcuno rifarà questo pavimento. È un costo spostato in avanti, non risparmiato, e lo paga la scuola fra sei o otto anni, cioè non noi.",
    "Niente caldaia nuova. È del 2003 e il verbale dice che è fuori norma sulle emissioni: funziona, ma è l'unico dei sei problemi che a settembre sarà esattamente com'era a marzo. Ci rimette chi paga il riscaldamento, tutti gli anni.",
    "Una scelta che sembra sbagliata, e la spiegazione che mi ero dato non regge. Abbiamo pagato 18.000 € per la seconda squadra e rinunciato al fondo imprevisti da 15.000. Mentre lo facevo me lo sono raccontato come una scelta fra le due: giorni certi invece di margine ipotetico. Rifacendo i conti non era una scelta — con il fondo il piano arrivava a 248.000 su 240.000 disponibili, e non ci stava comunque.",
    "E i sei giorni che la seconda squadra ci ha fatto guadagnare non bastano. Siamo passati da ottanta giorni a settantaquattro sugli ottantatré che avevamo: nove di margine. Il quadro elettrico è arrivato difettoso e ne è costati dodici. Se fosse arrivato a lavori avanzati saremmo fuori dal 5 settembre. È andata perché il ritardo è caduto su lavori non ancora partiti, non perché avessimo un piano che lo reggeva.",
    "Gli spogliatoi li abbiamo fatti, 27.000 € e quattordici giorni. Erano la voce più facile da togliere: quattro studenti su milleduecento, e nessuna norma che ce lo gridasse addosso. Li abbiamo tenuti perché una palestra da cui quattro persone restano fuori riapre per tutti tranne che per loro.",
    "Restano 7.000 € non spesi. Il quadro economico dice che le economie non tornano alla scuola: quei soldi li abbiamo persi, e sarebbero bastati per una parte di pavimento migliore. Non abbiamo trovato un modo di usarli che stesse dentro i giorni.",
    "Quello che non sappiamo. Nessuno di noi ha mai visto un collaudo. Abbiamo dato per buono che i lavori fatti nell'ordine giusto bastino a passarlo. Se il collaudatore chiede un documento che non abbiamo — e l'impianto elettrico ne produce parecchi — sedici giorni non bastano a procurarlo.",
  ].join("\n\n"),

  // s5_riflessione — minimo 120 caratteri. Risponde a tutte e due le domande.
  riflessione: [
    "La cosa che mi è rimasta addosso è la caldaia, e non me l'aspettavo. L'ho messa ultima in classifica il primo giorno, in dieci secondi, perché era l'unica voce che non riguardava né la sicurezza né il poterci giocare. Poi per ottantatré giorni non l'ho più guardata. È l'unico dei sei problemi che il 12 settembre sarà identico a com'era a marzo, e l'ho deciso prima di sapere quasi niente.",
    "Il momento in cui ho visto qualcosa che gli altri non vedevano è stato il quinto gettone. I primi quattro li ho spesi su lavori. Il quinto sugli spogliatoi, e non perché mi aspettassi di trovarci qualcosa: ci ho trovato un gradino di diciotto centimetri e quattro studenti che oggi non entrano. Prima di leggerlo, per me erano «gli spogliatoi» — una voce in fondo a una lista che avevo ordinato in dieci secondi.",
  ].join("\n\n"),
};

const PARTITA_CANTIERE = {
  s1_materiali: (step) => ({ letti: step.materiali.map((m) => m.id) }),

  // I primi tre sono ciò che impedisce di riaprire. `spogliatoi` prima di
  // `pavimento` perché quattro studenti non entrano affatto, mentre gli altri
  // giocherebbero su un pavimento consumato. `caldaia` ultima: è l'unica che non
  // impedisce niente — ed è la scelta che il robot rimpiange nella riflessione.
  s1_priorita: { ordine: ["elettrico", "controsoffitto", "tetto", "spogliatoi", "pavimento", "caldaia"] },

  // IL MANDATO SI SCEGLIE PRIMA DEI GETTONI, quindi M4 non è ancora stato letto:
  // la scelta si regge su M1, che è gratuito e dice «impianto elettrico del
  // 1988, non a norma». Non a norma su una scuola è la cosa che blocca un
  // collaudo, e il robot lo sceglie da lì — non dalla relazione, che arriverà
  // dopo a confermarlo.
  s1_mandato: { opzioneId: "elettrico" },

  s2_informazioni: { selezionati: GETTONI_CANTIERE },
  s2_non_approfondire: { testo: TESTI_CANTIERE.nonApprofondire },

  // IL PIANO. `seconda_squadra` esiste solo perché M10 è stato comprato (gate):
  // se un domani M10 uscisse dai gettoni, questa voce non comparirebbe e il
  // piano verrebbe rifiutato — è la dipendenza più dura di tutta la partita.
  // Il fondo imprevisti NON si prende: con lui il totale sarebbe 248.000 e
  // sforerebbe [verificato]. Nota: non prenderlo non costa niente nemmeno nella
  // rubrica, perché quel criterio entra solo se è stato letto M11 — e M11 è fra
  // i sette lasciati chiusi.
  s3_budget: { selezionati: ["copertura", "elettrico", "controsoffitto", "pvc", "accessibilita", "seconda_squadra"] },

  // Coerente col piano: nessuno dei due è dentro. L'ACCESSIBILITÀ NON SI SCARTA
  // — è la trappola dichiarata (`trappola: true, trappolaSeScartata: true`, cioè
  // qui scatta a scartarla e non a tenerla) e il robot ha comprato M9 apposta
  // per saperlo.
  s3_scarto: { scartati: ["pompa_calore", "parquet"] },

  // CINQUE COMPITI, NON TRE — e sono cinque persone nel gruppo: uno a testa.
  // Il robot si prende `materiali` perché i 35 giorni di consegna dei pannelli
  // li ha letti lui (M13) e nessun altro li sa. E lascia `conti` proprio perché
  // il regolamento del finanziamento (M11), che dice quanto costa una variante,
  // è fra quelli che NON ha comprato: tenere i conti senza sapere cosa costa
  // cambiare idea sarebbe prendersi un compito alla cieca.
  s3_ruoli: {
    assegnazioni: {
      ditta: "altri",
      conti: "altri",
      sicurezza: "altri",
      materiali: "io",
      famiglie: "altri",
    },
  },

  // La palestra riapre ma non è finita: 70 è «Abbastanza solida». Mai agli
  // estremi, per la stessa ragione delle Likert di T2.
  s4_previsione: { fiducia: 70 },

  s4_proposta: { testo: TESTI_CANTIERE.proposta },
  s5_riflessione: { testo: TESTI_CANTIERE.riflessione },

  // Il registro per primo perché in assemblea il custode dice «l'ho detto tre
  // volte» — e tre volte vuol dire che il problema non era sapere. La caldaia
  // seconda perché è l'unica cosa che il 12 settembre sarà identica a com'era a
  // marzo. I sensori terzi: l'acqua entra sempre dallo stesso angolo.
  //
  // ONESTÀ SU COME SONO STATI SCELTI, come per lo sportello: derivati dalla
  // partita, poi confrontati con gli ideali della rubrica — e qui ne coincide
  // UNO su tre (`registro`; gli ideali sono registro/controlli/accessibilita).
  // Non si cambiano per farli coincidere: seguono dalla mattina che il robot ha
  // giocato, e l'accessibilità l'ha già fatta.
  s5_passi: { passi: ["registro", "caldaia", "sensori"] },
};

// ══════════════════════════════════════════════ Le missioni che il robot gioca
//
// IN ORDINE, e l'ordine conta: la prima è quella DERIVATA — la sola che il
// percorso produce da sé, e quindi la sola su cui il confronto col suggerimento
// del prodotto dice qualcosa. Le altre il robot le gioca di proposito, e ognuna
// porta scritto il ramo di codice per cui esiste.
const MISSIONI_GIOCATE = [
  {
    slug: MISSIONE_DERIVATA,
    derivata: true,
    perche: "è la missione che il percorso del robot produce: quella che T3 suggerisce.",
    ramo: "alloca_budget (una grandezza sola) + assegna_ruoli",
    gettoni: GETTONI_SPORTELLO,
    gettoniDiPersone: GETTONI_DI_PERSONE_SPORTELLO,
    nominatiComeNonLetti: NOMINATI_SPORTELLO,
    chiusi: "enumerati",
    testi: TESTI_SPORTELLO,
    partita: PARTITA_SPORTELLO,
  },
  {
    slug: "cantiere-scuola",
    derivata: false,
    // Una riga: è quello che il comando stampa. Il ragionamento per esteso sta
    // nel blocco di commento sopra la partita del cantiere.
    perche: "copre un ramo che il suggerimento non raggiungerebbe mai (il cantiere si propone solo per l'edilizia, e il robot vince sulla salute).",
    ramo: "pianifica_lavori (due grandezze + dipendenze)",
    gettoni: GETTONI_CANTIERE,
    // Nessun conto «su carte e su persone» nei suoi testi: il conto che quei
    // testi fanno ad alta voce è un altro (i cinque documenti), e sta in
    // `chiusi: "unoSolo"`.
    gettoniDiPersone: null,
    nominatiComeNonLetti: NOMINATI_CANTIERE,
    chiusi: "unoSolo",
    // Il numero che il testo dichiara: deve restare uguale a `gettoni.length`,
    // perché chi legge può ricontarlo.
    numeroDichiarato: "cinque",
    testi: TESTI_CANTIERE,
    partita: PARTITA_CANTIERE,
  },
];

function missioneGiocata(slug) {
  return MISSIONI_GIOCATE.find((m) => m.slug === slug) ?? null;
}

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

// La risposta per uno step di UNA missione, o null se non si sa rispondere.
//
// IL SLUG È IL PRIMO PARAMETRO E NON HA UN DEFAULT, apposta: gli id degli step
// sono canonici e COLLIDONO fra missioni — `s3_budget` esiste in tutte e due, e
// nelle due vuole un payload di forma diversa (`allocazioni` contro
// `selezionati`). Un default qui sarebbe il posto in cui un collegamento
// mancante si nasconde: il robot risponderebbe alla missione sbagliata senza
// che niente si rompesse, e la risposta sarebbe perfino plausibile.
function rispostaPerStep(slug, step) {
  const missione = missioneGiocata(slug);
  if (!missione) return null;
  const scritta = missione.partita[step.id];
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
  MISSIONE_DERIVATA,
  MISSIONI_GIOCATE,
  missioneGiocata,
  rispostaGenerica,
  rispostaPerStep,
};
