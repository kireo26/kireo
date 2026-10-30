// I CONTENUTI DI UN POST DI UN ENTE (30/10, 20261119110000 e 20261120100000):
// il link, il file allegato, «salva». Solo funzioni pure e testi: le importano
// il form dell'ente e il feed dello studente, nel browser.
//
// ⚠️ IL TIPO «LINK SOCIAL» È USCITO (Mario, 30/10, guardando il form della
// scheda): se l'ente deve ricaricare la foto, scrivere un titolo e una riga,
// non sta condividendo un post, sta rifacendo un post normale con un link
// attaccato. Resta un LINK facoltativo su qualsiasi post (testo, immagine,
// file), di tutti i piani, e sotto il post un bottone che lo apre in una
// finestra nuova. Niente iframe, niente anteprima presa dalla piattaforma, e
// nessuna richiesta verso Instagram, Facebook o TikTok da nessun punto del
// progetto: `npm run test:contenuti` è rosso su una richiesta, verde su un link
// e su un nome (questo file vive di nomi).
// ⚠️ Il collegamento all'account Instagram di un ente (per prendere da lì i
// post) NON si costruisce: serve un account business, un'autorizzazione per
// ogni ente e l'approvazione dell'app da parte di Meta. È nei punti aperti di
// CLAUDE.md con la sua ragione.

// Lo specchio dell'espressione del vincolo `post_enti_link_esterno_https`
// (20261120100000): `npm run test:contenuti` pretende la stessa stringa. Solo
// https, un host con un punto, niente spazi: niente javascript:, data:, http.
export const SORGENTE_REGEX_LINK_ESTERNO = "^https://[a-z0-9-]+(\\.[a-z0-9-]+)+(:[0-9]+)?([/?#][^[:space:]]*)?$";
export const MAX_LINK_ESTERNO = 2000;

// La stessa regola in JavaScript: `[:space:]` è una classe POSIX che il motore
// di JS non conosce, e qui diventa `\s`.
const REGEX_LINK_ESTERNO = new RegExp(SORGENTE_REGEX_LINK_ESTERNO.replace("[^[:space:]]", "[^\\s]"), "i");

export function linkEsternoValido(url: string): boolean {
  const u = url.trim();
  return u.length <= MAX_LINK_ESTERNO && REGEX_LINK_ESTERNO.test(u);
}

export type Destinazione = "Instagram" | "Facebook" | "TikTok" | "sito";

/**
 * Dove porta un link, dal NOME dell'indirizzo e mai da quello che scrive
 * l'ente: un'etichetta scritta dall'ente potrebbe dire «Apri su Instagram» sopra
 * un link che porta altrove, ed è una promessa che non possiamo mantenere.
 * `null` per un indirizzo che non è un link valido: il feed non lo mostra.
 */
export function destinazioneDelLink(url: string | null | undefined): Destinazione | null {
  if (!url || !linkEsternoValido(url)) return null;
  const host = new URL(url.trim()).hostname.toLowerCase();
  const di = (dominio: string) => host === dominio || host.endsWith(`.${dominio}`);
  if (di("instagram.com")) return "Instagram";
  if (di("tiktok.com")) return "TikTok";
  if (di("facebook.com") || di("fb.watch")) return "Facebook";
  return "sito";
}

export function etichettaLink(d: Destinazione): string {
  return d === "sito" ? "Apri il sito" : `Apri su ${d}`;
}

export const MAX_NOME_ALLEGATO = 200;

// ⚠️ UN'IMMAGINE DI UN POST SI MOSTRA SOLO SE STA NEL NOSTRO SPAZIO DEI FILE.
// `immagine_url` lo scrive il form dell'ente, cioè il client: un indirizzo
// qualunque (il server di un ente) farebbe di ogni apertura del feed una
// richiesta che porta fuori l'indirizzo IP di un minorenne. Il database non sa
// qual è il nostro dominio; il feed sì. Vale per le immagini di prima e per le
// schede di oggi.
export function immagineDelPost(url: string | null | undefined, baseSupabase: string | undefined): string | null {
  if (!url || !baseSupabase) return null;
  const prefisso = `${baseSupabase.replace(/\/$/, "")}/storage/v1/object/public/post-enti-media/`;
  return url.startsWith(prefisso) ? url : null;
}

/** Il nome del file come lo vede lo studente: quello che ha caricato l'ente, ripulito. */
export function nomeAllegato(nomeFile: string): string {
  const pulito = nomeFile.replace(/[\u0000-\u001f]/g, "").trim().slice(0, MAX_NOME_ALLEGATO);
  return pulito || "Documento.pdf";
}

/** Il percorso del PDF nello spazio dell'ente: la sua cartella, `post/`, un nome nostro. */
export function percorsoAllegato(istituzioneId: string, adesso: number): string {
  return `${istituzioneId}/post/allegato-${adesso}.pdf`;
}

// ⚠️ Testi miei e provvisori, tranne `fuoriDaKireo` (Mario, 30/10): lo
// studente sa dove va prima di premere, e «in una scheda nuova» risponde
// all'altra metà della domanda, «perdo quello che stavo guardando?».
export const TESTI_CONTENUTI = {
  fuoriDaKireo: "Si apre fuori da KIREO, in una scheda nuova.",
  scaricaFile: "Scarica il file",
  salva: "Salva",
  salvato: "Salvato ✓ — Togli",
  salvatoDove: "Lo ritrovi in Guide, fra i post che hai salvato.",
  salvaNonRiuscito: "Non è stato possibile salvarlo. Riprova.",
  togliNonRiuscito: "Non è stato possibile toglierlo. Riprova.",
  salvaNonVisibile: "Questo post non è più nel flusso: non si può salvare.",
  allegatoErrore: "Non siamo riusciti a preparare il file. Riprova fra poco.",
  allegatoNonDisponibile: "Questo file non è più disponibile.",
} as const;
