// I link nelle email di Supabase Auth (reimpostare la password, confermare
// l'indirizzo) valgono una volta sola, ed è giusto. Quello che non era giusto
// (01/11, Mario: link di reset aperto una seconda volta dal telefono) è che
// un link consumato portasse al modulo di accesso SENZA UNA PAROLA: chi ci
// arriva ha appena chiesto aiuto per entrare, e la conclusione che trae è
// che KIREO non funziona.
//
// «Già usato» e «scaduto» NON si distinguono, e non per pigrizia: Supabase
// risponde con lo stesso errore (`otp_expired`, «link is invalid or has
// expired») in tutti e due i casi, sia da `verifyOtp` sia nel frammento
// `#error_code=…` del suo endpoint. Quanto vale un link è un'impostazione di
// Supabase (Authentication → Email → scadenza dell'OTP), che il repo non
// legge: la frase non dice un numero che non abbiamo misurato. Il giorno in
// cui il numero è letto, entra nella frase.
//
// I testi: `link_reset_usato` è di Mario; `link_scaduto` (conferma
// dell'indirizzo) è mio e provvisorio. ⚠️ Per la conferma NON esiste un modo
// di chiedere un link nuovo (nessun `auth.resend` nel codice): la frase di
// prima diceva «richiedi un nuovo link», che non si può fare. Ora dice la sola
// cosa vera: se l'indirizzo era già confermato, l'accesso funziona.

export const MESSAGGI_LINK_EMAIL: Record<string, string> = {
  link_reset_usato:
    "Questo link è già stato usato, oppure è scaduto. Chiedine un altro da «Password dimenticata».",
  link_scaduto:
    "Questo link è già stato usato, oppure è scaduto. Prova ad accedere: se l'indirizzo era già confermato, entri.",
  link_non_valido: "Il link non è valido. Riprova ad accedere.",
};

/** Il codice d'errore per un link fallito in /auth/confirm, secondo il tipo. */
export function erroreLinkFallito(tipo: string | null): "link_reset_usato" | "link_scaduto" {
  return tipo === "recovery" ? "link_reset_usato" : "link_scaduto";
}

/**
 * Supabase, quando il suo endpoint di verifica rifiuta un link, rimanda alla
 * pagina di destinazione con l'errore nel FRAMMENTO (`#error=…&error_code=…`),
 * che il server non vede. Un redirect lato server senza frammento lo conserva,
 * quindi arriva fino al modulo di accesso: qui lo si legge.
 */
export function erroreDalFrammento(frammento: string): "link_scaduto" | "link_non_valido" | null {
  const testo = frammento.startsWith("#") ? frammento.slice(1) : frammento;
  if (!testo) return null;
  const parametri = new URLSearchParams(testo);
  const codice = parametri.get("error_code");
  const errore = parametri.get("error");
  if (!codice && !errore) return null;
  return codice === "otp_expired" ? "link_scaduto" : "link_non_valido";
}
