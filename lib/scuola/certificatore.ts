// Chi ha certificato una presenza, detto alla scuola (01/11, passo 4).
//
// «Certificato» senza dire da chi non è un difetto piccolo (Mario): chi ha
// certificato è parte del fatto che diventa un'ora in un registro. Fino al
// 01/11 l'etichetta non conosceva `ente` (il CHECK di `certificata_da_tipo`
// ammette sistema, kireo, scuola, ente), e una presenza certificata dall'ente
// si leggeva «Certificato». ⚠️ Testi miei e provvisori.

export const ETICHETTA_CERTIFICATORE: Record<string, string> = {
  sistema: "Certificato automaticamente dalla presenza misurata",
  kireo: "Certificato da KIREO",
  scuola: "Certificato dalla tua scuola",
  ente: "Certificato dall'ente che ha organizzato l'incontro",
};

export function etichettaCertificatore(tipo: string | null | undefined): string {
  if (tipo && ETICHETTA_CERTIFICATORE[tipo]) return ETICHETTA_CERTIFICATORE[tipo];
  // Mai la parola nuda: un tipo che non conosciamo lo si dice.
  return tipo ? `Certificato (${tipo})` : "Certificato: chi l'ha certificato non è registrato";
}
