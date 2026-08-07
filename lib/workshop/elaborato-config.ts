// Workshop 2.0 — schema dei contenuti dell'elaborato online, per workshop
// e per ruolo. Come per WORKSHOP_KIT in config.ts, lo schema vive qui in
// config TypeScript (si edita e si deploya senza migration): in DB
// (workshop_elaborati) vivono solo i dati dello studente.
//
// Fetta verticale: SOLO 'palestra-popolare' > 'salute' è implementato.
// Gli altri 4 workshop e gli altri 4 ruoli della palestra restano sul
// motore v1 (kit PDF + consegna file, vedi WORKSHOP_KIT/ConsegnaUpload) —
// non toccati in questo giro.

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
  consegna: string;
  giornoScadenza: number; // giorni da iscrizione.created_at (scadenza morbida, mai un blocco)
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
          id: "programma",
          titolo: "Incarico 1 — Il programma",
          consegna: "Costruisci il programma settimanale e definisci a chi si rivolge.",
          giornoScadenza: 4,
          sezioni: [
            {
              id: "programma_settimanale",
              titolo: "Il programma settimanale",
              tipo: "tabella",
              prompt: "Compila una riga per attività: quando, per chi, chi la conduce.",
              hint: "Pomeriggio per i ragazzi, sera per adulti e donne, mattina per gli anziani.",
              colonne: ["Giorno", "Orario", "Attività", "Fascia", "Chi conduce"],
              minRighe: 5,
            },
            {
              id: "inclusione",
              titolo: "Chi oggi non si muove",
              tipo: "testo",
              prompt: "Come porti dentro bambini, donne e anziani del quartiere?",
              hint: "Pensa a chi in un quartiere periferico non entrerebbe mai in palestra.",
              minCaratteri: 200,
            },
          ],
        },
        {
          id: "figure_sicurezza",
          titolo: "Incarico 2 — Figure e sicurezza",
          consegna: "Individua le figure necessarie e il protocollo di sicurezza.",
          giornoScadenza: 9,
          sezioni: [
            {
              id: "figure",
              titolo: "Le figure necessarie",
              tipo: "tabella",
              prompt: "Una riga per figura: qualifica richiesta, ore settimanali e costo annuo stimato.",
              hint: "Non dimenticare l'operatore BLSD.",
              colonne: ["Figura", "Qualifica", "Ore a settimana", "Costo annuo"],
              minRighe: 3,
            },
            {
              id: "sicurezza",
              titolo: "Checklist di sicurezza",
              tipo: "checklist",
              prompt: "Spunta le misure che il tuo programma prevede fin dal primo giorno.",
              voci: [
                "Certificato medico per ogni iscritto",
                "Defibrillatore in sala",
                "Operatore BLSD presente a ogni turno",
                "Cassetta di primo soccorso",
                "Registro infortuni",
              ],
            },
            {
              id: "protocollo_infortuni",
              titolo: "Protocollo infortuni",
              tipo: "testo",
              prompt: "Cosa fai, passo per passo, se un ragazzo si infortuna durante l'allenamento?",
            },
          ],
        },
        {
          id: "convinci_tonino",
          titolo: "Incarico 3 — Convinci Tonino",
          consegna: "Presenta il programma a Tonino con parole semplici e numeri chiave, poi consegna.",
          giornoScadenza: 14,
          sezioni: [
            {
              id: "sintesi",
              titolo: "La sintesi per Tonino",
              tipo: "testo_lungo",
              prompt: "In 5-6 righe, come presenti il programma a Tonino, con parole semplici e i numeri chiave?",
            },
          ],
        },
      ],
    },
  },
};

// Contesto sintetico del cliente per il tutor AI (§6 della spec): non il
// system prompt completo di WORKSHOP_CLIENTE_PROMPTS (troppo lungo da
// ripetere ad ogni richiesta di aiuto/revisione), solo un riassunto dei
// vincoli rigidi. Popolato per workshop, non per ruolo — il cliente è lo
// stesso per tutti i ruoli dello stesso progetto.
export const WORKSHOP_TUTOR_CONTESTO: Record<string, { cliente: string; vincoli: string }> = {
  "palestra-popolare": {
    cliente: "Tonino, 52 anni, ex pugile dilettante, terza media, parla in modo semplice e diretto.",
    vincoli:
      "Budget rigido di 30.000€, non un euro di più. I minori si allenano sempre gratis, non si tocca. Le quote degli adulti restano basse (circa 20€/mese). Non deve diventare una palestra fitness commerciale: niente abbonamenti col tornello, niente selezione all'ingresso.",
  },
};
