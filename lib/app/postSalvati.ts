// I POST CHE UNO STUDENTE HA SALVATO (30/10, 20261119110000). Stanno nello
// stesso archivio delle guide degli enti (`/app/guide`): «un archivio solo
// dello studente» (Mario). La regola è la stessa delle guide: il gesto dello
// studente resta. La riga è una copia fatta dal database al momento del
// salvataggio, e un post tolto dal flusso, di un ente che non è più attivo, o
// cancellato, resta qui con la data e il perché.
//
// ⚠️ UNA SCELTA MIA, DA CONFERMARE: di un post che non è più nel flusso resta
// il testo, e NON l'immagine, il link né il file. KIREO toglie un post perché
// qualcosa non va, e quel qualcosa può essere proprio l'immagine o il link:
// mostrarli dall'archivio annullerebbe la rimozione per chi l'aveva salvato. E
// il perché di una rimozione resta quello che KIREO ha scritto all'ente: qui
// si dice che è stato tolto e quando, non il motivo.

import { formattaData } from "@/lib/formato";

export type StatoPostSalvato = "visibile" | "tolto" | "non_visibile" | "ente_non_attivo" | "cancellato";

export type PostSalvato = {
  salvataggioId: string;
  postId: string | null;
  enteNome: string;
  istituzioneSlug: string | null;
  tipo: "testo" | "immagine" | "file" | "link_social";
  corpo: string;
  immagineUrl: string | null;
  linkUrl: string | null;
  linkTitolo: string | null;
  linkRiga: string | null;
  allegatoNome: string | null;
  pubblicatoIl: string | null;
  salvatoIl: string;
  stato: StatoPostSalvato;
  toltoIl: string | null;
};

type Rpc = {
  rpc: (fn: "post_salvati_miei") => PromiseLike<{ data: unknown; error: unknown }>;
};

const STATI: readonly string[] = ["visibile", "tolto", "non_visibile", "ente_non_attivo", "cancellato"];
const TIPI: readonly string[] = ["testo", "immagine", "file", "link_social"];
const testo = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/**
 * Le righe di chi chiede. `null` vuol dire NON LETTO (errore, o una riga che
 * non ha la forma attesa): non è «non hai salvato niente».
 */
export async function leggiPostSalvatiMiei(supabase: Rpc): Promise<PostSalvato[] | null> {
  try {
    const { data, error } = await supabase.rpc("post_salvati_miei");
    if (error || !Array.isArray(data)) return null;
    const righe: PostSalvato[] = [];
    for (const r of data as Record<string, unknown>[]) {
      if (
        typeof r?.salvataggio_id !== "string" || typeof r.ente_nome !== "string" || typeof r.corpo !== "string" ||
        typeof r.salvato_il !== "string" || typeof r.stato !== "string" || !STATI.includes(r.stato) ||
        typeof r.tipo !== "string" || !TIPI.includes(r.tipo)
      ) {
        return null;
      }
      const stato = r.stato as StatoPostSalvato;
      const visibile = stato === "visibile";
      righe.push({
        salvataggioId: r.salvataggio_id,
        postId: testo(r.post_id),
        enteNome: r.ente_nome,
        istituzioneSlug: testo(r.istituzione_slug),
        tipo: r.tipo as PostSalvato["tipo"],
        corpo: r.corpo,
        // Di un post che non è più nel flusso resta il testo: vedi la testa.
        immagineUrl: visibile ? testo(r.immagine_url) : null,
        linkUrl: visibile ? testo(r.link_url) : null,
        linkTitolo: testo(r.link_titolo),
        linkRiga: visibile ? testo(r.link_riga) : null,
        allegatoNome: testo(r.allegato_nome),
        pubblicatoIl: testo(r.pubblicato_il),
        salvatoIl: r.salvato_il,
        stato,
        toltoIl: testo(r.tolto_il),
      });
    }
    return righe;
  } catch {
    return null;
  }
}

// Testi miei e provvisori (30/10), da rileggere.
export const TESTI_POST_SALVATI = {
  titolo: "I post che hai salvato",
  nonLetto: "Non siamo riusciti a leggere i post che hai salvato: ricarica la pagina.",
  nessuno: "Non hai ancora salvato nessun post. In Bacheca, sotto ogni post, c'è «Salva».",
  riga: (p: PostSalvato) =>
    p.pubblicatoIl
      ? `${p.enteNome} · pubblicato il ${formattaData(p.pubblicatoIl, "long")} · salvato il ${formattaData(p.salvatoIl, "long")}`
      : `${p.enteNome} · salvato il ${formattaData(p.salvatoIl, "long")}`,
  /** Perché il post non è più nel flusso, o null se c'è ancora. */
  stato: (p: PostSalvato): string | null =>
    p.stato === "tolto"
      ? `KIREO l'ha tolto dal flusso${p.toltoIl ? ` il ${formattaData(p.toltoIl, "long")}` : ""}: qui resta il testo che avevi salvato.`
      : p.stato === "cancellato"
        ? "L'ente ha cancellato questo post: qui resta il testo che avevi salvato."
        : p.stato === "ente_non_attivo"
          ? "L'ente non è più su KIREO: qui resta il testo che avevi salvato."
          : p.stato === "non_visibile"
            ? "Questo post non è più nel flusso: qui resta il testo che avevi salvato."
            : null,
  togli: "Non salvarlo più",
  togliNonRiuscito: "Non è stato possibile toglierlo. Riprova.",
};
