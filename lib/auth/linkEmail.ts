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
  // Il link è buono, ma è stato aperto in un browser diverso da quello in cui
  // è stato chiesto: con il modello predefinito di Supabase il codice del link
  // si scambia per una sessione solo lì (vedi `instradaCodiceEmail`). Dire
  // «scaduto» qui sarebbe falso, e l'utente smetterebbe di riprovare.
  // Testi miei e provvisori.
  link_reset_altro_browser:
    "Questo link va aperto nel browser da cui hai chiesto di reimpostare la password. Aprilo lì, oppure chiedine un altro da «Password dimenticata» su questo dispositivo.",
  link_conferma_altro_browser:
    "Questo link è stato aperto in un browser diverso da quello da cui hai fatto la registrazione. Prova ad accedere con email e password: se l'indirizzo risulta confermato, entri.",
};

/**
 * ⚠️ IL RECUPERO PASSWORD NON FUNZIONAVA PER NESSUNO CHE NE AVESSE BISOGNO
 * (misurato da Mario il 01/11, in incognito: email ricevuta, bottone premuto,
 * modulo di accesso). Con il modello predefinito dell'email
 * (`{{ .ConfirmationURL }}`) Supabase verifica il link sul suo server e poi
 * rimanda alla pagina scelta con `?code=…`: un codice che diventa una sessione
 * SOLO se qualcuno lo scambia (`exchangeCodeForSession`). Nel nostro codice
 * non lo scambiava nessuno, e `/reimposta-password` senza sessione rimandava
 * all'accesso: funzionava solo a chi era già collegato, cioè a nessuno che
 * avesse dimenticato la password. Lo stesso per la conferma dell'indirizzo,
 * che atterra su `/app` o `/dopo-accesso`.
 *
 * Qui si decide dove va un `?code=` che arriva su una di quelle pagine: a
 * `/auth/confirm`, che lo scambia e poi fa quello che fa per un `token_hash`.
 * Il tipo lo dice la pagina d'arrivo, perché è l'unica cosa che Supabase
 * conserva della nostra richiesta (`redirectTo`/`emailRedirectTo`).
 *
 * ⚠️ Il limite, ed è di Supabase (PKCE): il codice si scambia solo nel browser
 * che ha chiesto il link, perché lì sta il «code verifier» in un cookie.
 * Aperto da un altro dispositivo non diventa una sessione, e lo si dice
 * (`link_*_altro_browser`), non lo si chiama scaduto. La strada che vale da
 * qualunque dispositivo è il modello dell'email con `token_hash`
 * (`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`), che
 * `/auth/confirm` sa già verificare: è un'impostazione del cruscotto.
 */
const ARRIVI_CON_CODICE: Record<string, "recovery" | "signup"> = {
  "/reimposta-password": "recovery",
  "/app": "signup",
  "/dopo-accesso": "signup",
};

export function instradaCodiceEmail(pathname: string, parametri: URLSearchParams): string | null {
  const codice = parametri.get("code");
  const tipo = ARRIVI_CON_CODICE[pathname];
  if (!codice || !tipo) return null;
  const q = new URLSearchParams({ code: codice, type: tipo, next: pathname });
  return `/auth/confirm?${q.toString()}`;
}

/** Lo scambio fallito perché il link è stato aperto in un altro browser. */
export function erroreScambioFallito(
  tipo: string | null,
  codiceErrore: string | undefined,
): "link_reset_usato" | "link_scaduto" | "link_reset_altro_browser" | "link_conferma_altro_browser" {
  if (codiceErrore === "pkce_code_verifier_not_found") {
    return tipo === "recovery" ? "link_reset_altro_browser" : "link_conferma_altro_browser";
  }
  return erroreLinkFallito(tipo);
}

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
