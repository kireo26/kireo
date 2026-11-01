// IL MODULO DELL'INVITO DI UN TUTOR (passo 5.3, 01/11).
//
// Dal giro del 28/10 (Mario): «Nome e cognome» ed «Email (facoltativa, solo per
// tuo riferimento)» stavano affiancati, e si leggevano come «Nome | Cognome»:
// Mario ci ha scritto Anna e Montefusco. *Due riquadri vicini con un'etichetta
// corta e una lunga non si leggono: si guarda la forma, e la forma dice che è una
// coppia.* Ora stanno uno sotto l'altro, e l'etichetta del secondo dice cos'è.
//
// E l'email non la controllava nessuno, né qui né nel database; e «per tuo
// riferimento» non era vero, perché la pagina dello staff la leggeva e non la
// mostrava. Ora si controlla qui e in crea_invito_tutor (20261201120000), e sta
// sulla riga dell'invito in attesa. KIREO non la usa per scrivere a nessuno.
//
// La forma dell'email è la stessa del database: un controllo largo, non un
// giudizio sull'indirizzo (una @, un punto dopo, niente spazi).
export const FORMA_EMAIL_INVITO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const LUNGHEZZA_MASSIMA_NOME_INVITO = 120;

// Testi miei e provvisori.
export const TESTI_INVITO_TUTOR = {
  etichettaNome: "Nome e cognome del tutor",
  etichettaEmail: "La sua email (facoltativa)",
  notaEmail: "Solo per ricordarti a chi hai mandato l'invito: KIREO non la usa per scrivergli.",
  nomeMancante: "Scrivi nome e cognome del tutor da invitare.",
  nomeLungo: `Nome e cognome stanno in ${LUNGHEZZA_MASSIMA_NOME_INVITO} caratteri.`,
  emailNonValida: "Questa non sembra un'email: controllala, oppure lascia il campo vuoto.",
} as const;

export type ErroreInvito = keyof Pick<typeof TESTI_INVITO_TUTOR, "nomeMancante" | "nomeLungo" | "emailNonValida">;

export function erroreInvitoTutor(nome: string, email: string): ErroreInvito | null {
  const n = nome.trim();
  if (!n) return "nomeMancante";
  if (n.length > LUNGHEZZA_MASSIMA_NOME_INVITO) return "nomeLungo";
  const e = email.trim();
  if (e && !FORMA_EMAIL_INVITO.test(e)) return "emailNonValida";
  return null;
}
