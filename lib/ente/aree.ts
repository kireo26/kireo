// LE AREE DI UN ENTE (Mario, 31/10): le sceglie l'ente e valgono subito; KIREO
// può toglierne una con un motivo (20261123110000). Testi miei e provvisori.

export function testoAreeEnte(massimo: number | null): string {
  const quante = massimo !== null ? `Fino a ${massimo} aree.` : "";
  return `${quante} Valgono subito: ti mettono in Esplora e nella pagina di ogni area che scegli, e lì possono comparire i tuoi post. Scegli solo le aree in cui lavori davvero: KIREO può toglierne una scelta a torto.`.trim();
}

export const TESTI_AREE_ENTE = {
  tolta: "Quest'area te l'ha tolta KIREO: per riaverla scrivici.",
  rigaTolta: (nome: string, motivo: string | null) => `Tolta da KIREO: ${nome}${motivo ? `. Il motivo: ${motivo}` : ""}`,
} as const;
