import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { segnalaGuasto } from "@/lib/guasti/registra";
import { CAMPO_RITORNO, ritornoSicuro } from "@/lib/guide/scaricamento";

// IL FILE DI UN POST, SCARICATO DAL SERVER (30/10, 20261119110000). È la strada
// della guida (`app/api/scarica-guida/ente/[guidaId]`): il feed fa una POST
// qui, `registra_download_allegato` scrive la traccia se chi chiama è uno
// studente e solo DOPO si rimanda al file. Il perché dell'ordine sta in
// `lib/guide/scaricamento.ts`: quando un PDF sostituisce la pagina, il browser
// cancella quello che non è ancora partito.
//
// Il file viene dal database, mai dal corpo: dal form arriva solo l'id nel
// percorso. E il database non dà un indirizzo, dà il PERCORSO nello spazio
// dell'ente: l'indirizzo lo costruisce questa route, quindi nessun post può
// far scaricare un file da un posto qualunque.
//
// I post si leggono solo da collegati (la Bacheca sta in `/app`): senza una
// sessione si va ad accedere, e si torna alla Bacheca.
const PROCESSO = "scarica-allegato-post";

type Risposta = { stato?: string; percorso?: string };

function conEsito(percorso: string, esito: "errore" | "non_disponibile"): string {
  const [base, query = ""] = percorso.split("?");
  const qs = new URLSearchParams(query);
  qs.set("allegato", esito);
  return `${base}?${qs.toString()}#allegato`;
}

export async function POST(request: Request, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const form = await request.formData().catch(() => null);
  const ritorno = ritornoSicuro(form?.get(CAMPO_RITORNO) ?? "/app/bacheca");
  const torna = (esito: "errore" | "non_disponibile") => NextResponse.redirect(new URL(conEsito(ritorno, esito), request.url), 303);

  let percorso: string;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.redirect(new URL(`/accedi?redirectedFrom=${encodeURIComponent("/app/bacheca")}`, request.url), 303);
    }
    const { data, error } = await supabase.rpc("registra_download_allegato", { p_post: postId });
    if (error) throw error;
    const risposta = data as Risposta | null;
    if (risposta?.stato !== "ok" || !risposta.percorso) return torna("non_disponibile");
    percorso = risposta.percorso;
    const { data: pubblico } = supabase.storage.from("istituzioni-media").getPublicUrl(percorso);
    return NextResponse.redirect(pubblico.publicUrl, 303);
  } catch (errore) {
    await segnalaGuasto(
      { processo: PROCESSO, specie: "traccia_allegato", motivo: "funzione_non_riuscita", dettaglio: errore },
      "Errore [scarica-allegato-post]: registra_download_allegato non ha risposto, file non mandato —",
    );
    return torna("errore");
  }
}
