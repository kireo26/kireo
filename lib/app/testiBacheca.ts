// I testi della Bacheca, in un posto solo. Miei e provvisori, da rileggere con
// Mario (28/10). Ognuno dice un fatto diverso, e nessuno ne afferma un altro:
// «non letta» non dice «non segui nessuno», e «nessun post» non dice che non
// segui nessun ente.
export const TESTI_BACHECA = {
  nonLetta: "Non siamo riusciti a leggere la tua Bacheca: ricarica la pagina.",
  nessunEnte: "Non segui ancora nessun ente. Qui compariranno i post di quelli che seguirai.",
  vaiAEsplora: "Trova gli enti da seguire",
  // Fino al 29/10 diceva «Gli enti che segui non hanno ancora pubblicato
  // niente.»: falso il giorno in cui KIREO toglie l'unico post di un ente. Dice
  // quello che lo studente vede, non cosa hanno fatto gli enti.
  nessunPost: "In Bacheca non c'è ancora nessun post degli enti che segui.",
  finiti: "Non ci sono altri post più vecchi.",
  piuVecchi: "Post più vecchi →",
  tornaAiRecenti: "← Torna ai più recenti",
  nienteAltro: "Non ci sono altri post.",
  // Il post di una notifica (`?post=`), 29/10.
  dallaNotifica: "Il post della notifica",
  postNonPiu: "Il post di questa notifica non è più in Bacheca: è stato tolto.",
  postNonLetto: "Non siamo riusciti a leggere il post di questa notifica: ricarica la pagina.",
} as const;
