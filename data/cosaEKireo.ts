// Contenuto dei 3 blocchi "Per chi è KIREO" (studenti/scuola/docenti),
// centralizzato qui perché riusato sia dalla Homepage sia dalle landing
// del funnel scuole (/dirigenti, /scuole) — "riusare i contenuti reali del
// sito", non inventare nuovo copy per le landing.
export type BloccoPubblico = {
  tag: string;
  tagClass: string;
  titolo: string;
  testo: string;
  lista: string[];
  cta: string;
  href: string;
};

export const PUBBLICI: BloccoPubblico[] = [
  {
    tag: "Per gli studenti",
    tagClass: "bg-kireo-green/15 text-kireo-green-light",
    titolo: "Scopri chi sei. Scegli con chiarezza.",
    testo:
      "Un percorso di orientamento personalizzato e gratuito che fa emergere le tue attitudini — e ti mostra le direzioni coerenti con te, che siano studio o lavoro.",
    lista: [
      "Percorso di orientamento su misura",
      "Test, guide, webinar, workshop e sfide",
      "Un assistente digitale sempre disponibile per le tue domande",
      "Ore PCTO certificate mentre ti orienti",
    ],
    cta: "Inizia il tuo percorso →",
    href: "/per-gli-studenti",
  },
  {
    tag: "Per le scuole",
    tagClass: "bg-kireo-orange/15 text-kireo-orange",
    titolo: "Il PCTO che si gestisce da solo.",
    testo:
      "Un servizio di orientamento certificato e gratuito per la tua scuola: gli studenti maturano ore PCTO, i docenti monitorano, la segreteria riceve tutto automaticamente.",
    lista: [
      "Percorsi validi come PCTO, in digitale",
      "Giustificativi generati automaticamente",
      "Dashboard docente con statistiche",
      "Zero costi, oggi e domani",
    ],
    cta: "Scopri il servizio →",
    href: "/per-le-scuole",
  },
  {
    tag: "Per i docenti",
    tagClass: "bg-kireo-logo/15 text-kireo-logo",
    titolo: "L'aggiornamento che ti serve. Gratis.",
    testo:
      "L'AI sta cambiando la scuola e la formazione è ormai un obbligo. Iscrivendoti a KIREO hai formazione continua di qualità, senza costi e senza vincoli.",
    lista: [
      "Webinar mensili con attestato di partecipazione",
      "Guide e materiali pronti per l'aula, scaricabili",
      "Newsletter mensile su AI e scuola",
      "Una community di colleghi che innovano",
    ],
    cta: "Entra in KIREO →",
    href: "/per-i-docenti#entra-in-kireo",
  },
];
