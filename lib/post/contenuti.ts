// I CONTENUTI DI UN POST DI UN ENTE (30/10, 20261119110000): la scheda del
// link, il file allegato, «salva». Solo funzioni pure e testi: le importano il
// form dell'ente e il feed dello studente, nel browser.
//
// ⚠️ MAI UN IFRAME DI INSTAGRAM, FACEBOOK O TIKTOK (Mario, 30/10). Fino a oggi
// il feed caricava l'iframe della piattaforma al primo clic: un consenso che
// non sapeva di esserlo. Lo studente premeva per vedere un video, e con quel
// gesto si faceva vedere da Meta. Ora il post è una SCHEDA che compila l'ente
// (titolo, una riga, un'immagine, il link) e un bottone che apre il post sulla
// piattaforma, fuori da KIREO, quando è lo studente a volerlo. E nessuna
// richiesta verso quelle piattaforme, nemmeno dal nostro server: niente che si
// rompa quando cambiano le regole, niente immagine che scade.
// ⚠️ Il collegamento all'account Instagram di un ente (per prendere da lì la
// scheda) NON si costruisce: serve un account business, un'autorizzazione per
// ogni ente e l'approvazione dell'app da parte di Meta. È nei punti aperti di
// CLAUDE.md con la sua ragione; se torna la tentazione, la domanda è chi
// risponde quando Meta cambia le regole.

// Lo specchio dell'espressione del vincolo `post_enti_coerenza_tipo`
// (20261119110000): `npm run test:contenuti` pretende la stessa stringa.
export const SORGENTE_REGEX_LINK_SOCIALE = "^https://([a-z0-9-]+\\.)*(instagram\\.com|facebook\\.com|fb\\.watch|tiktok\\.com)/";
export const REGEX_LINK_SOCIALE = new RegExp(SORGENTE_REGEX_LINK_SOCIALE, "i");

export type Piattaforma = "Instagram" | "Facebook" | "TikTok";

export function piattaformaDelLink(url: string | null | undefined): Piattaforma | null {
  if (!url || !REGEX_LINK_SOCIALE.test(url.trim())) return null;
  const host = new URL(url.trim()).hostname.toLowerCase();
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return "Instagram";
  if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "TikTok";
  return "Facebook";
}

export const MAX_TITOLO_LINK = 120;
export const MAX_RIGA_LINK = 200;
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

// ⚠️ Testi miei e provvisori.
export const TESTI_CONTENUTI = {
  apriSu: (p: Piattaforma) => `Apri su ${p}`,
  fuoriDaKireo: "Si apre fuori da KIREO.",
  // Un link_social di prima del 30/10 non ha la scheda: resta il link.
  linkSenzaScheda: (p: Piattaforma | null) => (p ? `Un post su ${p}` : "Un post su un social"),
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
