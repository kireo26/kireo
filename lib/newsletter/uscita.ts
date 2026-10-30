// I testi dell'uscita da una newsletter dalla posta (30/10). Miei e
// provvisori, da rileggere.
export const TESTI_USCITA = {
  titolo: "Esci dalla newsletter",
  domanda: (ente: string) =>
    `Non vuoi più ricevere la newsletter di ${ente}? Premi il bottone: smetti di riceverla, per email e dentro KIREO, e quelle già in coda per email non partono più.`,
  bottone: "Non voglio più riceverla",
  fatto: "Fatto: non ricevi più questa newsletter. Se cambi idea, puoi iscriverti di nuovo dalla pagina dell'ente.",
  sconosciuto:
    "Questo link non corrisponde più a un'iscrizione: forse l'uscita da questa newsletter c'è già stata. Le tue scelte le trovi nel tuo profilo su KIREO.",
  errore: "Non siamo riusciti a completare la richiesta. Riprova fra un momento.",
};
