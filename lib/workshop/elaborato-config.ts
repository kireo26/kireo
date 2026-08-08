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

  // Ricevuti da Mario in elaborato-enoteca-v2.ts (ELABORATO_ENOTECA), stesso
  // schema di palestra-popolare > salute. Slug ruoli verificati contro
  // supabase/migrations/20260807130000_workshop.sql (seed di
  // enoteca-centocelle): economia/giurisprudenza/grafica/marketing/food,
  // combaciano esattamente. Fiducia 25×4=100 per ruolo.
  "enoteca-centocelle": {
    // ══════════════════════════════════════════════════════════ ECONOMIA (CFO junior)
    economia: {
      fasi: [
        {
          id: "apertura",
          titolo: "Tappa 1 — I costi per aprire",
          obiettivo: "Metti in fila l'investimento iniziale per aprire l'enoteca, dentro gli 80.000€.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "costi_apertura",
              titolo: "L'investimento iniziale",
              tipo: "tabella",
              prompt: "Stima le voci per aprire. Tutto incluso deve stare negli 80.000€.",
              hint: "Ristrutturazione locale (60 mq), arredi e scaffalature, impianto frigo, licenze, prima scorta vini, cassa/POS, insegna.",
              colonne: ["Voce", "Costo (€)"],
              righeIniziali: [
                ["Ristrutturazione e impianti", ""],
                ["Arredi e scaffalature", ""],
                ["Cantina/frigo e attrezzature", ""],
                ["Licenze e pratiche", ""],
                ["Prima scorta vini", ""],
                ["Insegna e comunicazione iniziale", ""],
                ["Totale", ""],
              ],
            },
            {
              id: "margine",
              titolo: "Cosa tieni da parte",
              tipo: "testo",
              prompt: "Quanto lasci come cuscinetto per i primi mesi, prima che l'enoteca cammini da sola?",
              hint: "Aprire e finire i soldi al secondo mese è l'errore classico: tieni una riserva.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Gianni, da ex commercialista, va dritto al punto: «Ottantamila, non un euro di più. Fammi vedere che ci stai dentro e che non finiamo i soldi a gennaio». Apre di fatto la tappa sui costi mensili.",
          revisioneFocus: [
            "Le voci di apertura sono realistiche per un'enoteca di 60 mq?",
            "Il totale sta dentro gli 80.000€?",
            "Ha previsto un cuscinetto per i primi mesi?",
            "Niente voci dimenticate (licenze, impianto frigo, prima scorta)?",
          ],
        },
        {
          id: "costi_ricavi",
          titolo: "Tappa 2 — Costi fissi e ricavi",
          obiettivo: "Stima quanto costa tenere aperto ogni mese e quanto puoi incassare.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "costi_fissi",
              titolo: "I costi fissi mensili",
              tipo: "tabella",
              prompt: "Cosa paghi ogni mese a prescindere dagli incassi?",
              hint: "Affitto (~1.200€), utenze, dipendente/collaboratore, commercialista, assicurazione, rifornimento vini.",
              colonne: ["Voce", "Costo mensile (€)"],
              minRighe: 4,
            },
            {
              id: "ricavi",
              titolo: "Come incassi",
              tipo: "testo_lungo",
              prompt:
                "Da cosa arrivano i ricavi (bottiglie da asporto, mescita al calice, food)? Stima uno scontrino medio e quanti clienti al giorno servono.",
              hint: "Markup vino: al calice 2,5–3x, a bottiglia 1,8–2,2x. Ragiona su coperti/serata realistici a Centocelle.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Gianni fa il conto della serva: «Bello, ma quanto incasso davvero al mese? E quanta gente deve entrà ogni sera perché torni?». Apre di fatto la tappa sul break-even.",
          revisioneFocus: [
            "I costi fissi mensili sono completi e realistici?",
            "La stima ricavi parte da numeri concreti (scontrino, clienti/giorno)?",
            "I margini sul vino sono usati correttamente?",
            "Le ipotesi sono plausibili per il quartiere, non ottimistiche?",
          ],
        },
        {
          id: "break_even",
          titolo: "Tappa 3 — Il break-even",
          obiettivo: "Calcola in quanti mesi l'enoteca va a pari e quanto runway hai.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "calcolo_be",
              titolo: "Il punto di pareggio",
              tipo: "testo_lungo",
              prompt: "Con i tuoi costi fissi e i tuoi margini, quanti incassi servono al mese per andare a pari? In quanti mesi ci arrivi?",
              hint: "Break-even = costi fissi ÷ margine. Poi confronta col cuscinetto: i soldi bastano ad arrivarci?",
              minCaratteri: 350,
            },
            {
              id: "rischio",
              titolo: "Se va peggio del previsto",
              tipo: "testo",
              prompt: "Se nei primi mesi incassi il 30% in meno, cosa fai? Dove tagli senza chiudere?",
              hint: "Gianni vuole sapere che hai un piano B, non solo lo scenario ottimista.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Gianni vuole il numero: «In quanti mesi rientro? Dammi una cifra, non i giri di parole. E se va male?». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Il break-even è calcolato correttamente sui numeri delle tappe precedenti?",
            "Il tempo di pareggio è coerente col cuscinetto disponibile?",
            "C'è uno scenario prudente, non solo quello ottimista?",
            "Il piano B è concreto?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Gianni",
          obiettivo: "Metti insieme i conti e convincilo che l'enoteca sta in piedi. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "I conti, in chiaro",
              tipo: "testo_lungo",
              prompt: "Investimento, costi fissi, ricavi attesi e mesi al pareggio: spiegalo a Gianni in modo asciutto e con i numeri.",
              hint: "Gianni è un ex commercialista: apprezza precisione e onestà, odia i numeri gonfiati.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Gianni tira le somme sulla fiducia accumulata: se i conti tornano e sono onesti, ci sta; se qualcosa non quadra, lo dice senza giri. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi è chiara e sostenuta dai numeri?",
            "È coerente con le tappe precedenti?",
            "Rispetta il tetto di 80.000€ e niente banche/soci?",
            "Convincerebbe un ex commercialista diffidente?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════════ GIURISPRUDENZA (Legal junior)
    giurisprudenza: {
      fasi: [
        {
          id: "licenze",
          titolo: "Tappa 1 — Le licenze per vendere vino",
          obiettivo: "Capisci quali autorizzazioni servono per aprire e vendere vino.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "quali_licenze",
              titolo: "Cosa serve per aprire",
              tipo: "testo_lungo",
              prompt: "Quali autorizzazioni servono per vendere e somministrare vino? Spiega la differenza tra asporto e mescita.",
              hint: "SCIA per somministrazione (art. 64 D.Lgs 59/2010), codice ATECO 56.30.00, requisiti professionali/onorabilità.",
              minCaratteri: 300,
            },
            {
              id: "checklist_apertura",
              titolo: "La checklist di apertura",
              tipo: "checklist",
              prompt: "Spunta i passaggi burocratici da fare, in ordine.",
              voci: [
                "Partita IVA e codice ATECO",
                "SCIA al Comune (SUAP)",
                "Iscrizione Registro Imprese CCIAA",
                "Requisiti igienico-sanitari (ASL/HACCP)",
                "Insegna e autorizzazioni comunali",
              ],
            },
          ],
          reazioneCliente:
            "Gianni sbuffa sulla burocrazia: «Quante carte servono per aprì 'sto posto? Io le rogne non le voglio». Apre di fatto la tappa sulla forma giuridica.",
          revisioneFocus: [
            "Distingue correttamente asporto e somministrazione?",
            "Cita SCIA, ATECO e requisiti in modo corretto?",
            "La checklist è completa e in ordine logico?",
            "È spiegato in modo comprensibile a un non addetto?",
          ],
        },
        {
          id: "forma",
          titolo: "Tappa 2 — La forma giuridica",
          obiettivo: "Scegli tra ditta individuale e SRL semplificata, con una motivazione.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "scelta_forma",
              titolo: "Quale forma",
              tipo: "scelta",
              prompt: "Cosa consigli a Gianni, e perché in una riga?",
              hint: "Gianni non vuole soci né banche. Valuta responsabilità patrimoniale, costi e tassazione.",
              opzioni: ["Ditta individuale", "SRL semplificata (SRLS)", "Impresa familiare"],
            },
            {
              id: "motivazione",
              titolo: "Il perché",
              tipo: "testo_lungo",
              prompt: "Spiega i pro e i contro della tua scelta: responsabilità, costi di costituzione, tasse (IRPEF vs IRES).",
              hint: "Ditta individuale: semplice ma responsabilità illimitata. SRLS: protegge il patrimonio ma più adempimenti.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Gianni, che di conti se ne intende, incalza: «Ditta o società? Guarda che coi miei risparmi ci gioco la casa, mica scherziamo». Apre di fatto la tappa sull'e-commerce.",
          revisioneFocus: [
            "La forma scelta è motivata con pro e contro reali?",
            "Ha considerato la responsabilità patrimoniale (i risparmi di Gianni)?",
            "Il confronto fiscale è corretto?",
            "La scelta rispetta il no a soci e banche?",
          ],
        },
        {
          id: "ecommerce",
          titolo: "Tappa 3 — Vendere anche online",
          obiettivo: "Verifica cosa cambia se Gianni vuole vendere vino anche online.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "ecommerce_norme",
              titolo: "E-commerce di alcolici",
              tipo: "testo_lungo",
              prompt: "Cosa serve in più per vendere vino online rispetto al negozio fisico?",
              hint: "Comunicazione di vendita online, accise/registri se applicabili, verifica età, spedizione alcolici, privacy/termini.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Gianni intravede un'opportunità ma diffida: «E se vendo pure su internet? Non è che poi mi arrivano multe che manco so'?». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Ha individuato cosa cambia davvero rispetto alla vendita in loco?",
            "Cita adempimenti reali (comunicazione, verifica età, spedizione)?",
            "Distingue ciò che è obbligatorio da ciò che è consigliato?",
            "È realistico per una piccola enoteca?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Gianni",
          obiettivo: "Riassumi licenze, forma e online in modo che Gianni non abbia paura della burocrazia. Ultimo passo.",
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
              prompt: "Licenze, forma giuridica scelta e, se serve, l'online: spiega tutto a Gianni passo per passo, senza gergo.",
              hint: "Fagli vedere che è tutto gestibile e che i suoi risparmi sono protetti.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Gianni valuta se ora la burocrazia gli fa meno paura: se è convinto, ci sta; se no, dice cosa ancora lo blocca. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi tiene insieme licenze, forma ed e-commerce?",
            "È chiara e senza gergo?",
            "Rassicura sulla protezione del patrimonio?",
            "È coerente con le tappe precedenti?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════════ GRAFICA (Creative director)
    grafica: {
      fasi: [
        {
          id: "nome",
          titolo: "Tappa 1 — Il nome",
          obiettivo: "Proponi il nome dell'enoteca: deve richiamare la tradizione romana.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "proposta_nome",
              titolo: "La proposta di nome",
              tipo: "testo_lungo",
              prompt: "Proponi 2-3 nomi e spiega perché funzionano. Niente inglese, niente astratto: radici romane.",
              hint: "Gianni vuole \"caldo e artigianale\", tradizione. Pensa a dialetto, storia del quartiere, mestieri.",
              minCaratteri: 250,
            },
          ],
          reazioneCliente:
            "Gianni è netto: «Niente inglese eh, dev'esse' 'na cosa romana, che quando la senti sai già de che parliamo». Apre di fatto la tappa su logo e colori.",
          revisioneFocus: [
            "I nomi richiamano la tradizione romana (no inglese, no astratto)?",
            "C'è una motivazione dietro ogni proposta?",
            "Sono nomi pronunciabili e memorabili?",
            "Funzionano per un'enoteca di quartiere?",
          ],
        },
        {
          id: "logo_palette",
          titolo: "Tappa 2 — Logo e colori",
          obiettivo: "Definisci il concept del logo e la palette dell'enoteca.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "concept",
              titolo: "Il concept",
              tipo: "testo_lungo",
              prompt: "Descrivi l'idea del logo e la palette (2-3 colori) con il loro perché.",
              hint: "Punto di partenza suggerito: terra (#8B5E3C), borgogna (#722F37), avorio (#F5F0E8). Caldo e artigianale.",
              minCaratteri: 250,
            },
            {
              id: "bozza",
              titolo: "Una bozza (facoltativo)",
              tipo: "immagine",
              opzionale: true,
              prompt: "Se vuoi, allega la foto di uno schizzo del logo o una moodboard.",
            },
          ],
          reazioneCliente:
            "Gianni vuole vedere, non sentire teorie: «Famme vede' com'è 'sta roba, che coi disegni astratti non ci capisco niente». Apre di fatto la tappa sulle applicazioni.",
          revisioneFocus: [
            "Il concept è coerente col nome e con \"caldo e artigianale\"?",
            "La palette è motivata, non casuale?",
            "È qualcosa di realizzabile, non solo bello a parole?",
            "Rispetta il gusto del cliente (niente minimal/nordico)?",
          ],
        },
        {
          id: "applicazioni",
          titolo: "Tappa 3 — Le applicazioni",
          obiettivo: "Verifica che l'identità funzioni dove serve davvero.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "applicazioni",
              titolo: "Dove vive il marchio",
              tipo: "tabella",
              prompt: "Per ogni supporto, di' come si adatta il logo/identità.",
              hint: "Insegna esterna (grande), etichette vino (piccola), profilo Instagram (quadrato), menu stampato (b/n).",
              colonne: ["Supporto", "Come si adatta"],
              minRighe: 4,
            },
          ],
          reazioneCliente:
            "Gianni pensa al pratico: «E sull'insegna grande e sulle bottiglie piccole funziona uguale? Non è che poi non se legge?». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Ha testato le applicazioni chiave (insegna, etichetta, social, menu)?",
            "Il logo regge sia in grande che in piccolo, a colori e in b/n?",
            "Le scelte sono pratiche, non solo estetiche?",
            "C'è coerenza tra tutte le applicazioni?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Gianni",
          obiettivo: "Presenta l'identità completa e convincilo. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "L'identità, in breve",
              tipo: "testo_lungo",
              prompt: "Nome, logo, colori e come vivono sui vari supporti: racconta l'identità a Gianni in modo semplice e concreto.",
              hint: "Gianni non è un creativo: collega ogni scelta a un motivo pratico o alla tradizione romana.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Gianni valuta se l'identità gli \"suona\" romana e concreta: se sì, ci sta; se no, dice cosa non lo convince. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi tiene insieme nome, logo, colori e applicazioni?",
            "Ogni scelta è motivata in modo concreto?",
            "Rispetta il gusto del cliente e la tradizione romana?",
            "È spiegata senza gergo da designer?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════════ MARKETING (Marketing manager)
    marketing: {
      fasi: [
        {
          id: "quartiere",
          titolo: "Tappa 1 — Il quartiere e il target",
          obiettivo: "Studia Centocelle e definisci a chi si rivolge l'enoteca.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "analisi",
              titolo: "Chi c'è a Centocelle",
              tipo: "testo_lungo",
              prompt: "Descrivi il quartiere e il target: chi entrerebbe in un'enoteca di vini naturali qui?",
              hint: "Centocelle: fascia 25-44 prevalente, quartiere in trasformazione, tanti locali aperti negli ultimi anni.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Gianni è concreto: «Ma chi ce viene da me a beve vino naturale? Qui non è mica il centro». Apre di fatto la tappa sul piano di lancio.",
          revisioneFocus: [
            "L'analisi del quartiere è concreta, non generica?",
            "Il target è definito con precisione?",
            "Tiene conto che è vino naturale (nicchia) in periferia?",
            "Individua un motivo per cui la gente entrerebbe?",
          ],
        },
        {
          id: "lancio",
          titolo: "Tappa 2 — Il piano di lancio",
          obiettivo: "Costruisci il piano dei primi 3 mesi, dall'apertura alla fidelizzazione.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "piano",
              titolo: "Il piano 3 mesi",
              tipo: "tabella",
              prompt: "Cosa fai settimana per settimana (o mese per mese) per far conoscere e riempire l'enoteca?",
              hint: "Pre-opening (buzz, lista amici), opening (serata inaugurale, degustazione), retention (fidelizzare i primi clienti).",
              colonne: ["Periodo", "Azione", "Obiettivo"],
              minRighe: 4,
            },
          ],
          reazioneCliente:
            "Gianni frena sui costi: «Io in pubblicità non ce voglio buttà soldi. Se me chiedi mille euro de Facebook, semo già fritti». Apre di fatto la tappa sui social senza budget.",
          revisioneFocus: [
            "Il piano copre pre-opening, opening e retention?",
            "Le azioni sono concrete e realizzabili con pochi soldi?",
            "C'è un obiettivo chiaro per ogni fase?",
            "È adatto a un'enoteca di quartiere, non a una grande catena?",
          ],
        },
        {
          id: "social",
          titolo: "Tappa 3 — Traffico senza budget",
          obiettivo: "Trova come generare clienti nei primi mesi senza spendere in pubblicità.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "tattiche",
              titolo: "Tre tattiche a costo zero",
              tipo: "testo_lungo",
              prompt: "Presenta 3 tattiche concrete per portare gente senza advertising, con una stima del risultato atteso.",
              hint: "Passaparola strutturato, collaborazioni col quartiere, contenuti social organici, degustazioni/eventi.",
              minCaratteri: 350,
            },
          ],
          reazioneCliente:
            "Gianni è diffidente ma curioso: «'Sti social funzionano davvero o è tempo perso? Fammi vede' che ci guadagno». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Le 3 tattiche sono concrete e a basso costo?",
            "C'è una stima del risultato atteso, non solo idee?",
            "Sono adatte a chi non vuole spendere in adv?",
            "Sono sostenibili per una persona sola all'inizio?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Gianni",
          obiettivo: "Convincilo che riempirai l'enoteca senza svenarti in pubblicità. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "Il piano, in breve",
              tipo: "testo_lungo",
              prompt: "Target, lancio e come porti gente senza budget: spiegalo a Gianni con esempi concreti e attese realistiche.",
              hint: "Gianni odia i soldi buttati: mostra il ritorno di ogni azione, non la fuffa da marketer.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Gianni valuta se il piano riempie l'enoteca senza spese folli: se lo convince, ci sta; se no, dice cosa non gli torna. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi tiene insieme target, lancio e crescita senza budget?",
            "Le attese sono realistiche, non gonfiate?",
            "Rispetta il no all'advertising a pagamento?",
            "È spiegata senza gergo da marketer?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════════ FOOD (Food & wine curator)
    food: {
      fasi: [
        {
          id: "carta_vini",
          titolo: "Tappa 1 — La carta vini",
          obiettivo: "Costruisci una carta di soli vini naturali e biodinamici, con budget limitato.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "carta",
              titolo: "La carta",
              tipo: "tabella",
              prompt: "Imposta una carta di partenza: tipologia, fascia di prezzo di vendita, note. Solo naturali/biodinamici.",
              hint: "30-40 etichette bastano per partire. Mescola entry (€4-8 ingrosso) e fascia media (€8-15).",
              colonne: ["Tipologia / zona", "Fascia prezzo vendita", "Note"],
              minRighe: 4,
            },
          ],
          reazioneCliente:
            "Gianni è irremovibile: «Solo vini naturali, eh. Manco uno convenzionale \"per chi non è abituato\". Su questo non se discute». Apre di fatto la tappa sui fornitori.",
          revisioneFocus: [
            "La carta è solo di vini naturali/biodinamici?",
            "C'è un mix di fasce di prezzo sensato?",
            "È adatta a un quartiere periferico (non solo etichette costose)?",
            "Il numero di etichette è gestibile all'avvio?",
          ],
        },
        {
          id: "fornitori",
          titolo: "Tappa 2 — I fornitori",
          obiettivo: "Trova da chi comprare, a quali prezzi, per reggere i margini.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "fornitori",
              titolo: "Da chi compri",
              tipo: "testo_lungo",
              prompt: "Come ti rifornisci? Produttori diretti, distributori di naturali, prezzi indicativi all'ingrosso.",
              hint: "Lazio, Umbria, Abruzzo: produttori con cui trattare diretti. Ingrosso €4-8 entry, €8-15 media.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Gianni fa i conti: «Quanto me costano a bottiglia? Perché se le pago troppo, o le vendo care o ce rimetto». Apre di fatto la tappa sul food.",
          revisioneFocus: [
            "Le fonti di rifornimento sono concrete e realistiche?",
            "I prezzi all'ingrosso reggono i margini di vendita?",
            "Ha considerato l'acquisto diretto per risparmiare?",
            "È sostenibile per una piccola enoteca?",
          ],
        },
        {
          id: "food",
          titolo: "Tappa 3 — Il food pairing",
          obiettivo: "Aggiungi un'offerta food semplice, incluso un piatto caldo serale, senza una cucina vera.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "menu",
              titolo: "Il menu essenziale",
              tipo: "tabella",
              prompt: "Cosa abbini ai vini tenendo bassi i costi e senza una cucina attrezzata?",
              hint: "Taglieri (materia prima €4-6, vendita €12-16), conserve, formaggi laziali. Un solo piatto caldo semplice.",
              colonne: ["Piatto", "Costo materia prima", "Prezzo vendita"],
              minRighe: 3,
            },
            {
              id: "piatto_caldo",
              titolo: "Il piatto caldo serale",
              tipo: "testo",
              prompt: "Quale piatto caldo (uno solo, semplice) proponi e come lo gestisci in 60 mq senza cucina completa?",
              hint: "Deve essere fattibile con attrezzatura minima e non far esplodere i costi fissi.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Gianni pone il vincolo pratico: «Un piatto caldo la sera me sta bene, ma io 'na cucina grande non ce l'ho e non la voglio». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Il menu è sostenibile senza una cucina completa?",
            "I margini food sono corretti (costo vs vendita)?",
            "Il piatto caldo è uno, semplice e gestibile in 60 mq?",
            "L'offerta food valorizza i vini senza complicare la gestione?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Gianni",
          obiettivo: "Presenta carta, fornitori e food come un'offerta coerente. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "L'offerta, in breve",
              tipo: "testo_lungo",
              prompt: "Carta vini, fornitori e food pairing: racconta a Gianni l'offerta completa e perché regge i conti.",
              hint: "Solo naturali (non negoziabile), margini che tornano, food semplice: mettilo nero su bianco.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Gianni valuta se l'offerta è coerente e sostenibile: se lo convince, ci sta; se no, dice cosa lo lascia perplesso. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi tiene insieme carta, fornitori e food?",
            "Rispetta il vincolo \"solo vini naturali\"?",
            "I margini reggono?",
            "L'offerta è realistica per 60 mq senza grande cucina?",
          ],
        },
      ],
    },
  },

  // Ricevuti da Mario in elaborato-cargo-v2.ts (ELABORATO_CARGO), stesso
  // schema degli altri workshop v2. Slug ruoli confermati contro
  // WORKSHOP_KIT["cargo-bike-torino"] (config.ts) — quella mappa era già
  // stata verificata contro il DB reale in una sessione precedente (vedi
  // CLAUDE.md, "Verifica slug — DB come fonte di verità"): nessuna
  // migration per questo workshop vive nel repo (seed applicato a mano da
  // Mario), quindi non c'è un file da controllare qui, solo la mappa già
  // verificata. Fiducia 25×4=100 per ruolo.
  "cargo-bike-torino": {
    // ══════════════════════════════════════════════════════ ECONOMIA (Analista di flotta)
    economia: {
      fasi: [
        {
          id: "confronto",
          titolo: "Tappa 1 — Furgone vs cargo bike",
          obiettivo: "Confronta i costi di un furgone e di una cargo bike, voce per voce.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "confronto_costi",
              titolo: "Il confronto dei costi",
              tipo: "tabella",
              prompt: "Metti a confronto furgone e cargo bike su ogni voce di costo.",
              hint: "Costo/km, carburante vs elettricità, manutenzione, assicurazione, bollo, multe/permessi ZTL.",
              colonne: ["Voce di costo", "Furgone", "Cargo bike"],
              minRighe: 5,
            },
            {
              id: "voce_chiave",
              titolo: "Dove si risparmia di più",
              tipo: "testo",
              prompt: "Qual è la voce dove la cargo bike fa davvero la differenza, e perché?",
              hint: "A Torino pesano ZTL, multe e carburante: parti da lì.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Renzo va al sodo, da piemontese: «Bene i conti, ma a me interessa una cosa: in quanto tempo rientro dei soldi che metto?». Apre di fatto la tappa sull'investimento.",
          revisioneFocus: [
            "Il confronto copre le voci reali (carburante, ZTL, manutenzione, assicurazione)?",
            "I numeri sono plausibili per una piccola flotta a Torino?",
            "Ha individuato dove la cargo bike conviene davvero?",
            "Tiene conto della ZTL e delle multe, punto dolente di Renzo?",
          ],
        },
        {
          id: "investimento",
          titolo: "Tappa 2 — Quante cargo bike e quanto costano",
          obiettivo: "Dimensiona l'investimento restando nei 60.000€.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "investimento",
              titolo: "L'investimento",
              tipo: "tabella",
              prompt: "Quante cargo bike compri e quanto costano, con gli extra (batterie, attrezzatura)?",
              hint: "Renzo ne aveva in testa due, ma valuta se ne servono di più. Non tocca tutta la flotta: un furgone resta.",
              colonne: ["Voce", "Quantità", "Costo (€)"],
              minRighe: 3,
            },
            {
              id: "budget",
              titolo: "Il conto nel budget",
              tipo: "testo",
              prompt: "Come stai dentro i 60.000€ e cosa lasci come margine?",
              hint: "Renzo ha già un mutuo: non si indebita oltre. Sii preciso.",
              minCaratteri: 200,
            },
          ],
          reazioneCliente:
            "Renzo blocca subito gli entusiasmi: «Sessantamila, non un euro di più. Ce l'ho già il mutuo, non me ne accollo un altro. Rifai i conti se sfori». Apre di fatto la tappa sul break-even.",
          revisioneFocus: [
            "L'investimento sta dentro i 60.000€?",
            "Il numero di cargo bike è motivato, non a caso?",
            "Rispetta il vincolo di non convertire tutta la flotta?",
            "C'è un margine, niente indebitamento extra?",
          ],
        },
        {
          id: "break_even",
          titolo: "Tappa 3 — Il break-even della conversione",
          obiettivo: "Calcola in quanti mesi le cargo bike ripagano l'investimento.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "calcolo",
              titolo: "Il punto di pareggio",
              tipo: "testo_lungo",
              prompt: "Con i risparmi su carburante, multe ZTL e manutenzione, in quanti mesi rientri dell'investimento? Mostra il calcolo.",
              hint: "Risparmio mensile stimato → mesi = investimento ÷ risparmio mensile. Sii onesto sulle ipotesi.",
              minCaratteri: 350,
            },
          ],
          reazioneCliente:
            "Renzo pensa al concreto quotidiano: «E quando piove, o d'inverno, o in salita? Se le consegne rallentano i clienti se ne vanno». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Il break-even è calcolato sui risparmi reali (carburante, ZTL, manutenzione)?",
            "Le ipotesi sono oneste, non ottimistiche?",
            "Il tempo di rientro è coerente con l'investimento?",
            "Tiene conto dei limiti (meteo, salite) senza gonfiare i numeri?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Renzo",
          obiettivo: "Convincilo che la conversione regge economicamente. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "I conti, in chiaro",
              tipo: "testo_lungo",
              prompt: "Confronto costi, investimento e mesi di rientro: spiegalo a Renzo con numeri asciutti e onesti.",
              hint: "Renzo è pratico e diffida di chi vende sogni: numeri veri e \"in quanto rientro\".",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Renzo tira le somme sulla fiducia accumulata: se i conti lo convincono, ci sta; se no, dice cosa non gli torna. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi è chiara e sostenuta dai numeri?",
            "Rispetta i 60.000€ e la flotta mista?",
            "Il rientro è credibile?",
            "Convince un corriere pratico e diffidente?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════ MOBILITA (Progettista di rete)
    mobilita: {
      fasi: [
        {
          id: "hub",
          titolo: "Tappa 1 — La rete di hub",
          obiettivo: "Progetta dove appoggiare le cargo bike per coprire il centro di Torino.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "hub",
              titolo: "Gli hub",
              tipo: "testo_lungo",
              prompt: "Dove metti gli hub (magazzino attuale, nano-hub in centro)? Quanti e perché?",
              hint: "Tipi di hub: grandi, medi, nano-hub. Raggio di copertura efficace di una cargo bike dal punto di appoggio.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo parte dal suo: «Il magazzino ce l'ho già io fuori centro. Non basta quello? Perché mi servono altri punti?». Apre di fatto la tappa sulle zone di copertura.",
          revisioneFocus: [
            "Il numero e il tipo di hub è motivato?",
            "Considera il raggio efficace di una cargo bike?",
            "Sfrutta il magazzino esistente dove ha senso?",
            "È realistico per il centro di Torino e la ZTL?",
          ],
        },
        {
          id: "copertura",
          titolo: "Tappa 2 — Le zone di copertura",
          obiettivo: "Definisci quali zone copre ogni cargo bike e quante consegne al giorno.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "zone",
              titolo: "Zone e carichi",
              tipo: "tabella",
              prompt: "Per ogni zona/cargo bike: raggio coperto e consegne realistiche al giorno.",
              hint: "Meglio numeri prudenti: un rider non fa 100 consegne. Guarda i dati dei progetti pilota europei.",
              colonne: ["Zona", "Raggio", "Consegne/giorno"],
              minRighe: 3,
            },
          ],
          reazioneCliente:
            "Renzo, che il mestiere lo conosce, incalza: «Ma quante consegne fa davvero un rider in un giorno? Non contarmi i sogni». Apre di fatto la tappa sui giri di consegna.",
          revisioneFocus: [
            "Le consegne/giorno sono realistiche, non ottimistiche?",
            "La copertura ha senso geografico per Torino?",
            "Il numero di cargo bike è coerente con la copertura?",
            "Regge nelle ore di punta?",
          ],
        },
        {
          id: "giri",
          titolo: "Tappa 3 — I giri di consegna",
          obiettivo: "Organizza i giri in modo che il servizio non peggiori rispetto ai furgoni.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "giri",
              titolo: "Come organizzi i giri",
              tipo: "testo_lungo",
              prompt: "Come pianifichi i giri (fasce orarie, priorità, rientri all'hub) per non far peggiorare i tempi di consegna?",
              hint: "Renzo teme che le consegne rallentino e i clienti scappino: dimostra che i tempi tengono.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo ribadisce il suo chiodo fisso: «Il servizio NON deve peggiorare. Se il pacco arriva più tardi, il cliente cambia corriere e io chiudo». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "I giri sono organizzati per tenere i tempi di consegna?",
            "Considera le ore di punta e i rientri all'hub?",
            "Dimostra che il servizio non peggiora?",
            "È realizzabile con le cargo bike previste?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Renzo",
          obiettivo: "Convincilo che la rete copre Torino senza far peggiorare il servizio. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "La rete, in breve",
              tipo: "testo_lungo",
              prompt: "Hub, zone e giri: spiega a Renzo come copri il centro tenendo i tempi.",
              hint: "Concreto: mappa mentale chiara, numeri prudenti, servizio garantito.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Renzo valuta se la rete regge senza peggiorare il servizio: se sì, ci sta; se no, dice cosa lo preoccupa. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi tiene insieme hub, zone e giri?",
            "Il servizio resta all'altezza dei furgoni?",
            "I numeri sono prudenti e credibili?",
            "È coerente con le tappe precedenti?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════ TECNICA (Responsabile mezzi)
    tecnica: {
      fasi: [
        {
          id: "modelli",
          titolo: "Tappa 1 — Quali cargo bike",
          obiettivo: "Scegli i modelli giusti per il tipo di consegne di Renzo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "modelli",
              titolo: "I modelli",
              tipo: "tabella",
              prompt: "Confronta 2-3 modelli professionali: capacità di carico, autonomia, prezzo.",
              hint: "Capacità tipiche 240 litri – 2 m³. Serve reggere i colli dell'e-commerce e dei negozi del centro.",
              colonne: ["Modello", "Capacità", "Autonomia", "Prezzo"],
              minRighe: 2,
            },
          ],
          reazioneCliente:
            "Renzo vuole capirci: «Quante ne servono e di che tipo? Non voglio comprà biciclette da passeggio, devono reggere i pacchi veri». Apre di fatto la tappa su batterie e ricarica.",
          revisioneFocus: [
            "I modelli sono professionali e adatti alle consegne (non da hobby)?",
            "La capacità di carico regge i volumi?",
            "I prezzi sono coerenti col budget?",
            "La scelta è motivata sul tipo di merce?",
          ],
        },
        {
          id: "batterie",
          titolo: "Tappa 2 — Batterie e ricarica",
          obiettivo: "Risolvi autonomia e ricarica per una giornata di lavoro piena.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "batterie",
              titolo: "Autonomia e ricarica",
              tipo: "testo_lungo",
              prompt: "Come garantisci che le cargo bike reggano tutta la giornata? Autonomia, batterie di scorta, dove e quando ricarichi.",
              hint: "Batteria extra, ricarica in hub durante le pause, rotazione. Le salite di Torino consumano di più.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo pensa al peggio: «E quando la batteria è scarica a metà giornata? Mica posso lasciare i pacchi per strada». Apre di fatto la tappa su manutenzione e meteo.",
          revisioneFocus: [
            "La soluzione copre una giornata di lavoro piena?",
            "Prevede batterie di scorta o ricarica in hub?",
            "Tiene conto del consumo maggiore in salita?",
            "È pratica e a costi ragionevoli?",
          ],
        },
        {
          id: "manutenzione",
          titolo: "Tappa 3 — Manutenzione, pioggia e salite",
          obiettivo: "Gestisci manutenzione e i limiti reali di Torino (meteo, dislivelli).",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "manutenzione",
              titolo: "Tenere in strada le bici",
              tipo: "testo_lungo",
              prompt: "Come gestisci manutenzione ordinaria, giorni di pioggia e le salite? Cosa fai quando una cargo bike è ferma?",
              hint: "Manutenzione programmata, un mezzo di riserva o il furgone rimasto per i giorni difficili, motore adatto ai dislivelli.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo mette il dito nella piaga: «A Torino piove e ci stanno le salite. Con la pioggia i tuoi rider che fanno, si fermano?». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "La manutenzione è pianificata, non improvvisata?",
            "C'è un piano per pioggia e giorni difficili (furgone di riserva)?",
            "Tiene conto delle salite di Torino nella scelta dei mezzi?",
            "Il servizio regge anche nei casi peggiori?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Renzo",
          obiettivo: "Convincilo che la flotta di cargo bike è affidabile tutti i giorni. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "I mezzi, in breve",
              tipo: "testo_lungo",
              prompt: "Modelli, batterie, manutenzione e piano per il maltempo: spiega a Renzo perché la flotta è affidabile.",
              hint: "Renzo teme i fermi: mostragli che hai pensato a tutto, pioggia e salite comprese.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Renzo valuta se può fidarsi dei mezzi ogni giorno: se sì, ci sta; se no, dice cosa lo preoccupa. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi copre mezzi, energia, manutenzione e maltempo?",
            "Dà affidabilità quotidiana?",
            "È realistica per Torino?",
            "È coerente con le tappe precedenti?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════ DIGITALE (Product owner)
    digitale: {
      fasi: [
        {
          id: "cosa_serve",
          titolo: "Tappa 1 — Cosa serve davvero",
          obiettivo: "Definisci le funzioni minime indispensabili per gestire le consegne.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "funzioni",
              titolo: "Le funzioni indispensabili",
              tipo: "testo_lungo",
              prompt: "Cosa serve davvero, senza fronzoli? Elenca le funzioni minime e perché ognuna serve.",
              hint: "Assegnazione giri, tracciamento consegne, prova di consegna (foto/firma), comunicazione col cliente.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo è diffidente sulla tecnologia: «Io di app non ne so niente, e i miei ragazzi manco. Non voglio 'na roba che nessuno usa». Apre di fatto la tappa sul sistema minimo.",
          revisioneFocus: [
            "Le funzioni sono davvero le essenziali (niente fronzoli)?",
            "Ogni funzione ha un motivo pratico?",
            "È pensato per persone poco tecnologiche?",
            "Copre il tracciamento e la prova di consegna?",
          ],
        },
        {
          id: "sistema",
          titolo: "Tappa 2 — Il sistema minimo e i costi",
          obiettivo: "Scegli gli strumenti concreti, con occhio ai costi.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "strumenti",
              titolo: "Strumenti e costi",
              tipo: "tabella",
              prompt: "Per ogni funzione, quale strumento usi e quanto costa? Privilegia soluzioni no-code/economiche.",
              hint: "Esistono app di gestione consegne già pronte a canone basso: meglio che farsi un software su misura.",
              colonne: ["Funzione", "Strumento", "Costo"],
              minRighe: 3,
            },
          ],
          reazioneCliente:
            "Renzo torna sui soldi: «Quanto mi costa 'sta roba al mese? Perché se è un salasso, i pacchi li segno sul quaderno come ho sempre fatto». Apre di fatto la tappa sul risparmio.",
          revisioneFocus: [
            "Gli strumenti sono economici e già pronti (no-code)?",
            "I costi (canoni) sono chiari e sostenibili?",
            "Copre tutte le funzioni minime?",
            "Evita il software su misura inutile?",
          ],
        },
        {
          id: "risparmio",
          titolo: "Tappa 3 — Convincere Renzo che serve",
          obiettivo: "Dimostra il risparmio concreto in tempo ed errori.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "risparmio",
              titolo: "Il risparmio concreto",
              tipo: "testo_lungo",
              prompt: "Come dimostri a uno scettico che il sistema fa risparmiare (meno errori, meno telefonate, meno pacchi persi)?",
              hint: "Traduci in tempo e soldi: quante ore/telefonate/errori eviti a settimana.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo vuole la prova: «E 'sto affare mi fa risparmià davvero, o è solo 'na spesa in più che mi vendi bene?». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Il risparmio è tradotto in tempo e soldi concreti?",
            "Gli esempi sono credibili per una piccola impresa?",
            "Convince uno scettico, non un appassionato di tech?",
            "Il beneficio supera chiaramente il costo?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Renzo",
          obiettivo: "Convincilo che vale la pena, spiegandolo semplice. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "Il sistema, in parole semplici",
              tipo: "testo_lungo",
              prompt: "Funzioni, strumenti, costo e risparmio: spiegalo a Renzo come lo spiegheresti a chi non usa app.",
              hint: "Niente paroloni tech: cosa fa, quanto costa, quanto fa risparmiare.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Renzo valuta se la tecnologia gli conviene davvero: se sì, ci sta; se no, dice cosa non lo convince. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi è semplice, senza gergo tech?",
            "È chiaro cosa fa, quanto costa e quanto fa risparmiare?",
            "È adatta a chi non è tecnologico?",
            "È coerente con le tappe precedenti?",
          ],
        },
      ],
    },

    // ══════════════════════════════════════════════════════ SOSTENIBILITA (Sustainability manager)
    sostenibilita: {
      fasi: [
        {
          id: "emissioni",
          titolo: "Tappa 1 — Le emissioni evitate",
          obiettivo: "Calcola quanta CO₂ evita la conversione in un anno.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "co2",
              titolo: "Il calcolo delle emissioni",
              tipo: "testo_lungo",
              prompt: "Come stimi la CO₂ evitata passando dai furgoni alle cargo bike? Mostra il ragionamento con numeri di massima.",
              hint: "Km/anno per mezzo × emissioni furgone diesel al km, meno il quasi-zero della cargo bike elettrica.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo è pragmatico: «A me della CO₂ me ne frega il giusto. Dimmi piuttosto: 'sta cosa mi porta soldi o clienti?». Apre di fatto la tappa su bandi e incentivi.",
          revisioneFocus: [
            "Il calcolo della CO₂ è impostato in modo sensato?",
            "Parte da dati concreti (km, tipo di mezzo)?",
            "Collega la sostenibilità a un vantaggio pratico?",
            "È onesto, senza numeri gonfiati?",
          ],
        },
        {
          id: "bandi",
          titolo: "Tappa 2 — Bandi e incentivi",
          obiettivo: "Trova contributi pubblici reali per finanziare le cargo bike.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "bandi",
              titolo: "I contributi",
              tipo: "tabella",
              prompt: "Individua bandi/incentivi reali per cargo bike o logistica sostenibile, con importo e requisiti.",
              hint: "Contributi regionali per mezzi cargo (es. Emilia-Romagna 500-1.000€ a mezzo), incentivi comunali/logistica urbana.",
              colonne: ["Bando/incentivo", "Importo", "Requisiti"],
              minRighe: 2,
            },
          ],
          reazioneCliente:
            "Renzo drizza le orecchie sui soldi: «'Sti contributi da dove escono? E quanto ci metto a prenderli, con che carte?». Apre di fatto la tappa sul vantaggio commerciale.",
          revisioneFocus: [
            "I bandi/incentivi sono reali e pertinenti?",
            "Ci sono importo e requisiti per ognuno?",
            "Sono accessibili a una piccola impresa?",
            "Contribuiscono davvero a ridurre l'investimento?",
          ],
        },
        {
          id: "vantaggio",
          titolo: "Tappa 3 — Il vantaggio commerciale",
          obiettivo: "Trasforma la sostenibilità in un argomento che porta clienti.",
          giorniConsigliati: 4,
          cooldownGiorni: 2,
          chatMinima: 3,
          fiduciaMax: 25,
          sezioni: [
            {
              id: "vantaggio",
              titolo: "La sostenibilità che porta lavoro",
              tipo: "testo_lungo",
              prompt: "Come usi la consegna a zero emissioni per acquisire clienti (negozi green, e-commerce attenti, gare/appalti)?",
              hint: "Molti committenti oggi vogliono fornitori sostenibili: è un argomento di vendita, non solo etica.",
              minCaratteri: 300,
            },
          ],
          reazioneCliente:
            "Renzo diventa attento: «Quindi mi dici che coi cargo posso pure prendere clienti nuovi? Fammi capì come». Apre di fatto la tappa del pitch.",
          revisioneFocus: [
            "Collega la sostenibilità a nuovi clienti/ricavi, non solo all'etica?",
            "Gli esempi sono concreti (chi cerca fornitori green)?",
            "È credibile per il mercato di Torino?",
            "Dà a Renzo un motivo commerciale, non solo ambientale?",
          ],
        },
        {
          id: "pitch",
          titolo: "Tappa 4 — Il pitch a Renzo",
          obiettivo: "Convincilo che la sostenibilità è anche un affare. Ultimo passo.",
          giorniConsigliati: 3,
          cooldownGiorni: 2,
          chatMinima: 4,
          fiduciaMax: 25,
          ultima: true,
          sezioni: [
            {
              id: "sintesi",
              titolo: "La sostenibilità, in concreto",
              tipo: "testo_lungo",
              prompt: "CO₂ evitata, contributi ottenibili e clienti nuovi: spiega a Renzo perché conviene anche in termini di soldi.",
              hint: "Renzo non è un ambientalista: parlagli di incentivi e clienti, con la CO₂ come bonus.",
              minCaratteri: 400,
            },
          ],
          reazioneCliente:
            "Renzo valuta se la sostenibilità gli porta soldi e clienti: se sì, ci sta; se no, dice cosa non lo convince. Chiusura del percorso.",
          revisioneFocus: [
            "La sintesi tiene insieme emissioni, incentivi e vantaggio commerciale?",
            "Parla la lingua di Renzo (soldi e clienti)?",
            "I contributi e i benefici sono credibili?",
            "È coerente con le tappe precedenti?",
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
  "enoteca-centocelle": {
    cliente: "Gianni Tomassini, 52 anni, ex commercialista romano, parla in modo diretto e concreto, tipicamente romano.",
    vincoli:
      "Budget rigido di 80.000€ per l'apertura, non un euro di più. Vini solo naturali e biodinamici, nessuna etichetta convenzionale. Il nome e l'identità devono richiamare la tradizione romana, niente inglese o astratto. Niente soci né banche: i risparmi sono suoi. Diffidente verso proposte non motivate da dati reali.",
  },
  "cargo-bike-torino": {
    cliente: "Renzo Bertolotti, 47 anni, titolare di una piccola impresa di consegne a Torino (3 furgoni, 5 dipendenti), parla in modo pratico e un po' spiccio, da piemontese concreto.",
    vincoli:
      "Budget rigido di 60.000€ per la conversione, non un euro di più (ha già un mutuo, non si indebita oltre). Nessun licenziamento tra i 5 dipendenti. Non converte tutta la flotta: tiene almeno un furgone per il pesante e le consegne fuori centro. Il servizio di consegna non deve peggiorare rispetto ai furgoni, altrimenti i clienti se ne vanno. Diffida di chi vende sogni: vuole numeri concreti (km, tempi, ZTL, meteo di Torino).",
  },
};
