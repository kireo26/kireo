// LE VOCI DELL'AREA ADMIN (Mario, 31/10), nell'ordine suo: prima cosa aspetta
// te, poi i soggetti, poi le liste, poi la macchina.
//
// ⚠️ «Studenti» e «Docenti» non ci sono ancora, e non per dimenticanza: nascono
// con il terzo lotto, insieme alla funzione che restituisce solo numeri. Una
// voce che porta a una pagina vuota direbbe una cosa che non c'è. La
// dashboard delle statistiche viene alla fine, e non ha un posto qui.
export const VOCI_MENU_ADMIN: readonly { href: string; label: string }[] = [
  { href: "/admin", label: "Oggi" },
  { href: "/admin/notifiche", label: "Notifiche" },
  { href: "/admin/scuole", label: "Scuole" },
  { href: "/admin/enti", label: "Enti" },
  { href: "/admin/eventi", label: "Eventi" },
  { href: "/admin/post", label: "Post" },
  { href: "/admin/newsletter", label: "Newsletter" },
  { href: "/admin/sistema", label: "Sistema" },
];

// La finestra delle cose che sono successe (Notifiche) e dei guasti (Sistema):
// una sola, 30 giorni (Mario, 31/10). Un fatto del flusso invecchia; un guasto
// no, ma due finestre sono due cose da ricordare. Il totale si scrive sempre.
export const GIORNI_FINESTRA_ADMIN = 30;

/** L'istante da cui comincia la finestra: una funzione sola per i guasti e il flusso. */
export function inizioFinestraAdmin(adesso: Date = new Date()): string {
  return new Date(adesso.getTime() - GIORNI_FINESTRA_ADMIN * 86_400_000).toISOString();
}

// Quante righe per pagina negli elenchi con la ricerca. Il totale si scrive
// sempre: una schermata che mostra le ultime N senza dirlo nasconde.
export const RIGHE_PER_PAGINA_ADMIN = 50;
