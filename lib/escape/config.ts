// KIREO Escape — contenuto delle missioni (client-safe: solo prompt, opzioni,
// etichette d'area; nessun numero di punteggio). La prima missione è
// "Il progetto per il quartiere": cross-area, così il primo giro fa un
// sondaggio ad ampio spettro sulle 18 aree invece di incanalare subito lo
// studente in un dominio. Le 5 stanze seguono il modello del design:
// problema → selezione informazioni → vincolo → decisione → riflessione.

import type { EscapeMission, Step } from "./tipi";

// area_slug usati (tutti presenti in data/aree.ts):
// salute-professioni-sanitarie, sicurezza-difesa, arte-design-moda,
// agrifood-ambiente, scienze-educazione, economia-management,
// energia-sostenibilita, informatica-digitale.
const PROGETTO_QUARTIERE: EscapeMission = {
  slug: "progetto-quartiere",
  titolo: "Il progetto per il quartiere",
  sottotitolo: "Uno spazio pubblico abbandonato da rigenerare",
  descrizione:
    "Nel tuo quartiere c'è uno spazio abbandonato: un ex mercato coperto, chiuso da anni. Il Comune ti affida un piccolo budget e ti chiede: cosa ne facciamo? Non c'è una risposta giusta — ci sono le tue scelte. Attraverserai cinque stanze e, alla fine, ti restituiremo qualche ipotesi su ciò che ti attiva di più. Nessun cronometro, nessuna sconfitta: puoi riprendere quando vuoi.",
  tipo: "cross-area",
  areeCandidate: [
    "salute-professioni-sanitarie",
    "sicurezza-difesa",
    "arte-design-moda",
    "agrifood-ambiente",
    "scienze-educazione",
    "economia-management",
    "energia-sostenibilita",
    "informatica-digitale",
  ],
  stanze: [
    {
      numero: 1,
      titolo: "Il problema",
      intro: "Prima di decidere cosa costruire, guarda bene cosa non funziona. Inquadrare il problema è già una scelta.",
      step: [
        {
          id: "s1_inquadra",
          stanza: 1,
          tipo: "scelta_singola",
          titolo: "Qual è, per te, il vero problema di questo spazio?",
          prompt: "Lo stesso spazio vuoto può essere letto in modi diversi. Da quale angolazione lo guardi tu?",
          hint: "Non ce n'è una giusta: la tua lettura orienta tutto il resto.",
          opzioni: [
            { id: "sicurezza", label: "È un luogo di degrado: poca sicurezza, la sera fa paura", areaSlug: "sicurezza-difesa", qualita: 0.6 },
            { id: "salute", label: "È uno spreco: potrebbe far muovere e stare bene la gente", areaSlug: "salute-professioni-sanitarie", qualita: 0.7 },
            { id: "cultura", label: "È un'occasione culturale persa per il quartiere", areaSlug: "arte-design-moda", qualita: 0.65 },
            { id: "ambiente", label: "È troppo cemento dove servirebbe verde e aria pulita", areaSlug: "agrifood-ambiente", qualita: 0.65 },
          ],
        },
        {
          id: "s1_priorita",
          stanza: 1,
          tipo: "ordina_priorita",
          titolo: "Ordina i bisogni del quartiere, dal più urgente",
          prompt: "Trascina in alto ciò che conta di più. Le prime scelte pesano di più.",
          elementi: [
            { id: "sport", label: "Un posto per fare sport e muoversi", areaSlug: "salute-professioni-sanitarie" },
            { id: "cultura", label: "Un luogo di cultura e ritrovo", areaSlug: "arte-design-moda" },
            { id: "verde", label: "Più verde e meno cemento", areaSlug: "agrifood-ambiente" },
            { id: "sicurezza", label: "Illuminazione e sicurezza la sera", areaSlug: "sicurezza-difesa" },
            { id: "ragazzi", label: "Un posto dove i ragazzi stiano il pomeriggio", areaSlug: "scienze-educazione" },
          ],
        },
      ],
    },
    {
      numero: 2,
      titolo: "Le informazioni",
      intro: "Hai tempo per aprire solo alcuni dossier prima di decidere. Su cosa vuoi saperne di più?",
      step: [
        {
          id: "s2_dossier",
          stanza: 2,
          tipo: "seleziona_informazioni",
          titolo: "Apri fino a 3 dossier",
          prompt: "Ogni dossier costa 1 punto-tempo, ne hai 3. Scegli su cosa informarti prima di progettare.",
          hint: "Ciò che scegli di approfondire dice dove va la tua curiosità.",
          budget: 3,
          dossier: [
            { id: "d_salute", label: "Dati su sedentarietà e salute nel quartiere", areaSlug: "salute-professioni-sanitarie", costo: 1 },
            { id: "d_econ", label: "Bilancio comunale e costi di gestione", areaSlug: "economia-management", costo: 1 },
            { id: "d_energia", label: "Riqualificazioni con energie rinnovabili", areaSlug: "energia-sostenibilita", costo: 1 },
            { id: "d_sociale", label: "Interviste ai residenti e ai ragazzi", areaSlug: "scienze-educazione", costo: 1 },
            { id: "d_verde", label: "Mappa del verde e della biodiversità urbana", areaSlug: "agrifood-ambiente", costo: 1 },
            { id: "d_tech", label: "Tecnologie smart per spazi pubblici", areaSlug: "informatica-digitale", costo: 1 },
            { id: "d_arte", label: "Storie di street art e centri culturali di quartiere", areaSlug: "arte-design-moda", costo: 1 },
          ],
        },
      ],
    },
    {
      numero: 3,
      titolo: "Il vincolo",
      intro: "Il budget è limitato e poi si riduce ancora. Qui non puoi avere tutto: devi scegliere e rinunciare.",
      step: [
        {
          id: "s3_budget",
          stanza: 3,
          tipo: "alloca_budget",
          titolo: "Distribuisci 100 punti-risorsa tra gli interventi",
          prompt: "Metti più risorse dove credi di più. Cerca di usarli quasi tutti, senza puntare tutto su una sola cosa.",
          hint: "Come distribuisci racconta le tue priorità concrete, non quelle a parole.",
          totale: 100,
          voci: [
            { id: "sport", label: "Area sportiva e attrezzi", areaSlug: "salute-professioni-sanitarie" },
            { id: "verde", label: "Verde e alberi", areaSlug: "agrifood-ambiente" },
            { id: "luce", label: "Illuminazione e sicurezza", areaSlug: "sicurezza-difesa" },
            { id: "palco", label: "Spazio culturale e palco", areaSlug: "arte-design-moda" },
            { id: "tech", label: "Punti tecnologici (wifi, ricarica)", areaSlug: "informatica-digitale" },
            { id: "solare", label: "Pannelli solari", areaSlug: "energia-sostenibilita" },
          ],
        },
        {
          id: "s3_taglio",
          stanza: 3,
          tipo: "scarta_opzione",
          titolo: "I fondi si riducono: elimina 2 interventi",
          prompt: "Rinuncia a 2 cose. Tieni ciò che per te è davvero essenziale.",
          hint: "Ciò che tieni conta più di ciò che togli.",
          daScartare: 2,
          opzioni: [
            { id: "sport", label: "Area sportiva e attrezzi", areaSlug: "salute-professioni-sanitarie", qualita: 0.8 },
            { id: "verde", label: "Verde e alberi", areaSlug: "agrifood-ambiente", qualita: 0.75 },
            { id: "luce", label: "Illuminazione e sicurezza", areaSlug: "sicurezza-difesa", qualita: 0.8 },
            { id: "palco", label: "Spazio culturale e palco", areaSlug: "arte-design-moda", qualita: 0.6 },
            { id: "tech", label: "Punti tecnologici (wifi, ricarica)", areaSlug: "informatica-digitale", qualita: 0.4 },
            { id: "solare", label: "Pannelli solari", areaSlug: "energia-sostenibilita", qualita: 0.55 },
          ],
        },
      ],
    },
    {
      numero: 4,
      titolo: "La decisione",
      intro: "È il momento di metterci la faccia. Prima dichiara quanto pensi di farcela, poi scrivi la tua proposta.",
      step: [
        {
          id: "s4_previsione",
          stanza: 4,
          tipo: "previsione_poi_esito",
          titolo: "Quanto pensi di aver fatto un buon progetto?",
          prompt: "Sposta il cursore: quanto convinceresti il quartiere con la tua proposta?",
          domanda: "La tua fiducia, prima di scrivere",
        },
        {
          id: "s4_decisione",
          stanza: 4,
          tipo: "decisione_scritta",
          titolo: "Scrivi la tua proposta per lo spazio",
          prompt:
            "Cosa realizzi in quell'ex mercato? Per chi? E perché proprio questo? Scrivilo come lo racconteresti a chi ci abita.",
          hint: "Non servono paroloni: concretezza e un perché sincero.",
          minCaratteri: 300,
        },
      ],
    },
    {
      numero: 5,
      titolo: "La riflessione",
      intro: "Ultimo passo: non sul quartiere, ma su di te. Cosa ti sei accorto di aver messo di tuo?",
      step: [
        {
          id: "s5_riflessione",
          stanza: 5,
          tipo: "riflessione",
          titolo: "Cosa hai scoperto su di te?",
          prompt:
            "Cosa ti ha attratto di più mentre progettavi? Cosa ti è venuto facile, cosa difficile? Scrivi due righe sincere.",
          hint: "Questa è la parte che resta tua: la salviamo nel tuo diario.",
          minCaratteri: 150,
        },
      ],
    },
  ],
};

export const MISSIONI: EscapeMission[] = [PROGETTO_QUARTIERE];

export function getMissione(slug: string): EscapeMission | undefined {
  return MISSIONI.find((m) => m.slug === slug);
}

// Elenco piatto degli step di una missione (comodo per il player e il motore).
export function stepDellaMissione(mission: EscapeMission): Step[] {
  return mission.stanze.flatMap((s) => s.step);
}
