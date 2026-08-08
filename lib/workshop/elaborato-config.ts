// Workshop 2.0 v2 — schema dei contenuti del percorso a tappe gated, per
// workshop e per ruolo. Come per WORKSHOP_KIT in config.ts, lo schema vive
// qui in config TypeScript (si edita e si deploya senza migration): in DB
// (workshop_elaborati/workshop_fasi_stato) vivono solo i dati e lo stato
// di avanzamento dello studente.
//
// Fetta verticale: SOLO 'palestra-popolare' > 'salute' è implementato.
// Gli altri 4 workshop e gli altri 4 ruoli della palestra restano sul
// motore v1 (kit PDF + consegna file, vedi WORKSHOP_KIT/ConsegnaUpload) —
// non toccati in questo giro.
//
// Evoluzione rispetto alla prima versione dell'elaborato online (form a
// sezioni tutte aperte, "Consegna il progetto" manuale in fondo): ogni
// tappa ora è gated (bloccata finché la precedente non è stata
// revisionata), richiede una chat minima col cliente prima di poter
// essere consegnata, e alla revisione si accompagna una reazione in
// carattere del cliente + un punteggio di fiducia. Il campo `consegna`
// (v1) è stato rinominato `obiettivo` (più coerente col nuovo modello a
// tappe, dove "consegnare" è ora un'azione esplicita — il pulsante
// "Consegna la tappa" — non solo una descrizione).

export type TipoSezione = "testo" | "testo_lungo" | "tabella" | "checklist" | "scelta" | "immagine";

export type SezioneElaborato = {
  id: string;
  titolo: string;
  tipo: TipoSezione;
  prompt: string;
  hint?: string;
  // Se true, la sezione non entra mai nel calcolo "sezioni incomplete" (né
  // client né server) — usata per la sola sezione facoltativa esistente
  // oggi (spazio > la_pianta > pianta_schizzo, tipo 'immagine').
  opzionale?: boolean;
  // tipo 'testo' / 'testo_lungo'
  minCaratteri?: number;
  // tipo 'tabella': righe ripetibili, salvate come array di oggetti.
  // righeIniziali (facoltativo): righe pre-compilate all'apertura della
  // sezione (es. voci di costo già elencate, valore lasciato vuoto) — un
  // array di tuple posizionali, una per colonna in `colonne`, solo per
  // dare un punto di partenza allo studente: restano righe normali,
  // modificabili/rimuovibili come le altre.
  colonne?: string[];
  righeIniziali?: string[][];
  minRighe?: number;
  // tipo 'checklist': voci spuntabili, salvate come booleani + nota libera
  voci?: string[];
  // tipo 'scelta': opzioni + motivazione libera
  opzioni?: string[];
  // tipo 'immagine': percorso Storage (bucket workshop-consegne) di
  // un'immagine caricata dallo studente, o "" se non ancora caricata.
};

export type FaseElaborato = {
  id: string;
  titolo: string;
  obiettivo: string;
  // Scadenza morbida informativa, relativa all'apertura della tappa (mai
  // un blocco — a gatare è lo stato in workshop_fasi_stato, non l'orologio).
  giorniConsigliati: number;
  // Giorni di attesa dopo la consegna di QUESTA tappa prima che il cron
  // generi revisione+reazione e apra la tappa successiva.
  cooldownGiorni: number;
  // Messaggi minimi dello studente in chat col cliente (dall'apertura
  // della tappa) richiesti per poter consegnare.
  chatMinima: number;
  // Punti fiducia massimi assegnabili dalla revisione di questa tappa.
  fiduciaMax: number;
  // Guida per l'AI su come il cliente reagisce alla consegna di questa
  // tappa e aggancia (in carattere) la tappa successiva.
  reazioneCliente: string;
  // Rubrica su cui il tutor revisiona (3-4 punti concreti).
  revisioneFocus: string[];
  // Marca l'ultima tappa: alla sua revisione il cron chiude l'intero
  // progetto (workshop_elaborati.stato -> 'consegnato' + activity_log).
  ultima?: boolean;
  sezioni: SezioneElaborato[];
};

export type Elaborato = {
  fasi: FaseElaborato[];
};

export const WORKSHOP_ELABORATO: Record<string, Record<string, Elaborato>> = {
  "palestra-popolare": {
    salute: {
      fasi: [
        {
          id: "quartiere_programma",
          titolo: "Tappa 1 — Il quartiere e il programma",
          obiettivo: "Capisci chi nel quartiere non si muove, e disegna il programma settimanale che lo porta dentro.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "ricognizione",
              titolo: "Chi oggi non si muove (e perché)",
              tipo: "testo_lungo",
              prompt:
                "Nel tuo quartiere, chi non fa sport e perché? Usa i dati del brief (in Italia il 35% è sedentario, al Sud pratica sport solo il 21%). Chi vuoi far entrare per primo?",
              hint: "Pensa ai ragazzi che stanno in strada, alle donne che non entrerebbero in una sala mista, agli anziani soli.",
              minCaratteri: 400,
            },
            {
              id: "programma_settimanale",
              titolo: "Il programma settimanale",
              tipo: "tabella",
              prompt: "Una riga per attività: quando, per chi, chi la conduce. Copri tutte le fasce.",
              hint: "Pomeriggio per bambini e ragazzi, sera per adulti e donne, mattina per gli anziani.",
              colonne: ["Giorno", "Orario", "Attività", "Fascia", "Chi conduce"],
              minRighe: 6,
            },
            {
              id: "priorita",
              titolo: "Da dove parti",
              tipo: "testo",
              prompt: "Con quali 2 attività parti subito, e perché proprio quelle?",
              hint: "Meglio poche cose fatte bene che tutto insieme e poi non reggere.",
              minCaratteri: 250,
            },
          ],
          reazioneCliente:
            "Tonino ha letto il programma. Gli sembra tanta roba: lui sa fare solo la boxe e si preoccupa di CHI tiene le altre attività e di CHI le paga. Reagisce in carattere (diretto, parole semplici) e apre di fatto la tappa sulle persone.",
          revisioneFocus: [
            "C'è un'attività per ogni fascia (bambini, ragazzi, adulti, donne, anziani)?",
            "Le fasce orarie sono realistiche per un quartiere periferico?",
            "L'inclusione di chi oggi non si muove è concreta, non generica?",
            "Le 2 priorità sono motivate con un perché?",
          ],
        },
        {
          id: "persone_qualifiche",
          titolo: "Tappa 2 — Le persone e le qualifiche",
          obiettivo: "Chi conduce le attività, con quali qualifiche, quanto costa e dove lo trovi.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "figure",
              titolo: "Le figure e i costi",
              tipo: "tabella",
              prompt: "Per ogni figura: cosa deve avere in regola, quante ore, quanto costa all'anno.",
              hint: "Tecnici FPI o EPS, laureati in Scienze motorie. Non dimenticare l'operatore BLSD.",
              colonne: ["Figura", "Qualifica richiesta", "Ore/sett.", "Costo annuo"],
              minRighe: 4,
            },
            {
              id: "reclutamento",
              titolo: "Dove le trovi",
              tipo: "testo_lungo",
              prompt: "Dove trovi queste persone nel quartiere? Chi può essere volontario e chi va pagato?",
              hint: "Centro sociale, laureati in cerca di esperienza, ex atleti, associazioni del territorio.",
              minCaratteri: 350,
            },
            {
              id: "tonino_tecnico",
              titolo: "Tonino in regola",
              tipo: "testo",
              prompt: "Tonino sa insegnare boxe: come lo metti in regola come tecnico?",
              hint: "Tesserino tecnico FPI o di un Ente di Promozione Sportiva.",
              minCaratteri: 150,
            },
          ],
          reazioneCliente:
            "Tonino si preoccupa dei costi degli istruttori («e 'sti soldi chi li mette?») e vuole capire chi è retribuito e chi no. Reagisce in carattere e apre di fatto la tappa sulla sicurezza.",
          revisioneFocus: [
            "Le qualifiche sono reali (FPI/EPS, laurea in Scienze motorie)?",
            "I costi sono plausibili e sostenibili con un budget da palestra popolare?",
            "C'è sempre un operatore BLSD presente?",
            "È chiaro chi è volontario e chi è retribuito?",
          ],
        },
        {
          id: "sicurezza",
          titolo: "Tappa 3 — La sicurezza, sul serio",
          obiettivo: "Rendi la palestra sicura e a norma dal lato salute: certificati, defibrillatore, protocollo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "certificati",
              titolo: "I certificati medici",
              tipo: "testo",
              prompt: "Chi deve avere quale certificato? (non agonistico / agonistico)",
              hint: "Non agonistico dal medico di base o pediatra; agonistico con visita specialistica ed ECG per chi gareggia.",
              minCaratteri: 200,
            },
            {
              id: "checklist_sicurezza",
              titolo: "La sicurezza — spunta ciò che prevedi",
              tipo: "checklist",
              prompt: "Cosa metti in piedi per essere in regola e sicuro?",
              voci: [
                "Certificato medico per tutti i tesserati",
                "Defibrillatore (DAE) in sala, segnalato",
                "Almeno un operatore BLSD a ogni turno",
                "Cassetta di primo soccorso e numeri di emergenza",
                "Registro infortuni",
              ],
            },
            {
              id: "protocollo_infortuni",
              titolo: "Un caso vero",
              tipo: "testo_lungo",
              prompt: "Durante l'allenamento un ragazzo sviene. Cosa succede, passo per passo, nella tua palestra?",
              hint: "Chi interviene, con cosa, chi chiama, cosa si annota. Il defibrillatore dov'è e chi lo sa usare.",
              minCaratteri: 350,
            },
          ],
          reazioneCliente:
            "Tonino è scettico sul defibrillatore («non l'ho mai avuto in vita mia, serve davvero? quanto costa?») e vuole essere rassicurato con parole semplici. Reagisce in carattere e apre di fatto la tappa finale del pitch.",
          revisioneFocus: [
            "Il protocollo infortuni è concreto e nell'ordine giusto?",
            "Ci sono defibrillatore e personale formato BLSD?",
            "È chiaro chi è responsabile della sicurezza?",
            "I certificati sono quelli giusti per non agonistico e agonistico?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Tonino",
          obiettivo: "Metti tutto insieme e convincilo. È l'ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "Il progetto, in parole semplici",
              tipo: "testo_lungo",
              prompt:
                "Metti insieme programma, persone e sicurezza. Coi numeri chiave e senza paroloni: perché questa palestra tiene i ragazzi dentro e sta in piedi?",
              hint: "Tonino ha la terza media. Parti dai ragazzi e dai minori gratis, poi i numeri.",
              minCaratteri: 500,
            },
            {
              id: "una_cosa",
              titolo: "La cosa di cui vai più fiero",
              tipo: "testo",
              prompt: "Qual è la cosa del tuo progetto di cui vai più fiero, e perché?",
              hint: "Quella che, se togli tutto il resto, resta il cuore del progetto.",
              minCaratteri: 150,
            },
          ],
          reazioneCliente:
            "Tonino tira le somme in base alla fiducia accumulata nel percorso: se è convinto, ci sta e ringrazia; se ha ancora dubbi, dice con franchezza cosa lo frena. È la chiusura dello stage.",
          revisioneFocus: [
            "La sintesi è chiara e semplice (Tonino ha la terza media)?",
            "Ci sono i numeri chiave (costi, soci per il pareggio, sicurezza)?",
            "Il progetto è coerente in tutte le sue parti (programma, persone, sicurezza)?",
            "Convincerebbe davvero un cliente diffidente?",
          ],
        },
      ],
    },

    // Ricevuti da Mario in elaborato-palestra-v2-ruoli.ts (ELABORATO_PALESTRA_ALTRI),
    // stesso schema di salute: 4 tappe profonde ciascuno, fiducia 25×4=100.
    economia: {
      fasi: [
        {
          id: "i_conti",
          titolo: "Tappa 1 — I conti veri",
          obiettivo: "Metti in fila i costi annuali della palestra: anche coi minori gratis, questi soldi servono.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "costi_annuali",
              titolo: "I costi annuali",
              tipo: "tabella",
              prompt: "Stima ogni voce di costo in un anno. Parti da queste e adatta i numeri.",
              hint: "La voce che decide tutto sono i compensi degli istruttori.",
              colonne: ["Voce", "Importo annuo (€)"],
              righeIniziali: [
                ["Concessione / affitto impianto", ""],
                ["Utenze (luce, acqua, riscaldamento)", ""],
                ["Pulizie", ""],
                ["Assicurazione RC e infortuni", ""],
                ["Compensi istruttori", ""],
                ["Manutenzione attrezzature", ""],
                ["Commercialista e adempimenti", ""],
                ["Totale", ""],
              ],
            },
            {
              id: "voce_pesante",
              titolo: "La voce che pesa di più",
              tipo: "testo",
              prompt: "Qual è il costo più grande e come pensi di tenerlo sotto controllo?",
              hint: "Volontariato, poche ore retribuite, convenzioni: cosa è comprimibile e cosa no.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Tonino guarda i numeri e si spaventa un po': «Tutti 'sti soldi ogni anno? E io c'ho trentamila euro in croce». Reagisce in carattere e apre di fatto la tappa sul pareggio.",
          revisioneFocus: [
            "I costi sono realistici per una piccola palestra di quartiere?",
            "Il totale è coerente con le singole voci?",
            "Ha individuato la voce che pesa di più e come gestirla?",
            "Ha tenuto conto che i minori non pagano?",
          ],
        },
        {
          id: "il_pareggio",
          titolo: "Tappa 2 — Il pareggio",
          obiettivo: "Calcola quante quote adulti servono per coprire i costi, coi minori gratis.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "calcolo",
              titolo: "Il calcolo",
              tipo: "testo_lungo",
              prompt:
                "Quante quote adulti servono per andare a pari? Scrivi il calcolo (costi ÷ quota annua) e di' se è realistico per il quartiere.",
              hint: "Se servono 110 paganti a 20€, in periferia è dura. Fai vedere i numeri.",
              minCaratteri: 300,
            },
            {
              id: "quote",
              titolo: "Le quote",
              tipo: "tabella",
              prompt: "Prova due o tre livelli di quota mensile e quanti soci servono per ognuno.",
              hint: "Più alzi la quota, meno soci servono ma più perdi la vocazione popolare.",
              colonne: ["Quota mensile", "Soci necessari", "È realistico?"],
              minRighe: 2,
            },
          ],
          reazioneCliente:
            "Tonino torna sul suo chiodo fisso: «Venti euro al mese sono già tanti per la gente di qui. Come li trovi tutti 'sti paganti?». Apre di fatto la tappa sulle altre entrate.",
          revisioneFocus: [
            "Il calcolo del pareggio è corretto e mostrato con i numeri?",
            "Il numero di soci necessari è realistico per un quartiere periferico?",
            "Ha capito che le sole quote difficilmente bastano?",
            "Ha rispettato quote basse e minori gratis?",
          ],
        },
        {
          id: "le_entrate",
          titolo: "Tappa 3 — Le altre entrate",
          obiettivo: "Costruisci il mix di entrate che regge il progetto oltre le quote, e il piano dei 30.000€.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "entrate_alternative",
              titolo: "Le entrate, quelle vere",
              tipo: "tabella",
              prompt: "Le fonti oltre le quote: quanto puoi puntare a ottenere da ognuna e cosa richiede.",
              hint: "Bandi periferie, 5x1000, convenzioni col Comune, fondazioni, sponsor locali, corsi a pagamento pieno.",
              colonne: ["Fonte", "Quanto punti (€)", "Cosa richiede"],
              minRighe: 3,
            },
            {
              id: "investimento",
              titolo: "I 30.000€ di partenza",
              tipo: "testo",
              prompt: "Come spendi l'investimento iniziale, senza sforare i 30.000€?",
              hint: "Priorità: ciò che ti fa aprire. Il resto per fasi.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Tonino è diffidente sui bandi: «E se 'sti bandi non li vinciamo, chiudiamo dopo un anno?». Vuole essere rassicurato. Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Il mix di entrate è credibile e non punta solo sulle quote?",
            "Ogni fonte dice da dove viene e a che condizioni?",
            "Il piano dei 30.000€ sta nel budget e dà priorità all'apertura?",
            "Il modello regge anche se un bando salta?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Tonino",
          obiettivo: "Metti insieme i conti e convincilo che il progetto sta in piedi. È l'ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "I conti, in parole semplici",
              tipo: "testo_lungo",
              prompt: "Costi, numero di soci per il pareggio e mix di entrate: spiegalo a Tonino con parole semplici e i numeri chiave.",
              hint: "Tonino ha la terza media: niente paroloni, solo numeri veri e chiari.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Tonino tira le somme in base alla fiducia accumulata: se i conti lo hanno convinto, ci sta; se no, dice cosa ancora non gli torna. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi è chiara e semplice (terza media)?",
            "Ci sono i numeri chiave: costi, soci per il pareggio, mix di entrate?",
            "I conti sono coerenti con le tappe precedenti?",
            "Convincerebbe un cliente diffidente e attento ai soldi?",
          ],
        },
      ],
    },

    educazione: {
      fasi: [
        {
          id: "a_chi_perche",
          titolo: "Tappa 1 — A chi e perché",
          obiettivo: "Descrivi a chi si rivolge il progetto e quale bisogno educativo copre, con i dati.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "destinatari_bisogno",
              titolo: "A chi ti rivolgi e il bisogno",
              tipo: "testo_lungo",
              prompt: "Chi sono i ragazzi e qual è il bisogno? Usa i dati (dispersione 9,8%, 12,4% al Sud; povertà educativa).",
              hint: "Non «aiutare i ragazzi»: sii preciso. Es. medie del quartiere, a rischio, senza un posto dove stare il pomeriggio.",
              minCaratteri: 350,
            },
          ],
          reazioneCliente:
            "Tonino si schermisce: «Io mica sono un professore. Come faccio a fare educazione? Io so tirare di boxe». Apre di fatto la tappa sulle attività.",
          revisioneFocus: [
            "Il bisogno è descritto con precisione, non genericamente?",
            "Ha usato i dati su dispersione e povertà educativa?",
            "È chiaro a quali ragazzi si rivolge?",
            "Si capisce perché proprio la palestra può rispondere a quel bisogno?",
          ],
        },
        {
          id: "attivita",
          titolo: "Tappa 2 — Le attività educative",
          obiettivo: "Le attività oltre all'allenamento, che rendono il progetto educativo e non solo sportivo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "attivita",
              titolo: "Le attività",
              tipo: "tabella",
              prompt: "Cosa fai oltre ad allenare, cosa aggiunge e con chi.",
              hint: "Regola del pagellino, doposcuola, educazione al rispetto, sportello d'ascolto.",
              colonne: ["Attività", "Cosa aggiunge", "Con chi"],
              minRighe: 3,
            },
            {
              id: "regola",
              titolo: "Sport e scuola insieme",
              tipo: "testo",
              prompt: "Come leghi l'allenamento all'andare a scuola (es. la «regola del pagellino»)?",
              hint: "Per allenarti devi andare a scuola: come lo gestisci senza cacciare chi è già in difficoltà?",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Tonino è scettico sugli alleati: «Le scuole perché dovrebbero darmi retta? Io sono uno con la palestra». Apre di fatto la tappa su alleati e misura.",
          revisioneFocus: [
            "Le attività sono concrete e vanno oltre il solo allenamento?",
            "Ogni attività ha un alleato che la rende possibile?",
            "Il legame sport-scuola è pensato senza escludere chi è in difficoltà?",
            "È qualcosa che una scuola o una fondazione capirebbe?",
          ],
        },
        {
          id: "alleati_misura",
          titolo: "Tappa 3 — Alleati e risultati",
          obiettivo: "Chi mettere attorno al tavolo e come dimostrare che il progetto funziona.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "alleati",
              titolo: "Gli alleati",
              tipo: "testo_lungo",
              prompt: "Scuole, servizi sociali, ETS, famiglie: chi coinvolgi e cosa porta ognuno?",
              hint: "Nessun bando finanzia una palestra da sola: finanzia una rete.",
              minCaratteri: 300,
            },
            {
              id: "indicatori",
              titolo: "Come lo misuri",
              tipo: "tabella",
              prompt: "Cosa guardi per dire che sta funzionando?",
              hint: "Presenze, voti e assenze dei seguiti, ragazzi agganciati dalle scuole.",
              colonne: ["Indicatore", "Come lo misuro"],
              minRighe: 2,
            },
          ],
          reazioneCliente:
            "Tonino teme la burocrazia: «Tutta 'sta roba da misurare e compilare… chi la fa? Io non ho un ufficio». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Gli alleati sono reali e con un ruolo chiaro?",
            "Gli indicatori sono davvero misurabili?",
            "La rete rende il progetto finanziabile?",
            "È sostenibile da gestire per una piccola realtà?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Tonino",
          obiettivo: "Trasforma «toglierli dalla strada» in un progetto che convince. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "Il progetto educativo, in breve",
              tipo: "testo_lungo",
              prompt: "A chi, con quali attività, con quali alleati e con quali risultati attesi: spiega tutto a Tonino in modo semplice.",
              hint: "Mostragli che non deve diventare una scuola: resta la sua palestra, ma con un senso in più.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Tonino valuta se il progetto lo ha convinto: se sì, ci crede e ringrazia; se no, dice cosa ancora lo lascia perplesso. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi è chiara e semplice (terza media)?",
            "Tiene insieme bisogno, attività, alleati e risultati?",
            "È coerente con le tappe precedenti?",
            "Convince che «toglierli dalla strada» è diventato un progetto vero?",
          ],
        },
      ],
    },

    spazio: {
      fasi: [
        {
          id: "la_pianta",
          titolo: "Tappa 1 — La pianta",
          obiettivo: "Dividi lo spazio a blocchi: cosa va dove, e cosa serve fin da subito.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "pianta_descrizione",
              titolo: "La divisione dello spazio",
              tipo: "testo_lungo",
              prompt: "Come dividi lo spazio? Elenca le aree e i metri quadri indicativi.",
              hint: "Ring/sacchi, area functional, spogliatoi, ingresso, servizi. Almeno un bagno accessibile.",
              minCaratteri: 300,
            },
            {
              id: "pianta_schizzo",
              titolo: "Uno schizzo (facoltativo)",
              tipo: "immagine",
              opzionale: true,
              prompt: "Se vuoi, allega la foto di uno schizzo della pianta fatto a mano.",
            },
          ],
          reazioneCliente:
            "Tonino è pratico: «Bello, ma con trentamila euro ci sistemo davvero tutto 'sto spazio, o mi fermo a metà?». Apre di fatto la tappa sul preventivo.",
          revisioneFocus: [
            "C'è uno spazio per ogni uso (allenamento, spogliatoi, ingresso, servizi)?",
            "È previsto un bagno accessibile?",
            "Le dimensioni sono plausibili per le attività?",
            "La divisione è realistica per un locale recuperato?",
          ],
        },
        {
          id: "preventivo",
          titolo: "Tappa 2 — Il preventivo per fasi",
          obiettivo: "Fai i conti della ristrutturazione, mettendo prima ciò che ti fa aprire a norma.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "preventivo",
              titolo: "Il preventivo per fasi",
              tipo: "tabella",
              prompt: "Cosa fai e quanto costa, diviso per fasi. Prima la sicurezza, poi ciò che si vede.",
              hint: "Pavimentazione (gomma 20–45 €/mq), spogliatoi/bagno accessibile, impianti, riscaldamento, attrezzi.",
              colonne: ["Fase", "Cosa faccio", "Costo (€)"],
              righeIniziali: [
                ["Fase 1 — per aprire a norma", "", ""],
                ["Fase 1 — per aprire a norma", "", ""],
                ["Fase 2 — dopo", "", ""],
              ],
            },
          ],
          reazioneCliente:
            "Tonino sull'ordine delle spese: «Il pavimento buono lo metto subito o prima i bagni? A me 'ste cose non me tornano». Apre di fatto la tappa sulle norme.",
          revisioneFocus: [
            "Le fasi hanno un ordine sensato (prima la sicurezza)?",
            "I costi sono plausibili e stanno nel budget di partenza?",
            "La Fase 1 è davvero ciò che serve per aprire?",
            "Ha considerato le voci pesanti (spogliatoi, impianti)?",
          ],
        },
        {
          id: "a_norma",
          titolo: "Tappa 3 — A norma",
          obiettivo: "Verifica cosa serve per legge per aprire le porte al pubblico.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "checklist_norma",
              titolo: "A norma — spunta ciò che hai considerato",
              tipo: "checklist",
              prompt: "Cosa serve per aprire in regola?",
              voci: [
                "Agibilità e SCIA per il cambio d'uso",
                "Accessibilità: ingresso e bagno senza barriere (L. 13/1989)",
                "Impianti elettrico e termico certificati",
                "Uscite, estintori e segnaletica antincendio",
              ],
            },
            {
              id: "norme_note",
              titolo: "Chi certifica e come",
              tipo: "testo",
              prompt: "Chi firma che è tutto a norma, e cosa serve per un locale sotto le 100 persone?",
              hint: "Sotto le 100 persone di norma niente CPI dei Vigili del Fuoco, ma servono agibilità e conformità impianti.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Tonino si sente perso: «Chi me le firma 'ste carte? Io non ci capisco niente di burocrazia». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Ha coperto agibilità, accessibilità, impianti e antincendio?",
            "Ha capito chi certifica cosa?",
            "Le scelte sono corrette per un piccolo locale (sotto 100 persone)?",
            "L'accessibilità è considerata dall'inizio, non come ripensamento?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Tonino",
          obiettivo: "Digli cosa apri subito coi 30.000€ e cosa rimandi, e perché è tutto a norma. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "Lo spazio, in parole semplici",
              tipo: "testo_lungo",
              prompt: "Pianta, preventivo per fasi e messa a norma: spiega a Tonino cosa apre subito e cosa dopo, senza sorprese.",
              hint: "Con 30.000€ non si fa tutto: parti per fasi, prima la sicurezza. Diglielo chiaro.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Tonino valuta se il piano dello spazio lo convince e sta nei soldi: se sì, ci sta; se no, dice cosa lo preoccupa ancora. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi è chiara e semplice (terza media)?",
            "È chiaro cosa apre subito e cosa dopo?",
            "Sta nel budget di 30.000€?",
            "Dà sicurezza che sarà tutto a norma?",
          ],
        },
      ],
    },

    legale: {
      fasi: [
        {
          id: "forma",
          titolo: "Tappa 1 — La forma giuridica",
          obiettivo: "Scegli la «scatola» giuridica giusta e metti in fila gli adempimenti.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "forma",
              titolo: "La forma giuridica",
              tipo: "scelta",
              prompt: "Quale scegli, e perché in una riga?",
              hint: "Per una palestra popolare la strada naturale è l'ASD (spesso anche APS).",
              opzioni: ["ASD — Associazione Sportiva Dilettantistica", "APS — Associazione di Promozione Sociale", "SSD — Società Sportiva Dilettantistica"],
            },
            {
              id: "adempimenti",
              titolo: "Gli adempimenti, in ordine",
              tipo: "testo_lungo",
              prompt: "Cosa devi fare per aprire e restare in regola?",
              hint: "Statuto, codice fiscale, RASD, affiliazione (FPI o EPS), regime L.398/91, assicurazione soci.",
              minCaratteri: 250,
            },
          ],
          reazioneCliente:
            "Tonino si blocca subito: «Associazione, società… io che devo fà esattamente? Parla come al bar». Apre di fatto la tappa sui bandi.",
          revisioneFocus: [
            "La forma è scelta con una motivazione sensata?",
            "Gli adempimenti sono in ordine e completi?",
            "Ha citato RASD e affiliazione (FPI/EPS)?",
            "È spiegato in modo comprensibile a chi non è del settore?",
          ],
        },
        {
          id: "bandi",
          titolo: "Tappa 2 — I bandi",
          obiettivo: "Trova i fondi pubblici veri: bandi reali con importi, scadenze e requisiti.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "bandi",
              titolo: "I 3 bandi",
              tipo: "tabella",
              prompt: "Individua almeno 3 bandi reali con importo, scadenza e requisiti.",
              hint: "Sport di Tutti – Quartieri (fino a 100.000€, vieta quote), Sport e Periferie, fondazioni (Con i Bambini).",
              colonne: ["Bando", "Importo", "Scadenza", "Requisiti"],
              minRighe: 3,
            },
          ],
          reazioneCliente:
            "Tonino diffida della carta: «'Sti bandi chi li scrive? Io ho la terza media, mica so compilà 'ste domande». Apre di fatto la tappa su istruttori e regole.",
          revisioneFocus: [
            "I bandi sono reali e adatti a una palestra popolare?",
            "Ci sono importo, scadenza e requisiti per ognuno?",
            "Ha colto che «minori gratis» spesso è un requisito favorevole, non un ostacolo?",
            "Sono bandi accessibili a una piccola associazione?",
          ],
        },
        {
          id: "istruttori_regole",
          titolo: "Tappa 3 — Istruttori e regole",
          obiettivo: "Inquadra chi allena e chiudi gli obblighi (assicurazione, agibilità, sicurezza).",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "istruttori",
              titolo: "Come inquadri gli istruttori",
              tipo: "testo_lungo",
              prompt: "Riforma dello sport: come metti in regola chi allena, senza costi insostenibili?",
              hint: "Lavoratori sportivi (D.Lgs 36/2021): fino a 5.000€/anno esenti da imposte e contributi.",
              minCaratteri: 250,
            },
            {
              id: "obblighi",
              titolo: "Gli altri obblighi",
              tipo: "checklist",
              prompt: "Cosa non deve mancare per stare in regola?",
              voci: [
                "Assicurazione dei soci tramite tesseramento",
                "Certificati medici in regola",
                "Agibilità dei locali",
                "Autorizzazioni di pubblica sicurezza per gli eventi aperti",
              ],
            },
          ],
          reazioneCliente:
            "Tonino teme i pasticci: «E se prendo i soldi di un bando e poi sbaglio i conti, che mi succede?». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "L'inquadramento degli istruttori è corretto (riforma dello sport)?",
            "Ha sfruttato la soglia dei 5.000€ per tenere i costi bassi?",
            "Gli obblighi (assicurazione, certificati, agibilità) sono coperti?",
            "È tutto spiegato in modo semplice e rassicurante?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Tonino",
          obiettivo: "Metti insieme forma, bandi e regole in parole semplici. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "La parte legale, in chiaro",
              tipo: "testo_lungo",
              prompt: "Forma scelta, cosa firma, i 3 bandi e come mette in regola gli istruttori: spiega tutto a Tonino senza paroloni.",
              hint: "Tonino teme la burocrazia: fagli vedere che è tutto gestibile, passo per passo.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Tonino valuta se ora la burocrazia gli fa meno paura: se è convinto, ci sta; se no, dice cosa ancora non gli è chiaro. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi è chiara e semplice (terza media)?",
            "Tiene insieme forma, adempimenti, bandi e istruttori?",
            "È coerente con le tappe precedenti?",
            "Toglie a Tonino la paura della burocrazia?",
          ],
        },
      ],
    },
  },
};

// Contesto sintetico del cliente per il tutor AI (aiuto/revisione per
// sezione): non il system prompt completo di WORKSHOP_CLIENTE_PROMPTS
// (troppo lungo da ripetere ad ogni richiesta), solo un riassunto dei
// vincoli rigidi. Popolato per workshop, non per ruolo — il cliente è lo
// stesso per tutti i ruoli dello stesso progetto.
export const WORKSHOP_TUTOR_CONTESTO: Record<string, { cliente: string; vincoli: string }> = {
  "palestra-popolare": {
    cliente: "Tonino, 52 anni, ex pugile dilettante, terza media, parla in modo semplice e diretto.",
    vincoli:
      "Budget rigido di 30.000€, non un euro di più. I minori si allenano sempre gratis, non si tocca. Le quote degli adulti restano basse (circa 20€/mese). Non deve diventare una palestra fitness commerciale: niente abbonamenti col tornello, niente selezione all'ingresso.",
  },
};
