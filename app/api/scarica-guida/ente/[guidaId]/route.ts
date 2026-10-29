import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { segnalaGuasto } from "@/lib/guasti/registra";
import { CAMPO_RITORNO, conEsito, destinatarioGuida, linkHttp, ritornoSicuro } from "@/lib/guide/scaricamento";
import { mandaEmailGuida } from "@/lib/guide/emailGuida";
import { contaScaricamentoSenzaAccesso } from "@/lib/guide/contatoreScaricamenti";

// LA GUIDA DI UN ENTE, SCARICATA DAL SERVER (29/10, 20261114100000). Il form
// della pagina pubblica fa una POST qui; questa route chiede a
// `registra_download_guida` il file e, se chi chiama è uno studente, la
// funzione scrive la traccia (recinto e scaricamento) PRIMA di rispondere.
// Solo dopo si rimanda al PDF. Il perché sta in `lib/guide/scaricamento.ts`.
//
// La guida e il suo link vengono dal database, mai dal corpo: dal form arriva
// solo l'id nel percorso, che è una chiave. La funzione filtra come la lettura
// pubblica (ente attivo, guida non archiviata).
//
// Chi non ha fatto l'accesso non esegue la funzione (20261114100000): per lui
// la guida si legge con la lettura pubblica, e lo scaricamento lo conta il
// server senza nessuna identità (`contaScaricamentoSenzaAccesso`, 20261115100000).
//
// Se il database non risponde, il file non parte e si torna alla pagina con un
// esito che lo dice: senza la funzione non sappiamo nemmeno quale file
// mandare. L'email parte dopo la risposta (`after`): il download non la aspetta.
const PROCESSO = "scarica-guida-ente";

type RispostaDownload = { stato?: string; pdf_url?: string; slug?: string; nome?: string };

export async function POST(request: Request, { params }: { params: Promise<{ guidaId: string }> }) {
  const { guidaId } = await params;
  const form = await request.formData().catch(() => null);
  const ritorno = ritornoSicuro(form?.get(CAMPO_RITORNO));
  const torna = (esito: Parameters<typeof conEsito>[1]) => NextResponse.redirect(new URL(conEsito(ritorno, esito), request.url), 303);

  let risposta = null as RispostaDownload | null;
  let emailAccount: string | null = null;
  let collegato = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    emailAccount = user?.email ?? null;
    collegato = Boolean(user);
    if (user) {
      const { data, error } = await supabase.rpc("registra_download_guida", { p_guida_id: guidaId });
      if (error) throw error;
      risposta = data as RispostaDownload | null;
    } else {
      // Senza accesso non c'è niente da scrivere: la guida si legge con la
      // lettura pubblica, che ha la stessa regola della funzione (ente attivo,
      // guida non archiviata). Una guida sostituita qui risulta «non
      // disponibile»: la policy non la mostra, e quindi nemmeno da dove veniva.
      const { data, error } = await supabase
        .from("guide_enti")
        .select("pdf_url, istituzioni(nome)")
        .eq("id", guidaId)
        .maybeSingle();
      if (error) throw error;
      const ente = data?.istituzioni as { nome?: string } | { nome?: string }[] | null | undefined;
      const nome = Array.isArray(ente) ? ente[0]?.nome : ente?.nome;
      risposta = data ? { stato: "ok", pdf_url: data.pdf_url as string, nome } : { stato: "non_trovata" };
    }
  } catch (errore) {
    await segnalaGuasto(
      { processo: PROCESSO, specie: "traccia_guida", motivo: "funzione_non_riuscita", dettaglio: errore },
      "Errore [scarica-guida-ente]: registra_download_guida non ha risposto, file non mandato —",
    );
    return torna("errore");
  }

  if (risposta?.stato === "non_pubblica" && risposta.slug) {
    return NextResponse.redirect(new URL(conEsito(`/istituzioni/${risposta.slug}`, "sostituita"), request.url), 303);
  }
  if (risposta?.stato !== "ok") return torna("non_disponibile");
  if (!linkHttp(risposta.pdf_url)) {
    // Un `pdf_url` che non è un indirizzo web: un dato da correggere, e un
    // rimbalzo verso uno schema qualunque non si fa.
    await segnalaGuasto(
      { processo: PROCESSO, specie: "traccia_guida", motivo: "link_non_ammesso", dettaglio: guidaId },
      "Errore [scarica-guida-ente]: la guida non ha un link http(s) —",
    );
    return torna("errore");
  }

  const destinatario = destinatarioGuida(emailAccount, form);
  if (!emailAccount && !destinatario) return torna("dati");
  const link = risposta.pdf_url.trim();
  // Chi ha fatto l'accesso l'ha già contato `registra_download_guida`; per chi
  // no lo conta il server, prima di rispondere (20261115100000).
  if (!collegato) await contaScaricamentoSenzaAccesso(PROCESSO, guidaId);
  if (destinatario) {
    const titolo = risposta.nome ? `Guida di ${risposta.nome}` : "La guida che hai scaricato";
    after(() => mandaEmailGuida(PROCESSO, destinatario, titolo, link));
  }
  return NextResponse.redirect(link, 303);
}
