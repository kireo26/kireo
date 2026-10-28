// LE ETICHETTE DEI TRE GESTI VERSO UN ENTE (28/10, Mario: il §9). Una riga
// sotto ogni bottone, sulla pagina dell'ente, che dice cosa apre quel gesto:
// chi vede cosa, per quale canale. Testi miei e provvisori, da rileggere.
//
// Le tre cose che devono restare vere, perché sono fatti e non toni:
// - seguire porta i post nella Bacheca e, per gli enti con un piano a
//   pagamento, una notifica in KIREO (notifica_follower_*): «a volte», senza
//   dire perché, perché il piano di un ente non è un'informazione per lo
//   studente. Nessuna email;
// - la newsletter la manda KIREO, e l'indirizzo dello studente non passa
//   all'ente (la regola 2 del pacchetto legale, in CLAUDE.md). È l'unico dei
//   tre gesti dai 18 anni, e per una promessa della NOSTRA informativa, non
//   per una legge (lib/app/comunicazioniKireo.ts): lo si dice come un impegno
//   nostro, non come un limite di chi legge;
// - condividere il profilo mostra all'ente i campi che il pannello di
//   conferma elenca per intero prima del clic (ManifestazioneInteresseButton).
//   L'etichetta ne dice il cuore; il pannello resta il posto dove si leggono
//   tutti, e non si alleggerisce.
// Condividere e scrivere sono aperti dai 14 anni, cioè a chiunque possa
// iscriversi: non lo si scrive accanto, perché non distingue nessuno.
export const DIDASCALIA_SEGUI = "I suoi post nella tua Bacheca, e a volte una notifica qui. Nessuna email.";
export const DIDASCALIA_NEWSLETTER =
  "Le sue novità per email, mandate da KIREO: l'ente non vede il tuo indirizzo. Dai 18 anni, per un impegno nostro.";
// Dal 20261111100000 l'ente vede anche cosa hai fatto VERSO DI LUI (i suoi
// eventi a cui sei stato e quanto tempo ci hai passato, la sua guida scaricata): il pannello di
// conferma lo nomina, e la riga lo dice. Mai i test, le missioni, i workshop.
// «Può scriverti» era impreciso: l'ente non scrive per primo, risponde (la
// regola sta accanto a apri_conversazione_ente, 20261112100000).
export const DIDASCALIA_CONDIVIDI =
  "L'ente vede nome, scuola, le aree che hai scelto e cosa hai fatto verso di lui. I messaggi restano dentro KIREO, e li cominci tu.";

// A PROFILO GIÀ CONDIVISO la riga resta, e dice quello che sta succedendo
// adesso (Mario, 28/10: «l'unico momento in cui lo studente legge cosa
// condivide è quello in cui non condivide ancora» — non più). Due forme,
// perché chi ha condiviso prima del 20261111100000 ha dato un consenso più
// stretto, e l'ente per lui vede meno: la frase non promette più del vero.
export const DIDASCALIA_CONDIVISO_CON_ATTIVITA =
  "L'ente vede nome, scuola, le aree che hai scelto e cosa hai fatto verso di lui. Non vede test, missioni né workshop.";
export const DIDASCALIA_CONDIVISO_SENZA_ATTIVITA =
  "L'ente vede nome, scuola e le aree che hai scelto. Non vede test, missioni né workshop.";
