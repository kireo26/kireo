import type { AuthError } from "@supabase/supabase-js";

const MESSAGGI_PER_CODICE: Record<string, string> = {
  invalid_credentials: "Email o password non corretti.",
  email_not_confirmed: "Conferma prima la tua email: controlla la casella.",
  over_email_send_rate_limit: "Troppi tentativi: riprova tra qualche minuto.",
  over_request_rate_limit: "Troppi tentativi: riprova tra qualche minuto.",
  user_already_exists: "Esiste già un profilo con questa email: prova ad accedere.",
  email_exists: "Esiste già un profilo con questa email: prova ad accedere.",
};

const FALLBACK = "Qualcosa è andato storto. Riprova tra qualche istante.";

// Messaggi chiari per i casi noti di errore di Supabase Auth nei form di
// accesso/registrazione. `error.code` è il modo stabile per riconoscere il
// caso (introdotto in @supabase/auth-js, non cambia tra versioni del
// messaggio testuale); il controllo su `error.message`/`error.status` resta
// come rete di sicurezza per i casi in cui il code non arrivi popolato. Il
// fallback generico è per errori sconosciuti.
export function messaggioErroreAuth(error: AuthError): string {
  if (error.code && error.code in MESSAGGI_PER_CODICE) {
    return MESSAGGI_PER_CODICE[error.code];
  }

  const messaggio = error.message.toLowerCase();
  if (messaggio.includes("invalid login credentials")) return MESSAGGI_PER_CODICE.invalid_credentials;
  if (messaggio.includes("email not confirmed")) return MESSAGGI_PER_CODICE.email_not_confirmed;
  if (messaggio.includes("already registered") || messaggio.includes("already exists")) {
    return MESSAGGI_PER_CODICE.user_already_exists;
  }
  if (messaggio.includes("rate limit") || error.status === 429) {
    return MESSAGGI_PER_CODICE.over_email_send_rate_limit;
  }

  return FALLBACK;
}
