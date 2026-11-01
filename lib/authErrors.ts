import type { AuthError } from "@supabase/supabase-js";

// I messaggi degli errori di Supabase Auth nei form di accesso, registrazione
// e reimpostazione della password.
//
// ⚠️ LA REGOLA DI QUESTO FILE (Mario, 01/11): «riprova fra poco» si dice SOLO
// quando riprovare fra poco può funzionare. Il caso che l'ha fissata: chi
// reimpostava la password scrivendo quella di prima leggeva «Qualcosa è andato
// storto. Riprova tra qualche istante.», cioè il consiglio di aspettare e poi
// rifare la stessa cosa, che fallisce identica perché è una regola, non un
// guasto. Quindi un rifiuto per una regola dice la regola; un guasto
// passeggero (rete, timeout, 5xx) dice di riprovare; un rifiuto che non
// riconosciamo NON promette che riprovare funzioni.

const MESSAGGI_PER_CODICE: Record<string, string> = {
  invalid_credentials: "Email o password non corretti.",
  email_not_confirmed: "Conferma prima la tua email: controlla la casella.",
  over_email_send_rate_limit: "Troppi tentativi: riprova tra qualche minuto.",
  over_request_rate_limit: "Troppi tentativi: riprova tra qualche minuto.",
  user_already_exists: "Esiste già un profilo con questa email: prova ad accedere.",
  email_exists: "Esiste già un profilo con questa email: prova ad accedere.",
  // Le regole della password (testi di Mario il primo, miei e provvisori gli altri).
  same_password: "La nuova password deve essere diversa da quella di prima.",
  email_address_invalid: "Questo indirizzo email non è valido: controlla di averlo scritto bene.",
  signup_disabled: "In questo momento le registrazioni sono chiuse.",
  // La sessione del link è finita mentre si compilava il modulo: riprovare
  // non serve, serve un link nuovo.
  session_not_found: "Il tuo accesso non è più valido. Chiedi un nuovo link da «Password dimenticata».",
  session_expired: "Il tuo accesso non è più valido. Chiedi un nuovo link da «Password dimenticata».",
};

// I motivi di una password debole come li manda Supabase (`WeakPasswordReasons`
// in @supabase/auth-js: length, characters, pwned). Testi miei e provvisori.
const MOTIVI_PASSWORD_DEBOLE: Record<string, string> = {
  length: "è troppo corta",
  characters: "deve contenere più tipi di caratteri: lettere minuscole e maiuscole, numeri e simboli",
  pwned: "compare in elenchi di password rubate, quindi non è sicura",
};

// I codici di un guasto passeggero: qui riprovare fra poco PUÒ funzionare.
const CODICI_PASSEGGERI = new Set(["unexpected_failure", "request_timeout", "hook_timeout", "hook_timeout_after_retry"]);

export const TESTO_GUASTO_PASSEGGERO = "Qualcosa è andato storto da parte nostra. Riprova tra qualche istante.";

// Un rifiuto che non riconosciamo: non sappiamo se riprovare serva, quindi non
// lo promettiamo, e diamo la strada che funziona sempre.
export const TESTO_RIFIUTO_SCONOSCIUTO =
  "La richiesta non è stata accettata, e non sappiamo dirti perché. Se ti succede di nuovo, scrivici da Contatti.";

function testoPasswordDebole(error: AuthError): string {
  const motivi = ((error as unknown as { reasons?: unknown }).reasons ?? []) as unknown[];
  const frasi = motivi
    .filter((m): m is string => typeof m === "string" && m in MOTIVI_PASSWORD_DEBOLE)
    .map((m) => MOTIVI_PASSWORD_DEBOLE[m]);
  if (frasi.length === 0) return "Questa password non è abbastanza sicura: scegline un'altra.";
  return `Questa password ${frasi.join("; inoltre ")}. Scegline un'altra.`;
}

// `error.code` è il modo stabile per riconoscere il caso; il controllo su
// `error.message`/`error.status` resta come rete per quando il code non arriva.
export function messaggioErroreAuth(error: AuthError): string {
  const codice = error.code ?? "";
  if (codice === "weak_password" || error.name === "AuthWeakPasswordError") return testoPasswordDebole(error);
  if (codice in MESSAGGI_PER_CODICE) return MESSAGGI_PER_CODICE[codice];
  if (CODICI_PASSEGGERI.has(codice)) return TESTO_GUASTO_PASSEGGERO;

  const messaggio = (error.message ?? "").toLowerCase();
  if (messaggio.includes("invalid login credentials")) return MESSAGGI_PER_CODICE.invalid_credentials;
  if (messaggio.includes("email not confirmed")) return MESSAGGI_PER_CODICE.email_not_confirmed;
  if (messaggio.includes("already registered") || messaggio.includes("already exists")) {
    return MESSAGGI_PER_CODICE.user_already_exists;
  }
  if (messaggio.includes("different from the old password")) return MESSAGGI_PER_CODICE.same_password;
  if (messaggio.includes("rate limit") || error.status === 429) {
    return MESSAGGI_PER_CODICE.over_email_send_rate_limit;
  }

  // Un guasto di rete (AuthRetryableFetchError, status 0) o del server (5xx)
  // è passeggero; un altro 4xx è un rifiuto, e riprovare identico non serve.
  const status = error.status ?? 0;
  if (error.name === "AuthRetryableFetchError" || status === 0 || status >= 500) return TESTO_GUASTO_PASSEGGERO;
  return TESTO_RIFIUTO_SCONOSCIUTO;
}
