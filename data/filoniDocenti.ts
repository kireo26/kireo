// I 5 filoni della formazione continua docenti (allineati all'enum SQL
// filone_docenti — lo slug qui DEVE coincidere esattamente col valore
// enum). Contenuto centralizzato: /per-i-docenti, /docente e ogni altro
// punto che li elenca legge da qui.

export type FiloneDocenti = {
  slug: "ai_didattica" | "valutazione_ai" | "etica_normativa" | "ai_burocrazia" | "orientamento_pcto";
  nome: string;
  descrizioneBreve: string;
};

export const FILONI_DOCENTI: FiloneDocenti[] = [
  {
    slug: "ai_didattica",
    nome: "AI nella didattica quotidiana",
    descrizioneBreve:
      "Creare esercizi, verifiche e materiali personalizzati con gli strumenti AI. Dalla teoria alla pratica: cosa funziona davvero in aula e cosa no.",
  },
  {
    slug: "valutazione_ai",
    nome: "Valutazione nell'era dell'AI",
    descrizioneBreve:
      "Se un tema si genera in pochi secondi, la verifica va ripensata: valutare il processo e il pensiero critico, non solo il prodotto.",
  },
  {
    slug: "etica_normativa",
    nome: "Etica, privacy e normativa",
    descrizioneBreve:
      "Cosa dicono le linee guida MIM e l'AI Act: cosa si può fare, cosa è vietato e come costruire una policy d'istituto.",
  },
  {
    slug: "ai_burocrazia",
    nome: "AI contro la burocrazia",
    descrizioneBreve:
      "Programmazioni, relazioni, comunicazioni, documentazione: come usare l'AI per alleggerire il carico amministrativo.",
  },
  {
    slug: "orientamento_pcto",
    nome: "Orientamento e PCTO",
    descrizioneBreve:
      "Strumenti pratici per accompagnare gli studenti nella scelta post-diploma e integrare l'orientamento nel percorso PCTO.",
  },
];

export function getFiloneBySlug(slug: string | null | undefined): FiloneDocenti | undefined {
  return FILONI_DOCENTI.find((f) => f.slug === slug);
}
