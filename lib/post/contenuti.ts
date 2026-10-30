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

// ⚠️ LO `https://` LO METTIAMO NOI (Mario, 30/10). La regola resta «solo
// https», intatta: cambia QUANDO si applica. Un ente scrive «www.davante.it»
// e lo trova scritto «https://www.davante.it»: quello che sistemiamo si vede,
// e quello che si salva è esattamente quello che l'ente legge nel campo.
// Un `http://` si alza a `https://` E SI DICE (`alzatoAHttps`), e non si
// verifica: nessuna richiesta parte verso l'indirizzo, da nessun punto. Si
// sistema quando si lascia il campo o si preme «Pubblica», mai mentre si
// scrive. Restano rossi, e non si sistema niente: uno spazio dentro, un
// indirizzo senza dominio, uno schema che non è una pagina web
// (javascript:, data:, file:, mailto:…). Un rosso per causa.
export type ErroreLink = "spazio" | "nonIndirizzo" | "schemaVietato";
export type EsitoLink =
  | { ok: true; url: string | null; alzatoAHttps: boolean }
  | { ok: false; errore: ErroreLink };

export function normalizzaLinkEsterno(testo: string): EsitoLink {
  const t = testo.trim();
  if (!t) return { ok: true, url: null, alzatoAHttps: false };
  if (/\s/.test(t)) return { ok: false, errore: "spazio" };
  let url: string;
  let alzatoAHttps = false;
  if (/^https:\/\//i.test(t)) url = t;
  else if (/^http:\/\//i.test(t)) {
    url = `https://${t.slice("http://".length)}`;
    alzatoAHttps = true;
  } else if (t.startsWith("//")) url = `https:${t}`;
  else {
    // Uno schema è una parola senza punti seguita da «:» e da qualcosa che non
    // è un numero di porta: «javascript:», «data:», «mailto:», «ftp://».
    // «davante.it:8080» e «localhost:3000» non lo sono (il primo ha un punto,
    // il secondo una porta), e cadono più sotto sulla regola dell'indirizzo.
    const schema = t.match(/^([a-z][a-z0-9+-]*):(?!\d)/i);
    if (schema) return { ok: false, errore: "schemaVietato" };
    url = `https://${t}`;
  }
  if (!linkEsternoValido(url)) return { ok: false, errore: "nonIndirizzo" };
  return { ok: true, url, alzatoAHttps };
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

// ⚠️ L'IMMAGINE DI UN POST NON SI TAGLIA (Mario, 30/10: «un'immagine
// tagliata da noi è un contenuto che abbiamo riscritto senza dirlo»: la
// locandina perde la data in basso, il manifesto il logo in alto). Mantiene le
// sue proporzioni, sempre; l'altezza ha un tetto, la larghezza non supera il
// post, e lo spazio che avanza resta vuoto. Mai `object-cover`, mai una
// larghezza e un'altezza fisse insieme. Una classe sola per il feed,
// l'archivio dello studente e la coda dell'admin: `npm run test:contenuti` §8
// pretende che tutte e tre la usino e che nessuna immagine di un post tagli.
export const CLASSE_IMMAGINE_POST = "mt-3 block h-auto max-h-[28rem] w-auto max-w-full rounded-xl";

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
  // Di Mario (30/10). Se a schermo, col posto nuovo nel menù, sembra superflua, si toglie.
  salvatoDove: "Lo ritrovi in Le mie cose.",
  salvaNonRiuscito: "Non è stato possibile salvarlo. Riprova.",
  togliNonRiuscito: "Non è stato possibile toglierlo. Riprova.",
  salvaNonVisibile: "Questo post non è più nel flusso: non si può salvare.",
  allegatoErrore: "Non siamo riusciti a preparare il file. Riprova fra poco.",
  allegatoNonDisponibile: "Questo file non è più disponibile.",
} as const;
