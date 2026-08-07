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

export type TipoSezione = "testo" | "testo_lungo" | "tabella" | "checklist" | "scelta";

export type SezioneElaborato = {
  id: string;
  titolo: string;
  tipo: TipoSezione;
  prompt: string;
  hint?: string;
  // tipo 'testo' / 'testo_lungo'
  minCaratteri?: number;
  // tipo 'tabella': righe ripetibili, salvate come array di oggetti
  colonne?: string[];
  minRighe?: number;
  // tipo 'checklist': voci spuntabili, salvate come booleani + nota libera
  voci?: string[];
  // tipo 'scelta': opzioni + motivazione libera
  opzioni?: string[];
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
