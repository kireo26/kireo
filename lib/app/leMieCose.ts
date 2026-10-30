// «LE MIE COSE» (Mario, 30/10): quello che lo studente ha tenuto, cioè le
// guide degli enti che ha scaricato e i post che ha salvato. Stava in fondo a
// /app/guide, e lì un post salvato non lo cercava nessuno: lo stesso Mario,
// dopo aver premuto «Salva», non sapeva dove trovarlo.
//
// ⚠️ «GUIDE» NON SI È RINOMINATA, ed è una decisione presa misurando: /app/guide
// è il secondo passo del percorso (`lib/percorso/passi.ts`) e contiene le 18
// guide di KIREO con il cancello sui livelli. Quelle non sono «cose mie»: sono
// il gradino che lo studente deve ancora fare. Un nome giusto per metà dello
// schermo e sbagliato per l'altra metà è peggio di quello vecchio.
//
// Nel menù sta accanto alla Bacheca, non accanto a «Le mie attività»: le due
// voci cominciano uguale e non sono parenti (il tempo che hai speso, quello che
// hai tenuto). Il posto dice da sé dove finisce quello che si salva.

export const HREF_LE_MIE_COSE = "/app/le-mie-cose";

// Testi miei e provvisori, tranne `salvatoDove` (Mario, 30/10).
export const TESTI_LE_MIE_COSE = {
  etichetta: "Le mie cose",
  titolo: "Le mie cose",
  intestazione: "Quello che hai tenuto: le guide degli enti che hai scaricato e i post che hai salvato.",
  // Per chi arriva a /app/guide con un preferito o un link di prima: la
  // sezione non c'è più lì, e la riga dice dove è andata invece di saltare
  // altrove senza spiegazione.
  spostate: "Le guide degli enti che hai scaricato e i post che hai salvato ora stanno in Le mie cose.",
  vaiDiLa: "Vai a Le mie cose →",
} as const;
