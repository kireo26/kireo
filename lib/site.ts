// URL canonico del sito, usato per sitemap, robots, canonical, Open Graph
// e dati strutturati JSON-LD.
export const SITE_URL = "https://kireo.it";

/**
 * L'indirizzo pubblico di KIREO: quello che compare sul sito, quello a cui
 * rispondono le email di conferma, quello a cui rimandano i testi che si
 * scusano — e, dall'11/10/2026, **la casella da cui si risponde**: ogni avviso
 * interno arriva anche qui, perché il `Reply-To` recapita alla persona giusta
 * ma il mittente lo decide la casella in cui si legge (vedi `ORIGINI` in
 * `app/api/richiesta-contatto/route.ts`).
 *
 * Sta qui, accanto all'URL canonico, perché è l'altra coordinata pubblica del
 * prodotto — e perché al 10/10/2026 viveva in cinque posti: la pagina
 * /contatti, la route delle richieste, il rifiuto del limite di cortesia, il
 * template dell'email di conferma e la nota di «Scarica i miei dati». Cinque
 * copie di un indirizzo che un giorno cambia, e il giorno che cambia la
 * quinta la dimentica qualcuno.
 *
 * ⚠️ NON è l'indirizzo PERSONALE di Mario, che riceve una COPIA degli avvisi
 * interni: quello sta solo nella route, gira sul server e non compare in niente
 * che si renda — `npm run test:contatti` lo pretende.
 */
export const EMAIL_PUBBLICA = "info@kireo.it";
