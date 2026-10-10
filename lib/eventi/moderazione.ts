// Chi può moderare la diretta di un evento, e cosa vede.
//
// ⚠️ UNA PAGINA PER DUE RUOLI, ed è un vincolo di Mario: «stessa pagina per
// ente e admin se possibile — due pagine gemelle divergono sempre». Quindi non
// `requireAdmin()` né `getEnteContext()`, che sono guardie di AREA e
// reindirizzano chi non è del loro ruolo: qui serve una guardia che ammetta
// tutti e due e dica QUALE dei due è, perché l'unica cosa che cambia fra loro è
// quali dati può portarsi via (vedi `parte`).
//
// ⚠️ LA VERA AUTORIZZAZIONE NON È QUI: le RPC della diretta
// (`conteggio_presenti_live`, `domande_live_organizzatore`,
// `chiudi_diretta_evento`, `esporta_*`) sono SECURITY DEFINER e rifiutano
// chiunque non sia admin o l'organizzatore. Questa funzione decide se la PAGINA
// si apre — cioè l'esperienza, non la protezione. Un `notFound()` invece di un
// redirect: chi non c'entra non deve nemmeno sapere che quell'evento esiste.

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Quale delle due parti sta moderando. Congelato nel nome come `certificata_da_tipo`. */
export type ParteModeratrice = "kireo" | "ente";

export type ContestoModerazione = {
  parte: ParteModeratrice;
  evento: {
    id: string;
    titolo: string;
    tipo: string;
    pubblico: string;
    filone: string | null;
    data_inizio: string;
    data_fine: string | null;
    stato: string;
    hosting_diretta: string | null;
    youtube_video_id: string | null;
    domanda_consegna: string | null;
    diretta_chiusa_il: string | null;
    diretta_chiusa_da_tipo: string | null;
    ore_pcto: number | null;
    organizzatore: string | null;
  };
};

export async function getContestoModerazione(eventoId: string): Promise<ContestoModerazione> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/accedi");

  const { data: profilo } = await supabase.from("profiles").select("ruolo").eq("id", user.id).maybeSingle();

  const { data: evento, error } = await supabase
    .from("eventi")
    .select(
      "id, titolo, tipo, pubblico, filone, data_inizio, data_fine, stato, hosting_diretta, youtube_video_id, domanda_consegna, diretta_chiusa_il, diretta_chiusa_da_tipo, ore_pcto, organizzatore_id, istituzioni(nome)",
    )
    .eq("id", eventoId)
    .maybeSingle();

  // ⚠️ UNA LETTURA FALLITA NON È UN EVENTO CHE NON ESISTE, e l'errore si
  // logga: un `notFound()` muto su un problema di rete manda a cercare un
  // evento che c'è.
  if (error) console.error("getContestoModerazione: lettura evento", error);
  if (!evento) notFound();

  let parte: ParteModeratrice | null = null;
  if (profilo?.ruolo === "admin") {
    parte = "kireo";
  } else if (profilo?.ruolo === "istituzione") {
    const { data: link } = await supabase
      .from("institution_profiles")
      .select("istituzione_id")
      .eq("user_id", user.id)
      .maybeSingle();
    // ⚠️ `=== organizzatore_id` e non `!==`: un confronto affermativo con un
    // `istituzione_id` nullo è falso, quindi fallisce CHIUSO — un `!==`
    // sarebbe NULL-unsafe nella direzione sbagliata, che è il difetto che in
    // questo progetto abbiamo ricacciato sette volte.
    if (link?.istituzione_id && link.istituzione_id === evento.organizzatore_id) parte = "ente";
  }
  if (!parte) notFound();

  const istituzione = Array.isArray(evento.istituzioni) ? evento.istituzioni[0] : evento.istituzioni;
  return {
    parte,
    evento: {
      id: evento.id,
      titolo: evento.titolo,
      tipo: evento.tipo,
      pubblico: evento.pubblico,
      filone: evento.filone,
      data_inizio: evento.data_inizio,
      data_fine: evento.data_fine,
      stato: evento.stato,
      hosting_diretta: evento.hosting_diretta,
      youtube_video_id: evento.youtube_video_id,
      domanda_consegna: evento.domanda_consegna,
      diretta_chiusa_il: evento.diretta_chiusa_il,
      diretta_chiusa_da_tipo: evento.diretta_chiusa_da_tipo,
      ore_pcto: evento.ore_pcto,
      organizzatore: istituzione?.nome ?? null,
    },
  };
}
